import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Loader2, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ScopeType = "ASSOCIATION" | "CLUB" | "DIVISION" | "TEAM";
type ModuleKey = "player_mvp" | "umpire_match_voting" | "committee" | "safety_risk" | "hockey_trace";
type ModuleFlag = Tables<"module_feature_flags">;
type TeamDivisionOption = Pick<Tables<"team_divisions">, "team_id" | "division_id">;

interface AssociationOption {
  id: string;
  name: string;
}

interface ClubOption {
  id: string;
  name: string;
  association_id: string;
}

interface DivisionOption {
  id: string;
  name: string;
  association_id: string;
}

interface TeamOption {
  id: string;
  name: string;
  club_id: string;
  division_id: string | null;
}

interface PendingOverride {
  moduleKey: ModuleKey;
  moduleLabel: string;
  enabled: boolean;
}

const MODULES: Array<{ key: ModuleKey; label: string; description: string; defaultEnabled: boolean }> = [
  {
    key: "player_mvp",
    label: "Player MVP Voting",
    description: "Player ballot, session and result workflows.",
    defaultEnabled: true,
  },
  {
    key: "umpire_match_voting",
    label: "Umpire Match Voting",
    description: "Official completed-fixture umpire ballots and results.",
    defaultEnabled: true,
  },
  {
    key: "committee",
    label: "Committee Management",
    description: "Committee positions, meetings, polls, decisions and private chat.",
    defaultEnabled: true,
  },
  {
    key: "safety_risk",
    label: "Risk & Quality Improvement",
    description: "Risk register, reviews, actions, QI items and Bright Ideas.",
    defaultEnabled: true,
  },
  {
    key: "hockey_trace",
    label: "Hockey Trace Lab",
    description: "Experimental trace playback and analysis tools.",
    defaultEnabled: false,
  },
];

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "The module controls could not be updated.";

export function ModuleControlsCard() {
  const { toast } = useToast();
  const {
    loading: scopeLoading,
    isSuperAdmin,
    scopedAssociationIds,
    scopedClubIds,
  } = useAdminScope();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [associations, setAssociations] = useState<AssociationOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<TeamDivisionOption[]>([]);
  const [flags, setFlags] = useState<ModuleFlag[]>([]);
  const [scopeType, setScopeType] = useState<ScopeType>("ASSOCIATION");
  const [associationId, setAssociationId] = useState("");
  const [clubId, setClubId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [resolvedStates, setResolvedStates] = useState<Partial<Record<ModuleKey, boolean>>>({});
  const [resolving, setResolving] = useState(false);
  const [savingKey, setSavingKey] = useState<ModuleKey | null>(null);
  const [pendingOverride, setPendingOverride] = useState<PendingOverride | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [associationResult, clubResult, divisionResult, teamResult, teamDivisionResult, flagResult] = await Promise.all([
      supabase.from("associations").select("id, name").order("name"),
      supabase.from("clubs").select("id, name, association_id").order("name"),
      supabase.from("divisions").select("id, name, association_id").order("name"),
      supabase.from("teams").select("id, name, club_id, division_id").order("name"),
      supabase.from("team_divisions").select("team_id, division_id"),
      supabase.from("module_feature_flags").select("*").order("module_key"),
    ]);
    const failure = [associationResult, clubResult, divisionResult, teamResult, teamDivisionResult, flagResult]
      .find((result) => result.error)?.error;
    if (failure) {
      setLoadError(failure.message);
      setLoading(false);
      return;
    }
    setAssociations(associationResult.data || []);
    setClubs(clubResult.data || []);
    setDivisions(divisionResult.data || []);
    setTeams(teamResult.data || []);
    setTeamDivisions(teamDivisionResult.data || []);
    setFlags(flagResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!scopeLoading) void loadData();
  }, [loadData, scopeLoading]);

  const manageableAssociationIds = useMemo(() => {
    if (isSuperAdmin) return new Set(associations.map((association) => association.id));
    const ids = new Set(scopedAssociationIds);
    clubs.forEach((club) => {
      if (scopedClubIds.includes(club.id)) ids.add(club.association_id);
    });
    return ids;
  }, [associations, clubs, isSuperAdmin, scopedAssociationIds, scopedClubIds]);

  const availableAssociations = useMemo(
    () => associations.filter((association) => manageableAssociationIds.has(association.id)),
    [associations, manageableAssociationIds],
  );

  useEffect(() => {
    if (!associationId && availableAssociations.length > 0) {
      setAssociationId(availableAssociations[0].id);
      setClubId("");
      setDivisionId("");
      setTeamId("");
    } else if (associationId && !availableAssociations.some((association) => association.id === associationId)) {
      setAssociationId(availableAssociations[0]?.id || "");
      setClubId("");
      setDivisionId("");
      setTeamId("");
    }
  }, [associationId, availableAssociations]);

  const handleAssociationChange = (value: string) => {
    setAssociationId(value);
    setClubId("");
    setDivisionId("");
    setTeamId("");
  };

  const canManageAssociation = isSuperAdmin || scopedAssociationIds.includes(associationId);
  const availableScopeTypes = useMemo<ScopeType[]>(
    () => canManageAssociation
      ? ["ASSOCIATION", "CLUB", "DIVISION", "TEAM"]
      : ["CLUB", "TEAM"],
    [canManageAssociation],
  );

  useEffect(() => {
    if (!availableScopeTypes.includes(scopeType)) {
      setScopeType(availableScopeTypes[0]);
      setClubId("");
      setDivisionId("");
      setTeamId("");
    }
  }, [availableScopeTypes, scopeType]);

  const availableClubs = useMemo(
    () => clubs.filter((club) =>
      club.association_id === associationId
      && (canManageAssociation || scopedClubIds.includes(club.id)),
    ),
    [associationId, canManageAssociation, clubs, scopedClubIds],
  );

  const associationDivisions = useMemo(
    () => divisions.filter((division) => division.association_id === associationId),
    [associationId, divisions],
  );

  const availableDivisions = useMemo(() => {
    if (scopeType !== "TEAM" || !clubId) return associationDivisions;
    const clubTeamIds = new Set(teams.filter((team) => team.club_id === clubId).map((team) => team.id));
    const clubDivisionIds = new Set(
      teamDivisions
        .filter((item) => clubTeamIds.has(item.team_id))
        .map((item) => item.division_id),
    );
    teams.forEach((team) => {
      if (team.club_id === clubId && team.division_id) clubDivisionIds.add(team.division_id);
    });
    return associationDivisions.filter((division) => clubDivisionIds.has(division.id));
  }, [associationDivisions, clubId, scopeType, teamDivisions, teams]);

  const availableTeams = useMemo(
    () => !clubId || !divisionId
      ? []
      : teams.filter((team) => team.club_id === clubId && (
        team.division_id === divisionId
        || teamDivisions.some((item) => item.team_id === team.id && item.division_id === divisionId)
      )),
    [clubId, divisionId, teamDivisions, teams],
  );

  useEffect(() => {
    if (clubId && !availableClubs.some((club) => club.id === clubId)) {
      setClubId("");
      setDivisionId("");
      setTeamId("");
    }
  }, [availableClubs, clubId]);

  useEffect(() => {
    if (divisionId && !availableDivisions.some((division) => division.id === divisionId)) {
      setDivisionId("");
      setTeamId("");
    }
  }, [availableDivisions, divisionId]);

  useEffect(() => {
    if (teamId && !availableTeams.some((team) => team.id === teamId)) setTeamId("");
  }, [availableTeams, teamId]);

  const handleScopeTypeChange = (value: string) => {
    const nextScopeType = value as ScopeType;
    setScopeType(nextScopeType);
    setClubId("");
    setDivisionId("");
    setTeamId("");
  };

  const handleClubChange = (value: string) => {
    setClubId(value);
    setDivisionId("");
    setTeamId("");
  };

  const handleDivisionChange = (value: string) => {
    setDivisionId(value);
    setTeamId("");
  };

  const selectedTeam = teams.find((team) => team.id === teamId);
  const selectedTeamMatchesScope = Boolean(selectedTeam && clubId && divisionId
    && selectedTeam.club_id === clubId
    && (selectedTeam.division_id === divisionId
      || teamDivisions.some((item) => item.team_id === selectedTeam.id && item.division_id === divisionId)));
  const selectedScopeId = scopeType === "ASSOCIATION"
    ? associationId
    : scopeType === "CLUB"
      ? clubId
      : scopeType === "DIVISION"
        ? divisionId
        : selectedTeamMatchesScope ? teamId : "";

  const selectedTeamClub = selectedTeamMatchesScope
    ? clubs.find((club) => club.id === clubId)
    : undefined;
  const selectedTeamDivision = selectedTeamMatchesScope
    ? divisions.find((division) => division.id === divisionId)
    : undefined;
  const selectedAssociation = associations.find((association) => association.id === associationId);
  const selectedScopeName = scopeType === "ASSOCIATION"
    ? selectedAssociation?.name
    : scopeType === "CLUB"
      ? clubs.find((club) => club.id === clubId)?.name
      : scopeType === "DIVISION"
        ? divisions.find((division) => division.id === divisionId)?.name
        : [selectedAssociation?.name, selectedTeamClub?.name, selectedTeamDivision?.name, selectedTeam?.name]
          .filter(Boolean)
          .join(" / ");

  const resolveStates = useCallback(async () => {
    if (!selectedScopeId) {
      setResolvedStates({});
      return;
    }
    const selectedClub = scopeType === "CLUB"
      ? clubs.find((club) => club.id === clubId)
      : scopeType === "TEAM"
        ? selectedTeamClub
        : undefined;
    const scopeAssociationId = scopeType === "ASSOCIATION"
      ? associationId
      : selectedClub?.association_id || associationId;
    const scopeClubId = selectedClub?.id;
    const scopeDivisionId = scopeType === "DIVISION"
      ? divisionId
      : scopeType === "TEAM" && selectedTeamMatchesScope
        ? divisionId
        : undefined;
    const scopeTeamId = scopeType === "TEAM" ? teamId : undefined;

    setResolving(true);
    const results = await Promise.all(MODULES.map(async (module) => {
      const { data, error } = await supabase.rpc("resolve_module_enabled", {
        p_module_key: module.key,
        p_association_id: scopeAssociationId || undefined,
        p_club_id: scopeClubId || undefined,
        p_division_id: scopeDivisionId || undefined,
        p_team_id: scopeTeamId || undefined,
      });
      if (error) throw error;
      return [module.key, data] as const;
    }));
    setResolvedStates(Object.fromEntries(results) as Record<ModuleKey, boolean>);
    setResolving(false);
  }, [associationId, clubId, clubs, divisionId, scopeType, selectedScopeId, selectedTeamClub, selectedTeamMatchesScope, teamId]);

  useEffect(() => {
    void resolveStates().catch((error: unknown) => {
      setResolving(false);
      toast({ title: "Module status unavailable", description: getErrorMessage(error), variant: "destructive" });
    });
  }, [flags, resolveStates, toast]);

  const exactFlagByModule = useMemo(() => new Map(
    flags
      .filter((flag) => flag.scope_type === scopeType && flag.scope_id === selectedScopeId)
      .map((flag) => [flag.module_key as ModuleKey, flag]),
  ), [flags, scopeType, selectedScopeId]);

  const saveOverride = async () => {
    if (!pendingOverride || !selectedScopeId) return;
    setSavingKey(pendingOverride.moduleKey);
    const { error } = await supabase.rpc("set_module_feature_flag", {
      p_module_key: pendingOverride.moduleKey,
      p_scope_type: scopeType,
      p_scope_id: selectedScopeId,
      p_enabled: pendingOverride.enabled,
      p_notes: `Set from Roles & modules for ${selectedScopeName || selectedScopeId}`,
    });
    if (error) {
      toast({ title: "Module setting not saved", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: `${pendingOverride.moduleLabel} ${pendingOverride.enabled ? "enabled" : "disabled"}`,
        description: `This ${scopeType.toLowerCase()} now overrides its parent setting.`,
      });
      await loadData();
    }
    setSavingKey(null);
    setPendingOverride(null);
  };

  const clearOverride = async (moduleKey: ModuleKey, moduleLabel: string) => {
    if (!selectedScopeId) return;
    setSavingKey(moduleKey);
    const { error } = await supabase.rpc("clear_module_feature_flag", {
      p_module_key: moduleKey,
      p_scope_type: scopeType,
      p_scope_id: selectedScopeId,
    });
    if (error) {
      toast({ title: "Inherited setting not restored", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${moduleLabel} now inherits`, description: "The closest parent setting now applies." });
      await loadData();
    }
    setSavingKey(null);
  };

  if (scopeLoading || loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Module controls
          </CardTitle>
          <CardDescription>
            A child scope inherits its parent setting until an administrator records an explicit override.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          <div className={`grid gap-4 sm:grid-cols-2 ${scopeType === "TEAM" ? "xl:grid-cols-5" : "lg:grid-cols-3"}`}>
            <div className="space-y-2">
              <Label>Association</Label>
              <Select value={associationId} onValueChange={handleAssociationChange}>
                <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select association" /></SelectTrigger>
                <SelectContent>
                  {availableAssociations.map((association) => (
                    <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Control level</Label>
              <Select value={scopeType} onValueChange={handleScopeTypeChange}>
                <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableScopeTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScopeItemSelect
              scopeType={scopeType}
              clubId={clubId}
              divisionId={divisionId}
              teamId={teamId}
              clubs={availableClubs}
              divisions={availableDivisions}
              teams={availableTeams}
              onClubChange={handleClubChange}
              onDivisionChange={handleDivisionChange}
              onTeamChange={setTeamId}
            />
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            Disabling a module here can remove access for people below this scope. Every override asks for confirmation and can be returned to inherited mode.
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {MODULES.map((module) => {
              const exactFlag = exactFlagByModule.get(module.key);
              const effectiveEnabled = resolvedStates[module.key] ?? module.defaultEnabled;
              const saving = savingKey === module.key;
              return (
                <div key={module.key} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{module.label}</p>
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                    </div>
                    <Badge variant={effectiveEnabled ? "default" : "secondary"}>
                      {resolving ? "Checking" : effectiveEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {exactFlag
                      ? `Explicit ${scopeType.toLowerCase()} override.`
                      : "Inherited from a parent scope or the SportStack default."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={exactFlag?.enabled === true ? "default" : "outline"}
                      disabled={!selectedScopeId || saving}
                      onClick={() => setPendingOverride({ moduleKey: module.key, moduleLabel: module.label, enabled: true })}
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enable here
                    </Button>
                    <Button
                      size="sm"
                      variant={exactFlag?.enabled === false ? "destructive" : "outline"}
                      disabled={!selectedScopeId || saving}
                      onClick={() => setPendingOverride({ moduleKey: module.key, moduleLabel: module.label, enabled: false })}
                    >
                      Disable here
                    </Button>
                    {exactFlag && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => void clearOverride(module.key, module.label)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Use inherited
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(pendingOverride)} onOpenChange={(open) => !open && setPendingOverride(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingOverride?.enabled ? "Enable" : "Disable"} {pendingOverride?.moduleLabel} here?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This creates an explicit {scopeType.toLowerCase()} override for {selectedScopeName || "the selected scope"}.
              It will take priority over the parent setting until Use inherited is selected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(savingKey)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(savingKey)}
              onClick={(event) => {
                event.preventDefault();
                void saveOverride();
              }}
            >
              {savingKey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ScopeItemSelect({
  scopeType,
  clubId,
  divisionId,
  teamId,
  clubs,
  divisions,
  teams,
  onClubChange,
  onDivisionChange,
  onTeamChange,
}: {
  scopeType: ScopeType;
  clubId: string;
  divisionId: string;
  teamId: string;
  clubs: ClubOption[];
  divisions: DivisionOption[];
  teams: TeamOption[];
  onClubChange: (value: string) => void;
  onDivisionChange: (value: string) => void;
  onTeamChange: (value: string) => void;
}) {
  if (scopeType === "ASSOCIATION") {
    return (
      <div className="space-y-2">
        <Label>Selected scope</Label>
        <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">Association above</div>
      </div>
    );
  }

  if (scopeType === "TEAM") {
    return (
      <>
        <ScopeSelect label="Club" value={clubId} placeholder="Select club" options={clubs} onChange={onClubChange} />
        <ScopeSelect
          label="Division"
          value={divisionId}
          placeholder={clubId ? "Select division" : "Select a club first"}
          options={divisions}
          onChange={onDivisionChange}
          disabled={!clubId}
        />
        <ScopeSelect
          label="Team"
          value={teamId}
          placeholder={divisionId ? "Select team" : "Select a division first"}
          options={teams}
          onChange={onTeamChange}
          disabled={!clubId || !divisionId}
        />
      </>
    );
  }

  const value = scopeType === "CLUB" ? clubId : divisionId;
  const options = scopeType === "CLUB" ? clubs : divisions;
  const handleChange = scopeType === "CLUB" ? onClubChange : onDivisionChange;
  return (
    <ScopeSelect
      label={scopeType.charAt(0) + scopeType.slice(1).toLowerCase()}
      value={value}
      placeholder={`Select ${scopeType.toLowerCase()}`}
      options={options}
      onChange={handleChange}
    />
  );
}

function ScopeSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
