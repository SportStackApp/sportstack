import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Lock, Camera, Wrench, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPreferencesSection } from "@/components/profile/NotificationPreferencesSection";
import { PersonalDetailsSection } from "@/components/profile/PersonalDetailsSection";
import { TeamMembershipSection } from "@/components/profile/TeamMembershipSection";
import { RequestAdditionalTeamDialog } from "@/components/profile/RequestAdditionalTeamDialog";
import { ProfilePhotoCropper } from "@/components/profile/ProfilePhotoCropper";
import { StatsDetailDialog } from "@/components/profile/StatsDetailDialog";
import { SetPrimaryTeamDialog } from "@/components/profile/SetPrimaryTeamDialog";
import { uploadAvatar, deleteAvatar } from "@/lib/uploadAvatar";
import { useTestRole } from "@/contexts/TestRoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type MembershipType = Database["public"]["Enums"]["membership_type"];

const ALL_ROLES: AppRole[] = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN", "SUPER_ADMIN"];

const getRoleDisplayName = (role: AppRole): string => {
  const names: Record<AppRole, string> = {
    PLAYER: "Player",
    COACH: "Coach",
    TEAM_MANAGER: "Team Manager",
    CLUB_ADMIN: "Club Admin",
    ASSOCIATION_ADMIN: "Association Admin",
    SUPER_ADMIN: "Super Admin",
  };
  return names[role];
};

const getRoleEmoji = (role: AppRole): string => {
  const emojis: Record<AppRole, string> = {
    PLAYER: "🏃",
    COACH: "📋",
    TEAM_MANAGER: "📊",
    CLUB_ADMIN: "🏢",
    ASSOCIATION_ADMIN: "🏛️",
    SUPER_ADMIN: "👑",
  };
  return emojis[role];
};

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  suburb: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  gender: string | null;
  hockey_vic_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
}

interface TeamMembershipData {
  id: string;
  team_id: string;
  membership_type: MembershipType;
  position: string | null;
  jersey_number: number | null;
  status: string;
  team: {
    id: string;
    name: string;
    club: {
      id: string;
      name: string;
      association: {
        id: string;
        name: string;
      };
    };
  };
}

interface PrimaryChangeRequestData {
  id: string;
  from_team_id: string | null;
  to_team_id: string;
  status: string;
  requested_at: string;
  from_team: { id: string; name: string } | null;
  to_team: { id: string; name: string };
}

const Profile = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { testRole, setTestRole } = useTestRole();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [memberships, setMemberships] = useState<TeamMembershipData[]>([]);
  const [pendingChangeRequest, setPendingChangeRequest] = useState<PrimaryChangeRequestData | null>(null);
  const [allTeams, setAllTeams] = useState<Array<{id: string; name: string; clubId: string; clubName: string; associationId: string; associationName: string;}>>([]);
  const [pendingRequestTeams, setPendingRequestTeams] = useState<Array<{id: string; teamId: string; teamName: string; clubName: string; type: string;}>>([]);
  const [pendingPrimaryRequest, setPendingPrimaryRequest] = useState<Array<{id: string; teamId: string; teamName: string; clubName: string; type: string;}>>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogType, setStatsDialogType] = useState<"games" | "goals">("games");
  const [setPrimaryDialogOpen, setSetPrimaryDialogOpen] = useState(false);
  const [requestAdditionalDialogOpen, setRequestAdditionalDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    suburb: "",
    dateOfBirth: "",
    gender: "",
    emergencyContact: {
      name: "",
      phone: "",
      relationship: "",
    },
  });

  const [savedFormData, setSavedFormData] = useState(formData);

  // Fetch profile, memberships, and pending change requests
  const fetchData = async () => {
    if (!user) return;

    setLoading(true);

    // Fetch profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
    } else if (profileData) {
      setProfile(profileData);
      setAvatarUrl(profileData.avatar_url || undefined);
      
      const newFormData = {
        firstName: profileData.first_name || "",
        lastName: profileData.last_name || "",
        phone: profileData.phone || "",
        suburb: profileData.suburb || "",
        dateOfBirth: profileData.date_of_birth || "",
        gender: profileData.gender || "",
        emergencyContact: {
          name: profileData.emergency_contact_name || "",
          phone: profileData.emergency_contact_phone || "",
          relationship: profileData.emergency_contact_relationship || "",
        },
      };
      setFormData(newFormData);
      setSavedFormData(newFormData);
    }

    // Fetch team memberships with team, club, association details
    const { data: membershipData, error: membershipError } = await supabase
      .from("team_memberships")
      .select("id, team_id, membership_type, position, jersey_number, status")
      .eq("user_id", user.id);

    if (membershipError) {
      console.error("Error fetching memberships:", membershipError);
    } else if (membershipData) {
      if (membershipData.length === 0) {
        setMemberships([]);
      } else {
        const teamIds = membershipData.map((m: any) => m.team_id);
        const { data: teamDetails } = await supabase
          .from("teams")
          .select("id, name, club_id, clubs(id, name, associations(id, name))")
          .in("id", teamIds);

        const teamMap = (teamDetails || []).reduce((acc: any, team: any) => {
          acc[team.id] = team;
          return acc;
        }, {});

        // Transform the data to match our interface
        const transformed = membershipData.map((m: any) => {
          const teamObj = teamMap[m.team_id];
          // clubs could be an array or an object depending on PostgREST, but usually an object for many-to-one
          const club = Array.isArray(teamObj?.clubs) ? teamObj.clubs[0] : teamObj?.clubs;
          const association = Array.isArray(club?.associations) ? club.associations[0] : club?.associations;

          return {
            id: m.id,
            team_id: m.team_id,
            membership_type: m.membership_type,
            position: m.position,
            jersey_number: m.jersey_number,
            status: m.status,
            team: {
              id: teamObj?.id || "",
              name: teamObj?.name || "",
              club: {
                id: club?.id || "",
                name: club?.name || "",
                association: {
                  id: association?.id || "",
                  name: association?.name || "",
                },
              },
            },
          };
        });
        setMemberships(transformed);
      }
    }

    // Fetch pending team requests from requests table
    const { data: pendingReqsData } = await supabase
      .from("requests")
      .select("id, team_id, membership_type")
      .eq("target_user_id", user.id)
      .eq("status", "PENDING");

    const pendingReqsTransformed: Array<{id: string; teamId: string; teamName: string; clubName: string; type: string;}> = [];
    if (pendingReqsData && pendingReqsData.length > 0) {
      const pendingReqTeamIds = pendingReqsData.map((r: any) => r.team_id);
      const { data: pendingReqTeamDetails } = await supabase
        .from("teams")
        .select("id, name, club_id, clubs(name)")
        .in("id", pendingReqTeamIds);

      const pendingReqTeamMap = (pendingReqTeamDetails || []).reduce((acc: any, team: any) => {
        acc[team.id] = team;
        return acc;
      }, {});

      const pendingPrimaryFromReqs: Array<{id: string; teamId: string; teamName: string; clubName: string; type: string;}> = [];
      for (const req of pendingReqsData) {
        const teamObj = pendingReqTeamMap[req.team_id];
        const club = Array.isArray(teamObj?.clubs) ? teamObj.clubs[0] : teamObj?.clubs;
        const item = {
          id: `req_${req.id}`,
          teamId: req.team_id,
          teamName: teamObj?.name || "Unknown Team",
          clubName: club?.name || "Unknown Club",
          type: req.membership_type,
        };
        if (req.membership_type === "PRIMARY") {
          pendingPrimaryFromReqs.push(item);
        } else {
          pendingReqsTransformed.push(item);
        }
      }
      setPendingPrimaryRequest(pendingPrimaryFromReqs);
    }
    setPendingRequestTeams(pendingReqsTransformed);

    // Fetch all available teams with club and association info
    const [{ data: assocData }, { data: clubData }, { data: teamData }] = await Promise.all([
      supabase.from("associations").select("id, name").order("name"),
      supabase.from("clubs").select("id, name, association_id").order("name"),
      supabase.from("teams").select("id, name, club_id").order("name"),
    ]);
    if (teamData && clubData && assocData) {
      const clubMap = Object.fromEntries(clubData.map((c: any) => [c.id, c]));
      const assocMap = Object.fromEntries(assocData.map((a: any) => [a.id, a]));
      setAllTeams(teamData.map((t: any) => {
        const club = clubMap[t.club_id] ?? {};
        const assoc = assocMap[club.association_id] ?? {};
        return {
          id: t.id,
          name: t.name,
          clubId: club.id ?? "",
          clubName: club.name ?? "",
          associationId: assoc.id ?? "",
          associationName: assoc.name ?? "",
        };
      }));
    }

    // Fetch pending primary change requests
    const { data: changeRequestData, error: changeRequestError } = await supabase
      .from("primary_change_requests")
      .select(`
        id,
        from_team_id,
        to_team_id,
        status,
        requested_at
      `)
      .eq("user_id", user.id)
      .in("status", ["PENDING", "ADMIN_APPROVED"])
      .maybeSingle();

    if (changeRequestError) {
      console.error("Error fetching change requests:", changeRequestError);
      setPendingChangeRequest(null);
    } else if (changeRequestData) {
      // Fetch team names separately to avoid the multiple FK issue
      let fromTeam = null;
      let toTeam = null;

      if (changeRequestData.from_team_id) {
        const { data: fromTeamData } = await supabase
          .from("teams")
          .select("id, name")
          .eq("id", changeRequestData.from_team_id)
          .single();
        fromTeam = fromTeamData;
      }

      const { data: toTeamData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("id", changeRequestData.to_team_id)
        .single();
      toTeam = toTeamData;

      setPendingChangeRequest({
        id: changeRequestData.id,
        from_team_id: changeRequestData.from_team_id,
        to_team_id: changeRequestData.to_team_id,
        status: changeRequestData.status,
        requested_at: changeRequestData.requested_at,
        from_team: fromTeam,
        to_team: toTeam || { id: changeRequestData.to_team_id, name: "Unknown Team" },
      });
    } else {
      setPendingChangeRequest(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        phone: formData.phone || null,
        suburb: formData.suburb || null,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        emergency_contact_name: formData.emergencyContact.name || null,
        emergency_contact_phone: formData.emergencyContact.phone || null,
        emergency_contact_relationship: formData.emergencyContact.relationship || null,
      })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } else {
      setSavedFormData(formData);
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    }
  };

  const handleCancel = () => {
    setFormData(savedFormData);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setSavedFormData(formData);
    setIsEditing(true);
  };

  const handleFormChange = (data: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleRequestPrimaryChange = () => {
    setSetPrimaryDialogOpen(true);
  };

  const handleSetPrimaryTeam = async (teamId: string) => {
    if (!user) return;

    const primaryMembership = memberships.find(
      (m) => m.membership_type === "PRIMARY" && m.status === "APPROVED"
    );

    // Get team info first for notifications
    const { data: teamData } = await supabase
      .from("teams")
      .select("club_id, name")
      .eq("id", teamId)
      .single();

    // Always insert a primary_change_request - works with or without existing primary
    const { error } = await supabase.from("primary_change_requests").insert({
      user_id: user.id,
      from_team_id: primaryMembership?.team_id || null,
      to_team_id: teamId,
      status: "PENDING",
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit primary team request.",
        variant: "destructive",
      });
      return;
    }

    // Notify coach/manager of destination team and club admin
    if (teamData) {
      const [{ data: teamAdmins }, { data: clubAdmins }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("team_id", teamId).in("role", ["COACH", "TEAM_MANAGER"]),
        supabase.from("user_roles").select("user_id").eq("club_id", teamData.club_id).eq("role", "CLUB_ADMIN"),
      ]);
      const recipientIds = [...(teamAdmins?.map((r: any) => r.user_id) ?? []), ...(clubAdmins?.map((r: any) => r.user_id) ?? [])].filter((id, i, arr) => arr.indexOf(id) === i);
      const playerName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "A player" : "A player";
      if (recipientIds.length > 0) {
        await supabase.from("notifications").insert(
          recipientIds.map((uid: string) => ({
            user_id: uid,
            type: "PRIMARY_TEAM_CHANGE_REQUEST",
            title: "Primary Team Change Request",
            message: `${playerName} has requested ${teamData.name} as their primary team.`,
            team_id: teamId,
          }))
        );
      }
    }

    toast({
      title: "Request Submitted",
      description: "Your primary team request has been sent for approval.",
    });
    fetchData();
  };

  const handleCancelChangeRequest = async () => {
    if (!user || !pendingChangeRequest) return;

    const { error } = await supabase
      .from("primary_change_requests")
      .update({ status: "CANCELLED" })
      .eq("id", pendingChangeRequest.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel request.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Cancelled",
        description: "Your primary team change request has been cancelled.",
      });
      fetchData();
    }
  };

  const handleConfirmChange = async () => {
    if (!user || !pendingChangeRequest || pendingChangeRequest.status !== "ADMIN_APPROVED") return;

    // Downgrade old PRIMARY to PERMANENT
    if (pendingChangeRequest.from_team_id) {
      await supabase
        .from("team_memberships")
        .update({ membership_type: "PERMANENT" })
        .eq("user_id", user.id)
        .eq("team_id", pendingChangeRequest.from_team_id)
        .eq("membership_type", "PRIMARY");
    }

    // Upgrade new team to PRIMARY
    const { error: upgradeError } = await supabase
      .from("team_memberships")
      .update({ membership_type: "PRIMARY" })
      .eq("user_id", user.id)
      .eq("team_id", pendingChangeRequest.to_team_id);

    // Mark request as completed
    await supabase
      .from("primary_change_requests")
      .update({ status: "COMPLETED", resolved_at: new Date().toISOString() })
      .eq("id", pendingChangeRequest.id);

    if (upgradeError) {
      toast({ title: "Error", description: "Failed to confirm change.", variant: "destructive" });
    } else {
      toast({ title: "Primary Team Changed", description: "Your primary team has been updated." });
      fetchData();
    }
  };

  const handleAcceptInvite = async (membershipId: string) => {
    const { error } = await supabase
      .from("team_memberships")
      .update({ status: "APPROVED" })
      .eq("id", membershipId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to accept invite.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Invite Accepted",
        description: "You've been added to the team.",
      });
      fetchData();
    }
  };

  const handleDeclineInvite = async (membershipId: string) => {
    const { error } = await supabase
      .from("team_memberships")
      .update({ status: "DECLINED" })
      .eq("id", membershipId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to decline invite.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Invite Declined",
        description: "The coach has been notified.",
      });
      fetchData();
    }
  };

  const handleAvatarSave = async (blob: Blob) => {
    if (!user) return;
    
    setIsAvatarLoading(true);
    const tempUrl = URL.createObjectURL(blob);
    setAvatarUrl(tempUrl);

    try {
      const newUrl = await uploadAvatar(user.id, blob);
      setAvatarUrl(newUrl);
      
      // Update profile with new avatar URL
      await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", user.id);
      
      toast({
        title: "Photo Updated",
        description: "Your profile photo has been updated.",
      });
    } catch (error) {
      setAvatarUrl(profile?.avatar_url || undefined);
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!user) return;
    
    setIsAvatarLoading(true);
    const previousUrl = avatarUrl;
    setAvatarUrl(undefined);

    try {
      await deleteAvatar(user.id);
      
      // Update profile to remove avatar URL
      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      
      toast({
        title: "Photo Removed",
        description: "Your profile photo has been removed.",
      });
    } catch (error) {
      setAvatarUrl(previousUrl);
      toast({
        title: "Delete Failed",
        description: "Failed to remove photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const openStatsDialog = (type: "games" | "goals") => {
    setStatsDialogType(type);
    setStatsDialogOpen(true);
  };

  const handleRoleChange = (role: AppRole) => {
    setTestRole(role as any);
    toast({
      title: "Test Role Changed",
      description: `Now viewing as ${getRoleDisplayName(role)}. Sidebar navigation updated.`,
    });
  };

  // Transform memberships for TeamMembershipSection
  const approvedMemberships = memberships.filter((m) => m.status === "APPROVED" || m.status === "ACTIVE");
  const primaryMembership = approvedMemberships.find((m) => m.membership_type === "PRIMARY");
  const extraMemberships = approvedMemberships.filter((m) => m.membership_type !== "PRIMARY");
  const pendingMemberships = memberships.filter((m) => m.status === "PENDING");

  const primaryTeam = primaryMembership
    ? {
        teamId: primaryMembership.team_id,
        teamName: primaryMembership.team.name,
        clubId: primaryMembership.team.club.id,
        clubName: primaryMembership.team.club.name,
        associationId: primaryMembership.team.club.association.id,
        associationName: primaryMembership.team.club.association.name,
        type: "PRIMARY" as const,
        position: primaryMembership.position || undefined,
        jerseyNumber: primaryMembership.jersey_number || undefined,
      }
    : null;

  const extraTeams = extraMemberships.map((m) => ({
    teamId: m.team_id,
    teamName: m.team.name,
    clubId: m.team.club.id,
    clubName: m.team.club.name,
    associationId: m.team.club.association.id,
    associationName: m.team.club.association.name,
    type: m.membership_type as "PRIMARY" | "PERMANENT" | "FILL_IN",
    position: m.position || undefined,
    jerseyNumber: m.jersey_number || undefined,
  }));

  // Transform pending change request for display
  const pendingChangeRequestForDisplay = pendingChangeRequest
    ? {
        id: pendingChangeRequest.id,
        fromTeamId: pendingChangeRequest.from_team_id,
        fromTeamName: pendingChangeRequest.from_team?.name || null,
        toTeamId: pendingChangeRequest.to_team_id,
        toTeamName: pendingChangeRequest.to_team?.name || "",
        status: pendingChangeRequest.status,
        requestedAt: pendingChangeRequest.requested_at,
      }
    : null;

  // Transform pending memberships for invites section
  // Non-primary pending memberships for the Additional Teams section
  const pendingAdditionalTeams = [
    ...pendingMemberships
      .filter((m) => m.membership_type !== "PRIMARY")
      .map((m) => ({
        id: m.id,
        teamId: m.team_id,
        teamName: m.team.name,
        clubName: m.team.club.name,
        type: m.membership_type,
      })),
    ...pendingRequestTeams,
  ];

  const displayName = [formData.firstName, formData.lastName].filter(Boolean).join(" ") || user?.email || "User";
  const initials = (formData.firstName?.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase();

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-fade-in pb-8">
        <div className="text-center">
          <Skeleton className="w-24 h-24 rounded-full mx-auto mb-4" />
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in pb-8">
      {/* Header */}
      <div className="text-center">
        <div
          className="relative group cursor-pointer mx-auto w-24 h-24 mb-4"
          onClick={() => setCropperOpen(true)}
        >
          {isAvatarLoading ? (
            <Skeleton className="w-24 h-24 rounded-full" />
          ) : (
            <Avatar className="w-24 h-24 border-2 border-border">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-4xl font-display bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-8 w-8 text-foreground" />
          </div>
        </div>
        <h1 className="font-display text-3xl text-foreground">
          {displayName}
        </h1>
        {primaryTeam && (
          <p className="text-muted-foreground mt-2">
            {primaryTeam.clubName} • {primaryTeam.associationName}
          </p>
        )}
        
        
        {/* User Roles Display */}
        <div className="flex flex-wrap gap-2 justify-center mt-3">
          <Badge variant="secondary" className="text-xs">
            {getRoleEmoji(testRole as AppRole)} {getRoleDisplayName(testRole as AppRole)}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card
          className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openStatsDialog("games")}
        >
          <CardContent className="pt-5">
            <p className="font-display text-3xl text-accent">0</p>
            <p className="text-xs text-muted-foreground">Games Played</p>
          </CardContent>
        </Card>
        <Card
          className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openStatsDialog("goals")}
        >
          <CardContent className="pt-5">
            <p className="font-display text-3xl text-accent">0</p>
            <p className="text-xs text-muted-foreground">Goals</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-5">
            <p className="font-display text-3xl text-accent">2024</p>
            <p className="text-xs text-muted-foreground">Member Since</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Memberships */}
      <TeamMembershipSection
        primaryTeam={primaryTeam}
        extraTeams={extraTeams}
        pendingChangeRequest={pendingChangeRequestForDisplay}
        pendingPrimaryRequest={pendingPrimaryRequest[0]}
        onRequestChange={handleRequestPrimaryChange}
        onCancelRequest={handleCancelChangeRequest}
        onConfirmChange={handleConfirmChange}
        onSetPrimaryTeam={() => setSetPrimaryDialogOpen(true)}
        hasApprovedTeams={approvedMemberships.length > 0}
        onRequestAdditionalTeam={() => setRequestAdditionalDialogOpen(true)}
        pendingAdditionalTeams={pendingAdditionalTeams}
        onCancelAdditionalRequest={async (id) => {
          if (id.startsWith("req_")) {
            const actualId = id.replace("req_", "");
            const { error } = await supabase
              .from("requests")
              .update({ status: "CANCELLED", cancelled_by: user?.id })
              .eq("id", actualId);
            if (error) {
              toast({ title: "Error", description: "Failed to cancel request.", variant: "destructive" });
            } else {
              toast({ title: "Cancelled", description: "Your team request has been cancelled." });
              fetchData();
            }
          } else {
            const { error } = await supabase.from("team_memberships").delete().eq("id", id);
            if (error) {
              toast({ title: "Error", description: "Failed to cancel request.", variant: "destructive" });
            } else {
              toast({ title: "Cancelled", description: "Your team request has been cancelled." });
              fetchData();
            }
          }
        }}
      />

      {/* Personal Details with Edit */}
      <PersonalDetailsSection
        email={user?.email || ""}
        isEditing={isEditing}
        formData={formData}
        onFormChange={handleFormChange}
        onSave={handleSave}
        onCancel={handleCancel}
        onEdit={handleStartEdit}
      />

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full">
            <Lock className="h-4 w-4 mr-2" />
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Developer Tools - Role Switcher */}
      <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            Developer Tools
            <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
              Testing Only
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-select">Active Role (for testing)</Label>
            <Select value={testRole} onValueChange={(val) => handleRoleChange(val as AppRole)}>
              <SelectTrigger id="role-select" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {getRoleEmoji(role)} {getRoleDisplayName(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Switching roles updates the sidebar navigation immediately. 
              This is for UI testing only and does not bypass actual security.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <NotificationPreferencesSection />

      {/* Photo Cropper Dialog */}
      <ProfilePhotoCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        onSave={handleAvatarSave}
        onDelete={avatarUrl ? handleAvatarDelete : undefined}
        currentImage={avatarUrl}
      />

      {/* Stats Detail Dialog */}
      <StatsDetailDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
        type={statsDialogType}
        games={[]}
        goals={[]}
      />

      {/* Set Primary Team Dialog */}
      <SetPrimaryTeamDialog
        open={setPrimaryDialogOpen}
        onOpenChange={setSetPrimaryDialogOpen}
        onConfirm={handleSetPrimaryTeam}
        isChangingPrimary={!!primaryMembership}
      />

      {/* Request Additional Team Dialog */}
      <RequestAdditionalTeamDialog
        open={requestAdditionalDialogOpen}
        onOpenChange={setRequestAdditionalDialogOpen}
        existingTeamIds={memberships.map((m) => m.team_id)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default Profile;
