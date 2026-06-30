import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { useNavigate } from "react-router-dom";
import { Users, ArrowLeft, Shield, Search, Check, X, UserPlus, FileSpreadsheet, Download, RefreshCw, Plus, AlertTriangle, Pencil, GitMerge, Mail, Eye, EyeOff, KeyRound } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDisplayName, getRoleBadgeColor } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";
import { EditUserDetailsDialog } from "@/components/admin/EditUserDetailsDialog";
import { ensurePlayerRoleForTeam } from "@/lib/playerRoles";
import { MergeProfilesDialog } from "@/components/admin/MergeProfilesDialog";

type AppRole = Database["public"]["Enums"]["app_role"];
type MembershipType = Database["public"]["Enums"]["membership_type"];
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
  memberships: Membership[];
  pendingInvites: PendingInvite[];
}

interface RoleWithScope {
  role: AppRole;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

const ALL_ROLES: AppRole[] = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN", "SUPER_ADMIN", "UMPIRE", "VOTER"];

const ROLES_NEEDING_SCOPE: Record<string, string> = {
  ASSOCIATION_ADMIN: "association",
  CLUB_ADMIN: "club",
  TEAM_MANAGER: "team",
  COACH: "team",
};

const UsersManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedTeamIds, scopedClubIds, scopedAssociationIds } = useAdminScope();

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string; division?: string | null; division_id?: string | null }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [associationFilter, setAssociationFilter] = useState<string>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const availableTeamsForFilter = useMemo(() => {
    if (divisionFilter === "all") return teams;
    return teams.filter((t) => t.division_id === divisionFilter);
  }, [teams, divisionFilter]);

  const [hidePlaceholders, setHidePlaceholders] = useState(true);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, associationFilter, clubFilter, divisionFilter, teamFilter, hidePlaceholders]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessSending, setAccessSending] = useState(false);
  
  const handleOpenEditDialog = (u: UserWithRoles) => {
    setSelectedUser(u);
    setEditDialogOpen(true);
  };

  const handleOpenAccessDialog = (u: UserWithRoles) => {
    setSelectedUser(u);
    setAccessEmail("");
    setAccessDialogOpen(true);
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
  const [coachScopes, setCoachScopes] = useState<{ id: string, association_id: string, club_id: string, team_id: string }[]>([]);
  const [managerScopes, setManagerScopes] = useState<{ id: string, association_id: string, club_id: string, team_id: string }[]>([]);
  const [assocAdminScopes, setAssocAdminScopes] = useState<{ id: string, association_id: string }[]>([]);
  const [clubAdminScopes, setClubAdminScopes] = useState<{ id: string, association_id: string, club_id: string }[]>([]);
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

  const fetchUsers = async () => {
    setLoading(true);

    const [teamsRes, clubsRes, assocRes, divsRes] = await Promise.all([
      supabase.from("teams" as any).select("id, name, club_id, division, division_id"),
      supabase.from("clubs").select("id, name, association_id"),
      supabase.from("associations").select("id, name"),
      supabase.from("divisions" as any).select("id, name"),
    ]);
    setTeams((teamsRes.data as any) || []);
    setClubs((clubsRes.data as any) || []);
    setAssociations((assocRes.data as any) || []);
    setDivisions((divsRes.data as any) || []);

    const teamsList = (teamsRes.data as any) || [];
    const teamsToShow = isSuperAdmin ? teamsList.map((t) => t.id) : scopedTeamIds;

    let membershipsData: any[] = [];
    if (isSuperAdmin) {
      const { data } = await supabase.from("team_memberships").select("id, user_id, team_id, status, membership_type");
      membershipsData = data || [];
    } else if (teamsToShow.length > 0) {
      const { data } = await supabase.from("team_memberships").select("id, user_id, team_id, status, membership_type").in("team_id", teamsToShow);
      membershipsData = data || [];
    }

    const { data: pendingInvitesData } = await supabase
      .from("requests" as never)
      .select("id, target_user_id, team_id, membership_type")
      .eq("request_type", "TEAM_INVITE")
      .eq("status", "PENDING");

    const memberUserIds = [...new Set(membershipsData.map((m) => m.user_id))];

    let profiles: Profile[] = [];
    if (isSuperAdmin) {
      const { data } = await supabase.from("profiles").select("*").order("first_name");
      profiles = data || [];
    } else if (memberUserIds.length > 0) {
      const { data } = await supabase.from("profiles").select("*").in("id", memberUserIds).order("first_name");
      profiles = data || [];
    }

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role, association_id, club_id, team_id");

    const usersWithRoles: UserWithRoles[] = profiles.map((profile) => {
      const profileRoles = ((userRoles || []) as RoleWithScope[] & { user_id: string }[])
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

      const membershipTeamIds = new Set(membershipRows.map((membership) => membership.team_id));
      const roleOnlyMembershipRows = profileRoles
        .filter((role) => ["PLAYER", "COACH", "TEAM_MANAGER"].includes(role.role) && role.team_id && !membershipTeamIds.has(role.team_id))
        .map((role) => {
          const team = teamsList.find((t) => t.id === role.team_id);
          return {
            id: `role-${profile.id}-${role.role}-${role.team_id}`,
            team_id: role.team_id as string,
            status: "ACTIVE",
            membership_type: "PRIMARY",
            team_name: team?.name,
            club_id: team?.club_id || role.club_id || undefined,
          };
        });

      return {
        ...profile,
        roles: Array.from(new Set(profileRoles.map((r) => r.role))),
        roleScopes: profileRoles,
        memberships: [...membershipRows, ...roleOnlyMembershipRows],
        pendingInvites: ((pendingInvitesData as unknown as PendingInviteRow[]) || [])
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

    setUsers(usersWithRoles);
    setLoading(false);
    return usersWithRoles;
  };

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
    if (!scopeLoading && isAnyAdmin) {
      fetchUsers();
      fetchPrimaryRequests();
    }
  }, [scopeLoading, isAnyAdmin, isSuperAdmin, scopedTeamIds]);

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

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    if (!fullName.includes(searchQuery.toLowerCase())) return false;
    if (statusFilter === "duplicates") {
      return duplicateUserIds.has(user.id);
    }
    if (statusFilter !== "all") {
      if (statusFilter === "unassigned") {
        if (user.memberships.length > 0) return false;
      } else {
        if (!user.memberships.some((m) => m.status === statusFilter)) return false;
      }
    }
    if (associationFilter !== "all") {
      const assocTeamIds = teams
        .filter((t) => {
          const club = clubs.find((c) => c.id === t.club_id);
          return club?.association_id === associationFilter;
        })
        .map((t) => t.id);
      if (!user.memberships.some((m) => assocTeamIds.includes(m.team_id))) return false;
    }
    if (clubFilter !== "all") {
      const clubTeamIds = teams.filter((t) => t.club_id === clubFilter).map((t) => t.id);
      if (!user.memberships.some((m) => clubTeamIds.includes(m.team_id))) return false;
    }
    if (divisionFilter !== "all") {
      const divisionTeamIds = teams.filter((t) => t.division_id === divisionFilter).map((t) => t.id);
      if (!user.memberships.some((m) => divisionTeamIds.includes(m.team_id))) return false;
    }
    if (teamFilter !== "all") {
      if (!user.memberships.some((m) => m.team_id === teamFilter)) return false;
    }
    if (hidePlaceholders && (user as any).is_placeholder === true) return false;
    return true;
  });

  const paginatedUsers = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredUsers.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredUsers, currentPage, rowsPerPage]);

  const availableAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  const availableClubs = clubs.filter((c) => {
    if (associationFilter !== "all") return c.association_id === associationFilter;
    if (!isSuperAdmin) {
      return scopedClubIds.includes(c.id) || scopedAssociationIds.includes(c.association_id);
    }
    return true;
  });

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
        "Email": "",
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
    const { error } = await supabase.from("team_memberships").update({ status: "ACTIVE" }).eq("id", membershipId);
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
    const { error } = await supabase.from("team_memberships").update({ status: "DECLINED" }).eq("id", membershipId);
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

  const handleOpenRoleDialog = async (u: UserWithRoles) => {
    setSelectedUser(u);
    setRevsportsPlayerIdDraft(u.revsports_player_id || "");
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role, association_id, club_id, team_id")
      .eq("user_id", u.id);

    const roles = new Set<AppRole>();
    const cScopes: any[] = [];
    const mScopes: any[] = [];
    const aScopes: any[] = [];
    const clScopes: any[] = [];

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
      }
    });

    setSelectedRoles(Array.from(roles));
    setCoachScopes(cScopes.length > 0 ? cScopes : [{ id: crypto.randomUUID(), association_id: "", club_id: "", division_id: "", team_id: "" }]);
    setManagerScopes(mScopes.length > 0 ? mScopes : [{ id: crypto.randomUUID(), association_id: "", club_id: "", division_id: "", team_id: "" }]);
    setAssocAdminScopes(aScopes.length > 0 ? aScopes : [{ id: crypto.randomUUID(), association_id: "" }]);
    setClubAdminScopes(clScopes.length > 0 ? clScopes : [{ id: crypto.randomUUID(), association_id: "", club_id: "" }]);
    setShowTeamAssign(false);
    setAssignAssociationId("");
    setAssignClubId("");
    setAssignDivision("");
    setAssignTeamId("");
    setAssignMembershipType("PRIMARY");
    setRoleDialogOpen(true);
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
    if (isSuperAdmin) return true;
    if (role === "SUPER_ADMIN") return false;
    if (scopedAssociationIds.length > 0) {
      return ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN"].includes(role);
    }
    if (scopedClubIds.length > 0) {
      return ["PLAYER", "COACH", "TEAM_MANAGER"].includes(role);
    }
    return false;
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    setSaving(true);

    if (isSuperAdmin) {
      const cleanRevSportsId = revsportsPlayerIdDraft.trim();
      const profileUpdate: Partial<Profile> = { revsports_player_id: cleanRevSportsId || null };
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", selectedUser.id);

      if (profileError) {
        toast({ title: "Error", description: profileError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
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

    const { error } = await supabase.rpc('admin_save_user_roles' as any, {
      p_user_id: selectedUser.id,
      p_roles: selectedRoles,
      p_coach_scopes: p_coach_scopes.length > 0 ? p_coach_scopes : null,
      p_manager_scopes: p_manager_scopes.length > 0 ? p_manager_scopes : null,
      p_association_admin_associations: p_association_admin_associations.length > 0 ? p_association_admin_associations : null,
      p_club_admin_scopes: p_club_admin_scopes.length > 0 ? p_club_admin_scopes : null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    toast({ title: "Success", description: "User roles updated" });
    setRoleDialogOpen(false);
    fetchUsers();
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

      const { error } = await supabase.from("requests" as any).insert({
        request_type: "TEAM_INVITE",
        requester_id: user?.id,
        target_user_id: selectedUser.id,
        team_id: assignTeamId,
        association_id: assignAssociationId,
        club_id: assignClubId,
        membership_type: assignMembershipType,
        status: "PENDING",
      });

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

    // Downgrade any existing PRIMARY to SECONDARY first
    const { error: downgradeError } = await supabase
      .from("team_memberships")
      .update({ membership_type: "SECONDARY" })
      .eq("user_id", selectedUser.id)
      .eq("membership_type", "PRIMARY");

    if (downgradeError) {
      toast({ title: "Error", description: downgradeError.message, variant: "destructive" });
      return;
    }

    // Upgrade the chosen membership to PRIMARY
    const { error: upgradeError } = await supabase
      .from("team_memberships")
      .update({ membership_type: "PRIMARY" })
      .eq("id", membershipId);

    if (upgradeError) {
      toast({ title: "Error", description: upgradeError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Primary team updated" });
    fetchUsers();
  };

  const handleRemoveMembership = async (membershipId: string) => {
    const { error } = await supabase
      .from("team_memberships")
      .delete()
      .eq("id", membershipId);

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
    const { error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("requests" as any)
      .update({ status: "CANCELLED", cancelled_by: user?.id })
      .eq("id", requestId);

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

  const handleSendAccessLink = async () => {
    if (!selectedUser) return;

    const isPlaceholder = selectedUser.is_placeholder === true;
    const email = accessEmail.trim().toLowerCase();
    if (isPlaceholder && !email) {
      toast({ title: "Email required", description: "Enter the player's real email address.", variant: "destructive" });
      return;
    }

    setAccessSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-profile-access-link", {
        body: {
          profile_id: selectedUser.id,
          email: isPlaceholder ? email : undefined,
        },
      });

      if (error) {
        throw error;
      }

      const result = data as { error?: string; success?: boolean; link_type?: "claim" | "password_reset" } | null;
      if (!result?.success) {
        throw new Error(result?.error || "Could not send the access link.");
      }

      toast({
        title: result.link_type === "password_reset" ? "Password reset sent" : "Claim link sent",
        description: result.link_type === "password_reset"
          ? "The user can use the email link to reset their password."
          : "The player can use the email link to create their real account.",
      });
      setAccessDialogOpen(false);
      setAccessEmail("");
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
        <Button variant="ghost" size="sm" onClick={() => setScopes(prev => [...prev, { id: crypto.randomUUID(), association_id: "", club_id: "", division_id: "", team_id: "" }])}>
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
        <Button variant="ghost" size="sm" onClick={() => setScopes(prev => [...prev, { id: crypto.randomUUID(), association_id: "", club_id: "" }])}>
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
        <Button variant="ghost" size="sm" onClick={() => setScopes(prev => [...prev, { id: crypto.randomUUID(), association_id: "" }])}>
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

  const assignAvailableClubs = assignAssociationId
    ? clubs.filter((c) => c.association_id === assignAssociationId)
    : clubs;
  const assignAvailableTeams = assignDivision
    ? assignTeamOptions.filter((t: any) => t.division_id === assignDivision)
    : assignTeamOptions;

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
              Export
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
              placeholder="Search by name..."
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
              <SelectItem value="DECLINED">Declined</SelectItem>
              {isSuperAdmin && <SelectItem value="unassigned">Unassigned</SelectItem>}
              <SelectItem value="duplicates">Duplicates</SelectItem>
            </SelectContent>
          </Select>
          <Select value={associationFilter} onValueChange={(v) => { setAssociationFilter(v); setClubFilter("all"); }}>
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
          <Select value={clubFilter} onValueChange={setClubFilter}>
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
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
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
        {primaryRequests.length > 0 && selectedMergeIds.length < 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw className="h-5 w-5" />
                Pending Primary Team Changes ({primaryRequests.length})
              </CardTitle>
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
                      <Button size="sm" variant="outline" onClick={() => handleApprovePrimaryRequest(req.id)}>
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeclinePrimaryRequest(req.id)}>
                        <X className="h-3 w-3 mr-1" /> Decline
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
              <CardDescription>{filteredUsers.length} user(s)</CardDescription>
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
                      </TableCell>
                      <TableCell>
                        {u.memberships.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
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
                                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase font-semibold">
                                              {m.membership_type}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
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
                          {u.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          ) : (
                            u.roles.map((role) => (
                              <Badge key={role} className={getRoleBadgeColor(role)} variant="secondary">
                                {getRoleDisplayName(role)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(u)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Details
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenRoleDialog(u)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Roles & Teams
                          </Button>
                          {u.is_placeholder ? (
                            <Button variant="outline" size="sm" onClick={() => handleOpenAccessDialog(u)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Claim Link
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleOpenAccessDialog(u)}>
                              <KeyRound className="mr-2 h-4 w-4" />
                              Password Reset
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleSelectUser(u.id)}
                              className={selectedMergeIds.includes(u.id) ? "bg-muted" : ""}
                            >
                              <GitMerge className="mr-2 h-4 w-4" />
                              Merge
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(() => {
                const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
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
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSuccess={async () => {
            const freshUsers = await fetchUsers();
            setSelectedUser((prev) => {
              if (!prev) return prev;
              const updated = freshUsers.find((u) => u.id === prev.id);
              return updated ? { ...updated } : prev;
            });
          }}
        />

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

        <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedUser?.is_placeholder ? "Send Claim Link" : "Send Password Reset"}
              </DialogTitle>
              <DialogDescription>
                {selectedUser?.is_placeholder
                  ? "Send a private email link so this placeholder player can create a real account."
                  : "Send a password reset email to this user's account email."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">
                  {selectedUser?.first_name || selectedUser?.last_name
                    ? `${selectedUser?.first_name || ""} ${selectedUser?.last_name || ""}`.trim()
                    : "Placeholder player"}
                </div>
                <div className="text-muted-foreground">
                  RevSports ID: {selectedUser?.revsports_player_id || "Not linked"}
                </div>
              </div>

              {selectedUser?.is_placeholder ? (
                <div className="space-y-1">
                  <Label htmlFor="access-email">Player email</Label>
                  <Input
                    id="access-email"
                    type="email"
                    value={accessEmail}
                    onChange={(event) => setAccessEmail(event.target.value)}
                    placeholder="player@example.com"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This will use the email address already attached to the user's SportStack account.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAccessDialogOpen(false)} disabled={accessSending}>
                Cancel
              </Button>
              <Button onClick={handleSendAccessLink} disabled={accessSending}>
                {accessSending
                  ? "Sending..."
                  : selectedUser?.is_placeholder
                    ? "Send Claim Link"
                    : "Send Password Reset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Role Management Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Roles & Teams</DialogTitle>
              <DialogDescription>
                Update roles and team assignments for {selectedUser?.first_name} {selectedUser?.last_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
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
                  {ALL_ROLES.map((role) => {
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
            </div>

            <Separator />

            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Team Memberships</h4>
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
                        <Badge
                          className={`text-xs shrink-0 ${
                            m.membership_type === "PRIMARY"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                          variant="secondary"
                        >
                          {m.membership_type}
                        </Badge>
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
                            <Badge className="text-xs shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" variant="secondary">
                              {invite.membership_type}
                            </Badge>
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

            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveRoles} disabled={saving}>
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
