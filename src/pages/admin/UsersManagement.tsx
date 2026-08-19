import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, ArrowLeft, Search, Check, X, UserPlus, FileSpreadsheet, Download, RefreshCw, Plus, AlertTriangle, Pencil, GitMerge, Eye, EyeOff } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDisplayName, getRoleBadgeColor } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";
import { EditUserDetailsDialog, type AccessLinkReviewDetails } from "@/components/admin/EditUserDetailsDialog";
import { ensurePlayerRoleForTeam } from "@/lib/playerRoles";
import { MergeProfilesDialog } from "@/components/admin/MergeProfilesDialog";
import { MembershipTypeBadge } from "@/components/MembershipTypeBadge";
import type { AppMode } from "@/contexts/AppModeContext";
import { useTeamContext } from "@/contexts/TeamContext";

type AppRole = Database["public"]["Enums"]["user_role_enum"];
type MembershipType = Database["public"]["Enums"]["membership_type_enum"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type TeamOption = Pick<Database["public"]["Tables"]["teams"]["Row"], "id" | "name" | "club_id" | "division" | "division_id">;
type ClubOption = Pick<Database["public"]["Tables"]["clubs"]["Row"], "id" | "name" | "association_id">;
type MembershipRow = Pick<Database["public"]["Tables"]["team_memberships"]["Row"], "id" | "user_id" | "team_id" | "status" | "membership_type">;
type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  is_placeholder?: boolean | null;
  revsports_player_id?: string | null;
  street_address?: string | null;
  email?: string | null;
};

interface Membership {
  id: string;
  team_id: string;
  status: string;
  membership_type: string;
  team_name?: string;
  club_id?: string;
}

interface PendingInviteRow {
  id: string;
  target_user_id: string;
  team_id: string;
  membership_type: string;
}

interface PendingInvite {
  id: string;
  team_id: string;
  team_name?: string;
  club_id?: string;
  membership_type: string;
}

interface UserWithRoles extends Profile {
  roles: AppRole[];
  roleScopes: RoleWithScope[];
  coordinationScopes: CoordinationScope[];
  memberships: Membership[];
  pendingInvites: PendingInvite[];
}

interface RoleWithScope {
  role: AppRole;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

type CoordinationResponsibility =
  | "UMPIRE_COORDINATOR"
  | "TECHNICAL_BENCH_COORDINATOR"
  | "VOLUNTEER_COORDINATOR";

interface CoordinationScope {
  id: string;
  user_id?: string;
  responsibility: CoordinationResponsibility;
  scope_type: "ASSOCIATION" | "CLUB";
  scope_id: string;
}

const ALL_ROLES: AppRole[] = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN", "SUPER_ADMIN", "UMPIRE", "VOTER"];

const COORDINATOR_LABELS: Record<CoordinationResponsibility, string> = {
  UMPIRE_COORDINATOR: "Umpire Coordinator",
  TECHNICAL_BENCH_COORDINATOR: "Technical Bench Coordinator",
  VOLUNTEER_COORDINATOR: "Volunteer Coordinator",
};

const ROLE_LEVEL: Record<AppRole, number> = {
  SUPER_ADMIN: 6,
  ASSOCIATION_ADMIN: 5,
  CLUB_ADMIN: 4,
  TEAM_MANAGER: 3,
  COACH: 2,
  UMPIRE_ADMIN: 2,
  PLAYER: 1,
  UMPIRE: 1,
  VOTER: 1,
};

const MODE_LEVEL: Record<AppMode, number> = {
  super_admin: 6,
  association: 5,
  club: 4,
  team_manager: 3,
  coach: 2,
  player: 1,
};

const ROLES_NEEDING_SCOPE: Record<string, string> = {
  ASSOCIATION_ADMIN: "association",
  CLUB_ADMIN: "club",
  TEAM_MANAGER: "team",
  COACH: "team",
  UMPIRE: "association",
};

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        // Use the normal Supabase error message if the response body is not JSON.
      }
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const UsersManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedAssociationId, selectedClubId, selectedDivision, selectedTeamId } = useTeamContext();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    loading: scopeLoading,
    isSuperAdmin,
    actualIsSuperAdmin,
    isAnyAdmin,
    actorMode,
    scopedTeamIds,
    scopedClubIds,
    scopedAssociationIds,
  } = useAdminScope();

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("query") || "");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [associationFilter, setAssociationFilter] = useState<string>(searchParams.get("association") || selectedAssociationId || "all");
  const [clubFilter, setClubFilter] = useState<string>(searchParams.get("club") || selectedClubId || "all");
  const [divisionFilter, setDivisionFilter] = useState(searchParams.get("division") || selectedDivision || "all");
  const [teamFilter, setTeamFilter] = useState(searchParams.get("team") || selectedTeamId || "all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalUserCount, setTotalUserCount] = useState(0);

  const [hidePlaceholders, setHidePlaceholders] = useState(true);
  const scopedTeamKey = scopedTeamIds.join(",");

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, associationFilter, clubFilter, divisionFilter, teamFilter, hidePlaceholders]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const values = {
      query: searchQuery,
      status: statusFilter,
      association: associationFilter,
      club: clubFilter,
      division: divisionFilter,
      team: teamFilter,
    };
    for (const [key, value] of Object.entries(values)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [associationFilter, clubFilter, divisionFilter, searchParams, searchQuery, setSearchParams, statusFilter, teamFilter]);

  useEffect(() => {
    if (associationFilter === "all") {
      setClubFilter("all");
      setDivisionFilter("all");
      setTeamFilter("all");
    }
  }, [associationFilter]);

  useEffect(() => {
    if (clubFilter === "all") {
      setDivisionFilter("all");
      setTeamFilter("all");
    }
  }, [clubFilter]);

  useEffect(() => {
    if (divisionFilter === "all") {
      setTeamFilter("all");
    }
  }, [divisionFilter]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [accessSending, setAccessSending] = useState(false);
  const [accessReviewOpen, setAccessReviewOpen] = useState(false);
  const [accessReviewDetails, setAccessReviewDetails] = useState<AccessLinkReviewDetails | null>(null);
  const [confirmEmailCurrent, setConfirmEmailCurrent] = useState(false);
  const [confirmFirstNameCurrent, setConfirmFirstNameCurrent] = useState(false);
  const [confirmLastNameCurrent, setConfirmLastNameCurrent] = useState(false);
  const [confirmedRoleKeys, setConfirmedRoleKeys] = useState<string[]>([]);
  const [confirmedTeamKeys, setConfirmedTeamKeys] = useState<string[]>([]);
  const [accessReviewRevSportsId, setAccessReviewRevSportsId] = useState("");
  
  const handleOpenEditDialog = (u: UserWithRoles) => {
    if (!canEditUser(u)) {
      toast({
        title: "Read-only account",
        description: "Your active role cannot edit an account at this level.",
        variant: "destructive",
      });
      return;
    }
    setSelectedUser(u);
    setEditDialogOpen(true);
    void loadRoleState(u);
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedMergeIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= 2) {
        toast({
          title: "Selection Limit",
          description: "You can only select up to 2 profiles to merge.",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, userId];
    });
  };
  const [revsportsPlayerIdDraft, setRevsportsPlayerIdDraft] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadError, setRolesLoadError] = useState<string | null>(null);
  const roleLoadRequestRef = useRef(0);
  const [coachScopes, setCoachScopes] = useState<{ id: string, association_id: string, club_id: string, division_id: string, team_id: string }[]>([]);
  const [managerScopes, setManagerScopes] = useState<{ id: string, association_id: string, club_id: string, division_id: string, team_id: string }[]>([]);
  const [assocAdminScopes, setAssocAdminScopes] = useState<{ id: string, association_id: string }[]>([]);
  const [clubAdminScopes, setClubAdminScopes] = useState<{ id: string, association_id: string, club_id: string }[]>([]);
  const [umpireScopes, setUmpireScopes] = useState<{ id: string, association_id: string }[]>([]);
  const [coordinationScopes, setCoordinationScopes] = useState<CoordinationScope[]>([]);
  const [saving, setSaving] = useState(false);
  const [primaryRequests, setPrimaryRequests] = useState<any[]>([]);

  const [showTeamAssign, setShowTeamAssign] = useState(false);
  const [assignAssociationId, setAssignAssociationId] = useState("");
  const [assignClubId, setAssignClubId] = useState("");
  const [assignDivision, setAssignDivision] = useState("");
  const [assignDivisionOptions, setAssignDivisionOptions] = useState<{ id: string; name: string }[]>([]);
  const [assignTeamOptions, setAssignTeamOptions] = useState<any[]>([]);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignMembershipType, setAssignMembershipType] = useState<MembershipType>("PRIMARY");
  const [assignSaving, setAssignSaving] = useState(false);

  const canEditUser = useCallback((target: UserWithRoles) => {
    if (!isAnyAdmin) return false;
    const targetLevel = target.roles.reduce((highest, role) => Math.max(highest, ROLE_LEVEL[role]), 0);
    if (actorMode === "team_manager") {
      const sharesAssignedTeam = target.memberships.some((membership) => scopedTeamIds.includes(membership.team_id));
      return sharesAssignedTeam && MODE_LEVEL.team_manager > targetLevel;
    }
    return MODE_LEVEL[actorMode] > targetLevel || actorMode === "super_admin";
  }, [actorMode, isAnyAdmin, scopedTeamIds]);

  useEffect(() => {
    if (!assignClubId) {
      setAssignTeamOptions([]);
      setAssignDivisionOptions([]);
      return;
    }

    const load = async () => {
      // First, get all teams for this club to find which divisions have teams
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, club_id, division_id")
        .eq("club_id", assignClubId)
        .order("name");

      if (teamsError) {
        console.error("Failed to fetch teams for club:", teamsError.message);
        return;
      }

      const result = teamsData || [];

      // Extract unique division_ids
      const divisionIds = Array.from(
        new Set(result.map((t: any) => t.division_id).filter(Boolean))
      ) as string[];

      // Query divisions that have teams in this club
      let divisions: { id: string; name: string }[] = [];
      if (divisionIds.length > 0) {
        const { data: divData, error: divError } = (await supabase
          .from("divisions" as any)
          .select("id, name")
          .in("id", divisionIds)
          .order("name")) as any;

        if (!divError) {
          divisions = divData || [];
        }
      }

      setAssignTeamOptions(result);
      setAssignDivisionOptions(divisions);
    };

    load();
  }, [assignClubId]);


  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) {
      navigate("/dashboard");
    }
  }, [scopeLoading, isAnyAdmin, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, clubsRes, assocRes, divsRes] = await Promise.all([
        supabase.from("teams").select("id, name, club_id, division, division_id"),
        supabase.from("clubs").select("id, name, association_id"),
        supabase.from("associations").select("id, name"),
        supabase.from("divisions").select("id, name"),
      ]);
      const teamsList = teamsRes.data || [];
      const clubsList = clubsRes.data || [];
      setTeams(teamsList);
      setClubs(clubsList);
      setAssociations(assocRes.data || []);
      setDivisions(divsRes.data || []);

      const scopedIds = isSuperAdmin ? teamsList.map((team) => team.id) : scopedTeamKey.split(",").filter(Boolean);
      let filteredTeamIds = scopedIds;
      if (associationFilter !== "all") {
        const clubIds = new Set(clubsList.filter((club) => club.association_id === associationFilter).map((club) => club.id));
        filteredTeamIds = filteredTeamIds.filter((id) => clubIds.has(teamsList.find((team) => team.id === id)?.club_id || ""));
      }
      if (clubFilter !== "all") filteredTeamIds = filteredTeamIds.filter((id) => teamsList.find((team) => team.id === id)?.club_id === clubFilter);
      if (divisionFilter !== "all") filteredTeamIds = filteredTeamIds.filter((id) => teamsList.find((team) => team.id === id)?.division_id === divisionFilter);
      if (teamFilter !== "all") filteredTeamIds = filteredTeamIds.filter((id) => id === teamFilter);

      const visibleAssociationId = associationFilter !== "all"
        ? associationFilter
        : actorMode === "association" && scopedAssociationIds.length === 1
          ? scopedAssociationIds[0]
          : null;
      const visibleClubId = clubFilter !== "all"
        ? clubFilter
        : actorMode === "club" && scopedClubIds.length === 1
          ? scopedClubIds[0]
          : null;
      const visibleTeamId = teamFilter !== "all"
        ? teamFilter
        : actorMode === "team_manager" && scopedTeamIds.length === 1
          ? scopedTeamIds[0]
          : null;

      const { data: visibleProfileRows, error: visibleProfilesError } = await supabase.rpc(
        "admin_visible_profile_ids" as never,
        {
          p_actor_mode: actorMode,
          p_association_id: visibleAssociationId,
          p_club_id: visibleClubId,
          p_team_id: visibleTeamId,
        } as never,
      );
      if (visibleProfilesError) throw visibleProfilesError;
      const serverVisibleUserIds = new Set(
        ((visibleProfileRows || []) as { profile_id: string }[]).map((row) => row.profile_id),
      );

      // Association, club and team containment is already enforced by the
      // server RPC for both memberships and scoped roles. Only a division
      // filter needs an extra team-based pass because the RPC has no division
      // argument. Membership status filters intentionally remain membership-only.
      const constrainByMembershipStatus = ["ACTIVE", "PENDING"].includes(statusFilter);
      const constrainByDivision = divisionFilter !== "all";

      let candidateUserIds: string[] | null = Array.from(serverVisibleUserIds);
      if (constrainByMembershipStatus || constrainByDivision) {
        if (filteredTeamIds.length === 0) {
          candidateUserIds = [];
        } else {
          let candidateQuery = supabase.from("team_memberships").select("user_id").in("team_id", filteredTeamIds);
          if (constrainByMembershipStatus) {
            candidateQuery = candidateQuery.eq("status", statusFilter as "ACTIVE" | "PENDING");
          }
          const { data, error } = await candidateQuery;
          if (error) throw error;
          const filteredProfileIds = new Set((data || []).map((membership) => membership.user_id));

          if (constrainByDivision && !constrainByMembershipStatus) {
            const { data: roleRows, error: roleError } = await supabase
              .from("user_roles")
              .select("user_id")
              .in("team_id", filteredTeamIds);
            if (roleError) throw roleError;
            (roleRows || []).forEach((roleRow) => filteredProfileIds.add(roleRow.user_id));
          }

          candidateUserIds = [...filteredProfileIds]
            .filter((profileId) => serverVisibleUserIds.has(profileId));
        }
      }

      if (statusFilter === "unassigned" || statusFilter === "duplicates") {
        const existingCandidateIds = candidateUserIds ? new Set(candidateUserIds) : null;
        const [{ data: compactProfiles, error: compactError }, { data: assignedMemberships, error: membershipError }] = await Promise.all([
          supabase.from("profiles").select("id, first_name, last_name"),
          statusFilter === "unassigned" ? supabase.from("team_memberships").select("user_id") : Promise.resolve({ data: [], error: null }),
        ]);
        if (compactError) throw compactError;
        if (membershipError) throw membershipError;

        if (statusFilter === "unassigned") {
          const assignedIds = new Set((assignedMemberships || []).map((membership) => membership.user_id));
          candidateUserIds = (compactProfiles || []).filter((profile) => !assignedIds.has(profile.id)).map((profile) => profile.id);
        } else {
          const idsByName = new Map<string, string[]>();
          (compactProfiles || []).forEach((profile) => {
            const name = `${profile.first_name || ""}|${profile.last_name || ""}`.trim().toLocaleLowerCase();
            if (name === "|") return;
            idsByName.set(name, [...(idsByName.get(name) || []), profile.id]);
          });
          candidateUserIds = [...idsByName.values()].filter((ids) => ids.length > 1).flat();
        }
        if (existingCandidateIds) {
          candidateUserIds = candidateUserIds.filter((profileId) => existingCandidateIds.has(profileId));
        }
      }

      if (candidateUserIds?.length === 0) {
        setUsers([]);
        setTotalUserCount(0);
        return [];
      }

      const searchTerms = searchQuery
        .trim()
        .replace(/[,%()]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      const pageStart = (currentPage - 1) * rowsPerPage;
      let profiles: Profile[] = [];

      if (candidateUserIds && candidateUserIds.length > 100) {
        // PostgREST puts `.in()` filters in the request URL. A broad association
        // or Super Admin scope can contain hundreds of UUIDs, which makes one
        // request too large and returns HTTP 400. Keep each URL safely bounded,
        // then apply the requested page after merging the authorised batches.
        const idBatches: string[][] = [];
        for (let index = 0; index < candidateUserIds.length; index += 100) {
          idBatches.push(candidateUserIds.slice(index, index + 100));
        }

        const profileBatches = await Promise.all(idBatches.map(async (profileIds) => {
          let batchQuery = supabase.from("profiles").select("*").in("id", profileIds);
          if (hidePlaceholders) batchQuery = batchQuery.eq("is_placeholder", false);
          for (const term of searchTerms) {
            batchQuery = batchQuery.or(
              `first_name.ilike.%${term}%,last_name.ilike.%${term}%,revsports_player_id.ilike.%${term}%`,
            );
          }
          const { data, error } = await batchQuery;
          if (error) throw error;
          return (data || []) as Profile[];
        }));

        const matchingProfiles = profileBatches.flat().sort((left, right) => {
          const firstNameOrder = (left.first_name || "").localeCompare(right.first_name || "");
          return firstNameOrder || (left.last_name || "").localeCompare(right.last_name || "");
        });
        setTotalUserCount(matchingProfiles.length);
        profiles = matchingProfiles.slice(pageStart, pageStart + rowsPerPage);
      } else {
        let profilesQuery = supabase.from("profiles").select("*", { count: "exact" });
        if (candidateUserIds) profilesQuery = profilesQuery.in("id", candidateUserIds);
        if (hidePlaceholders) profilesQuery = profilesQuery.eq("is_placeholder", false);
        for (const term of searchTerms) {
          // Each word may match either part of the person's name or their
          // RevSports registration ID. Repeating .or() makes all words required,
          // so a full name can span first_name and last_name.
          profilesQuery = profilesQuery.or(
            `first_name.ilike.%${term}%,last_name.ilike.%${term}%,revsports_player_id.ilike.%${term}%`,
          );
        }
        const { data: profilesData, count, error: profilesError } = await profilesQuery
          .order("first_name")
          .order("last_name")
          .range(pageStart, pageStart + rowsPerPage - 1);
        if (profilesError) throw profilesError;
        profiles = (profilesData || []) as Profile[];
        setTotalUserCount(count || 0);
      }

      const pageUserIds = profiles.map((profile) => profile.id);

      let membershipsData: MembershipRow[] = [];
      let pendingInvitesData: PendingInviteRow[] = [];
      let userRoles: ({ user_id: string } & RoleWithScope)[] = [];
      let coordinationResponsibilities: CoordinationScope[] = [];
      if (pageUserIds.length > 0) {
        let membershipQuery = supabase
          .from("team_memberships")
          .select("id, user_id, team_id, status, membership_type")
          .in("user_id", pageUserIds);
        if (!isSuperAdmin) membershipQuery = membershipQuery.in("team_id", scopedIds);
        const [membershipsRes, invitesRes, rolesRes, coordinationRes] = await Promise.all([
          membershipQuery,
          supabase
            .from("requests" as never)
            .select("id, target_user_id, team_id, membership_type")
            .eq("request_type", "TEAM_INVITE")
            .eq("status", "PENDING")
            .in("target_user_id", pageUserIds),
          supabase
            .from("user_roles")
            .select("user_id, role, association_id, club_id, team_id")
            .in("user_id", pageUserIds),
          supabase.rpc("admin_list_coordination_responsibilities", {
            p_user_ids: pageUserIds,
            p_actor_mode: actorMode,
          }),
        ]);
        if (membershipsRes.error) throw membershipsRes.error;
        if (invitesRes.error) throw invitesRes.error;
        if (rolesRes.error) throw rolesRes.error;
        if (coordinationRes.error) throw coordinationRes.error;
        membershipsData = membershipsRes.data || [];
        pendingInvitesData = (invitesRes.data || []) as unknown as PendingInviteRow[];
        userRoles = (rolesRes.data || []) as ({ user_id: string } & RoleWithScope)[];
        coordinationResponsibilities = ((coordinationRes.data || []) as unknown as Omit<CoordinationScope, "id">[])
          .map((item) => ({ ...item, id: crypto.randomUUID() }));
      }

      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => {
      const profileRoles = userRoles
        .filter((r) => r.user_id === profile.id);

      const membershipRows = membershipsData
        .filter((m) => m.user_id === profile.id)
        .map((m) => {
          const team = teamsList.find((t) => t.id === m.team_id);
          return {
            id: m.id,
            team_id: m.team_id,
            status: m.status,
            membership_type: m.membership_type,
            team_name: team?.name,
            club_id: team?.club_id,
          };
        });

      const membershipPriority = (membership: Membership) => {
        const status = membership.status === "ACTIVE" ? 100 : membership.status === "PENDING" ? 50 : 0;
        const type = membership.membership_type === "PRIMARY" ? 30 : membership.membership_type === "SECONDARY" ? 20 : 10;
        return status + type;
      };
      const deduplicatedMemberships = Array.from(
        membershipRows.reduce((byTeam, membership) => {
          const existing = byTeam.get(membership.team_id);
          if (!existing || membershipPriority(membership) > membershipPriority(existing)) {
            byTeam.set(membership.team_id, membership);
          }
          return byTeam;
        }, new Map<string, Membership>()).values(),
      );

      return {
        ...profile,
        roles: Array.from(new Set(profileRoles.map((r) => r.role))),
        roleScopes: profileRoles,
        coordinationScopes: coordinationResponsibilities.filter((item) => item.user_id === profile.id),
        // Team access roles and player memberships are separate concepts.
        // Coach and Team Manager scopes stay in roleScopes and must never be
        // presented as synthetic Primary player memberships.
        memberships: deduplicatedMemberships,
        pendingInvites: pendingInvitesData
        .filter((r) => r.target_user_id === profile.id)
        .map((r) => {
          const team = teamsList.find((t) => t.id === r.team_id);
          return {
            id: r.id,
            team_id: r.team_id,
            team_name: team?.name,
            club_id: team?.club_id,
            membership_type: r.membership_type,
          };
        }),
      };
      });

      if (actualIsSuperAdmin && actorMode === "super_admin" && usersWithRoles.length > 0) {
      const { data: emailData, error: emailError } = await supabase.functions.invoke("get-user-emails", {
        body: { profileIds: usersWithRoles.map((item) => item.id) },
      });

      if (!emailError && emailData?.emails) {
        const emailMap = emailData.emails as Record<string, string | null>;
        usersWithRoles.forEach((item) => {
          item.email = emailMap[item.id] || null;
        });
      }
      }

      setUsers(usersWithRoles);
      return usersWithRoles;
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
      setTotalUserCount(0);
      toast({ title: "Could not load users", description: "Please try again.", variant: "destructive" });
      return [];
    } finally {
      setLoading(false);
    }
  }, [actorMode, actualIsSuperAdmin, associationFilter, clubFilter, currentPage, divisionFilter, hidePlaceholders, isSuperAdmin, rowsPerPage, scopedAssociationIds, scopedClubIds, scopedTeamIds, scopedTeamKey, searchQuery, statusFilter, teamFilter, toast]);

  const fetchPrimaryRequests = async () => {
    const { data } = await supabase
      .from("primary_change_requests")
      .select("*")
      .eq("status", "PENDING")
      .order("requested_at", { ascending: false });
    
    if (data && data.length > 0) {
      const teamIds = [...new Set([...data.map((r: any) => r.to_team_id), ...data.filter((r: any) => r.from_team_id).map((r: any) => r.from_team_id)])];
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      
      const [teamsRes, profilesRes] = await Promise.all([
        supabase.from("teams").select("id, name").in("id", teamIds),
        supabase.from("profiles").select("id, first_name, last_name").in("id", userIds),
      ]);
      
      const teamNameMap = new Map((teamsRes.data || []).map((t: any) => [t.id, t.name]));
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()]));
      
      setPrimaryRequests(data.map((r: any) => ({
        ...r,
        user_name: profileMap.get(r.user_id) || "Unknown",
        from_team_name: r.from_team_id ? teamNameMap.get(r.from_team_id) || "Unknown" : null,
        to_team_name: teamNameMap.get(r.to_team_id) || "Unknown",
      })));
    } else {
      setPrimaryRequests([]);
    }
  };

  useEffect(() => {
    if (!scopeLoading && isAnyAdmin) void fetchPrimaryRequests();
  }, [scopeLoading, isAnyAdmin]);

  useEffect(() => {
    if (scopeLoading || !isAnyAdmin) return;
    const timer = window.setTimeout(() => void fetchUsers(), 300);
    return () => window.clearTimeout(timer);
  }, [fetchUsers, scopeLoading, isAnyAdmin]);

  // Duplicate detection
  const duplicateUserIds = useMemo(() => {
    const nameMap = new Map<string, string[]>();
    users.forEach((u) => {
      const key = `${(u.first_name || "").toLowerCase()}${(u.last_name || "").toLowerCase()}`.trim();
      if (!key) return;
      const arr = nameMap.get(key) || [];
      arr.push(u.id);
      nameMap.set(key, arr);
    });
    const dupes = new Set<string>();
    nameMap.forEach((ids) => {
      if (ids.length >= 2) ids.forEach((id) => dupes.add(id));
    });
    return dupes;
  }, [users]);

  const scopedAvailableTeams = useMemo(() => {
    if (isSuperAdmin) return teams;

    return teams.filter((team) => {
      const club = clubs.find((item) => item.id === team.club_id);
      return (
        scopedTeamIds.includes(team.id) ||
        scopedClubIds.includes(team.club_id) ||
        Boolean(club?.association_id && scopedAssociationIds.includes(club.association_id))
      );
    });
  }, [clubs, isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds, teams]);

  const availableAssociations = useMemo(() => {
    if (isSuperAdmin) return associations;

    const associationIds = new Set(
      scopedAvailableTeams
        .map((team) => clubs.find((club) => club.id === team.club_id)?.association_id)
        .filter(Boolean)
    );

    return associations.filter((association) => associationIds.has(association.id));
  }, [associations, clubs, isSuperAdmin, scopedAvailableTeams]);

  const availableClubs = useMemo(() => {
    if (associationFilter === "all") return [];

    const availableClubIds = new Set(scopedAvailableTeams.map((team) => team.club_id));
    return clubs.filter((club) => club.association_id === associationFilter && availableClubIds.has(club.id));
  }, [associationFilter, clubs, scopedAvailableTeams]);

  const availableDivisions = useMemo(() => {
    if (clubFilter === "all") return [];

    const divisionIds = new Set(
      scopedAvailableTeams
        .filter((team) => team.club_id === clubFilter)
        .map((team) => team.division_id)
        .filter(Boolean)
    );

    return divisions.filter((division) => divisionIds.has(division.id));
  }, [clubFilter, divisions, scopedAvailableTeams]);

  const availableTeamsForFilter = useMemo(() => {
    if (divisionFilter === "all") return [];

    return scopedAvailableTeams.filter(
      (team) => team.club_id === clubFilter && team.division_id === divisionFilter
    );
  }, [clubFilter, divisionFilter, scopedAvailableTeams]);

  const renderRoleScopeAssignments = (profile: UserWithRoles) => {
    const seenLabels = new Set<string>();
    const roleAssignments = profile.roleScopes.flatMap((scope, index) => {
      const team = scope.team_id ? teams.find((item) => item.id === scope.team_id) : undefined;
      const clubId = scope.club_id || team?.club_id;
      const club = clubId ? clubs.find((item) => item.id === clubId) : undefined;
      const associationId = scope.association_id || club?.association_id;
      const association = associationId ? associations.find((item) => item.id === associationId) : undefined;
      const division = team?.division_id ? divisions.find((item) => item.id === team.division_id) : undefined;
      const scopeLabel = [association?.name, club?.name, division?.name, team?.name].filter(Boolean).join(" / ");
      const label = scopeLabel ? `${getRoleDisplayName(scope.role)} — ${scopeLabel}` : "";

      if (!label || seenLabels.has(label)) return [];
      seenLabels.add(label);
      return [{ key: `${scope.role}-${scope.association_id || "all"}-${scope.club_id || "all"}-${scope.team_id || "all"}-${index}`, label }];
    });
    const coordinatorAssignments = profile.coordinationScopes.flatMap((scope, index) => {
      const association = scope.scope_type === "ASSOCIATION"
        ? associations.find((item) => item.id === scope.scope_id)
        : associations.find((item) => item.id === clubs.find((club) => club.id === scope.scope_id)?.association_id);
      const club = scope.scope_type === "CLUB" ? clubs.find((item) => item.id === scope.scope_id) : undefined;
      const scopeLabel = [association?.name, club?.name].filter(Boolean).join(" / ");
      const label = `${COORDINATOR_LABELS[scope.responsibility]} — ${scopeLabel || "Unknown scope"}`;
      if (seenLabels.has(label)) return [];
      seenLabels.add(label);
      return [{ key: `coordination-${scope.responsibility}-${scope.scope_type}-${scope.scope_id}-${index}`, label }];
    });
    const assignments = [...roleAssignments, ...coordinatorAssignments];

    if (assignments.length === 0) {
      return <span className="text-muted-foreground text-sm">Unassigned</span>;
    }

    return (
      <div className="flex flex-col items-start gap-1">
        {assignments.map((assignment) => (
          <Badge key={assignment.key} variant="outline" className="text-xs">
            {assignment.label}
          </Badge>
        ))}
      </div>
    );
  };

  const filteredUsers = users;
  const paginatedUsers = users;

  const handleExport = () => {
    if (filteredUsers.length === 0) return;

    const exportData = filteredUsers.map((user, index) => {
      const primaryMembership = user.memberships[0];
      const team = primaryMembership ? teams.find((t) => t.id === primaryMembership.team_id) : undefined;
      const club = team ? clubs.find((c) => c.id === team.club_id) : undefined;
      const fullTeam = team ? teams.find((t) => t.id === team.id) : undefined;

      return {
        "Registration #": index + 1,
        "First Name": user.first_name || "",
        "Last Name": user.last_name || "",
        "Email": user.email || "",
        "Gender": user.gender || "",
        "Date of Birth": user.date_of_birth || "",
        "Hockey Vic Number": user.hockey_vic_number || "",
        "Phone": user.phone || "",
        "Suburb": user.suburb || "",
        "Club": club?.name || "",
        "Team": team?.name || "",
        "Division": (fullTeam as any)?.division || "",
        "Membership Status": primaryMembership?.status || "Unassigned",
        "Membership Type": primaryMembership?.membership_type || "",
        "Emergency Contact Name": user.emergency_contact_name || "",
        "Emergency Contact Phone": user.emergency_contact_phone || "",
        "Emergency Contact Relationship": user.emergency_contact_relationship || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `players-export-${today}.xlsx`);
    toast({ title: "Export Complete", description: `${exportData.length} player(s) exported.` });
  };

  const handleApprovePrimaryRequest = async (requestId: string) => {
    const { error } = await supabase.from("primary_change_requests").update({ status: "ADMIN_APPROVED", resolved_by: user?.id }).eq("id", requestId);
    if (error) {
      toast({ title: "Error", description: "Failed to approve request.", variant: "destructive" });
    } else {
      toast({ title: "Approved", description: "Primary team change approved. User must confirm." });
      fetchPrimaryRequests();
    }
  };

  const handleDeclinePrimaryRequest = async (requestId: string) => {
    const { error } = await supabase.from("primary_change_requests").update({ status: "DECLINED", resolved_by: user?.id, resolved_at: new Date().toISOString() }).eq("id", requestId);
    if (error) {
      toast({ title: "Error", description: "Failed to decline request.", variant: "destructive" });
    } else {
      toast({ title: "Declined", description: "Primary team change request declined." });
      fetchPrimaryRequests();
    }
  };

  const handleApproveMembership = async (membershipId: string) => {
    const membership = selectedUser?.memberships.find((item) => item.id === membershipId);
    const { error } = await supabase.rpc("admin_manage_team_membership" as never, {
      p_membership_id: membershipId,
      p_action: "APPROVE",
      p_membership_type: null,
      p_actor_mode: actorMode,
    } as never);
    if (error) {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    } else {
      if (selectedUser && membership?.team_id) {
        await ensurePlayerRoleForTeam(selectedUser.id, membership.team_id);
      }

      toast({ title: "Approved", description: "Membership approved" });
      const freshUsers = await fetchUsers();
      setSelectedUser((prev) => {
        if (!prev) return prev;
        const updated = freshUsers.find((u) => u.id === prev.id);
        return updated ? { ...updated } : prev;
      });
    }
  };

  const handleDeclineMembership = async (membershipId: string) => {
    const { error } = await supabase.rpc("admin_manage_team_membership" as never, {
      p_membership_id: membershipId,
      p_action: "DECLINE",
      p_membership_type: null,
      p_actor_mode: actorMode,
    } as never);
    if (error) {
      toast({ title: "Error", description: "Failed to decline", variant: "destructive" });
    } else {
      toast({ title: "Declined", description: "Membership declined" });
      const freshUsers = await fetchUsers();
      setSelectedUser((prev) => {
        if (!prev) return prev;
        const updated = freshUsers.find((u) => u.id === prev.id);
        return updated ? { ...updated } : prev;
      });
    }
  };

  const loadRoleState = async (u: UserWithRoles) => {
    const requestId = ++roleLoadRequestRef.current;
    setRolesLoading(true);
    setRolesLoadError(null);
    setSelectedUser(u);
    setRevsportsPlayerIdDraft(u.revsports_player_id || "");
    // Clear the previous user's draft immediately so a slow request can never
    // expose or save stale role data for the newly selected user.
    setSelectedRoles([]);
    setCoachScopes([]);
    setManagerScopes([]);
    setAssocAdminScopes([]);
    setClubAdminScopes([]);
    setUmpireScopes([]);
    setCoordinationScopes([]);

    const [rolesResult, coordinationResult] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, association_id, club_id, team_id")
        .eq("user_id", u.id),
      supabase.rpc("admin_list_coordination_responsibilities", {
        p_user_ids: [u.id],
        p_actor_mode: actorMode,
      }),
    ]);
    const { data: rolesData, error: rolesError } = rolesResult;

    if (requestId !== roleLoadRequestRef.current) return false;
    if (rolesError || coordinationResult.error) {
      setRolesLoading(false);
      const message = rolesError?.message || coordinationResult.error?.message || "Access details could not load.";
      setRolesLoadError(message);
      toast({
        title: "Roles could not load",
        description: message,
        variant: "destructive",
      });
      return false;
    }

    const roles = new Set<AppRole>();
    const cScopes: any[] = [];
    const mScopes: any[] = [];
    const aScopes: any[] = [];
    const clScopes: any[] = [];
    const uScopes: Array<{ id: string; association_id: string }> = [];

    (rolesData || []).forEach(r => {
      roles.add(r.role as AppRole);
      if (r.role === "COACH" && r.team_id) {
        const teamObj = teams.find(t => t.id === r.team_id);
        cScopes.push({ id: crypto.randomUUID(), association_id: r.association_id || "", club_id: r.club_id || "", division_id: teamObj?.division_id || "", team_id: r.team_id });
      } else if (r.role === "TEAM_MANAGER" && r.team_id) {
        const teamObj = teams.find(t => t.id === r.team_id);
        mScopes.push({ id: crypto.randomUUID(), association_id: r.association_id || "", club_id: r.club_id || "", division_id: teamObj?.division_id || "", team_id: r.team_id });
      } else if (r.role === "ASSOCIATION_ADMIN" && r.association_id) {
        aScopes.push({ id: crypto.randomUUID(), association_id: r.association_id });
      } else if (r.role === "CLUB_ADMIN" && r.club_id) {
        clScopes.push({ id: crypto.randomUUID(), association_id: r.association_id || "", club_id: r.club_id });
      } else if (r.role === "UMPIRE" && r.association_id) {
        uScopes.push({ id: crypto.randomUUID(), association_id: r.association_id });
      }
    });

    setSelectedRoles(Array.from(roles));
    setCoachScopes(cScopes.length > 0 ? cScopes : [{ id: crypto.randomUUID(), association_id: "", club_id: "", division_id: "", team_id: "" }]);
    setManagerScopes(mScopes.length > 0 ? mScopes : [{ id: crypto.randomUUID(), association_id: "", club_id: "", division_id: "", team_id: "" }]);
    setAssocAdminScopes(aScopes.length > 0 ? aScopes : [{ id: crypto.randomUUID(), association_id: "" }]);
    setClubAdminScopes(clScopes.length > 0 ? clScopes : [{ id: crypto.randomUUID(), association_id: "", club_id: "" }]);
    setUmpireScopes(uScopes.length > 0 ? uScopes : [{ id: crypto.randomUUID(), association_id: "" }]);
    setCoordinationScopes(((coordinationResult.data || []) as unknown as Omit<CoordinationScope, "id">[])
      .map((item) => ({ ...item, id: crypto.randomUUID() })));
    setShowTeamAssign(false);
    setAssignAssociationId("");
    setAssignClubId("");
    setAssignDivision("");
    setAssignTeamId("");
    setAssignMembershipType("PRIMARY");
    setRolesLoading(false);
    return true;
  };

  const handleOpenRoleDialog = async (u: UserWithRoles) => {
    if (await loadRoleState(u)) setRoleDialogOpen(true);
  };

  const handleToggleRole = (role: AppRole) => {
    setSelectedRoles((prev) => 
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleScopeChange = (
    setState: React.Dispatch<React.SetStateAction<any[]>>,
    id: string,
    field: string,
    value: string
  ) => {
    setState((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value || "" };
        if (field === "association_id") {
          updated.club_id = "";
          updated.division_id = "";
          updated.team_id = "";
        }
        if (field === "club_id") {
          updated.division_id = "";
          updated.team_id = "";
        }
        if (field === "division_id") {
          updated.team_id = "";
        }
        return updated;
      })
    );
  };

  const canAssignRole = (role: AppRole): boolean => {
    if (role === "UMPIRE_ADMIN") return false;
    if (isSuperAdmin) return true;
    if (role === "SUPER_ADMIN") return false;
    if (scopedAssociationIds.length > 0) {
      return ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "UMPIRE"].includes(role);
    }
    if (scopedClubIds.length > 0) {
      return ["PLAYER", "COACH", "TEAM_MANAGER"].includes(role);
    }
    return false;
  };

  const handleSaveRoles = async () => {
    if (!selectedUser || rolesLoading) return;
    if (rolesLoadError) {
      toast({
        title: "Roles are unavailable",
        description: "Close this window and try again before saving role changes.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    const stopForInvalidScope = (description: string) => {
      toast({ title: "Complete the role scope", description, variant: "destructive" });
      setSaving(false);
    };
    const hasDuplicates = (values: string[]) => new Set(values).size !== values.length;

    if (selectedRoles.includes("ASSOCIATION_ADMIN")) {
      if (assocAdminScopes.length === 0 || assocAdminScopes.some((scope) => !scope.association_id)) {
        stopForInvalidScope("Select an association for every Association Admin row.");
        return;
      }
      if (hasDuplicates(assocAdminScopes.map((scope) => scope.association_id))) {
        stopForInvalidScope("The same association cannot be assigned twice to Association Admin.");
        return;
      }
    }
    if (selectedRoles.includes("CLUB_ADMIN")) {
      if (clubAdminScopes.length === 0 || clubAdminScopes.some((scope) => !scope.association_id || !scope.club_id)) {
        stopForInvalidScope("Select an association and club for every Club Admin row.");
        return;
      }
      if (hasDuplicates(clubAdminScopes.map((scope) => scope.club_id))) {
        stopForInvalidScope("The same club cannot be assigned twice to Club Admin.");
        return;
      }
    }
    if (selectedRoles.includes("COACH")) {
      if (coachScopes.length === 0 || coachScopes.some((scope) => !scope.association_id || !scope.club_id || !scope.division_id || !scope.team_id)) {
        stopForInvalidScope("Select an association, club, division and team for every Coach row.");
        return;
      }
      if (hasDuplicates(coachScopes.map((scope) => scope.team_id))) {
        stopForInvalidScope("The same team cannot be assigned twice to Coach.");
        return;
      }
    }
    if (selectedRoles.includes("TEAM_MANAGER")) {
      if (managerScopes.length === 0 || managerScopes.some((scope) => !scope.association_id || !scope.club_id || !scope.division_id || !scope.team_id)) {
        stopForInvalidScope("Select an association, club, division and team for every Team Manager row.");
        return;
      }
      if (hasDuplicates(managerScopes.map((scope) => scope.team_id))) {
        stopForInvalidScope("The same team cannot be assigned twice to Team Manager.");
        return;
      }
    }
    if (selectedRoles.includes("UMPIRE")) {
      if (umpireScopes.length === 0 || umpireScopes.some((scope) => !scope.association_id)) {
        stopForInvalidScope("Select an association for every Umpire row.");
        return;
      }
      if (hasDuplicates(umpireScopes.map((scope) => scope.association_id))) {
        stopForInvalidScope("The same association cannot be assigned twice to Umpire.");
        return;
      }
    }
    if (coordinationScopes.some((scope) => !scope.scope_id)) {
      stopForInvalidScope("Select a scope for every Coordinator responsibility.");
      return;
    }
    if (hasDuplicates(coordinationScopes.map((scope) => `${scope.responsibility}:${scope.scope_type}:${scope.scope_id}`))) {
      stopForInvalidScope("The same Coordinator responsibility and scope cannot be assigned twice.");
      return;
    }

    const p_coach_scopes = selectedRoles.includes("COACH")
      ? coachScopes
          .filter((s) => s.team_id)
          .map((s) => ({
            association_id: s.association_id || null,
            club_id: s.club_id || null,
            team_id: s.team_id,
          }))
      : [];
    const p_manager_scopes = selectedRoles.includes("TEAM_MANAGER")
      ? managerScopes
          .filter((s) => s.team_id)
          .map((s) => ({
            association_id: s.association_id || null,
            club_id: s.club_id || null,
            team_id: s.team_id,
          }))
      : [];
    const p_association_admin_associations = selectedRoles.includes("ASSOCIATION_ADMIN") ? assocAdminScopes.filter((s) => s.association_id).map((s) => s.association_id) : [];
    const p_club_admin_scopes = selectedRoles.includes("CLUB_ADMIN")
      ? clubAdminScopes
          .filter((s) => s.club_id)
          .map((s) => ({
            association_id: s.association_id || null,
            club_id: s.club_id,
          }))
      : [];
    const p_umpire_associations = selectedRoles.includes("UMPIRE")
      ? umpireScopes.filter((scope) => scope.association_id).map((scope) => scope.association_id)
      : [];
    const p_coordination_responsibilities = coordinationScopes.map((scope) => ({
      responsibility: scope.responsibility,
      scope_type: scope.scope_type,
      scope_id: scope.scope_id,
    }));

    const { error } = await supabase.rpc("admin_save_user_access", {
      p_user_id: selectedUser.id,
      p_roles: selectedRoles,
      p_coach_scopes: p_coach_scopes.length > 0 ? p_coach_scopes : null,
      p_manager_scopes: p_manager_scopes.length > 0 ? p_manager_scopes : null,
      p_association_admin_associations: p_association_admin_associations.length > 0 ? p_association_admin_associations : null,
      p_club_admin_scopes: p_club_admin_scopes.length > 0 ? p_club_admin_scopes : null,
      p_umpire_associations: p_umpire_associations.length > 0 ? p_umpire_associations : null,
      p_coordination_responsibilities,
      p_actor_mode: actorMode,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Keep the RevSports identity update behind the authoritative role save.
    // A failed role change must never alter the user's external identity link.
    let revSportsLinkError: string | null = null;
    if (isSuperAdmin) {
      const cleanRevSportsId = revsportsPlayerIdDraft.trim();
      const profileUpdate: ProfileUpdate = { revsports_player_id: cleanRevSportsId || null };
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", selectedUser.id);

      if (profileError) {
        revSportsLinkError = profileError.message;
      }
    }

    if (revSportsLinkError) {
      toast({
        title: "Roles saved; RevSports link not saved",
        description: revSportsLinkError,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "User roles updated" });
    }
    const freshUsers = await fetchUsers();
    const updatedUser = freshUsers.find((user) => user.id === selectedUser.id);
    if (updatedUser) setSelectedUser({ ...updatedUser });
    setRoleDialogOpen(false);
    setEditDialogOpen(false);
    setSaving(false);
  };

  const handleAssignTeam = async () => {
    if (!selectedUser || !assignTeamId || !assignAssociationId || !assignClubId) return;
    setAssignSaving(true);

    try {
      // Check for duplicate PRIMARY pending request if this is a PRIMARY membership
      if (assignMembershipType === "PRIMARY") {
        const { data: existingPendingPrimary, error: checkError } = await supabase
          .from("requests" as any)
          .select("id")
          .eq("target_user_id", selectedUser.id)
          .eq("membership_type", "PRIMARY")
          .eq("status", "PENDING");

        if (checkError) throw checkError;

        if ((existingPendingPrimary || []).length > 0) {
          toast({
            title: "Cannot send invite",
            description: "This player already has a pending primary team request. It must be cancelled before a new one can be sent.",
            variant: "destructive",
          });
          setAssignSaving(false);
          return;
        }

        // Warn if this player already has an active primary team elsewhere —
        // approving this new invite later will replace it.
        const { data: existingActivePrimary, error: activeCheckError } = await supabase
          .from("team_memberships")
          .select("id, teams(name)")
          .eq("user_id", selectedUser.id)
          .eq("membership_type", "PRIMARY")
          .eq("status", "ACTIVE");

        if (activeCheckError) throw activeCheckError;

        if ((existingActivePrimary || []).length > 0) {
          const currentPrimaryName = (existingActivePrimary[0] as unknown as { teams: { name: string } | null })?.teams?.name || "their current team";
          const confirmed = window.confirm(
            `${selectedUser.first_name} ${selectedUser.last_name} is currently primary for ${currentPrimaryName}. If this new invite is approved, it will replace that as their primary team. Continue?`
          );
          if (!confirmed) {
            setAssignSaving(false);
            return;
          }
        }
      }

      const { error } = await supabase.rpc("admin_create_team_invite" as never, {
        p_target_user_id: selectedUser.id,
        p_team_id: assignTeamId,
        p_membership_type: assignMembershipType,
        p_actor_mode: actorMode,
      } as never);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Invite sent — waiting for player to accept" });
        setShowTeamAssign(false);
        setAssignTeamId("");
        setAssignAssociationId("");
        setAssignClubId("");
        setAssignDivision("");
        const freshUsers = await fetchUsers();
        setSelectedUser((prev) => {
          if (!prev) return prev;
          const updated = freshUsers.find((u) => u.id === prev.id);
          return updated ? { ...updated } : prev;
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleMakePrimary = async (membershipId: string) => {
    if (!selectedUser) return;

    const { error } = await supabase.rpc("admin_manage_team_membership" as never, {
      p_membership_id: membershipId,
      p_action: "MAKE_PRIMARY",
      p_membership_type: null,
      p_actor_mode: actorMode,
    } as never);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Primary team updated" });
    fetchUsers();
  };

  const handleRemoveMembership = async (membershipId: string) => {
    const { error } = await supabase.rpc("admin_manage_team_membership" as never, {
      p_membership_id: membershipId,
      p_action: "REMOVE",
      p_membership_type: null,
      p_actor_mode: actorMode,
    } as never);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Membership removed" });
    const freshUsers = await fetchUsers();
    setSelectedUser((prev) => {
      if (!prev) return prev;
      const updated = freshUsers.find((u) => u.id === prev.id);
      return updated ? { ...updated } : prev;
    });
  };

  const handleCancelInvite = async (requestId: string) => {
    const { error } = await supabase.rpc("admin_cancel_team_invite" as never, {
      p_request_id: requestId,
      p_actor_mode: actorMode,
    } as never);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Invite cancelled" });
    const freshUsers = await fetchUsers();
    setSelectedUser((prev) => {
      if (!prev) return prev;
      const updated = freshUsers.find((u) => u.id === prev.id);
      return updated ? { ...updated } : prev;
    });
  };

  const handleRequestAccessLinkReview = async (details: AccessLinkReviewDetails) => {
    if (!selectedUser) return;

    const freshUsers = await fetchUsers();
    const updatedUser = freshUsers.find((item) => item.id === selectedUser.id) || selectedUser;
    setSelectedUser(updatedUser);
    setAccessReviewDetails(details);
    setConfirmEmailCurrent(false);
    setConfirmFirstNameCurrent(false);
    setConfirmLastNameCurrent(false);
    setConfirmedRoleKeys([]);
    setConfirmedTeamKeys([]);
    setAccessReviewRevSportsId(updatedUser.revsports_player_id || "");
    setEditDialogOpen(false);
    setAccessReviewOpen(true);
  };

  const handleConfirmSendAccessLink = async () => {
    if (!selectedUser || !accessReviewDetails) return;

    const isPlaceholder = selectedUser.is_placeholder === true;
    const email = accessReviewDetails.email.trim().toLowerCase();
    if (!email) {
      toast({ title: "Email required", description: "Enter the user's email address.", variant: "destructive" });
      return;
    }

    setAccessSending(true);
    try {
      const cleanRevSportsId = accessReviewRevSportsId.trim();
      if (cleanRevSportsId !== (selectedUser.revsports_player_id || "")) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ revsports_player_id: cleanRevSportsId || null } satisfies ProfileUpdate)
          .eq("id", selectedUser.id);

        if (profileError) {
          throw profileError;
        }
      }

      const { data, error } = await supabase.functions.invoke("send-profile-access-link", {
        body: {
          profile_id: selectedUser.id,
          email: isPlaceholder ? email : undefined,
        },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error, "Could not send the access link."));
      }

      const result = data as {
        error?: string;
        success?: boolean;
        link_type?: "claim" | "existing_account_claim" | "password_reset";
      } | null;
      if (!result?.success) {
        throw new Error(result?.error || "Could not send the access link.");
      }

      const toastCopy = result.link_type === "password_reset"
        ? {
            title: "Password reset sent",
            description: "The user can use the email link to reset their password.",
          }
        : result.link_type === "existing_account_claim"
          ? {
              title: "Existing account linked",
              description: "The user can use the email link to sign in and claim the placeholder profile.",
            }
          : {
              title: "Claim link sent",
              description: "The player can use the email link to create their real account.",
            };

      toast({
        title: toastCopy.title,
        description: toastCopy.description,
      });
      setAccessReviewOpen(false);
      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send the access link.";
      toast({
        title: "Access link failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAccessSending(false);
    }
  };

  const getClubsForAssociation = (assocId: string | null) => {
    if (!assocId) return clubs;
    return clubs.filter((c) => c.association_id === assocId);
  };

  const getTeamsForClub = (clubId: string | null) => {
    if (!clubId) return teams;
    return teams.filter((t) => t.club_id === clubId);
  };

  const renderTeamScopeList = (
    title: string,
    scopes: any[],
    setScopes: React.Dispatch<React.SetStateAction<any[]>>
  ) => (
    <div className="space-y-2 mt-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{title} Scope</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setScopes(prev => [...prev, { id: crypto.randomUUID(), association_id: "", club_id: "", division_id: "", team_id: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add Team
        </Button>
      </div>
      <div className="space-y-3">
        {scopes.map((scope) => {
          const divisionIdsForClub = new Set(teams.filter(t => t.club_id === scope.club_id && t.division_id).map(t => t.division_id));
          const availableDivisions = divisions.filter(d => divisionIdsForClub.has(d.id));
          const teamsForDivision = teams.filter(t => t.club_id === scope.club_id && t.division_id === scope.division_id);

          return (
            <div key={scope.id} className="grid gap-2 sm:grid-cols-5 items-end border-l-2 border-muted pl-4 py-2 relative group">
              <div className="space-y-1 col-span-1">
                <Label className="text-xs text-muted-foreground">Association</Label>
                <Select value={scope.association_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "association_id", v)}>
                  <SelectTrigger className="h-8 text-xs overflow-hidden"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {associations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs text-muted-foreground">Club</Label>
                <Select value={scope.club_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "club_id", v)} disabled={!scope.association_id}>
                  <SelectTrigger className="h-8 text-xs overflow-hidden"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {getClubsForAssociation(scope.association_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs text-muted-foreground">Division</Label>
                <Select value={scope.division_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "division_id", v)} disabled={!scope.club_id}>
                  <SelectTrigger className="h-8 text-xs overflow-hidden"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {availableDivisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs text-muted-foreground">Team</Label>
                <Select value={scope.team_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "team_id", v)} disabled={!scope.division_id}>
                  <SelectTrigger className="h-8 text-xs overflow-hidden"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {teamsForDivision.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 pb-1">
                {scopes.length > 1 && (
                  <button type="button" onClick={() => setScopes(prev => prev.filter(s => s.id !== scope.id))} className="text-xs text-destructive hover:underline px-2">
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderClubScopeList = (
    title: string,
    scopes: any[],
    setScopes: React.Dispatch<React.SetStateAction<any[]>>
  ) => (
    <div className="space-y-2 mt-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{title} Scope</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setScopes(prev => [...prev, { id: crypto.randomUUID(), association_id: "", club_id: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add Club
        </Button>
      </div>
      <div className="space-y-3">
        {scopes.map((scope) => (
          <div key={scope.id} className="grid gap-2 sm:grid-cols-4 items-end border-l-2 border-muted pl-4 py-2">
            <div className="space-y-1 col-span-1">
              <Label className="text-xs text-muted-foreground">Association</Label>
              <Select value={scope.association_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "association_id", v)}>
                <SelectTrigger className="h-8 text-xs overflow-hidden"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {associations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-1">
              <Label className="text-xs text-muted-foreground">Club</Label>
              <Select value={scope.club_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "club_id", v)} disabled={!scope.association_id}>
                <SelectTrigger className="h-8 text-xs overflow-hidden"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {getClubsForAssociation(scope.association_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1"></div>
            <div className="col-span-1 pb-1">
              {scopes.length > 1 && (
                <button type="button" onClick={() => setScopes(prev => prev.filter(s => s.id !== scope.id))} className="text-xs text-destructive hover:underline px-2">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAssociationScopeList = (
    title: string,
    scopes: any[],
    setScopes: React.Dispatch<React.SetStateAction<any[]>>
  ) => (
    <div className="space-y-2 mt-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{title} Scope</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setScopes(prev => [...prev, { id: crypto.randomUUID(), association_id: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add Association
        </Button>
      </div>
      <div className="space-y-3">
        {scopes.map((scope) => (
          <div key={scope.id} className="grid gap-2 sm:grid-cols-4 items-end border-l-2 border-muted pl-4 py-2">
            <div className="space-y-1 col-span-1">
              <Label className="text-xs text-muted-foreground">Association</Label>
              <Select value={scope.association_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "association_id", v)}>
                <SelectTrigger className="h-8 text-xs overflow-hidden"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {associations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"></div>
            <div className="col-span-1 pb-1">
              {scopes.length > 1 && (
                <button type="button" onClick={() => setScopes(prev => prev.filter(s => s.id !== scope.id))} className="text-xs text-destructive hover:underline px-2">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const canAssignCoordinator = (responsibility: CoordinationResponsibility) => {
    if (isSuperAdmin || scopedAssociationIds.length > 0) return true;
    return scopedClubIds.length > 0 && responsibility !== "UMPIRE_COORDINATOR";
  };

  const addCoordinatorScope = (responsibility: CoordinationResponsibility) => {
    const associationOnly = responsibility === "UMPIRE_COORDINATOR";
    const clubOnly = !isSuperAdmin && scopedAssociationIds.length === 0;
    setCoordinationScopes((current) => [...current, {
      id: crypto.randomUUID(),
      responsibility,
      scope_type: associationOnly || !clubOnly ? "ASSOCIATION" : "CLUB",
      scope_id: "",
    }]);
  };

  const renderCoordinatorScopes = () => (
    <div className="space-y-3 mt-5 border-t pt-4">
      <div>
        <Label className="text-sm font-medium">Coordinator responsibilities</Label>
        <p className="text-xs text-muted-foreground">Fixed permission bundles. They do not grant Association Admin or Club Admin access.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(COORDINATOR_LABELS) as CoordinationResponsibility[]).map((responsibility) => (
          <Button
            key={responsibility}
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAssignCoordinator(responsibility)}
            onClick={() => addCoordinatorScope(responsibility)}
          >
            <Plus className="mr-1 h-3 w-3" />{COORDINATOR_LABELS[responsibility]}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {coordinationScopes.map((scope) => {
          const associationOnly = scope.responsibility === "UMPIRE_COORDINATOR";
          const clubOnly = !isSuperAdmin && scopedAssociationIds.length === 0;
          const scopeOptions = scope.scope_type === "ASSOCIATION"
            ? (isSuperAdmin ? associations : availableAssociations).map((association) => ({
                id: association.id,
                label: association.name,
              }))
            : clubs
                .filter((club) => isSuperAdmin || scopedClubIds.includes(club.id) || scopedAssociationIds.includes(club.association_id))
                .map((club) => ({
                  id: club.id,
                  label: `${associations.find((association) => association.id === club.association_id)?.name || "Association"} / ${club.name}`,
                }));

          return (
            <div key={scope.id} className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[1.5fr_130px_1.5fr_auto]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Responsibility</Label>
                <Badge variant="secondary">{COORDINATOR_LABELS[scope.responsibility]}</Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Scope type</Label>
                <Select
                  value={scope.scope_type}
                  disabled={associationOnly || clubOnly}
                  onValueChange={(value) => setCoordinationScopes((current) => current.map((item) => item.id === scope.id
                    ? { ...item, scope_type: value as "ASSOCIATION" | "CLUB", scope_id: "" }
                    : item))}
                >
                  <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASSOCIATION">Association</SelectItem>
                    {!associationOnly && <SelectItem value="CLUB">Club</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Scope</Label>
                <Select
                  value={scope.scope_id || "__none__"}
                  onValueChange={(value) => setCoordinationScopes((current) => current.map((item) => item.id === scope.id
                    ? { ...item, scope_id: value === "__none__" ? "" : value }
                    : item))}
                >
                  <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select scope" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select scope</SelectItem>
                    {scopeOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setCoordinationScopes((current) => current.filter((item) => item.id !== scope.id))}>
                Remove
              </Button>
            </div>
          );
        })}
        {coordinationScopes.length === 0 && <p className="text-sm text-muted-foreground">No Coordinator responsibilities assigned.</p>}
      </div>
    </div>
  );

  const assignAvailableClubs = assignAssociationId
    ? clubs.filter((c) => c.association_id === assignAssociationId)
    : clubs;
  const assignAvailableTeams = assignDivision
    ? assignTeamOptions.filter((t: any) => t.division_id === assignDivision)
    : assignTeamOptions;

  const accessReviewUser = selectedUser;
  const accessReviewIsPlaceholder = accessReviewUser?.is_placeholder === true;
  const accessReviewAction = accessReviewIsPlaceholder ? "claim link" : "password reset";
  const activePrimaryTeam = accessReviewUser?.memberships.find(
    (membership) => membership.membership_type === "PRIMARY" && membership.status === "ACTIVE"
  );
  const accessRoleKeys = accessReviewUser?.roleScopes.map((scope, index) =>
    `${scope.role}-${scope.association_id || "all"}-${scope.club_id || "all"}-${scope.team_id || "all"}-${index}`
  ) || [];
  const accessTeamItems = accessReviewUser
    ? [
        ...accessReviewUser.memberships.map((membership) => ({ key: `membership-${membership.id}`, item: membership, pending: false })),
        ...accessReviewUser.pendingInvites.map((invite) => ({ key: `invite-${invite.id}`, item: invite, pending: true })),
      ]
    : [];
  const accessMissingItems = [
    !accessReviewDetails?.email?.trim() ? "Email" : null,
    !accessReviewDetails?.firstName?.trim() ? "First name" : null,
    !accessReviewDetails?.lastName?.trim() ? "Last name" : null,
    !activePrimaryTeam ? "Active primary team" : null,
  ].filter(Boolean) as string[];
  const allRolesConfirmed = accessRoleKeys.every((key) => confirmedRoleKeys.includes(key));
  const allTeamsConfirmed = accessTeamItems.every((team) => confirmedTeamKeys.includes(team.key));
  const accessConfirmReady =
    accessMissingItems.length === 0 &&
    confirmEmailCurrent &&
    confirmFirstNameCurrent &&
    confirmLastNameCurrent &&
    allRolesConfirmed &&
    allTeamsConfirmed &&
    !accessSending;

  const profileValue = (value?: string | null) => value?.trim() || "Not recorded";

  const getTeamSummary = (membership: Membership | PendingInvite) => {
    const team = teams.find((item) => item.id === membership.team_id);
    const club = team ? clubs.find((item) => item.id === team.club_id) : undefined;
    const association = club ? associations.find((item) => item.id === club.association_id) : undefined;
    const division = team?.division_id ? divisions.find((item) => item.id === team.division_id) : undefined;
    return [
      association?.name,
      club?.name,
      division?.name,
      membership.team_name || team?.name || "Unknown team",
    ].filter(Boolean).join(" / ");
  };

  const getRoleScopeSummary = (scope: RoleWithScope) => {
    const association = scope.association_id ? associations.find((item) => item.id === scope.association_id) : undefined;
    const club = scope.club_id ? clubs.find((item) => item.id === scope.club_id) : undefined;
    const team = scope.team_id ? teams.find((item) => item.id === scope.team_id) : undefined;
    const division = team?.division_id ? divisions.find((item) => item.id === team.division_id) : undefined;
    const scopeText = [association?.name, club?.name, division?.name, team?.name].filter(Boolean).join(" / ");
    return scopeText || "All allowed scope";
  };

  const rolePills = selectedRoles.includes("UMPIRE_ADMIN")
    ? [...ALL_ROLES, "UMPIRE_ADMIN" as AppRole]
    : ALL_ROLES;

  const rolesTabContent = rolesLoading ? (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <RefreshCw className="h-4 w-4 animate-spin" />
      Loading this user's roles...
    </div>
  ) : rolesLoadError ? (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
      Roles could not load. Close this window and try again before making changes.
    </div>
  ) : (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">RevSports Link</h4>
        {isSuperAdmin ? (
          <div className="space-y-1">
            <Label htmlFor="revsports-player-id">External player ID</Label>
            <Input
              id="revsports-player-id"
              value={revsportsPlayerIdDraft}
              onChange={(event) => setRevsportsPlayerIdDraft(event.target.value)}
              placeholder="RevSports player ID"
            />
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
            {selectedUser?.revsports_player_id || "Not linked"}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Roles</h4>
        <div className="flex flex-wrap gap-2">
          {rolePills.map((role) => {
            const disabled = !canAssignRole(role);
            const isChecked = selectedRoles.includes(role);

            return (
              <button
                key={role}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && handleToggleRole(role)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                  ${isChecked ? "opacity-100 ring-2 ring-offset-2 ring-offset-background" : "opacity-40 hover:opacity-70"}
                  ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <Badge className={`${getRoleBadgeColor(role)} pointer-events-none`} variant="secondary">
                  {getRoleDisplayName(role)}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {selectedRoles.includes("ASSOCIATION_ADMIN") && renderAssociationScopeList("Association Admin", assocAdminScopes, setAssocAdminScopes)}
      {selectedRoles.includes("CLUB_ADMIN") && renderClubScopeList("Club Admin", clubAdminScopes, setClubAdminScopes)}
      {selectedRoles.includes("COACH") && renderTeamScopeList("Coach", coachScopes, setCoachScopes)}
      {selectedRoles.includes("TEAM_MANAGER") && renderTeamScopeList("Team Manager", managerScopes, setManagerScopes)}
      {selectedRoles.includes("UMPIRE") && renderAssociationScopeList("Umpire", umpireScopes, setUmpireScopes)}
      {renderCoordinatorScopes()}
    </div>
  );

  const teamsTabContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Player Team Memberships</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowTeamAssign(!showTeamAssign)}>
          <Plus className="h-3 w-3 mr-1" />
          Assign Team
        </Button>
      </div>

      {selectedUser && (selectedUser.memberships.length > 0 || selectedUser.pendingInvites.length > 0) ? (
        <div className="space-y-1">
          {selectedUser.memberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge variant="outline" className="text-xs shrink-0">
                  {m.team_name || "Unknown"}
                </Badge>
                <MembershipTypeBadge membershipType={m.membership_type} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {m.membership_type !== "PRIMARY" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => handleMakePrimary(m.id)}>
                    Make Primary
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive" onClick={() => handleRemoveMembership(m.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {selectedUser.pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge variant="outline" className="text-xs shrink-0">
                  {invite.team_name || "Unknown"}
                </Badge>
                <MembershipTypeBadge membershipType={invite.membership_type} />
                <Badge className="text-xs shrink-0" variant="outline">
                  Pending
                </Badge>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive" onClick={() => handleCancelInvite(invite.id)}>
                Cancel
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No team memberships</p>
      )}

      {showTeamAssign && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Association</Label>
              <Select
                value={assignAssociationId}
                onValueChange={(v) => {
                  setAssignAssociationId(v);
                  setAssignClubId("");
                  setAssignDivision("");
                  setAssignTeamId("");
                }}
              >
                <SelectTrigger className="h-8 text-xs overflow-hidden">
                  <SelectValue placeholder="Select association" />
                </SelectTrigger>
                <SelectContent>
                  {associations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Club</Label>
              <Select
                value={assignClubId}
                onValueChange={(v) => {
                  setAssignClubId(v);
                  setAssignDivision("");
                  setAssignTeamId("");
                  setAssignTeamOptions([]);
                  setAssignDivisionOptions([]);
                }}
                disabled={!assignAssociationId}
              >
                <SelectTrigger className="h-8 text-xs overflow-hidden">
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  {assignAvailableClubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Division</Label>
              <Select
                value={assignDivision}
                onValueChange={(v) => {
                  setAssignDivision(v);
                  setAssignTeamId("");
                }}
                disabled={!assignClubId || assignDivisionOptions.length === 0}
              >
                <SelectTrigger className="h-8 text-xs overflow-hidden">
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {assignDivisionOptions.length === 0 ? (
                    <SelectItem value="_none" disabled>No divisions available</SelectItem>
                  ) : (
                    assignDivisionOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Team</Label>
              <Select value={assignTeamId} onValueChange={setAssignTeamId} disabled={!assignDivision}>
                <SelectTrigger className="h-8 text-xs overflow-hidden">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {assignAvailableTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Membership Type</Label>
              <Select value={assignMembershipType} onValueChange={(v) => setAssignMembershipType(v as MembershipType)}>
                <SelectTrigger className="h-8 text-xs overflow-hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primary</SelectItem>
                  <SelectItem value="SECONDARY">Secondary</SelectItem>
                  <SelectItem value="FILL_IN">Fill-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowTeamAssign(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleAssignTeam} disabled={!assignTeamId || assignSaving}>
              {assignSaving ? "Adding..." : "Add Membership"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (scopeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">Manage user profiles, roles, and memberships</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/bulk-import")}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={filteredUsers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export page
            </Button>
            <Button onClick={() => navigate("/admin/add-player")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
            {isSuperAdmin && (
              <Button
                variant="secondary"
                disabled={selectedMergeIds.length !== 2}
                onClick={() => setMergeDialogOpen(true)}
              >
                <GitMerge className="h-4 w-4 mr-2" />
                Merge Selected
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or registration ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              {isSuperAdmin && <SelectItem value="unassigned">Unassigned</SelectItem>}
              <SelectItem value="duplicates">Duplicates</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={associationFilter}
            onValueChange={(v) => {
              setAssociationFilter(v);
              setClubFilter("all");
              setDivisionFilter("all");
              setTeamFilter("all");
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Association" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Associations</SelectItem>
              {availableAssociations.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={clubFilter}
            onValueChange={(v) => {
              setClubFilter(v);
              setDivisionFilter("all");
              setTeamFilter("all");
            }}
            disabled={associationFilter === "all"}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Club" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {availableClubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={divisionFilter}
            onValueChange={(v) => {
              setDivisionFilter(v);
              setTeamFilter("all");
            }}
            disabled={clubFilter === "all"}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {availableDivisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter} disabled={divisionFilter === "all"}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {availableTeamsForFilter.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={hidePlaceholders ? "secondary" : "outline"}
            onClick={() => setHidePlaceholders(prev => !prev)}
            title={hidePlaceholders ? "Click to show placeholder profiles" : "Click to hide placeholder profiles"}
          >
            {hidePlaceholders ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Placeholders hidden
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Placeholders shown
              </>
            )}
          </Button>
        </div>

        {/* Pending Primary Team Change Requests */}
        {primaryRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw className="h-5 w-5" />
                Primary Team Changes ({primaryRequests.length})
              </CardTitle>
              <CardDescription>
                These are handled from Requests so the badge count and action list stay matched.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {primaryRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{req.user_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.from_team_name
                          ? `${req.from_team_name} → ${req.to_team_name}`
                          : `Set ${req.to_team_name} as primary`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate("/admin/requests")}>
                        Open Requests
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users
              </CardTitle>
              <CardDescription>{totalUserCount} user(s)</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(val) => {
                  setRowsPerPage(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found.</div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSuperAdmin && <TableHead className="w-12"></TableHead>}
                    <TableHead>Name</TableHead>
                    <TableHead>Association / Club / Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => (
                    <TableRow key={u.id}>
                      {isSuperAdmin && (
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selectedMergeIds.includes(u.id)}
                            onCheckedChange={() => handleToggleSelectUser(u.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {u.first_name || u.last_name
                              ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                              : "(No name)"}
                            {duplicateUserIds.has(u.id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>Possible duplicate account</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {u.email && (
                            <div className="text-xs font-normal text-muted-foreground">
                              {u.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.memberships.length === 0 ? (
                          renderRoleScopeAssignments(u)
                        ) : (
                          <div className="space-y-1">
                            {(() => {
                              const primaryMembership = u.memberships.find(m => m.membership_type === "PRIMARY");
                              if (!primaryMembership) return null;
                              const primaryTeam = teams.find((t) => t.id === primaryMembership.team_id);
                              const primaryClub = primaryTeam ? clubs.find((c) => c.id === primaryTeam.club_id) : undefined;
                              const primaryAssociation = primaryClub ? associations.find((a) => a.id === primaryClub.association_id) : undefined;
                              const divisionId = primaryTeam?.division_id;
                              const primaryDivisionName = divisionId ? divisions.find((d) => d.id === divisionId)?.name : undefined;
                              
                              const primaryParts = [];
                              if (primaryAssociation?.name) primaryParts.push(primaryAssociation.name);
                              if (primaryClub?.name) primaryParts.push(primaryClub.name);
                              if (primaryDivisionName) primaryParts.push(primaryDivisionName);
                              if (primaryMembership.team_name) primaryParts.push(primaryMembership.team_name);
                              
                              const primaryDisplayText = primaryParts.join(" / ") || "Unknown";
                              return (
                                <Badge variant="outline" className="text-xs">
                                  {primaryDisplayText}
                                </Badge>
                              );
                            })()}
                            
                            {(() => {
                              const nonPrimaryMemberships = u.memberships.filter((m) => m.membership_type !== "PRIMARY");
                              if (nonPrimaryMemberships.length === 0) return null;
                              
                              return (
                                <>
                                  <button
                                    onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                                    className="text-xs text-muted-foreground hover:underline block mt-1"
                                  >
                                    +{nonPrimaryMemberships.length} more
                                  </button>
                                  {expandedUserId === u.id && (
                                    <div className="flex flex-col gap-1 mt-1 pl-2 border-l border-muted">
                                      {nonPrimaryMemberships.map((m) => {
                                        const team = teams.find((t) => t.id === m.team_id);
                                        const club = team ? clubs.find((c) => c.id === team.club_id) : undefined;
                                        const parts = [];
                                        if (club?.name) parts.push(club.name);
                                        if (m.team_name) parts.push(m.team_name);
                                        const displayText = parts.join(" / ") || "Unknown";
                                        return (
                                          <div key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <span>{displayText}</span>
                                            <MembershipTypeBadge membershipType={m.membership_type} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            {(u.roleScopes.length > 0 || u.coordinationScopes.length > 0) && renderRoleScopeAssignments(u)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const primaryMembership = u.memberships.find(m => m.membership_type === "PRIMARY") ?? u.memberships[0];
                          if (!primaryMembership) {
                            return <span className="text-muted-foreground text-sm">-</span>;
                          }
                          return (
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="secondary"
                                className={
                                  primaryMembership.status === "PENDING"
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                                    : primaryMembership.status === "ACTIVE"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                }
                              >
                                {primaryMembership.status}
                              </Badge>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && u.coordinationScopes.length === 0 ? (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          ) : (
                            <>
                            {u.roles.map((role) => (
                              <Badge key={role} className={getRoleBadgeColor(role)} variant="secondary">
                                {getRoleDisplayName(role)}
                              </Badge>
                            ))}
                            {Array.from(new Set(u.coordinationScopes.map((scope) => scope.responsibility))).map((responsibility) => (
                              <Badge key={responsibility} variant="outline">
                                {COORDINATOR_LABELS[responsibility]}
                              </Badge>
                            ))}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditDialog(u)}
                            disabled={!canEditUser(u)}
                            title={!canEditUser(u) ? "Your active role cannot edit this account" : undefined}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(() => {
                const totalPages = Math.ceil(totalUserCount / rowsPerPage);
                if (totalPages <= 1) return null;
                return (
                  <div className="flex items-center justify-between mt-4 py-4 border-t px-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </Button>
                  </div>
                );
              })()}
              </>
            )}
          </CardContent>
        </Card>

        <EditUserDetailsDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              roleLoadRequestRef.current += 1;
              setRolesLoading(false);
              setRolesLoadError(null);
            }
          }}
          user={selectedUser}
          onSendAccessLink={handleRequestAccessLinkReview}
          accessLinkSending={accessSending}
          rolesContent={rolesTabContent}
          teamsContent={teamsTabContent}
          onSaveRoles={handleSaveRoles}
          rolesSaving={saving}
          rolesLoading={rolesLoading}
          rolesLoadError={rolesLoadError}
          actorMode={actorMode}
          canManageAuthentication={actualIsSuperAdmin && actorMode === "super_admin"}
          membershipOnly={actorMode === "team_manager"}
          onSuccess={async () => {
            const freshUsers = await fetchUsers();
            setSelectedUser((prev) => {
              if (!prev) return prev;
              const updated = freshUsers.find((u) => u.id === prev.id);
              return updated ? { ...updated } : prev;
            });
          }}
        />

        <Dialog
          open={accessReviewOpen}
          onOpenChange={(open) => {
            setAccessReviewOpen(open);
            if (!open) {
              setConfirmEmailCurrent(false);
              setConfirmFirstNameCurrent(false);
              setConfirmLastNameCurrent(false);
              setConfirmedRoleKeys([]);
              setConfirmedTeamKeys([]);
              setAccessReviewRevSportsId("");
              setAccessReviewDetails(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Confirm {accessReviewIsPlaceholder ? "Claim Link" : "Password Reset"}
              </DialogTitle>
              <DialogDescription>
                Review the profile, roles, and teams before sending the {accessReviewAction} email.
              </DialogDescription>
            </DialogHeader>

            {accessReviewUser && accessReviewDetails && (
              <div className="space-y-5 py-2">
                {accessMissingItems.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    Missing required information: {accessMissingItems.join(", ")}.
                  </div>
                )}

                <div className="rounded-md border p-3">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Details to Confirm
                  </h3>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <label htmlFor="confirm-email-current" className="flex items-start gap-3 rounded-md border bg-muted/30 p-2">
                      <Checkbox
                        id="confirm-email-current"
                        checked={confirmEmailCurrent}
                        onCheckedChange={(checked) => setConfirmEmailCurrent(checked === true)}
                      />
                      <span>
                        <span className="block text-muted-foreground">Email</span>
                        <span className="font-medium">{profileValue(accessReviewDetails.email)}</span>
                      </span>
                    </label>
                    <label htmlFor="confirm-first-name-current" className="flex items-start gap-3 rounded-md border bg-muted/30 p-2">
                      <Checkbox
                        id="confirm-first-name-current"
                        checked={confirmFirstNameCurrent}
                        onCheckedChange={(checked) => setConfirmFirstNameCurrent(checked === true)}
                      />
                      <span>
                        <span className="block text-muted-foreground">First name</span>
                        <span className="font-medium">{profileValue(accessReviewDetails.firstName)}</span>
                      </span>
                    </label>
                    <label htmlFor="confirm-last-name-current" className="flex items-start gap-3 rounded-md border bg-muted/30 p-2">
                      <Checkbox
                        id="confirm-last-name-current"
                        checked={confirmLastNameCurrent}
                        onCheckedChange={(checked) => setConfirmLastNameCurrent(checked === true)}
                      />
                      <span>
                        <span className="block text-muted-foreground">Last name</span>
                        <span className="font-medium">{profileValue(accessReviewDetails.lastName)}</span>
                      </span>
                    </label>
                    <div className="space-y-1">
                      <Label htmlFor="access-revsports-player-id">RevSports ID</Label>
                      <Input
                        id="access-revsports-player-id"
                        value={accessReviewRevSportsId}
                        onChange={(event) => setAccessReviewRevSportsId(event.target.value)}
                        placeholder="RevSports player ID"
                        disabled={!isSuperAdmin || accessSending}
                      />
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{" "}
                      <span className="font-medium">{profileValue(accessReviewDetails.phone)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date of birth:</span>{" "}
                      <span className="font-medium">{profileValue(accessReviewDetails.dateOfBirth)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gender:</span>{" "}
                      <span className="font-medium">{profileValue(accessReviewDetails.gender)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Suburb:</span>{" "}
                      <span className="font-medium">{profileValue(accessReviewDetails.suburb)}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Address:</span>{" "}
                      <span className="font-medium">{profileValue(accessReviewDetails.streetAddress)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Emergency contact:</span>{" "}
                      <span className="font-medium">{profileValue(accessReviewDetails.emergencyContactName)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Emergency phone:</span>{" "}
                      <span className="font-medium">{profileValue(accessReviewDetails.emergencyContactPhone)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Roles and Permissions
                  </h3>
                  {accessReviewUser.roleScopes.length > 0 ? (
                    <div className="space-y-2">
                      {accessReviewUser.roleScopes.map((scope, index) => {
                        const roleKey = accessRoleKeys[index];
                        return (
                          <label key={roleKey} htmlFor={`confirm-role-${roleKey}`} className="flex items-start gap-3 text-sm">
                            <Checkbox
                              id={`confirm-role-${roleKey}`}
                              checked={confirmedRoleKeys.includes(roleKey)}
                              onCheckedChange={(checked) => {
                                setConfirmedRoleKeys((current) =>
                                  checked === true
                                    ? Array.from(new Set([...current, roleKey]))
                                    : current.filter((key) => key !== roleKey)
                                );
                              }}
                            />
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge className={getRoleBadgeColor(scope.role)} variant="secondary">
                                {getRoleDisplayName(scope.role)}
                              </Badge>
                              <span className="text-muted-foreground">{getRoleScopeSummary(scope)}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No roles recorded.</p>
                  )}
                </div>

                <div className="rounded-md border p-3">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Teams
                  </h3>
                  {accessTeamItems.length > 0 ? (
                    <div className="space-y-2">
                      {accessTeamItems.map(({ key, item, pending }) => (
                        <label key={key} htmlFor={`confirm-team-${key}`} className="flex items-start gap-3 text-sm">
                          <Checkbox
                            id={`confirm-team-${key}`}
                            checked={confirmedTeamKeys.includes(key)}
                            onCheckedChange={(checked) => {
                              setConfirmedTeamKeys((current) =>
                                checked === true
                                  ? Array.from(new Set([...current, key]))
                                  : current.filter((teamKey) => teamKey !== key)
                              );
                            }}
                          />
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{pending ? "PENDING INVITE" : (item as Membership).status}</Badge>
                            <MembershipTypeBadge membershipType={item.membership_type} />
                            <span className="text-muted-foreground">{getTeamSummary(item)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No teams recorded.</p>
                  )}
                </div>

              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setAccessReviewOpen(false)} disabled={accessSending}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSendAccessLink} disabled={!accessConfirmReady}>
                {accessSending ? "Sending..." : `Send ${accessReviewIsPlaceholder ? "Claim Link" : "Password Reset"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <MergeProfilesDialog
          open={mergeDialogOpen}
          onOpenChange={(open) => {
            setMergeDialogOpen(open);
            if (!open) {
              setSelectedMergeIds([]);
            }
          }}
          profileIdA={selectedMergeIds[0]}
          profileIdB={selectedMergeIds[1]}
          onSuccess={async () => {
            await fetchUsers();
            setSelectedMergeIds([]);
          }}
        />

        {/* Role Management Dialog */}
        <Dialog
          open={roleDialogOpen}
          onOpenChange={(open) => {
            setRoleDialogOpen(open);
            if (!open) {
              roleLoadRequestRef.current += 1;
              setRolesLoading(false);
              setRolesLoadError(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Roles & Teams</DialogTitle>
              <DialogDescription>
                Update roles and team assignments for {selectedUser?.first_name} {selectedUser?.last_name}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="roles" className="py-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className="space-y-4 mt-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">RevSports Link</h4>
                {isSuperAdmin ? (
                  <div className="space-y-1">
                    <Label htmlFor="revsports-player-id">External player ID</Label>
                    <Input
                      id="revsports-player-id"
                      value={revsportsPlayerIdDraft}
                      onChange={(event) => setRevsportsPlayerIdDraft(event.target.value)}
                      placeholder="RevSports player ID"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
                    {selectedUser?.revsports_player_id || "Not linked"}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Roles</h4>
                <div className="flex flex-wrap gap-2">
                  {rolePills.map((role) => {
                    const disabled = !canAssignRole(role);
                    const isChecked = selectedRoles.includes(role);

                    return (
                      <button
                        key={role}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && handleToggleRole(role)}
                        className={`
                          px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                          ${isChecked
                            ? "opacity-100 ring-2 ring-offset-2 ring-offset-background"
                            : "opacity-40 hover:opacity-70"
                          }
                          ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
                        `}
                      >
                        <Badge
                          className={`${getRoleBadgeColor(role)} pointer-events-none`}
                          variant="secondary"
                        >
                          {getRoleDisplayName(role)}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedRoles.includes("ASSOCIATION_ADMIN") && renderAssociationScopeList("Association Admin", assocAdminScopes, setAssocAdminScopes)}
              {selectedRoles.includes("CLUB_ADMIN") && renderClubScopeList("Club Admin", clubAdminScopes, setClubAdminScopes)}
              {selectedRoles.includes("COACH") && renderTeamScopeList("Coach", coachScopes, setCoachScopes)}
              {selectedRoles.includes("TEAM_MANAGER") && renderTeamScopeList("Team Manager", managerScopes, setManagerScopes)}
              {selectedRoles.includes("UMPIRE") && renderAssociationScopeList("Umpire", umpireScopes, setUmpireScopes)}
              {renderCoordinatorScopes()}
              </TabsContent>

              <TabsContent value="teams" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Player Team Memberships</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTeamAssign(!showTeamAssign)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Assign Team
                </Button>
              </div>

              {selectedUser && (selectedUser.memberships.length > 0 || selectedUser.pendingInvites.length > 0) ? (
                <div className="space-y-1">
                  {selectedUser.memberships.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {m.team_name || "Unknown"}
                        </Badge>
                        <MembershipTypeBadge membershipType={m.membership_type} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.membership_type !== "PRIMARY" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleMakePrimary(m.id)}
                          >
                            Make Primary
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMembership(m.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}

                  {selectedUser && selectedUser.pendingInvites.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {selectedUser.pendingInvites.map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/40 last:border-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge variant="outline" className="text-xs shrink-0">
                              {invite.team_name || "Unknown"}
                            </Badge>
                            <MembershipTypeBadge membershipType={invite.membership_type} />
                            <Badge className="text-xs shrink-0" variant="outline">
                              Pending
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No team memberships</p>
              )}

              {showTeamAssign && (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {/* Association */}
                    <div className="space-y-1">
                      <Label className="text-xs">Association</Label>
                      <Select
                        value={assignAssociationId}
                        onValueChange={(v) => {
                          setAssignAssociationId(v);
                          setAssignClubId("");
                          setAssignDivision("");
                          setAssignTeamId("");
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs overflow-hidden">
                          <SelectValue placeholder="Select association" />
                        </SelectTrigger>
                        <SelectContent>
                          {associations.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Club */}
                    <div className="space-y-1">
                      <Label className="text-xs">Club</Label>
                      <Select
                        value={assignClubId}
                        onValueChange={(v) => {
                          setAssignClubId(v);
                          setAssignDivision("");
                          setAssignTeamId("");
                          setAssignTeamOptions([]);
                          setAssignDivisionOptions([]);
                        }}
                        disabled={!assignAssociationId}
                      >
                        <SelectTrigger className="h-8 text-xs overflow-hidden">
                          <SelectValue placeholder="Select club" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignAvailableClubs.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Division */}
                    <div className="space-y-1">
                      <Label className="text-xs">Division</Label>
                      <Select
                        value={assignDivision}
                        onValueChange={(v) => {
                          setAssignDivision(v);
                          setAssignTeamId("");
                        }}
                        disabled={!assignClubId || assignDivisionOptions.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs overflow-hidden">
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignDivisionOptions.length === 0 ? (
                            <SelectItem value="_none" disabled>No divisions available</SelectItem>
                          ) : (
                            assignDivisionOptions.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Team */}
                    <div className="space-y-1">
                      <Label className="text-xs">Team</Label>
                      <Select
                        value={assignTeamId}
                        onValueChange={setAssignTeamId}
                        disabled={!assignDivision}
                      >
                        <SelectTrigger className="h-8 text-xs overflow-hidden">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignAvailableTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Membership Type */}
                    <div className="space-y-1">
                      <Label className="text-xs">Membership Type</Label>
                      <Select
                        value={assignMembershipType}
                        onValueChange={(v) => setAssignMembershipType(v as MembershipType)}
                      >
                        <SelectTrigger className="h-8 text-xs overflow-hidden">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRIMARY">Primary</SelectItem>
                          <SelectItem value="SECONDARY">Secondary</SelectItem>
                          <SelectItem value="FILL_IN">Fill-in</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowTeamAssign(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleAssignTeam} disabled={!assignTeamId || assignSaving}>
                      {assignSaving ? "Adding..." : "Add Membership"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveRoles} disabled={saving || rolesLoading || Boolean(rolesLoadError)}>
                {saving ? "Saving..." : "Save Roles"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default UsersManagement;
