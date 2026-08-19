import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";

type ScopeType = "ASSOCIATION" | "CLUB" | "DIVISION" | "TEAM";
type SubjectType = "ROLE" | "GROUP" | "USER";
type AppRole = Database["public"]["Enums"]["user_role_enum"];
type PermissionChoice = "NOT_SET" | "ALLOW" | "DENY";
type CatalogueRow = Tables<"permission_catalogue">;
type GroupRow = Tables<"permission_groups">;
type GroupMemberRow = Tables<"permission_group_members">;
type SetRow = Tables<"permission_sets">;
type SetPermissionRow = Tables<"permission_set_permissions">;
type AssignmentRow = Tables<"permission_assignments">;
type OverrideRow = Tables<"permission_overrides">;
type TeamDivisionOption = Pick<Tables<"team_divisions">, "team_id" | "division_id">;

interface PermissionManagementPayload {
  groups: GroupRow[];
  group_members: GroupMemberRow[];
  sets: SetRow[];
  set_permissions: SetPermissionRow[];
  assignments: AssignmentRow[];
  overrides: OverrideRow[];
}

interface AssociationOption { id: string; name: string }
interface ClubOption { id: string; name: string; association_id: string }
interface DivisionOption { id: string; name: string; association_id: string }
interface TeamOption { id: string; name: string; club_id: string; division_id: string | null }
interface ProfileOption { profile_id: string; display_name: string }

const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: "ASSOCIATION_ADMIN", label: "Association Admin" },
  { value: "CLUB_ADMIN", label: "Club Admin" },
  { value: "TEAM_MANAGER", label: "Team Manager" },
  { value: "COACH", label: "Coach" },
  { value: "PLAYER", label: "Player" },
  { value: "UMPIRE", label: "Umpire" },
  { value: "VOTER", label: "Voter" },
];

const messageFor = (error: unknown) => error instanceof Error
  ? error.message
  : typeof error === "object" && error !== null && "message" in error
    ? String(error.message)
    : "The permission change could not be saved.";

export function AdvancedPermissionControls() {
  const { toast } = useToast();
  const { actorMode, isSuperAdmin, scopedAssociationIds, scopedClubIds } = useAdminScope();
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [associations, setAssociations] = useState<AssociationOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<TeamDivisionOption[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMemberRow[]>([]);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [setPermissions, setSetPermissions] = useState<SetPermissionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const permissionRequestId = useRef(0);
  const profileRequestId = useRef(0);

  const [associationId, setAssociationId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("ASSOCIATION");
  const [clubId, setClubId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [teamId, setTeamId] = useState("");

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [permissionChoices, setPermissionChoices] = useState<Record<string, PermissionChoice>>({});

  const [assignmentSetId, setAssignmentSetId] = useState("");
  const [assignmentSubjectType, setAssignmentSubjectType] = useState<SubjectType>("ROLE");
  const [assignmentSubjectKey, setAssignmentSubjectKey] = useState("");

  const [overridePermissionKey, setOverridePermissionKey] = useState("");
  const [overrideSubjectType, setOverrideSubjectType] = useState<SubjectType>("ROLE");
  const [overrideSubjectKey, setOverrideSubjectKey] = useState("");
  const [overrideAllowed, setOverrideAllowed] = useState(true);
  const [overrideReason, setOverrideReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all([
      supabase.from("associations").select("id, name").order("name"),
      supabase.from("clubs").select("id, name, association_id").order("name"),
      supabase.from("divisions").select("id, name, association_id").order("name"),
      supabase.from("teams").select("id, name, club_id, division_id").order("name"),
      supabase.from("team_divisions").select("team_id, division_id"),
      supabase.from("permission_catalogue").select("*").order("category").order("label"),
    ]);
    const failure = results.find((result) => result.error)?.error;
    if (failure) {
      toast({ title: "Permissions could not load", description: failure.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setAssociations(results[0].data || []);
    setClubs(results[1].data || []);
    setDivisions(results[2].data || []);
    setTeams(results[3].data || []);
    setTeamDivisions(results[4].data || []);
    setCatalogue(results[5].data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void loadData(); }, [loadData]);

  const manageableAssociationIds = useMemo(() => {
    if (isSuperAdmin) return new Set(associations.map((association) => association.id));
    const ids = new Set(scopedAssociationIds);
    clubs.forEach((club) => { if (scopedClubIds.includes(club.id)) ids.add(club.association_id); });
    return ids;
  }, [associations, clubs, isSuperAdmin, scopedAssociationIds, scopedClubIds]);
  const availableAssociations = useMemo(
    () => associations.filter((association) => manageableAssociationIds.has(association.id)),
    [associations, manageableAssociationIds],
  );

  useEffect(() => {
    if (!availableAssociations.some((association) => association.id === associationId)) {
      const nextAssociationId = availableAssociations[0]?.id || "";
      setAssociationId(nextAssociationId);
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
  const availableScopeTypes = useMemo<ScopeType[]>(() => canManageAssociation
    ? ["ASSOCIATION", "CLUB", "DIVISION", "TEAM"]
    : ["CLUB", "TEAM"], [canManageAssociation]);
  useEffect(() => {
    if (!availableScopeTypes.includes(scopeType)) {
      setScopeType(availableScopeTypes[0]);
      setClubId("");
      setDivisionId("");
      setTeamId("");
    }
  }, [availableScopeTypes, scopeType]);

  const availableClubs = useMemo(() => clubs.filter((club) => club.association_id === associationId
    && (canManageAssociation || scopedClubIds.includes(club.id))),
  [associationId, canManageAssociation, clubs, scopedClubIds]);
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
  // Only offer permissions that are enforced end-to-end in this release.
  // Action permissions stay in the catalogue for future workflow integration,
  // but must not look functional before their server write paths use them.
  const enforcedCatalogue = useMemo(
    () => catalogue.filter((permission) => permission.category === "MODULE"),
    [catalogue],
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

  const selectedScopeId = scopeType === "ASSOCIATION" ? associationId
    : scopeType === "CLUB" ? clubId
      : scopeType === "DIVISION" ? divisionId : teamId;

  const loadScopedPermissionData = useCallback(async () => {
    const requestId = ++permissionRequestId.current;
    setGroups([]);
    setGroupMembers([]);
    setSets([]);
    setSetPermissions([]);
    setAssignments([]);
    setOverrides([]);

    if (!selectedScopeId) {
      setPermissionLoading(false);
      return;
    }

    setPermissionLoading(true);
    const { data, error } = await supabase.rpc(
      "list_permission_management_records_for_mode" as never,
      {
        p_scope_type: scopeType,
        p_scope_id: selectedScopeId,
        p_actor_mode: actorMode,
      } as never,
    );

    if (requestId !== permissionRequestId.current) return;
    if (error) {
      toast({ title: "Permissions could not load", description: error.message, variant: "destructive" });
      setPermissionLoading(false);
      return;
    }

    const payload = (data || {}) as unknown as Partial<PermissionManagementPayload>;
    setGroups(Array.isArray(payload.groups) ? payload.groups : []);
    setGroupMembers(Array.isArray(payload.group_members) ? payload.group_members : []);
    setSets(Array.isArray(payload.sets) ? payload.sets : []);
    setSetPermissions(Array.isArray(payload.set_permissions) ? payload.set_permissions : []);
    setAssignments(Array.isArray(payload.assignments) ? payload.assignments : []);
    setOverrides(Array.isArray(payload.overrides) ? payload.overrides : []);
    setPermissionLoading(false);
  }, [actorMode, scopeType, selectedScopeId, toast]);

  useEffect(() => { void loadScopedPermissionData(); }, [loadScopedPermissionData]);

  const exactGroups = groups.filter((group) => group.scope_type === scopeType && group.scope_id === selectedScopeId);
  const exactSets = sets.filter((set) => set.owner_scope_type === scopeType && set.owner_scope_id === selectedScopeId);
  const exactAssignments = assignments.filter((assignment) => assignment.scope_type === scopeType && assignment.scope_id === selectedScopeId);
  const exactOverrides = overrides.filter((override) => override.scope_type === scopeType && override.scope_id === selectedScopeId);

  useEffect(() => {
    const requestId = ++profileRequestId.current;
    setProfiles([]);
    if (!selectedScopeId) return;

    void supabase.rpc("permission_visible_profiles_for_mode", {
      p_scope_type: scopeType,
      p_scope_id: selectedScopeId,
      p_actor_mode: actorMode,
    })
      .then(({ data, error }) => {
        if (requestId !== profileRequestId.current) return;
        if (error) toast({ title: "People could not load", description: error.message, variant: "destructive" });
        setProfiles(data || []);
      });
  }, [actorMode, scopeType, selectedScopeId, toast]);

  useEffect(() => {
    setEditingGroupId(null); setGroupName(""); setGroupDescription(""); setSelectedMembers([]);
    setEditingSetId(null); setSetName(""); setSetDescription(""); setPermissionChoices({});
    setAssignmentSetId(""); setAssignmentSubjectKey("");
    setOverridePermissionKey(""); setOverrideSubjectKey(""); setOverrideReason("");
  }, [scopeType, selectedScopeId]);

  const allowedRoles = ROLE_OPTIONS.filter((role) => {
    if (isSuperAdmin) return true;
    if (actorMode === "association") return !["ASSOCIATION_ADMIN"].includes(role.value);
    if (actorMode === "club") return ["TEAM_MANAGER", "COACH", "PLAYER", "UMPIRE", "VOTER"].includes(role.value);
    return false;
  });

  const saveGroup = async () => {
    if (!selectedScopeId || groupName.trim().length < 2) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_permission_group", {
      p_group_id: editingGroupId as string,
      p_name: groupName,
      p_description: groupDescription,
      p_scope_type: scopeType,
      p_scope_id: selectedScopeId,
      p_member_ids: selectedMembers,
      p_active: true,
      p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Group not saved", description: error.message, variant: "destructive" });
    else {
      toast({ title: editingGroupId ? "Group updated" : "Group created" });
      setEditingGroupId(null); setGroupName(""); setGroupDescription(""); setSelectedMembers([]);
      await loadScopedPermissionData();
    }
    setSaving(false);
  };

  const editGroup = (group: GroupRow) => {
    setEditingGroupId(group.id); setGroupName(group.name); setGroupDescription(group.description || "");
    setSelectedMembers(groupMembers.filter((member) => member.group_id === group.id).map((member) => member.user_id));
  };

  const archiveGroup = async (group: GroupRow) => {
    setSaving(true);
    const memberIds = groupMembers.filter((member) => member.group_id === group.id).map((member) => member.user_id);
    const { error } = await supabase.rpc("save_permission_group", {
      p_group_id: group.id, p_name: group.name, p_description: group.description || "",
      p_scope_type: group.scope_type, p_scope_id: group.scope_id, p_member_ids: memberIds,
      p_active: false, p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Group not archived", description: error.message, variant: "destructive" });
    else { toast({ title: "Group archived" }); await loadScopedPermissionData(); }
    setSaving(false);
  };

  const saveSet = async () => {
    if (!selectedScopeId || setName.trim().length < 2) return;
    const permissions = Object.fromEntries(Object.entries(permissionChoices)
      .filter(([, choice]) => choice !== "NOT_SET")
      .map(([key, choice]) => [key, choice === "ALLOW"]));
    if (Object.keys(permissions).length === 0) {
      toast({ title: "Choose at least one permission", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("save_permission_set", {
      p_permission_set_id: editingSetId as string,
      p_name: setName, p_description: setDescription,
      p_scope_type: scopeType, p_scope_id: selectedScopeId,
      p_permissions: permissions, p_active: true, p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Permission set not saved", description: error.message, variant: "destructive" });
    else {
      toast({ title: editingSetId ? "Permission set updated" : "Permission set created" });
      setEditingSetId(null); setSetName(""); setSetDescription(""); setPermissionChoices({});
      await loadScopedPermissionData();
    }
    setSaving(false);
  };

  const editSet = (set: SetRow) => {
    setEditingSetId(set.id); setSetName(set.name); setSetDescription(set.description || "");
    const choices: Record<string, PermissionChoice> = {};
    setPermissions.filter((entry) => entry.permission_set_id === set.id)
      .forEach((entry) => { choices[entry.permission_key] = entry.allowed ? "ALLOW" : "DENY"; });
    setPermissionChoices(choices);
  };

  const archiveSet = async (set: SetRow) => {
    const permissions = Object.fromEntries(setPermissions.filter((entry) => entry.permission_set_id === set.id)
      .map((entry) => [entry.permission_key, entry.allowed]));
    setSaving(true);
    const { error } = await supabase.rpc("save_permission_set", {
      p_permission_set_id: set.id, p_name: set.name, p_description: set.description || "",
      p_scope_type: set.owner_scope_type, p_scope_id: set.owner_scope_id,
      p_permissions: permissions, p_active: false, p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Permission set not archived", description: error.message, variant: "destructive" });
    else { toast({ title: "Permission set archived" }); await loadScopedPermissionData(); }
    setSaving(false);
  };

  const saveAssignment = async () => {
    if (!selectedScopeId || !assignmentSetId || !assignmentSubjectKey) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_permission_assignment", {
      p_assignment_id: null as string,
      p_permission_set_id: assignmentSetId,
      p_subject_type: assignmentSubjectType,
      p_subject_key: assignmentSubjectKey,
      p_scope_type: scopeType, p_scope_id: selectedScopeId,
      p_active: true, p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Permission set not assigned", description: error.message, variant: "destructive" });
    else { toast({ title: "Permission set assigned" }); setAssignmentSubjectKey(""); await loadScopedPermissionData(); }
    setSaving(false);
  };

  const archiveAssignment = async (assignment: AssignmentRow) => {
    setSaving(true);
    const { error } = await supabase.rpc("save_permission_assignment", {
      p_assignment_id: assignment.id, p_permission_set_id: assignment.permission_set_id,
      p_subject_type: assignment.subject_type, p_subject_key: assignment.subject_key,
      p_scope_type: assignment.scope_type, p_scope_id: assignment.scope_id,
      p_active: false, p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Assignment not archived", description: error.message, variant: "destructive" });
    else { toast({ title: "Assignment archived" }); await loadScopedPermissionData(); }
    setSaving(false);
  };

  const saveOverride = async () => {
    if (!selectedScopeId || !overridePermissionKey || !overrideSubjectKey || overrideReason.trim().length < 4) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_permission_override", {
      p_permission_key: overridePermissionKey, p_subject_type: overrideSubjectType,
      p_subject_key: overrideSubjectKey, p_scope_type: scopeType, p_scope_id: selectedScopeId,
      p_allowed: overrideAllowed, p_reason: overrideReason, p_active: true, p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Exception not saved", description: error.message, variant: "destructive" });
    else { toast({ title: "Permission exception saved" }); setOverrideReason(""); await loadScopedPermissionData(); }
    setSaving(false);
  };

  const archiveOverride = async (override: OverrideRow) => {
    setSaving(true);
    const { error } = await supabase.rpc("save_permission_override", {
      p_permission_key: override.permission_key, p_subject_type: override.subject_type,
      p_subject_key: override.subject_key, p_scope_type: override.scope_type, p_scope_id: override.scope_id,
      p_allowed: override.allowed, p_reason: override.reason || "Archived by administrator",
      p_active: false, p_actor_mode: actorMode,
    });
    if (error) toast({ title: "Exception not archived", description: error.message, variant: "destructive" });
    else { toast({ title: "Permission exception archived" }); await loadScopedPermissionData(); }
    setSaving(false);
  };

  const subjectOptions = (type: SubjectType) => type === "ROLE"
    ? allowedRoles.map((role) => ({ id: role.value, label: role.label }))
    : type === "GROUP"
      ? exactGroups.filter((group) => group.active).map((group) => ({ id: group.id, label: group.name }))
      : profiles.map((profile) => ({ id: profile.profile_id, label: profile.display_name }));

  const subjectLabel = (type: string, key: string) => {
    if (type === "ROLE") return ROLE_OPTIONS.find((role) => role.value === key)?.label || key;
    if (type === "GROUP") return groups.find((group) => group.id === key)?.name || "Archived group";
    return profiles.find((profile) => profile.profile_id === key)?.display_name || "Scoped user";
  };

  if (loading || permissionLoading) return <Card><CardContent className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Permission groups & sets</CardTitle>
        <CardDescription>
          Build named groups and reusable permission sets, then apply them to a role, group or individual user. A direct exception wins when rules conflict at the same scope.
          These settings control module visibility in the app. Existing database role and row-level security rules remain in place while each workflow is connected to the new action permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={`grid gap-4 sm:grid-cols-2 ${scopeType === "TEAM" ? "xl:grid-cols-5" : "lg:grid-cols-3"}`}>
          <FieldSelect label="Association" value={associationId} placeholder="Select association"
            options={availableAssociations.map((item) => ({ id: item.id, label: item.name }))} onChange={handleAssociationChange} />
          <FieldSelect label="Permission level" value={scopeType} placeholder="Select level"
            options={availableScopeTypes.map((item) => ({ id: item, label: titleCase(item) }))}
            onChange={handleScopeTypeChange} />
          {scopeType === "ASSOCIATION"
            ? <div className="space-y-2"><Label>Selected scope</Label><div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">Association above</div></div>
            : scopeType === "CLUB"
              ? <FieldSelect label="Club" value={clubId} placeholder="Select club"
                  options={availableClubs.map((item) => ({ id: item.id, label: item.name }))} onChange={handleClubChange} />
              : scopeType === "DIVISION"
                ? <FieldSelect label="Division" value={divisionId} placeholder="Select division"
                    options={availableDivisions.map((item) => ({ id: item.id, label: item.name }))} onChange={handleDivisionChange} />
                : <>
                    <FieldSelect label="Club" value={clubId} placeholder="Select club"
                      options={availableClubs.map((item) => ({ id: item.id, label: item.name }))} onChange={handleClubChange} />
                    <FieldSelect label="Division" value={divisionId} placeholder={clubId ? "Select division" : "Select a club first"}
                      options={availableDivisions.map((item) => ({ id: item.id, label: item.name }))}
                      onChange={handleDivisionChange} disabled={!clubId} />
                    <FieldSelect label="Team" value={teamId} placeholder={divisionId ? "Select team" : "Select a division first"}
                      options={availableTeams.map((item) => ({ id: item.id, label: item.name }))}
                      onChange={setTeamId} disabled={!clubId || !divisionId} />
                  </>}
        </div>

        <Tabs defaultValue="groups" className="space-y-4">
          <TabsList className="grid h-auto grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="sets">Permission sets</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-3 rounded-lg border p-4">
                <div><Label htmlFor="permission-group-name">Group name</Label><Input id="permission-group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="For example: Junior coordinators" /></div>
                <div><Label htmlFor="permission-group-description">Description</Label><Textarea id="permission-group-description" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} /></div>
                <div className="space-y-2"><Label>Members in this scope</Label>
                  <ScrollArea className="h-52 rounded-md border p-3">
                    <div className="space-y-2">{profiles.map((profile) => (
                      <label key={profile.profile_id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={selectedMembers.includes(profile.profile_id)} onCheckedChange={(checked) => setSelectedMembers((current) => checked ? [...current, profile.profile_id] : current.filter((id) => id !== profile.profile_id))} />
                        {profile.display_name}
                      </label>
                    ))}</div>
                  </ScrollArea>
                </div>
                <div className="flex gap-2"><Button disabled={saving || groupName.trim().length < 2} onClick={() => void saveGroup()}>{editingGroupId ? "Update group" : "Create group"}</Button>
                  {editingGroupId && <Button variant="outline" onClick={() => { setEditingGroupId(null); setGroupName(""); setGroupDescription(""); setSelectedMembers([]); }}>Cancel</Button>}
                </div>
              </div>
              <RecordList empty="No groups at this scope yet.">{exactGroups.map((group) => (
                <RecordRow key={group.id} title={group.name} detail={`${groupMembers.filter((member) => member.group_id === group.id).length} member(s)`} active={group.active}
                  onEdit={() => editGroup(group)} onArchive={() => void archiveGroup(group)} />
              ))}</RecordList>
            </div>
          </TabsContent>

          <TabsContent value="sets" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-3 rounded-lg border p-4">
                <div><Label htmlFor="permission-set-name">Set name</Label><Input id="permission-set-name" value={setName} onChange={(event) => setSetName(event.target.value)} placeholder="For example: Committee contributor" /></div>
                <div><Label htmlFor="permission-set-description">Description</Label><Textarea id="permission-set-description" value={setDescription} onChange={(event) => setSetDescription(event.target.value)} /></div>
                <div className="space-y-2">{enforcedCatalogue.map((permission) => (
                  <div key={permission.permission_key} className="grid items-center gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <div><p className="text-sm font-medium">{permission.label}</p><p className="text-xs text-muted-foreground">{permission.description}</p></div>
                    <Select value={permissionChoices[permission.permission_key] || "NOT_SET"} onValueChange={(value) => setPermissionChoices((current) => ({ ...current, [permission.permission_key]: value as PermissionChoice }))}>
                      <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="NOT_SET">Not set</SelectItem><SelectItem value="ALLOW">Allow</SelectItem><SelectItem value="DENY">Deny</SelectItem></SelectContent>
                    </Select>
                  </div>
                ))}</div>
                <div className="flex gap-2"><Button disabled={saving || setName.trim().length < 2} onClick={() => void saveSet()}>{editingSetId ? "Update set" : "Create set"}</Button>
                  {editingSetId && <Button variant="outline" onClick={() => { setEditingSetId(null); setSetName(""); setSetDescription(""); setPermissionChoices({}); }}>Cancel</Button>}
                </div>
              </div>
              <RecordList empty="No permission sets at this scope yet.">{exactSets.map((set) => (
                <RecordRow key={set.id} title={set.name} detail={`${setPermissions.filter((entry) => entry.permission_set_id === set.id).length} permission(s)`} active={set.active}
                  onEdit={() => editSet(set)} onArchive={() => void archiveSet(set)} />
              ))}</RecordList>
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
              <FieldSelect label="Permission set" value={assignmentSetId} placeholder="Select set" options={exactSets.filter((set) => set.active).map((set) => ({ id: set.id, label: set.name }))} onChange={setAssignmentSetId} />
              <FieldSelect label="Apply to" value={assignmentSubjectType} placeholder="Select type" options={[{ id: "ROLE", label: "Role" }, { id: "GROUP", label: "Group" }, { id: "USER", label: "Individual user" }]} onChange={(value) => { setAssignmentSubjectType(value as SubjectType); setAssignmentSubjectKey(""); }} />
              <FieldSelect label={titleCase(assignmentSubjectType)} value={assignmentSubjectKey} placeholder="Select target" options={subjectOptions(assignmentSubjectType)} onChange={setAssignmentSubjectKey} />
              <Button className="md:col-span-3 md:w-fit" disabled={saving || !assignmentSetId || !assignmentSubjectKey} onClick={() => void saveAssignment()}>Assign permission set</Button>
            </div>
            <RecordList empty="No active assignments at this scope yet.">{exactAssignments.filter((assignment) => assignment.active).map((assignment) => (
              <RecordRow key={assignment.id} title={sets.find((set) => set.id === assignment.permission_set_id)?.name || "Archived permission set"}
                detail={`${titleCase(assignment.subject_type)}: ${subjectLabel(assignment.subject_type, assignment.subject_key)}`} active
                onArchive={() => void archiveAssignment(assignment)} />
            ))}</RecordList>
          </TabsContent>

          <TabsContent value="exceptions" className="space-y-4">
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <FieldSelect label="Permission" value={overridePermissionKey} placeholder="Select permission" options={enforcedCatalogue.map((permission) => ({ id: permission.permission_key, label: permission.label }))} onChange={setOverridePermissionKey} />
              <FieldSelect label="Apply to" value={overrideSubjectType} placeholder="Select type" options={[{ id: "ROLE", label: "Role" }, { id: "GROUP", label: "Group" }, { id: "USER", label: "Individual user" }]} onChange={(value) => { setOverrideSubjectType(value as SubjectType); setOverrideSubjectKey(""); }} />
              <FieldSelect label={titleCase(overrideSubjectType)} value={overrideSubjectKey} placeholder="Select target" options={subjectOptions(overrideSubjectType)} onChange={setOverrideSubjectKey} />
              <FieldSelect label="Result" value={overrideAllowed ? "ALLOW" : "DENY"} placeholder="Select result" options={[{ id: "ALLOW", label: "Allow" }, { id: "DENY", label: "Deny" }]} onChange={(value) => setOverrideAllowed(value === "ALLOW")} />
              <div className="space-y-2 md:col-span-2"><Label htmlFor="permission-reason">Reason</Label><Textarea id="permission-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Why is this exception needed?" /></div>
              <Button className="md:w-fit" disabled={saving || !overridePermissionKey || !overrideSubjectKey || overrideReason.trim().length < 4} onClick={() => void saveOverride()}>Save exception</Button>
            </div>
            <RecordList empty="No active exceptions at this scope yet.">{exactOverrides.filter((override) => override.active).map((override) => (
              <RecordRow key={override.id} title={catalogue.find((permission) => permission.permission_key === override.permission_key)?.label || override.permission_key}
                detail={`${override.allowed ? "Allow" : "Deny"} · ${titleCase(override.subject_type)}: ${subjectLabel(override.subject_type, override.subject_key)}`} active
                onArchive={() => void archiveOverride(override)} />
            ))}</RecordList>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function FieldSelect({ label, value, placeholder, options, onChange, disabled = false }: { label: string; value: string; placeholder: string; options: Array<{ id: string; label: string }>; onChange: (value: string) => void; disabled?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function RecordList({ empty, children }: { empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="space-y-2 rounded-lg border p-4">{hasChildren ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</div>;
}

function RecordRow({ title, detail, active, onEdit, onArchive }: { title: string; detail: string; active: boolean; onEdit?: () => void; onArchive: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{title}</p><Badge variant={active ? "outline" : "secondary"}>{active ? "Active" : "Archived"}</Badge></div><p className="text-xs text-muted-foreground">{detail}</p></div><div className="flex gap-2">{onEdit && active && <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>}{active && <Button size="sm" variant="ghost" onClick={onArchive}>Archive</Button>}</div></div>;
}

const titleCase = (value: string) => value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
