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
import { Users, ArrowLeft, Shield, Search, Check, X, UserPlus, FileSpreadsheet, Download, RefreshCw, Plus, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDisplayName, getRoleBadgeColor } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type MembershipType = Database["public"]["Enums"]["membership_type"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Membership {
  id: string;
  team_id: string;
  status: string;
  membership_type: string;
  team_name?: string;
  club_id?: string;
}

interface UserWithRoles extends Profile {
  roles: AppRole[];
  memberships: Membership[];
}

interface RoleWithScope {
  role: AppRole;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

const ALL_ROLES: AppRole[] = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN", "SUPER_ADMIN", "VOTER"];

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [associationFilter, setAssociationFilter] = useState<string>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [hidePlaceholders, setHidePlaceholders] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
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
  const [assignTeamOptions, setAssignTeamOptions] = useState<{ id: string; name: string; division: string | null }[]>([]);
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
        const { data: divData, error: divError } = await supabase
          .from("divisions" as any)
          .select("id, name")
          .in("id", divisionIds)
          .order("name");

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
    setTeams(teamsRes.data || []);
    setClubs(clubsRes.data || []);
    setAssociations(assocRes.data || []);
    setDivisions(divsRes.data || []);

    const teamsList = teamsRes.data || [];
    const teamsToShow = isSuperAdmin ? teamsList.map((t) => t.id) : scopedTeamIds;

    let membershipsData: any[] = [];
    if (isSuperAdmin) {
      const { data } = await supabase.from("team_memberships").select("id, user_id, team_id, status, membership_type");
      membershipsData = data || [];
    } else if (teamsToShow.length > 0) {
      const { data } = await supabase.from("team_memberships").select("id, user_id, team_id, status, membership_type").in("team_id", teamsToShow);
      membershipsData = data || [];
    }

    const memberUserIds = [...new Set(membershipsData.map((m) => m.user_id))];

    let profiles: Profile[] = [];
    if (isSuperAdmin) {
      const { data } = await supabase.from("profiles").select("*").order("first_name");
      profiles = data || [];
    } else if (memberUserIds.length > 0) {
      const { data } = await supabase.from("profiles").select("*").in("id", memberUserIds).order("first_name");
      profiles = data || [];
    }

    const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");

    const usersWithRoles: UserWithRoles[] = profiles.map((profile) => ({
      ...profile,
      roles: (userRoles || []).filter((r) => r.user_id === profile.id).map((r) => r.role),
      memberships: membershipsData
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
        }),
    }));

    setUsers(usersWithRoles);
    setLoading(false);
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
    if (hidePlaceholders && (user as any).is_placeholder === true) return false;
    return true;
  });

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
    const { error } = await supabase.from("team_memberships").update({ status: "ACTIVE" }).eq("id", membershipId);
    if (error) {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    } else {
      toast({ title: "Approved", description: "Membership approved" });
      fetchUsers();
    }
  };

  const handleDeclineMembership = async (membershipId: string) => {
    const { error } = await supabase.from("team_memberships").update({ status: "DECLINED" }).eq("id", membershipId);
    if (error) {
      toast({ title: "Error", description: "Failed to decline", variant: "destructive" });
    } else {
      toast({ title: "Declined", description: "Membership declined" });
      fetchUsers();
    }
  };

  const handleOpenRoleDialog = async (u: UserWithRoles) => {
    setSelectedUser(u);
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
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleMakePrimary = async (membershipId: string) => {
    if (!selectedUser) return;

    // Downgrade any existing PRIMARY to PERMANENT first
    const { error: downgradeError } = await supabase
      .from("team_memberships")
      .update({ membership_type: "PERMANENT" })
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
    fetchUsers();
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
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {associations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs text-muted-foreground">Club</Label>
                <Select value={scope.club_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "club_id", v)} disabled={!scope.association_id}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {getClubsForAssociation(scope.association_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs text-muted-foreground">Division</Label>
                <Select value={scope.division_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "division_id", v)} disabled={!scope.club_id}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {availableDivisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs text-muted-foreground">Team</Label>
                <Select value={scope.team_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "team_id", v)} disabled={!scope.division_id}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {associations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-1">
              <Label className="text-xs text-muted-foreground">Club</Label>
              <Select value={scope.club_id} onValueChange={(v) => handleScopeChange(setScopes, scope.id, "club_id", v)} disabled={!scope.association_id}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
          <Button
            variant={hidePlaceholders ? "secondary" : "outline"}
            onClick={() => setHidePlaceholders(prev => !prev)}
          >
            Hide placeholders
          </Button>
        </div>

        {/* Pending Primary Team Change Requests */}
        {primaryRequests.length > 0 && (
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>{filteredUsers.length} user(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Association / Club / Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
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
                        <div className="flex flex-wrap gap-1">
                          {u.memberships.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          ) : (
                            u.memberships.map((m) => {
                              const club = clubs.find((c) => c.id === m.club_id);
                              const association = club ? associations.find((a) => a.id === club.association_id) : undefined;
                              const parts = [];
                              if (association?.name) parts.push(association.name);
                              if (club?.name) parts.push(club.name);
                              if (m.team_name) parts.push(m.team_name);
                              const displayText = parts.join(" / ") || "Unknown";
                              return (
                                <Badge key={m.id} variant="outline" className="text-xs">
                                  {displayText}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.memberships.length === 0 ? (
                            <span className="text-muted-foreground text-sm">-</span>
                          ) : (
                            u.memberships.map((m) => (
                              <div key={m.id} className="flex items-center gap-1">
                                <Badge
                                  variant="secondary"
                                  className={
                                    m.status === "PENDING"
                                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                                      : m.status === "ACTIVE"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                  }
                                >
                                  {m.status}
                                </Badge>
                                {m.status === "PENDING" && (
                                  <div className="flex gap-0.5">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleApproveMembership(m.id)}>
                                      <Check className="h-3 w-3 text-green-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeclineMembership(m.id)}>
                                      <X className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
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
                        <Button variant="outline" size="sm" onClick={() => handleOpenRoleDialog(u)}>
                          <Shield className="mr-2 h-4 w-4" />
                          Roles & Teams
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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

              {selectedUser && selectedUser.memberships.length > 0 ? (
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
                        <SelectTrigger className="h-8 text-xs">
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
                        <SelectTrigger className="h-8 text-xs">
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
                        <SelectTrigger className="h-8 text-xs">
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
                        <SelectTrigger className="h-8 text-xs">
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
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRIMARY">Primary</SelectItem>
                          <SelectItem value="PERMANENT">Secondary (Permanent)</SelectItem>
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
