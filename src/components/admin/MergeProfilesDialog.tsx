import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  is_placeholder?: boolean | null;
  revsports_player_id?: string | null;
  street_address?: string | null;
  email?: string | null;
};

interface MergeProfilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileIdA?: string;
  profileIdB?: string;
  onSuccess: () => void;
}

type TeamMembershipRow = Database["public"]["Tables"]["team_memberships"]["Row"] & {
  teams?: {
    id: string;
    name: string;
    club_id: string | null;
    division_id: string | null;
    clubs?: {
      id: string;
      name: string;
      association_id: string | null;
      associations?: {
        id: string;
        name: string;
      } | null;
    } | null;
    divisions?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"] & {
  associations?: { name: string } | null;
  clubs?: {
    name: string;
    associations?: { name: string } | null;
  } | null;
  teams?: {
    name: string;
    clubs?: {
      name: string;
      associations?: { name: string } | null;
    } | null;
    divisions?: { name: string } | null;
  } | null;
};

interface SecondaryOrRoleItem {
  id: string;
  type: "secondary_membership" | "user_role";
  label: string;
  profileId: string;
  profileName: string;
  teamId?: string | null;
  role?: string | null;
  associationId?: string | null;
  clubId?: string | null;
  membershipType?: string | null;
  rawRow: unknown;
  isDuplicateOf?: string;
}

interface FieldConfig {
  key: keyof Profile;
  label: string;
  isSystem?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: "id", label: "ID", isSystem: true },
  { key: "email", label: "Email", isSystem: true },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "phone", label: "Phone" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "suburb", label: "Suburb" },
  { key: "avatar_url", label: "Avatar URL" },
  { key: "hockey_vic_number", label: "Hockey Vic Number" },
  { key: "emergency_contact_name", label: "Emergency Contact Name" },
  { key: "emergency_contact_phone", label: "Emergency Contact Phone" },
  { key: "is_umpire", label: "Is Umpire" },
  { key: "is_placeholder", label: "Is Placeholder" },
  { key: "revsports_player_id", label: "RevSports Player ID" },
  { key: "street_address", label: "Street Address" },
  { key: "created_at", label: "Created At", isSystem: true },
  { key: "updated_at", label: "Updated At", isSystem: true },
];

const formatProfileValue = (key: keyof Profile, val: unknown): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") {
    return val ? "Yes" : "No";
  }
  if (key === "date_of_birth" && typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = val.split("-");
    return `${day}/${month}/${year}`;
  }
  if ((key === "created_at" || key === "updated_at") && typeof val === "string") {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      }
    } catch (e) {
      // ignore
    }
  }
  return String(val);
};

interface TeamScopeInfo {
  name?: string | null;
  divisions?: { name: string } | null;
  clubs?: {
    name?: string | null;
    associations?: { name: string } | null;
  } | null;
}

const formatHierarchyPath = (teams: unknown): string => {
  if (!teams) return "Unknown Team";
  const t = teams as TeamScopeInfo;
  const assocName = t.clubs?.associations?.name;
  const clubName = t.clubs?.name;
  const divName = t.divisions?.name;
  const teamName = t.name || "Unknown Team";
  return [assocName, clubName, divName, teamName].filter(Boolean).join(" / ");
};

export const MergeProfilesDialog = ({
  open,
  onOpenChange,
  profileIdA,
  profileIdB,
  onSuccess,
}: MergeProfilesDialogProps) => {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Profile Rows
  const [profileA, setProfileA] = useState<Profile | null>(null);
  const [profileB, setProfileB] = useState<Profile | null>(null);

  // Merge config states
  const [keepSide, setKeepSide] = useState<"A" | "B" | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, "A" | "B">>({});

  // Emails and memberships states
  const [emails, setEmails] = useState<Record<string, string | null>>({});
  const [primaryTMA, setPrimaryTMA] = useState<TeamMembershipRow | null>(null);
  const [primaryTMB, setPrimaryTMB] = useState<TeamMembershipRow | null>(null);
  const [primaryChoice, setPrimaryChoice] = useState<"A" | "B" | null>(null);
  const [flatItems, setFlatItems] = useState<SecondaryOrRoleItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !profileIdA || !profileIdB) {
      // Reset state on close
      setProfileA(null);
      setProfileB(null);
      setKeepSide(null);
      setFieldValues({});
      setEmails({});
      setPrimaryTMA(null);
      setPrimaryTMB(null);
      setPrimaryChoice(null);
      setFlatItems([]);
      setCheckedItems({});
      setErrorMsg("");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        // Step A: Load profiles
        const { data: profiles, error: profError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", [profileIdA, profileIdB]);

        if (profError) throw profError;
        if (!profiles || profiles.length < 2) {
          throw new Error("Could not find both profiles in the database.");
        }

        const pA = profiles.find((p) => p.id === profileIdA) as Profile;
        const pB = profiles.find((p) => p.id === profileIdB) as Profile;

        if (!pA || !pB) {
          throw new Error("One or both profiles failed to map correctly.");
        }

        setProfileA(pA);
        setProfileB(pB);

        // Fetch emails from the Edge Function
        try {
          const { data: emailData, error: emailError } = await supabase.functions.invoke("get-user-emails", {
            body: { profileIds: [profileIdA, profileIdB] },
          });
          if (!emailError && emailData?.emails) {
            setEmails(emailData.emails);
          } else {
            console.warn("Edge Function returned error for emails:", emailError || emailData);
          }
        } catch (e) {
          console.error("Failed to load user emails from Edge Function:", e);
        }

        // Step B: Set keep side defaults
        const isAPlaceholder = pA.is_placeholder === true;
        const isBPlaceholder = pB.is_placeholder === true;

        let initialKeepSide: "A" | "B" | null = null;
        if (isAPlaceholder && !isBPlaceholder) {
          initialKeepSide = "B";
        } else if (isBPlaceholder && !isAPlaceholder) {
          initialKeepSide = "A";
        }
        setKeepSide(initialKeepSide);

        // Fetch memberships and roles
        const [membershipsRes, rolesRes] = await Promise.all([
          supabase
            .from("team_memberships")
            .select(`
              id,
              user_id,
              team_id,
              membership_type,
              status,
              created_at,
              teams (
                id,
                name,
                club_id,
                division_id,
                clubs (
                  id,
                  name,
                  association_id,
                  associations (
                    id,
                    name
                  )
                ),
                divisions (
                  id,
                  name
                )
              )
            `)
            .in("user_id", [profileIdA, profileIdB]),
          supabase
            .from("user_roles")
            .select(`
              id,
              user_id,
              role,
              association_id,
              club_id,
              team_id,
              created_at,
              associations ( name ),
              clubs (
                name,
                associations ( name )
              ),
              teams (
                name,
                clubs (
                  name,
                  associations ( name )
                ),
                divisions ( name )
              )
            `)
            .in("user_id", [profileIdA, profileIdB]),
        ]);

        if (membershipsRes.error) throw membershipsRes.error;
        if (rolesRes.error) throw rolesRes.error;

        const mData = membershipsRes.data || [];
        const rData = rolesRes.data || [];

        // Identify primary memberships
        const pTMA = mData.find((m) => m.user_id === profileIdA && m.membership_type === "PRIMARY") || null;
        const pTMB = mData.find((m) => m.user_id === profileIdB && m.membership_type === "PRIMARY") || null;
        setPrimaryTMA(pTMA as TeamMembershipRow);
        setPrimaryTMB(pTMB as TeamMembershipRow);

        if (pTMA && !pTMB) {
          setPrimaryChoice("A");
        } else if (pTMB && !pTMA) {
          setPrimaryChoice("B");
        } else if (pTMA && pTMB) {
          setPrimaryChoice(initialKeepSide);
        } else {
          setPrimaryChoice(null);
        }

        // Build list of secondary memberships and user roles
        const secondaryMemberships = mData.filter((m) => m.membership_type !== "PRIMARY");
        const userRoles = rData;

        const nameA = pA.first_name || pA.last_name ? `${pA.first_name || ""} ${pA.last_name || ""}`.trim() : "Profile A";
        const nameB = pB.first_name || pB.last_name ? `${pB.first_name || ""} ${pB.last_name || ""}`.trim() : "Profile B";

        const items: SecondaryOrRoleItem[] = [];

        secondaryMemberships.forEach((m) => {
          const path = formatHierarchyPath(m.teams);
          items.push({
            id: m.id,
            type: "secondary_membership",
            label: `${m.membership_type} Membership: ${path}`,
            profileId: m.user_id,
            profileName: m.user_id === profileIdA ? nameA : nameB,
            teamId: m.team_id,
            membershipType: m.membership_type,
            rawRow: m,
          });
        });

        userRoles.forEach((r) => {
          let path = "";
          if (r.team_id && r.teams) {
            path = ` (${formatHierarchyPath(r.teams)})`;
          } else if (r.club_id && r.clubs) {
            const assocName = r.clubs.associations?.name;
            const clubName = r.clubs.name;
            path = ` (${[assocName, clubName].filter(Boolean).join(" / ")})`;
          } else if (r.association_id && r.associations) {
            path = ` (${r.associations.name})`;
          }
          const label = `${r.role.replace(/_/g, " ")}${path}`;

          items.push({
            id: r.id,
            type: "user_role",
            label,
            profileId: r.user_id,
            profileName: r.user_id === profileIdA ? nameA : nameB,
            role: r.role,
            associationId: r.association_id,
            clubId: r.club_id,
            teamId: r.team_id,
            rawRow: r,
          });
        });

        // Scan for duplicates
        const isDuplicateItem = (item1: SecondaryOrRoleItem, item2: SecondaryOrRoleItem) => {
          if (item1.type !== item2.type) return false;
          if (item1.profileId === item2.profileId) return false;
          if (item1.type === "secondary_membership") {
            return item1.teamId === item2.teamId && item1.membershipType === item2.membershipType;
          } else {
            return (
              item1.role === item2.role &&
              item1.associationId === item2.associationId &&
              item1.clubId === item2.clubId &&
              item1.teamId === item2.teamId
            );
          }
        };

        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            if (isDuplicateItem(items[i], items[j])) {
              items[i].isDuplicateOf = items[j].id;
              items[j].isDuplicateOf = items[i].id;
            }
          }
        }

        // Initialize checked state
        const initialChecked: Record<string, boolean> = {};
        items.forEach((item) => {
          if (item.isDuplicateOf) {
            const matchesKeep = initialKeepSide ? (item.profileId === (initialKeepSide === "A" ? profileIdA : profileIdB)) : (item.profileId === profileIdA);
            initialChecked[item.id] = matchesKeep;
          } else {
            initialChecked[item.id] = true;
          }
        });

        setFlatItems(items);
        setCheckedItems(initialChecked);
      } catch (err) {
        console.error("Error loading merge data:", err);
        setErrorMsg(err instanceof Error ? err.message : "Failed to load profiles and memberships.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, profileIdA, profileIdB]);

  // When keepSide changes, set default field values to win from the keep side,
  // and default primaryChoice & checked duplicate items to the keep side.
  useEffect(() => {
    if (!keepSide) return;
    const initialValues: Record<string, "A" | "B"> = {};
    FIELDS.forEach((f) => {
      initialValues[f.key] = keepSide;
    });
    setFieldValues(initialValues);

    if (primaryTMA && primaryTMB) {
      setPrimaryChoice(keepSide);
    }

    setCheckedItems((prev) => {
      const updated = { ...prev };
      flatItems.forEach((item) => {
        if (item.isDuplicateOf) {
          const belongsToKeep = item.profileId === (keepSide === "A" ? profileIdA : profileIdB);
          updated[item.id] = belongsToKeep;
        }
      });
      return updated;
    });
  }, [keepSide, primaryTMA, primaryTMB, flatItems, profileIdA, profileIdB]);

  if (!profileIdA || !profileIdB) return null;

  const handleConfirmMerge = async () => {
    if (!profileA || !profileB || !keepSide) return;

    setSubmitting(true);
    setErrorMsg("");

    const p_keep_id = keepSide === "A" ? profileIdA : profileB.id;
    const p_merge_id = keepSide === "A" ? profileIdB : profileA.id;

    // Build p_field_choices: formatted as { "field_name": "keep" | "merge" }
    const p_field_choices: Record<string, "keep" | "merge"> = {};
    FIELDS.forEach((f) => {
      if (f.isSystem) return; // skip system fields
      const chosenSide = fieldValues[f.key];
      p_field_choices[f.key] = chosenSide === keepSide ? "keep" : "merge";
    });

    // Build p_conflict_resolutions
    const p_conflict_resolutions: {
      table: string;
      row_id_to_keep: string | null;
      row_id_to_delete: string;
    }[] = [];

    // 1. Primary Team memberships conflict resolution
    if (primaryTMA && primaryTMB) {
      const keepId = primaryChoice === "A" ? primaryTMA.id : primaryTMB.id;
      const deleteId = primaryChoice === "A" ? primaryTMB.id : primaryTMA.id;
      p_conflict_resolutions.push({
        table: "team_memberships",
        row_id_to_keep: keepId,
        row_id_to_delete: deleteId,
      });
    }

    // 2. Secondary & Roles resolutions
    const processedIds = new Set<string>();

    flatItems.forEach((item) => {
      if (processedIds.has(item.id)) return;

      const tbl = item.type === "secondary_membership" ? "team_memberships" : "user_roles";

      if (item.isDuplicateOf) {
        const other = flatItems.find((it) => it.id === item.isDuplicateOf)!;
        processedIds.add(item.id);
        processedIds.add(other.id);

        const isItem1Checked = checkedItems[item.id] !== false;
        const isItem2Checked = checkedItems[other.id] !== false;

        // If one is unchecked, send the resolution pair
        if (!isItem1Checked || !isItem2Checked) {
          const keepId = isItem1Checked ? item.id : other.id;
          const deleteId = isItem1Checked ? other.id : item.id;
          p_conflict_resolutions.push({
            table: tbl,
            row_id_to_keep: keepId,
            row_id_to_delete: deleteId,
          });
        }
      } else {
        // Standalone item: if unchecked, delete it
        if (checkedItems[item.id] === false) {
          p_conflict_resolutions.push({
            table: tbl,
            row_id_to_keep: null,
            row_id_to_delete: item.id,
          });
        }
      }
    });

    try {
      const { error } = await supabase.rpc("admin_merge_profiles", {
        p_keep_id,
        p_merge_id,
        p_field_choices,
        p_conflict_resolutions,
      });

      if (error) {
        const detailedError = [
          error.message,
          error.details ? `Details: ${error.details}` : null,
          error.hint ? `Hint: ${error.hint}` : null,
        ].filter(Boolean).join(" | ");
        throw new Error(detailedError);
      }

      toast({
        title: "Profiles Merged",
        description: "The duplicate profile has been safely merged and deleted.",
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      console.error("Merge error:", err);
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else if (typeof err === "object" && err !== null && "message" in err && typeof (err as Record<string, unknown>).message === "string") {
        setErrorMsg((err as Record<string, string>).message);
      } else {
        setErrorMsg(String(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderProfileSummary = (p: Profile | null, side: "A" | "B") => {
    if (!p) return null;
    const isKeep = keepSide === side;
    return (
      <Card className={`border-2 transition-all ${isKeep ? "border-primary bg-primary/5" : "border-border"}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={side} id={`keep-${side}`} />
              <Label htmlFor={`keep-${side}`} className="font-bold text-sm text-muted-foreground cursor-pointer">
                Profile {side}
              </Label>
            </div>
            <Badge variant={isKeep ? "default" : "outline"} className="text-xs">
              {isKeep ? "Keeping (Retained)" : "Merging Away (Deleted)"}
            </Badge>
          </div>
          <h3 className="font-semibold text-lg text-foreground truncate">
            {p.first_name || p.last_name ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "(No name)"}
          </h3>
          <p className="text-xs font-mono text-muted-foreground truncate">{p.id}</p>
          {p.is_placeholder && (
            <Badge variant="secondary" className="mt-2 bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
              Placeholder Record
            </Badge>
          )}
          <div className="mt-4">
            <Button
              type="button"
              variant={isKeep ? "default" : "outline"}
              className="w-full text-xs font-semibold"
              onClick={() => setKeepSide(side)}
            >
              Keep Profile {side}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderFieldPicker = () => {
    if (!profileA || !profileB) return null;
    return (
      <div className="border rounded-md divide-y overflow-hidden max-h-[50vh] overflow-y-auto">
        <div className="grid grid-cols-12 bg-muted/50 font-semibold text-xs py-2 px-3 sticky top-0 backdrop-blur">
          <div className="col-span-3 text-muted-foreground">Field</div>
          <div className="col-span-4 text-center text-muted-foreground">Profile A</div>
          <div className="col-span-1"></div>
          <div className="col-span-4 text-center text-muted-foreground">Profile B</div>
        </div>

        {FIELDS.map((f) => {
          const valA = formatProfileValue(f.key, f.key === "email" ? emails[profileIdA] : profileA[f.key]);
          const valB = formatProfileValue(f.key, f.key === "email" ? emails[profileB] : profileB[f.key]);
          const isIdentical = valA === valB;
          const choice = fieldValues[f.key];

          return (
            <div
              key={f.key}
              className={`grid grid-cols-12 items-center py-2 px-3 text-xs transition-colors hover:bg-muted/30 ${
                isIdentical && !f.isSystem ? "opacity-50 bg-muted/10" : ""
              }`}
            >
              {/* Field Label */}
              <div className="col-span-3 font-medium text-foreground pr-2 truncate">
                {f.label}
              </div>

              {/* Profile A Value Choice */}
              <div className="col-span-4">
                <Button
                  type="button"
                  variant={choice === "A" ? "default" : "outline"}
                  disabled={f.isSystem}
                  className={`w-full justify-start h-8 px-2 text-left font-normal text-xs truncate ${
                    choice === "A" ? "ring-2 ring-ring" : ""
                  }`}
                  onClick={() => !f.isSystem && setFieldValues((prev) => ({ ...prev, [f.key]: "A" }))}
                >
                  {valA || <span className="text-muted-foreground/50 italic">(empty)</span>}
                </Button>
              </div>

              {/* Divider Icon */}
              <div className="col-span-1 flex justify-center text-muted-foreground/40 font-mono">
                |
              </div>

              {/* Profile B Value Choice */}
              <div className="col-span-4">
                <Button
                  type="button"
                  variant={choice === "B" ? "default" : "outline"}
                  disabled={f.isSystem}
                  className={`w-full justify-start h-8 px-2 text-left font-normal text-xs truncate ${
                    choice === "B" ? "ring-2 ring-ring" : ""
                  }`}
                  onClick={() => !f.isSystem && setFieldValues((prev) => ({ ...prev, [f.key]: "B" }))}
                >
                  {valB || <span className="text-muted-foreground/50 italic">(empty)</span>}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPrimaryTeamSection = () => {
    if (!primaryTMA && !primaryTMB) return null;

    const pathA = primaryTMA ? formatHierarchyPath(primaryTMA.teams) : "";
    const pathB = primaryTMB ? formatHierarchyPath(primaryTMB.teams) : "";

    return (
      <div className="space-y-3">
        <h4 className="font-bold text-sm text-foreground flex items-center gap-1">
          Primary Team Membership
          <span className="text-xs font-normal text-muted-foreground">(Must choose one primary team)</span>
        </h4>
        <div className="border rounded-md divide-y overflow-hidden">
          <div className="grid grid-cols-12 bg-muted/50 font-semibold text-xs py-2 px-3">
            <div className="col-span-3 text-muted-foreground">Scope</div>
            <div className="col-span-4 text-center text-muted-foreground">Profile A Primary</div>
            <div className="col-span-1"></div>
            <div className="col-span-4 text-center text-muted-foreground">Profile B Primary</div>
          </div>
          <div className="grid grid-cols-12 items-center py-2 px-3 text-xs">
            <div className="col-span-3 font-medium text-foreground pr-2">
              Primary Team
            </div>
            <div className="col-span-4">
              {primaryTMA ? (
                <Button
                  type="button"
                  variant={primaryChoice === "A" ? "default" : "outline"}
                  disabled={!primaryTMB}
                  className={`w-full justify-start h-auto min-h-8 py-1.5 px-2 text-left font-normal text-xs whitespace-normal break-words ${
                    primaryChoice === "A" ? "ring-2 ring-ring" : ""
                  }`}
                  onClick={() => setPrimaryChoice("A")}
                >
                  {pathA}
                </Button>
              ) : (
                <div className="text-muted-foreground/50 italic px-2 py-1">No Primary Team</div>
              )}
            </div>
            <div className="col-span-1 flex justify-center text-muted-foreground/40 font-mono">
              |
            </div>
            <div className="col-span-4">
              {primaryTMB ? (
                <Button
                  type="button"
                  variant={primaryChoice === "B" ? "default" : "outline"}
                  disabled={!primaryTMA}
                  className={`w-full justify-start h-auto min-h-8 py-1.5 px-2 text-left font-normal text-xs whitespace-normal break-words ${
                    primaryChoice === "B" ? "ring-2 ring-ring" : ""
                  }`}
                  onClick={() => setPrimaryChoice("B")}
                >
                  {pathB}
                </Button>
              ) : (
                <div className="text-muted-foreground/50 italic px-2 py-1">No Primary Team</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDuplicatePairs = () => {
    const pairs: [SecondaryOrRoleItem, SecondaryOrRoleItem][] = [];
    const renderedIds = new Set<string>();

    flatItems.forEach((item) => {
      if (item.isDuplicateOf && !renderedIds.has(item.id)) {
        const other = flatItems.find((it) => it.id === item.isDuplicateOf);
        if (other) {
          pairs.push([item, other]);
          renderedIds.add(item.id);
          renderedIds.add(other.id);
        }
      }
    });

    if (pairs.length === 0) return null;

    return (
      <div className="space-y-3">
        <h5 className="font-semibold text-xs text-amber-800 dark:text-amber-400">Overlapping / Duplicate Roles & Memberships</h5>
        <div className="space-y-2">
          {pairs.map(([item1, item2]) => {
            return (
              <Card key={`${item1.id}-${item2.id}`} className="border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/10">
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                    {item1.type === "secondary_membership" ? "Duplicate Membership" : "Duplicate Role"}
                  </div>
                  <div className="text-xs text-foreground mb-2">
                    {item1.label.includes(":") ? item1.label.substring(item1.label.indexOf(":") + 1).trim() : item1.label}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2 border rounded p-2 bg-background">
                      <Checkbox
                        id={`chk-${item1.id}`}
                        checked={checkedItems[item1.id] || false}
                        onCheckedChange={(checked) => {
                          setCheckedItems((prev) => ({
                            ...prev,
                            [item1.id]: !!checked,
                            [item2.id]: !checked,
                          }));
                        }}
                      />
                      <Label htmlFor={`chk-${item1.id}`} className="text-xs cursor-pointer flex-1">
                        Keep from <span className="font-semibold">{item1.profileName}</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded p-2 bg-background">
                      <Checkbox
                        id={`chk-${item2.id}`}
                        checked={checkedItems[item2.id] || false}
                        onCheckedChange={(checked) => {
                          setCheckedItems((prev) => ({
                            ...prev,
                            [item2.id]: !!checked,
                            [item1.id]: !checked,
                          }));
                        }}
                      />
                      <Label htmlFor={`chk-${item2.id}`} className="text-xs cursor-pointer flex-1">
                        Keep from <span className="font-semibold">{item2.profileName}</span>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStandaloneItems = () => {
    const standalones = flatItems.filter((item) => !item.isDuplicateOf);
    if (standalones.length === 0) return null;

    return (
      <div className="space-y-2">
        <h5 className="font-semibold text-xs text-muted-foreground">Other Roles & Memberships (Standalone)</h5>
        <div className="border rounded-md divide-y bg-background">
          {standalones.map((item) => (
            <div key={item.id} className="flex items-center space-x-3 p-2.5 text-xs">
              <Checkbox
                id={`chk-${item.id}`}
                checked={checkedItems[item.id] !== false}
                onCheckedChange={(checked) => {
                  setCheckedItems((prev) => ({ ...prev, [item.id]: !!checked }));
                }}
              />
              <div className="flex-1 min-w-0">
                <Label htmlFor={`chk-${item.id}`} className="cursor-pointer font-medium text-foreground block">
                  {item.label}
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Currently belongs to <span className="font-semibold">{item.profileName}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderConfirmation = () => {
    if (!profileA || !profileB || !keepSide) return null;
    const keepProfile = keepSide === "A" ? profileA : profileB;
    const deleteProfile = keepSide === "A" ? profileB : profileA;

    return (
      <div className="space-y-6 pt-2">
        <div className="flex gap-3 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg items-start">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold mb-1">Permanent Deletion Warning</h4>
            <p className="text-xs opacity-90 leading-relaxed">
              This action is destructive and irreversible. You are merging the record for{" "}
              <strong className="underline font-bold">
                {deleteProfile.first_name || deleteProfile.last_name
                  ? `${deleteProfile.first_name || ""} ${deleteProfile.last_name || ""}`.trim()
                  : "(No name)"}
              </strong>{" "}
              into the record for{" "}
              <strong className="underline font-bold">
                {keepProfile.first_name || keepProfile.last_name
                  ? `${keepProfile.first_name || ""} ${keepProfile.last_name || ""}`.trim()
                  : "(No name)"}
              </strong>.
            </p>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden divide-y">
          <div className="grid grid-cols-2 p-3 text-xs bg-muted/40 font-semibold text-muted-foreground">
            <div>RETAINED PROFILE (KEEP)</div>
            <div>DELETED PROFILE (MERGE AWAY)</div>
          </div>
          <div className="grid grid-cols-2 p-4 text-xs gap-4">
            <div>
              <div className="font-bold text-sm text-foreground mb-1">
                {keepProfile.first_name || keepProfile.last_name
                  ? `${keepProfile.first_name || ""} ${keepProfile.last_name || ""}`.trim()
                  : "(No name)"}
              </div>
              <div className="font-mono text-muted-foreground text-[10px] truncate mb-2">{keepProfile.id}</div>
              <div className="space-y-0.5 text-muted-foreground">
                <div>Phone: <span className="text-foreground">{keepProfile.phone || "-"}</span></div>
                <div>Hockey Vic #: <span className="text-foreground">{keepProfile.hockey_vic_number || "-"}</span></div>
                {keepProfile.is_placeholder && (
                  <Badge variant="secondary" className="mt-1 bg-amber-50 text-amber-700 text-[10px]">Placeholder</Badge>
                )}
              </div>
            </div>
            <div>
              <div className="font-bold text-sm text-foreground mb-1 text-muted-foreground line-through">
                {deleteProfile.first_name || deleteProfile.last_name
                  ? `${deleteProfile.first_name || ""} ${deleteProfile.last_name || ""}`.trim()
                  : "(No name)"}
              </div>
              <div className="font-mono text-muted-foreground text-[10px] truncate mb-2">{deleteProfile.id}</div>
              <div className="space-y-0.5 text-muted-foreground">
                <div>Phone: <span className="text-foreground">{deleteProfile.phone || "-"}</span></div>
                <div>Hockey Vic #: <span className="text-foreground">{deleteProfile.hockey_vic_number || "-"}</span></div>
                {deleteProfile.is_placeholder && (
                  <Badge variant="secondary" className="mt-1 bg-amber-50 text-amber-700 text-[10px]">Placeholder</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center font-bold text-sm text-foreground py-2">
          Keeping {keepProfile.first_name || keepProfile.last_name ? `${keepProfile.first_name || ""} ${keepProfile.last_name || ""}`.trim() : "(No name)"}, deleting {deleteProfile.first_name || deleteProfile.last_name ? `${deleteProfile.first_name || ""} ${deleteProfile.last_name || ""}`.trim() : "(No name)"}. This cannot be undone.
        </div>
      </div>
    );
  };

  const getRoleDisplayName = (role: string) => {
    return role.replace(/_/g, " ");
  };

  const isReadyToMerge = !!keepSide && !(primaryTMA && primaryTMB && !primaryChoice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Merge Duplicate Profiles</DialogTitle>
            <Badge variant="outline" className="text-xs text-muted-foreground font-semibold">
              Super Admin Tool
            </Badge>
          </div>
          <DialogDescription>
            Safely combine duplicate profile records, merge field values, resolve conflicts, and automatically update reference keys.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading details and checking database for conflicts...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {errorMsg && (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="font-medium text-xs leading-relaxed">
                    <h5 className="font-bold text-sm mb-0.5">Error processing request</h5>
                    <p className="font-mono text-[11px] whitespace-pre-wrap">{errorMsg}</p>
                  </div>
                </div>
                {keepSide !== null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive/30 hover:bg-destructive/15 text-destructive bg-transparent hover:text-destructive"
                    onClick={handleConfirmMerge}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Try Again
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-6">
              {/* Step 1: Keep Side / Profile Cards */}
              <RadioGroup
                value={keepSide || ""}
                onValueChange={(val) => setKeepSide(val as "A" | "B")}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {renderProfileSummary(profileA, "A")}
                {renderProfileSummary(profileB, "B")}
              </RadioGroup>

              <Separator />

              {/* Step 2: Field Picker & Membership details */}
              {keepSide ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-foreground">Select field values to retain:</h4>
                    {renderFieldPicker()}
                  </div>

                  {/* Primary Team Membership section */}
                  {renderPrimaryTeamSection()}

                  {/* Secondary Team Memberships & Roles section */}
                  {flatItems.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-1">
                          Other Memberships & Roles
                          <span className="text-xs font-normal text-muted-foreground">(Check to retain, uncheck to delete)</span>
                        </h4>
                        {renderDuplicatePairs()}
                        {renderStandaloneItems()}
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Destructive confirmation warning */}
                  {renderConfirmation()}
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-sm">
                  Select which profile to keep at the top to customize fields, roles, and memberships.
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-4 gap-2 flex items-center justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="font-bold border border-destructive-foreground/10 px-6"
                onClick={handleConfirmMerge}
                disabled={submitting || !isReadyToMerge}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Merging Profiles...
                  </>
                ) : (
                  "Confirm Destructive Merge"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
