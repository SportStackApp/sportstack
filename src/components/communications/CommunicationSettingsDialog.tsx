import { useEffect, useMemo, useState } from "react";
import { Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";

export type CommunicationTab = "team" | "club" | "association";

interface CommunicationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: CommunicationTab;
  channelId: string | null;
  teamId: string;
  clubId: string;
  associationId: string;
}

interface Candidate {
  id: string;
  name: string;
}

interface Permission {
  id: string;
  user_id: string;
  can_publish: boolean;
  can_moderate: boolean;
}

interface MembershipRow {
  user_id: string;
  team_id: string;
  teams: { club_id: string; clubs: { association_id: string } | Array<{ association_id: string }> | null }
    | Array<{ club_id: string; clubs: { association_id: string } | Array<{ association_id: string }> | null }>
    | null;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const database = supabase;

export function CommunicationSettingsDialog({
  open,
  onOpenChange,
  tab,
  channelId,
  teamId,
  clubId,
  associationId,
}: CommunicationSettingsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isSuperAdmin, canManageAssociation, canManageClub, canManageTeam } = useAdminScope();
  const [reminderDays, setReminderDays] = useState("7, 3, 1");
  const [teamRemindersEnabled, setTeamRemindersEnabled] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("__none__");
  const [newCanPublish, setNewCanPublish] = useState(tab !== "team");
  const [newCanModerate, setNewCanModerate] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAdministerChannel = useMemo(() => {
    if (isSuperAdmin) return true;
    if (tab === "association") return Boolean(associationId && canManageAssociation(associationId));
    return Boolean(clubId && canManageClub(clubId));
  }, [associationId, canManageAssociation, canManageClub, clubId, isSuperAdmin, tab]);
  const canManageSchedule = Boolean(clubId && canManageClub(clubId));
  const canManageTeamSchedule = Boolean(teamId && canManageTeam(teamId));

  useEffect(() => {
    setNewCanPublish(tab !== "team");
  }, [tab]);

  useEffect(() => {
    if (!open || !user) return;
    const loadSettings = async () => {
      const [clubResult, teamResult] = await Promise.all([
        clubId
          ?
          database
            .from("club_availability_reminder_settings")
            .select("reminder_days")
            .eq("club_id", clubId)
            .maybeSingle()
          : Promise.resolve({ data: null }),
        teamId
          ?
          database
            .from("team_availability_reminder_settings")
            .select("enabled")
            .eq("team_id", teamId)
            .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (clubResult?.data?.reminder_days) {
        setReminderDays((clubResult.data.reminder_days as number[]).join(", "));
      }
      if (typeof teamResult?.data?.enabled === "boolean") {
        setTeamRemindersEnabled(teamResult.data.enabled);
      }

      if (!channelId) return;
      const [permissionResult, membershipResult] = await Promise.all([
        database
          .from("communication_permissions")
          .select("id, user_id, can_publish, can_moderate")
          .eq("channel_id", channelId),
        database
          .from("team_memberships")
          .select("user_id, team_id, teams!inner(club_id, clubs!inner(association_id))")
          .eq("status", "ACTIVE"),
      ]);
      setPermissions((permissionResult.data || []) as Permission[]);

      const scopedMemberships = ((membershipResult.data || []) as MembershipRow[]).filter((membership) => {
        const team = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;
        const club = Array.isArray(team?.clubs) ? team.clubs[0] : team?.clubs;
        if (tab === "team") return membership.team_id === teamId;
        if (tab === "club") return team?.club_id === clubId;
        return club?.association_id === associationId;
      });
      const userIds = [...new Set(scopedMemberships.map((membership) => membership.user_id))];
      if (userIds.length === 0) {
        setCandidates([]);
        return;
      }
      const { data: profiles } = await database
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      setCandidates(
        ((profiles || []) as ProfileRow[])
          .map((profile) => ({
            id: profile.id,
            name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unnamed member",
          }))
          .sort((a: Candidate, b: Candidate) => a.name.localeCompare(b.name)),
      );
    };
    void loadSettings();
  }, [associationId, channelId, clubId, open, tab, teamId, user]);

  const saveReminderDays = async () => {
    if (!user || !clubId) return;
    const days = [...new Set(
      reminderDays
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value)),
    )].sort((a, b) => b - a);
    if (days.length < 1 || days.length > 3 || days.some((day) => day < 1 || day > 365)) {
      toast({
        title: "Check reminder days",
        description: "Enter one to three whole days between 1 and 365, separated by commas.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await database.from("club_availability_reminder_settings").upsert({
      club_id: clubId,
      reminder_days: days,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    toast(
      error
        ? { title: "Reminder schedule not saved", description: error.message, variant: "destructive" }
        : { title: "Reminder schedule saved", description: `${days.join(", ")} days before each fixture.` },
    );
  };

  const setTeamReminderState = async (enabled: boolean) => {
    if (!user || !teamId) return;
    setTeamRemindersEnabled(enabled);
    const { error } = await database.from("team_availability_reminder_settings").upsert({
      team_id: teamId,
      enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setTeamRemindersEnabled(!enabled);
      toast({ title: "Team reminder setting not saved", description: error.message, variant: "destructive" });
    }
  };

  const addPermission = async () => {
    if (!user || !channelId || selectedUserId === "__none__" || (!newCanPublish && !newCanModerate)) return;
    setSaving(true);
    const { error } = await database.from("communication_permissions").upsert(
      {
        channel_id: channelId,
        user_id: selectedUserId,
        can_publish: tab === "team" ? false : newCanPublish,
        can_moderate: newCanModerate,
        granted_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,user_id" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Permission not saved", description: error.message, variant: "destructive" });
      return;
    }
    const { data } = await database
      .from("communication_permissions")
      .select("id, user_id, can_publish, can_moderate")
      .eq("channel_id", channelId);
    setPermissions((data || []) as Permission[]);
    setSelectedUserId("__none__");
  };

  const removePermission = async (permissionId: string) => {
    const { error } = await database.from("communication_permissions").delete().eq("id", permissionId);
    if (error) {
      toast({ title: "Permission not removed", description: error.message, variant: "destructive" });
      return;
    }
    setPermissions((items) => items.filter((item) => item.id !== permissionId));
  };

  const candidateName = (userId: string) =>
    candidates.find((candidate) => candidate.id === userId)?.name || "Member";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Communication settings
          </DialogTitle>
          <DialogDescription>Manage only the selected team, club or association scope.</DialogDescription>
        </DialogHeader>

        {tab === "team" && (canManageSchedule || canManageTeamSchedule) && (
          <section className="space-y-4 rounded-lg border p-4">
            <div>
              <h3 className="font-medium">Availability reminders</h3>
              <p className="text-sm text-muted-foreground">Teams start off. Players keep control of their own channels.</p>
            </div>
            {canManageSchedule && (
              <div className="space-y-2">
                <Label htmlFor="reminder-days">Club reminder days</Label>
                <div className="flex gap-2">
                  <Input
                    id="reminder-days"
                    value={reminderDays}
                    onChange={(event) => setReminderDays(event.target.value)}
                    placeholder="7, 3, 1"
                  />
                  <Button onClick={() => void saveReminderDays()} disabled={saving}>Save</Button>
                </div>
                <p className="text-xs text-muted-foreground">Up to three whole-day points, for example 7, 3, 1.</p>
              </div>
            )}
            {canManageTeamSchedule && (
              <div className="flex items-center justify-between gap-4 rounded-md bg-muted/50 p-3">
                <div>
                  <Label htmlFor="team-reminders">Use the club schedule for this team</Label>
                  <p className="text-xs text-muted-foreground">Cancelled and postponed fixtures are automatically suppressed.</p>
                </div>
                <Switch
                  id="team-reminders"
                  checked={teamRemindersEnabled}
                  onCheckedChange={(checked) => void setTeamReminderState(checked)}
                />
              </div>
            )}
          </section>
        )}

        {canAdministerChannel && channelId && (
          <section className="space-y-4 rounded-lg border p-4">
            <div>
              <h3 className="font-medium">Delegated permissions</h3>
              <p className="text-sm text-muted-foreground">Grant exact-scope access without making the person an administrator.</p>
            </div>
            <div className="space-y-3">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full min-w-0 overflow-hidden">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select a member</SelectItem>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-5">
                {tab !== "team" && (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={newCanPublish} onCheckedChange={setNewCanPublish} /> Publish
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={newCanModerate} onCheckedChange={setNewCanModerate} /> Moderate
                </label>
                <Button
                  onClick={() => void addPermission()}
                  disabled={saving || selectedUserId === "__none__" || (!newCanPublish && !newCanModerate)}
                >
                  Add or update
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delegated permissions in this scope.</p>
              ) : permissions.map((permission) => (
                <div key={permission.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{candidateName(permission.user_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[permission.can_publish && "Publisher", permission.can_moderate && "Moderator"].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove permissions for ${candidateName(permission.user_id)}`}
                    onClick={() => void removePermission(permission.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
