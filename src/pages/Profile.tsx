import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AlertCircle, Save, Lock, Camera, Wrench, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPreferencesSection } from "@/components/profile/NotificationPreferencesSection";
import { PersonalDetailsSection } from "@/components/profile/PersonalDetailsSection";
import { TeamMembershipSection } from "@/components/profile/TeamMembershipSection";
import { RequestAdditionalTeamDialog } from "@/components/profile/RequestAdditionalTeamDialog";
import { ProfilePhotoCropper } from "@/components/profile/ProfilePhotoCropper";
import { StatsDetailDialog } from "@/components/profile/StatsDetailDialog";
import { SetPrimaryTeamDialog } from "@/components/profile/SetPrimaryTeamDialog";
import { PlayerPositionPreferences } from "@/components/profile/PlayerPositionPreferences";
import { useAppMode, type AppMode } from "@/contexts/AppModeContext";
import { membershipPriority } from "@/lib/playerPositions";
import { uploadAvatar, deleteAvatar } from "@/lib/uploadAvatar";
import { useTestRole } from "@/contexts/TestRoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isProfileReviewRequired } from "@/lib/profileCompletion";
import type { Database } from "@/integrations/supabase/types";
import { loadPlayerHistory, type PlayerHistoryRecord } from "@/lib/playerHistory";
import { getSafeAppPath } from "@/lib/authRedirect";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getProfileRoleEmoji, getProfileRoleLabel, type ProfileRole } from "@/lib/profileRoles";
import {
  cancelPrimaryTeamChange,
  confirmPrimaryTeamChange,
  requestPrimaryTeamChange,
} from "@/lib/primaryTeamChangeRpc";

type AppRole = ProfileRole;
type MembershipType = Database["public"]["Enums"]["membership_type"];

const ALL_ROLES: AppRole[] = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN", "SUPER_ADMIN", "UMPIRE", "VOTER"];

const APP_MODE_LABELS: Record<AppMode, string> = {
  super_admin: "Super Admin",
  association: "Association Admin",
  club: "Club Admin",
  team_manager: "Team Manager",
  coach: "Coach",
  player: "Player",
};

const getRoleDisplayName = getProfileRoleLabel;
const getRoleEmoji = getProfileRoleEmoji;

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  nickname: string | null;
  phone: string | null;
  suburb: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  gender: string | null;
  hockey_vic_number: string | null;
  revsports_player_id?: string | null;
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

interface RoleScopeDisplay {
  role: AppRole;
  scope: string;
}

const Profile = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { activeMode, roles } = useAppMode();
  const { testRole, setTestRole } = useTestRole();
  const returnTo = getSafeAppPath(searchParams.get("returnTo"), "");
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [memberships, setMemberships] = useState<TeamMembershipData[]>([]);
  const [pendingChangeRequest, setPendingChangeRequest] = useState<PrimaryChangeRequestData | null>(null);
  const [allTeams, setAllTeams] = useState<Array<{id: string; name: string; clubId: string; clubName: string; associationId: string; associationName: string;}>>([]);
  const [pendingRequestTeams, setPendingRequestTeams] = useState<Array<{id: string; teamId: string; teamName: string; clubName: string; type: string;}>>([]);
  const [pendingPrimaryRequest, setPendingPrimaryRequest] = useState<Array<{id: string; teamId: string; teamName: string; clubName: string; type: string;}>>([]);
  const [loading, setLoading] = useState(true);
  const [needsProfileReview, setNeedsProfileReview] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogType, setStatsDialogType] = useState<"games" | "goals">("games");
  const [setPrimaryDialogOpen, setSetPrimaryDialogOpen] = useState(false);
  const [requestAdditionalDialogOpen, setRequestAdditionalDialogOpen] = useState(false);
  const [latestRevSportsMatchUrl, setLatestRevSportsMatchUrl] = useState<string | null>(null);
  const [playerHistory, setPlayerHistory] = useState<PlayerHistoryRecord[]>([]);
  const [roleScopes, setRoleScopes] = useState<RoleScopeDisplay[]>([]);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    nickname: "",
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
        preferredName: profileData.preferred_name || "",
        nickname: profileData.nickname || "",
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

      const reviewRequired = isProfileReviewRequired(profileData);
      setNeedsProfileReview(reviewRequired);
      if (reviewRequired) {
        setIsEditing(true);
      }
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
        const transformedByTeam = new Map<string, TeamMembershipData>();
        membershipData.forEach((m) => {
          const teamObj = teamMap[m.team_id];
          // clubs could be an array or an object depending on PostgREST, but usually an object for many-to-one
          const club = Array.isArray(teamObj?.clubs) ? teamObj.clubs[0] : teamObj?.clubs;
          const association = Array.isArray(club?.associations) ? club.associations[0] : club?.associations;

          const candidate: TeamMembershipData = {
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
          const current = transformedByTeam.get(m.team_id);
          if (!current || (membershipPriority[candidate.membership_type] || 0) > (membershipPriority[current.membership_type] || 0)) {
            transformedByTeam.set(m.team_id, candidate);
          }
        });
        setMemberships(Array.from(transformedByTeam.values()));
      }
    }

    // Fetch pending team requests from requests table
    const { data: pendingReqsData } = (await supabase
      .from("requests" as any)
      .select("id, team_id, membership_type")
      .eq("target_user_id", user.id)
      .eq("status", "PENDING")) as any;

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
    } else {
      setPendingPrimaryRequest([]);
    }
    setPendingRequestTeams(pendingReqsTransformed);

    const { data: latestRevSportsRow } = await supabase
      .from("revsports_players")
      .select("match_url")
      .eq("profile_id", user.id)
      .not("match_url", "is", null)
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestRevSportsMatchUrl(latestRevSportsRow?.match_url || null);

    try {
      const history = await loadPlayerHistory(user.id);
      setPlayerHistory(history);
    } catch (historyError) {
      console.error("Error fetching player history:", historyError);
      setPlayerHistory([]);
    }

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role, associations(name), clubs(name), teams(name)")
      .eq("user_id", user.id);
    setRoleScopes((roleRows || []).map((row) => ({
      role: row.role as AppRole,
      scope: row.teams?.name || row.clubs?.name || row.associations?.name || "All accessible organisations",
    })));

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

    const profileUpdate = {
      first_name: formData.firstName.trim() || null,
      last_name: formData.lastName.trim() || null,
      preferred_name: formData.preferredName.trim() || null,
      nickname: formData.nickname.trim() || null,
      phone: formData.phone.trim() || null,
      suburb: formData.suburb.trim() || null,
      date_of_birth: formData.dateOfBirth || null,
      gender: formData.gender || null,
      emergency_contact_name: formData.emergencyContact.name.trim() || null,
      emergency_contact_phone: formData.emergencyContact.phone.trim() || null,
      emergency_contact_relationship: formData.emergencyContact.relationship.trim() || null,
    };

    if (isProfileReviewRequired(profileUpdate)) {
      toast({
        title: "Details required",
        description: "Please complete first name, last name, phone, date of birth, and gender before continuing.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } else {
      const savedData = {
        ...formData,
        firstName: profileUpdate.first_name || "",
        lastName: profileUpdate.last_name || "",
        preferredName: profileUpdate.preferred_name || "",
        nickname: profileUpdate.nickname || "",
        phone: profileUpdate.phone || "",
        suburb: profileUpdate.suburb || "",
        dateOfBirth: profileUpdate.date_of_birth || "",
        gender: profileUpdate.gender || "",
        emergencyContact: {
          name: profileUpdate.emergency_contact_name || "",
          phone: profileUpdate.emergency_contact_phone || "",
          relationship: profileUpdate.emergency_contact_relationship || "",
        },
      };
      setFormData(savedData);
      setSavedFormData(savedData);
      setProfile((current) => current ? { ...current, ...profileUpdate } : current);
      setNeedsProfileReview(false);
      setIsEditing(false);
      window.dispatchEvent(new Event("sportstack:profile-review-completed"));
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
      if (returnTo && !returnTo.startsWith("/profile")) {
        navigate(returnTo, { replace: true });
      }
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

    // Get team info first for notifications
    const { data: teamData } = await supabase
      .from("teams")
      .select("club_id, name")
      .eq("id", teamId)
      .single();

    // The server records the current primary team and creates one pending request.
    const { error } = await requestPrimaryTeamChange(teamId);

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
        supabase.from("user_roles").select("user_id").eq("team_id", teamId).eq("role", "TEAM_MANAGER"),
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

    const { error } = await cancelPrimaryTeamChange(pendingChangeRequest.id);

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

    const { error } = await confirmPrimaryTeamChange(pendingChangeRequest.id);

    if (error) {
      toast({
        title: "Primary team not changed",
        description: "The change could not be completed. No partial team change was saved.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Primary Team Changed", description: "Your primary team has been updated." });
    fetchData();
  };

  const handleAcceptInvite = async (membershipId: string) => {
    const { error } = await supabase
      .from("team_memberships")
      .update({ status: "ACTIVE" })
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
  const approvedMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === "ACTIVE"),
    [memberships],
  );
  const primaryMemberships = approvedMemberships.filter((m) => m.membership_type === "PRIMARY");
  const extraMemberships = approvedMemberships.filter((m) => m.membership_type !== "PRIMARY");
  const pendingMemberships = memberships.filter((m) => m.status === "PENDING");

  const primaryTeams = primaryMemberships.map((primaryMembership) => ({
        teamId: primaryMembership.team_id,
        teamName: primaryMembership.team.name,
        clubId: primaryMembership.team.club.id,
        clubName: primaryMembership.team.club.name,
        associationId: primaryMembership.team.club.association.id,
        associationName: primaryMembership.team.club.association.name,
        type: "PRIMARY" as const,
        position: primaryMembership.position || undefined,
        jerseyNumber: primaryMembership.jersey_number || undefined,
      }));

  const extraTeams = extraMemberships.map((m) => ({
    teamId: m.team_id,
    teamName: m.team.name,
    clubId: m.team.club.id,
    clubName: m.team.club.name,
    associationId: m.team.club.association.id,
    associationName: m.team.club.association.name,
    type: m.membership_type as "PRIMARY" | "SECONDARY" | "FILL_IN",
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
  const showDeveloperTools = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
  const gamesPlayed = playerHistory.length;
  const goalsScored = playerHistory.reduce((sum, game) => sum + game.goals, 0);
  const teamsRepresented = new Set(playerHistory.map((game) => `${game.clubName}:${game.teamName}`)).size;
  const regularPositionTeams = useMemo(
    () =>
      approvedMemberships.map((membership) => ({
        membershipId: membership.id,
        teamId: membership.team_id,
        teamName: membership.team.name,
        clubName: membership.team.club.name,
        membershipType: membership.membership_type,
        jerseyNumber: membership.jersey_number,
      })),
    [approvedMemberships],
  );
  const gameRecords = playerHistory.map((game) => ({
    id: game.id,
    date: game.date,
    teamName: game.teamName,
    clubName: game.clubName,
    associationName: game.associationName,
    opponent: game.opponent,
    location: game.location,
    result: game.result,
  }));
  const goalRecords = playerHistory.flatMap((game) =>
    Array.from({ length: game.goals }, (_, index) => ({
      id: `${game.id}-goal-${index + 1}`,
      date: game.date,
      gameId: game.fixtureId || game.id,
      teamName: game.teamName,
      clubName: game.clubName,
      associationName: game.associationName,
      opponent: game.opponent,
    })),
  );

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
      {needsProfileReview && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Confirm your profile details</AlertTitle>
          <AlertDescription>
            Please check your email and save your first name, last name, phone number, date of birth, and gender before continuing.
          </AlertDescription>
        </Alert>
      )}

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
        {primaryTeams.length > 0 && (
          <div className="mt-2 space-y-1 text-muted-foreground">
            {primaryTeams.map((primaryTeam) => (
              <p key={primaryTeam.teamId}>
                {primaryTeam.teamName} • {primaryTeam.clubName} • {primaryTeam.associationName}
              </p>
            ))}
          </div>
        )}
        
        
        {/* Active mode and every assigned role remain visible together. */}
        <div className="mt-3 space-y-2">
          <Badge className="text-xs">Viewing as {APP_MODE_LABELS[activeMode]}</Badge>
          <div className="flex flex-wrap justify-center gap-2">
            {roleScopes.length > 0
              ? roleScopes.map((item, index) => (
                  <Badge key={`${item.role}-${item.scope}-${index}`} variant="secondary" className="text-xs">
                    {getRoleEmoji(item.role)} {getRoleDisplayName(item.role)} · {item.scope}
                  </Badge>
                ))
              : roles.map((role) => (
                  <Badge key={role} variant="secondary" className="text-xs">
                    {getRoleEmoji(role as AppRole)} {getRoleDisplayName(role as AppRole)}
                  </Badge>
                ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card
          className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openStatsDialog("games")}
        >
          <CardContent className="pt-5">
            <p className="font-display text-3xl text-accent">{gamesPlayed}</p>
            <p className="text-xs text-muted-foreground">Games Played</p>
          </CardContent>
        </Card>
        <Card
          className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openStatsDialog("goals")}
        >
          <CardContent className="pt-5">
            <p className="font-display text-3xl text-accent">{goalsScored}</p>
            <p className="text-xs text-muted-foreground">Goals</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-5">
            <p className="font-display text-3xl text-accent">{teamsRepresented}</p>
            <p className="text-xs text-muted-foreground">Teams Represented</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Memberships */}
      <TeamMembershipSection
        primaryTeams={primaryTeams}
        extraTeams={extraTeams}
        pendingChangeRequest={pendingChangeRequestForDisplay}
        pendingPrimaryRequest={pendingPrimaryRequest[0]}
        onRequestChange={handleRequestPrimaryChange}
        onCancelRequest={handleCancelChangeRequest}
        onConfirmChange={handleConfirmChange}
        onRequestAdditionalTeam={() => setRequestAdditionalDialogOpen(true)}
        pendingAdditionalTeams={pendingAdditionalTeams}
        onCancelAdditionalRequest={async (id) => {
          if (id.startsWith("req_")) {
            const actualId = id.replace("req_", "");
            const { error } = await supabase
              .from("requests" as any)
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

      <PlayerPositionPreferences teams={regularPositionTeams} />

      {/* Personal Details with Edit */}
      <PersonalDetailsSection
        email={user?.email || ""}
        isEditing={isEditing}
        formData={formData}
        requiresReview={needsProfileReview}
        onFormChange={handleFormChange}
        onSave={handleSave}
        onCancel={handleCancel}
        onEdit={handleStartEdit}
      />

      {profile?.revsports_player_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">RevSports Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label>External player ID</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
                {profile.revsports_player_id}
              </div>
              <p className="text-xs text-muted-foreground">
                This links your SportStack profile to scraped RevSports data.
              </p>
              {latestRevSportsMatchUrl && (
                <a
                  href={latestRevSportsMatchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open latest RevSports match
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
      {showDeveloperTools && (
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
      )}

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
        games={gameRecords}
        goals={goalRecords}
      />

      {/* Set Primary Team Dialog */}
      <SetPrimaryTeamDialog
        open={setPrimaryDialogOpen}
        onOpenChange={setSetPrimaryDialogOpen}
        onConfirm={handleSetPrimaryTeam}
        currentPrimaryTeams={primaryTeams.map((team) => ({
          teamId: team.teamId,
          teamName: team.teamName,
          associationId: team.associationId,
        }))}
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
