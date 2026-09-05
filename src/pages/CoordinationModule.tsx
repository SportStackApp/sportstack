import { useCallback, useEffect, useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { AlertTriangle, CalendarClock, Check, Clock3, Loader2, MailPlus, RefreshCw, UserCheck, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppMode } from "@/contexts/AppModeContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCoordinationAccess } from "@/hooks/useCoordinationAccess";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultOfferDeadline,
  coordinationTabsForAccess,
  formatCoordinationStatus,
  type EligiblePerson,
  type FixturePositionSummary,
} from "@/features/coordination/coordination";

type FixtureRow = {
  id: string;
  fixture_date: string | null;
  round_name: string | null;
  round_number: number | null;
  status: string;
  home_team: { name: string; club_id: string } | null;
  away_team: { name: string } | null;
  venue: { name: string } | null;
};

type MyOffer = {
  id: string;
  status: string;
  decline_reason: string | null;
  offer_batch: {
    note: string | null;
    response_deadline: string;
    urgent: boolean;
    position: { position_label: string; starts_at: string; ends_at: string } | null;
  } | null;
};

type MyAssignment = {
  id: string;
  status: string;
  late_assignment: boolean;
  position: { position_label: string; starts_at: string; ends_at: string } | null;
};

type CapabilityInvite = {
  id: string;
  capability_type: string;
  scope_type: string;
  expires_at: string;
  status: string;
};

type MatrixRow = {
  user_id: string;
  name: string;
  completed_games: number;
  upcoming_games: number;
  replacement_requests: number;
  grades: Array<{ division: string; status: string; effective_date: string; signed_by: string }>;
  qualifications: Array<{ id: string; name: string; issuer: string | null; expires_on: string | null; note: string | null }>;
};

type ActivityRow = {
  id: string;
  name: string;
  activity_type: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: string;
};

type RosterCheck = {
  id: string;
  result: string;
  reviewed_status: string;
  detail: string | null;
  checked_at: string;
  fixture: string;
  fixture_date: string;
};

type MatrixNote = { id: string; content: string; kind: string; created_at: string; created_by: string };

const displayDateTime = (value: string | null) => value
  ? format(new Date(value), "dd/MM/yyyy h:mm a")
  : "Time not set";

const toLocalInput = (value: Date) => format(value, "yyyy-MM-dd'T'HH:mm");

export default function CoordinationModule() {
  const { user } = useAuth();
  const { activeMode, contextConfirmed } = useAppMode();
  const { selectedAssociationId, selectedClubId, selectedTeamId } = useTeamContext();
  const { toast } = useToast();
  const { access: coordinationAccess, loading: accessLoading } = useCoordinationAccess();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [associations, setAssociations] = useState<Array<{ id: string; name: string }>>([]);
  const [matrixAssociationId, setMatrixAssociationId] = useState(selectedAssociationId);
  const [selectedFixture, setSelectedFixture] = useState<FixtureRow | null>(null);
  const [positions, setPositions] = useState<FixturePositionSummary[]>([]);
  const [myOffers, setMyOffers] = useState<MyOffer[]>([]);
  const [myAssignments, setMyAssignments] = useState<MyAssignment[]>([]);
  const [capabilityInvites, setCapabilityInvites] = useState<CapabilityInvite[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [divisions, setDivisions] = useState<Array<{ id: string; association_id: string; name: string }>>([]);
  const [rosterChecks, setRosterChecks] = useState<RosterCheck[]>([]);
  const [offerPosition, setOfferPosition] = useState<FixturePositionSummary | null>(null);
  const [eligiblePeople, setEligiblePeople] = useState<EligiblePerson[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [offerNote, setOfferNote] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [offerDeadline, setOfferDeadline] = useState("");
  const [replacementAssignment, setReplacementAssignment] = useState<MyAssignment | null>(null);
  const [replacementNote, setReplacementNote] = useState("");
  const [declineOffer, setDeclineOffer] = useState<MyOffer | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState({ name: "", type: "Working bee", starts: "", ends: "", location: "", position: "Volunteer", count: "1" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCapability, setInviteCapability] = useState<"TECHNICAL_BENCH" | "VOLUNTEER" | "SUPERVISING_UMPIRE">("SUPERVISING_UMPIRE");
  const [matrixAction, setMatrixAction] = useState<{ kind: "GRADE" | "QUALIFICATION" | "NOTE" | "LOG"; userId: string; name: string } | null>(null);
  const [matrixActionValue, setMatrixActionValue] = useState("");
  const [matrixActionExtra, setMatrixActionExtra] = useState("");
  const [matrixActionStatus, setMatrixActionStatus] = useState("SIGNED_OFF");
  const [matrixNotes, setMatrixNotes] = useState<MatrixNote[]>([]);

  const showError = useCallback((message: string) => {
    toast({ title: "Coordination action could not be completed", description: message, variant: "destructive" });
  }, [toast]);

  const loadPersonalWork = useCallback(async () => {
    if (!user) return;
    const [offersResult, assignmentsResult, invitesResult] = await Promise.all([
      supabase.from("coordination_offer_recipients").select(
        "id, status, decline_reason, offer_batch:coordination_offer_batches!offer_batch_id(note, response_deadline, urgent, position:coordination_positions!position_id(position_label, starts_at, ends_at))",
      ).eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("coordination_assignments").select(
        "id, status, late_assignment, position:coordination_positions!position_id(position_label, starts_at, ends_at)",
      ).eq("assigned_user_id", user.id).order("starts_at", { ascending: true }),
      supabase.from("coordination_capability_invitations").select("id, capability_type, scope_type, expires_at, status")
        .eq("user_id", user.id).eq("status", "PENDING").order("created_at", { ascending: false }),
    ]);
    if (offersResult.error) throw offersResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (invitesResult.error) throw invitesResult.error;
    setMyOffers((offersResult.data || []) as unknown as MyOffer[]);
    setMyAssignments((assignmentsResult.data || []) as unknown as MyAssignment[]);
    setCapabilityInvites((invitesResult.data || []) as CapabilityInvite[]);
  }, [user]);

  const loadBaseData = useCallback(async () => {
    if (!contextConfirmed) return;
    setLoading(true);
    try {
      const [fixturesResult, associationsResult, activitiesResult, divisionsResult] = await Promise.all([
        supabase.from("fixtures").select(
          "id, fixture_date, round_name, round_number, status, home_team:teams!home_team_id(name, club_id), away_team:teams!away_team_id(name), venue:venues!venue_id(name)",
        ).gte("fixture_date", new Date().toISOString()).order("fixture_date", { ascending: true }).limit(100),
        supabase.from("associations").select("id, name").order("name"),
        supabase.from("coordination_activities").select("id, name, activity_type, starts_at, ends_at, location, status")
          .gte("ends_at", new Date().toISOString()).order("starts_at", { ascending: true }),
        supabase.from("divisions").select("id, association_id, name").order("name"),
      ]);
      if (fixturesResult.error) throw fixturesResult.error;
      if (associationsResult.error) throw associationsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (divisionsResult.error) throw divisionsResult.error;
      setFixtures((fixturesResult.data || []) as unknown as FixtureRow[]);
      setAssociations(associationsResult.data || []);
      setActivities((activitiesResult.data || []) as ActivityRow[]);
      setDivisions(divisionsResult.data || []);
      setMatrixAssociationId((current) => current || selectedAssociationId || associationsResult.data?.[0]?.id || "");
      await loadPersonalWork();
    } catch (error) {
      showError(error instanceof Error ? error.message : "The Coordination data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [contextConfirmed, loadPersonalWork, selectedAssociationId, showError]);

  useEffect(() => { void loadBaseData(); }, [loadBaseData]);

  const loadFixturePositions = useCallback(async (fixture: FixtureRow) => {
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc("coordination_get_fixture_positions", {
        p_fixture_id: fixture.id,
        p_actor_mode: activeMode,
      });
      if (error) throw error;
      setSelectedFixture(fixture);
      setPositions((data || []) as unknown as FixturePositionSummary[]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Fixture positions could not be loaded.");
    } finally {
      setWorking(false);
    }
  }, [activeMode, showError]);

  const openOffer = useCallback(async (position: FixturePositionSummary) => {
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc("coordination_list_eligible_people", {
        p_position_id: position.id,
        p_actor_mode: activeMode,
      });
      if (error) throw error;
      setOfferPosition(position);
      setEligiblePeople((data || []) as unknown as EligiblePerson[]);
      setSelectedPeople([]);
      setOfferNote(position.offer?.note || "");
      setOverrideNote("");
      setOfferDeadline(toLocalInput(position.offer
        ? new Date(position.offer.deadline)
        : defaultOfferDeadline(position.starts_at)));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Eligible people could not be loaded.");
    } finally {
      setWorking(false);
    }
  }, [activeMode, showError]);

  const sendOffer = async () => {
    if (!offerPosition || selectedPeople.length === 0) return;
    setWorking(true);
    try {
      const isLate = new Date(offerPosition.starts_at).getTime() <= Date.now();
      if (isLate) {
        if (selectedPeople.length !== 1) throw new Error("A late roster entry must add one person at a time.");
        const { error } = await supabase.rpc("coordination_late_assign", {
          p_position_id: offerPosition.id,
          p_user_id: selectedPeople[0],
          p_note: offerNote || undefined,
          p_actor_mode: activeMode,
          p_warning_override_note: overrideNote || undefined,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("coordination_send_offer", {
          p_position_id: offerPosition.id,
          p_recipient_ids: selectedPeople,
          p_note: offerNote || undefined,
          p_response_deadline: new Date(offerDeadline).toISOString(),
          p_actor_mode: activeMode,
          p_override_note: overrideNote || undefined,
        });
        if (error) throw error;
      }
      toast({ title: isLate ? "Roster entry confirmed" : "Offer sent", description: isLate ? "The person has been notified and can report an incorrect entry." : "Recipients can accept or decline. Acceptance still needs coordinator confirmation." });
      setOfferPosition(null);
      if (selectedFixture) await loadFixturePositions(selectedFixture);
    } catch (error) {
      showError(error instanceof Error ? error.message : "The offer could not be sent.");
    } finally {
      setWorking(false);
    }
  };

  const respondToOffer = async (offer: MyOffer, response: "ACCEPT" | "DECLINE" | "WITHDRAW") => {
    setWorking(true);
    try {
      const { error } = await supabase.rpc("coordination_respond_to_offer", {
        p_recipient_id: offer.id,
        p_response: response,
        p_reason: response === "DECLINE" ? declineReason || undefined : undefined,
      });
      if (error) throw error;
      setDeclineOffer(null);
      setDeclineReason("");
      await loadPersonalWork();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Your response could not be saved.");
    } finally {
      setWorking(false);
    }
  };

  const confirmRecipient = async (recipientId: string) => {
    setWorking(true);
    try {
      const { error } = await supabase.rpc("coordination_confirm_offer", {
        p_recipient_id: recipientId,
        p_actor_mode: activeMode,
        p_warning_override_note: overrideNote || undefined,
      });
      if (error) throw error;
      toast({ title: "Assignment confirmed", description: "Other recipients were marked Not selected and notified." });
      if (selectedFixture) await loadFixturePositions(selectedFixture);
    } catch (error) {
      showError(error instanceof Error ? error.message : "The assignment could not be confirmed.");
    } finally {
      setWorking(false);
    }
  };

  const requestReplacement = async () => {
    if (!replacementAssignment) return;
    setWorking(true);
    try {
      const { error } = await supabase.rpc("coordination_request_replacement", {
        p_assignment_id: replacementAssignment.id,
        p_note: replacementNote,
      });
      if (error) throw error;
      setReplacementAssignment(null);
      setReplacementNote("");
      await loadPersonalWork();
    } catch (error) {
      showError(error instanceof Error ? error.message : "The replacement request could not be sent.");
    } finally {
      setWorking(false);
    }
  };

  const respondCapabilityInvite = async (id: string, accept: boolean) => {
    setWorking(true);
    try {
      const { error } = await supabase.rpc("coordination_respond_capability_invite", { p_invitation_id: id, p_accept: accept });
      if (error) throw error;
      await loadPersonalWork();
    } catch (error) {
      showError(error instanceof Error ? error.message : "The capability invitation could not be updated.");
    } finally { setWorking(false); }
  };

  const loadMatrix = async () => {
    if (!matrixAssociationId) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc("coordination_get_umpire_matrix", {
        p_association_id: matrixAssociationId,
        p_actor_mode: activeMode,
      });
      if (error) throw error;
      setMatrix((data || []) as unknown as MatrixRow[]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "The Umpire Matrix could not be loaded.");
    } finally { setWorking(false); }
  };

  const openMatrixAction = async (kind: "GRADE" | "QUALIFICATION" | "NOTE" | "LOG", row: MatrixRow) => {
    setMatrixAction({ kind, userId: row.user_id, name: row.name });
    setMatrixActionValue("");
    setMatrixActionExtra("");
    setMatrixActionStatus("SIGNED_OFF");
    setMatrixNotes([]);
    if (kind === "LOG" && matrixAssociationId) {
      setWorking(true);
      const { data, error } = await supabase.rpc("coordination_get_umpire_notes", {
        p_user_id: row.user_id,
        p_association_id: matrixAssociationId,
        p_actor_mode: activeMode,
      });
      setWorking(false);
      if (error) showError(error.message);
      else setMatrixNotes((data || []) as unknown as MatrixNote[]);
    }
  };

  const saveMatrixAction = async () => {
    if (!matrixAction || !matrixAssociationId) return;
    setWorking(true);
    try {
      if (matrixAction.kind === "GRADE") {
        const { error } = await supabase.rpc("coordination_record_grade_signoff", {
          p_user_id: matrixAction.userId,
          p_association_id: matrixAssociationId,
          p_division_id: matrixActionValue,
          p_status: matrixActionStatus,
          p_effective_date: format(new Date(), "yyyy-MM-dd"),
          p_reason: matrixActionExtra || undefined,
          p_actor_mode: activeMode,
        });
        if (error) throw error;
      } else if (matrixAction.kind === "QUALIFICATION") {
        const { error } = await supabase.rpc("coordination_add_umpire_qualification", {
          p_user_id: matrixAction.userId,
          p_association_id: matrixAssociationId,
          p_name: matrixActionValue,
          p_issuer: matrixActionExtra || undefined,
          p_issued_on: undefined,
          p_expires_on: undefined,
          p_note: undefined,
          p_actor_mode: activeMode,
        });
        if (error) throw error;
      } else if (matrixAction.kind === "NOTE") {
        const { error } = await supabase.rpc("coordination_add_umpire_note", {
          p_user_id: matrixAction.userId,
          p_association_id: matrixAssociationId,
          p_content: matrixActionValue,
          p_note_kind: matrixActionStatus,
          p_actor_mode: activeMode,
        });
        if (error) throw error;
      }
      setMatrixAction(null);
      await loadMatrix();
    } catch (error) {
      showError(error instanceof Error ? error.message : "The Matrix entry could not be saved.");
    } finally { setWorking(false); }
  };

  const loadRosterChecks = async () => {
    if (!matrixAssociationId) return showError("Select an association in the Umpire Matrix first.");
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc("coordination_get_roster_review_queue", {
        p_association_id: matrixAssociationId,
        p_actor_mode: activeMode,
      });
      if (error) throw error;
      setRosterChecks((data || []) as unknown as RosterCheck[]);
    } catch (error) { showError(error instanceof Error ? error.message : "Roster checks could not be loaded."); }
    finally { setWorking(false); }
  };

  const reviewRosterCheck = async (id: string, status: "CONFIRMED" | "DISMISSED") => {
    const { error } = await supabase.rpc("coordination_review_roster_check", {
      p_check_id: id,
      p_reviewed_status: status,
      p_note: "Reviewed in the Coordination Module.",
      p_actor_mode: activeMode,
    });
    if (error) showError(error.message);
    else await loadRosterChecks();
  };

  const createActivity = async () => {
    const assignedScope = coordinationAccess.responsibilities.find((item) =>
      item.responsibility === "VOLUNTEER_COORDINATOR");
    const scopeType = assignedScope?.scope_type
      || (selectedTeamId ? "TEAM" : selectedClubId ? "CLUB" : "ASSOCIATION");
    const scopeId = assignedScope?.scope_id
      || selectedTeamId || selectedClubId || selectedAssociationId || matrixAssociationId;
    if (!scopeId) return showError("Select an association, club or team first.");
    setWorking(true);
    try {
      const { error } = await supabase.rpc("coordination_create_activity", {
        p_name: activity.name,
        p_activity_type: activity.type,
        p_description: undefined,
        p_scope_type: scopeType,
        p_scope_id: scopeId,
        p_starts_at: new Date(activity.starts).toISOString(),
        p_ends_at: new Date(activity.ends).toISOString(),
        p_location: activity.location || undefined,
        p_notes: undefined,
        p_positions: [{ label: activity.position, count: Number(activity.count), type: "VOLUNTEER" }],
        p_actor_mode: activeMode,
      });
      if (error) throw error;
      setActivityOpen(false);
      setActivity({ name: "", type: "Working bee", starts: "", ends: "", location: "", position: "Volunteer", count: "1" });
      await loadBaseData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "The activity could not be created.");
    } finally { setWorking(false); }
  };

  const sendCapabilityInvite = async () => {
    const responsibility = inviteCapability === "SUPERVISING_UMPIRE"
      ? "UMPIRE_COORDINATOR"
      : inviteCapability === "TECHNICAL_BENCH"
        ? "TECHNICAL_BENCH_COORDINATOR"
        : "VOLUNTEER_COORDINATOR";
    const assignedScope = coordinationAccess.responsibilities.find((item) =>
      item.responsibility === responsibility);
    const scopeType = assignedScope?.scope_type || (inviteCapability === "SUPERVISING_UMPIRE"
      ? "ASSOCIATION"
      : selectedTeamId ? "TEAM" : selectedClubId ? "CLUB" : "ASSOCIATION");
    const scopeId = assignedScope?.scope_id || (scopeType === "TEAM" ? selectedTeamId
      : scopeType === "CLUB" ? selectedClubId
      : matrixAssociationId || selectedAssociationId);
    if (!scopeId) return showError("Select an association scope first.");
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("coordination-invite", {
        body: {
          email: inviteEmail,
          capability_type: inviteCapability,
          scope_type: scopeType,
          scope_id: scopeId,
          actor_mode: activeMode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: data?.account_invite_sent ? "Account invitation sent" : "Capability invitation sent",
        description: "The capability is added only if the person accepts it.",
      });
      setInviteOpen(false);
      setInviteEmail("");
    } catch (error) {
      showError(error instanceof Error ? error.message : "The invitation could not be sent.");
    } finally { setWorking(false); }
  };

  const pendingCount = useMemo(() => myOffers.filter((offer) => ["PENDING", "ACCEPTED_AWAITING_CONFIRMATION"].includes(offer.status)).length, [myOffers]);
  const canManageFixtures = coordinationAccess.can_manage_umpires || coordinationAccess.can_manage_technical_bench;
  const canManageMatrix = coordinationAccess.can_manage_matrix;
  const canManageActivities = coordinationAccess.can_manage_volunteers;
  const canReviewRoster = coordinationAccess.can_review_roster_mismatches;
  const visibleTabs = coordinationTabsForAccess(coordinationAccess);
  const defaultTab = pendingCount
    ? "mine"
    : canManageFixtures
      ? "fixtures"
      : canManageMatrix
        ? "matrix"
        : canManageActivities
          ? "activities"
          : canReviewRoster
            ? "roster-checks"
            : "mine";

  if (loading || accessLoading || !contextConfirmed) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Coordination</h1><p className="text-sm text-muted-foreground">Offers are not rostered until a coordinator confirms them.</p></div>
        <Button variant="outline" onClick={() => void loadBaseData()} disabled={working}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>No until yes</AlertTitle><AlertDescription>An accepted offer means the person is willing. The position is still unfilled until the offerer confirms them.</AlertDescription></Alert>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {visibleTabs.includes("fixtures") && <TabsTrigger value="fixtures">Fixtures</TabsTrigger>}
          <TabsTrigger value="mine">My work {pendingCount > 0 && <Badge className="ml-2">{pendingCount}</Badge>}</TabsTrigger>
          {visibleTabs.includes("matrix") && <TabsTrigger value="matrix">Umpire Matrix</TabsTrigger>}
          {visibleTabs.includes("activities") && <TabsTrigger value="activities">Volunteer activities</TabsTrigger>}
          {visibleTabs.includes("roster-checks") && <TabsTrigger value="roster-checks">Roster flags</TabsTrigger>}
        </TabsList>

        {canManageFixtures && <TabsContent value="fixtures" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <Card><CardHeader><CardTitle className="text-lg">Upcoming fixtures</CardTitle><CardDescription>Select a fixture to create or view its four standard positions.</CardDescription></CardHeader>
              <CardContent className="max-h-[65vh] space-y-2 overflow-y-auto">
                {fixtures.map((fixture) => <button key={fixture.id} type="button" onClick={() => void loadFixturePositions(fixture)} className="w-full rounded-lg border p-3 text-left hover:bg-muted">
                  <div className="font-medium">{fixture.home_team?.name || "Home"} v {fixture.away_team?.name || "Bye"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{displayDateTime(fixture.fixture_date)} · {fixture.venue?.name || "Venue not set"}</div>
                </button>)}
                {fixtures.length === 0 && <p className="text-sm text-muted-foreground">No upcoming fixtures are visible in this scope.</p>}
              </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-lg">{selectedFixture ? `${selectedFixture.home_team?.name} v ${selectedFixture.away_team?.name || "Bye"}` : "Fixture positions"}</CardTitle>
              <CardDescription>{selectedFixture ? displayDateTime(selectedFixture.fixture_date) : "Select a fixture on the left."}</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {positions.map((position) => <div key={position.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2"><div className="font-medium">{position.label}</div><Badge variant={position.state === "FILLED" ? "default" : "outline"}>{formatCoordinationStatus(position.state)}</Badge></div>
                  {position.assignment ? <div className="mt-3 rounded-md bg-muted p-3"><div className="font-medium">{position.assignment.name}</div><div className="text-xs text-muted-foreground">{formatCoordinationStatus(position.assignment.status)}{position.assignment.late ? " · Late roster entry" : ""}</div></div> : <p className="mt-3 text-sm text-muted-foreground">No confirmed person.</p>}
                  {position.offer && <div className="mt-3 space-y-2"><div className="text-xs text-muted-foreground">Deadline {displayDateTime(position.offer.deadline)} {position.offer.urgent && <Badge variant="destructive">Urgent</Badge>}</div>
                    {position.offer.recipients.map((recipient) => <div key={recipient.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm"><span>{recipient.name} · {formatCoordinationStatus(recipient.status)}</span>{recipient.status === "ACCEPTED_AWAITING_CONFIRMATION" && <Button size="sm" onClick={() => void confirmRecipient(recipient.id)}>Confirm</Button>}</div>)}
                  </div>}
                  {!position.assignment && <Button className="mt-3 w-full" variant="outline" onClick={() => void openOffer(position)}>{new Date(position.starts_at) <= new Date() ? "Add actual person" : position.offer ? "Add recipients" : "Offer position"}</Button>}
                </div>)}
                {!selectedFixture && <p className="text-sm text-muted-foreground">Nothing selected yet.</p>}
              </CardContent></Card>
          </div>
        </TabsContent>}

        <TabsContent value="mine" className="space-y-4">
          {capabilityInvites.map((invite) => <Card key={invite.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6"><div><div className="font-medium">{formatCoordinationStatus(invite.capability_type)} capability invitation</div><div className="text-sm text-muted-foreground">Expires {displayDateTime(invite.expires_at)}</div></div><div className="flex gap-2"><Button variant="outline" onClick={() => void respondCapabilityInvite(invite.id, false)}>Decline</Button><Button onClick={() => void respondCapabilityInvite(invite.id, true)}>Accept</Button></div></CardContent></Card>)}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-lg">Offers</CardTitle><CardDescription>Accepting does not roster you. You may withdraw until the coordinator confirms you.</CardDescription></CardHeader><CardContent className="space-y-3">
              {myOffers.map((offer) => <div key={offer.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{offer.offer_batch?.position?.position_label || "Coordination offer"}</div><div className="text-xs text-muted-foreground">{displayDateTime(offer.offer_batch?.position?.starts_at || null)} · respond by {displayDateTime(offer.offer_batch?.response_deadline || null)}</div></div><Badge variant={offer.offer_batch?.urgent ? "destructive" : "outline"}>{formatCoordinationStatus(offer.status)}</Badge></div>
                {offer.offer_batch?.note && <p className="mt-2 rounded bg-muted p-2 text-sm">{offer.offer_batch.note}</p>}
                {offer.status === "PENDING" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void respondToOffer(offer, "ACCEPT")}><Check className="mr-1 h-4 w-4" />Accept</Button><Button size="sm" variant="outline" onClick={() => setDeclineOffer(offer)}><X className="mr-1 h-4 w-4" />Decline</Button></div>}
                {offer.status === "ACCEPTED_AWAITING_CONFIRMATION" && <Button className="mt-3" size="sm" variant="outline" onClick={() => void respondToOffer(offer, "WITHDRAW")}>Withdraw while waiting</Button>}
              </div>)}
              {myOffers.length === 0 && <p className="text-sm text-muted-foreground">No Coordination offers yet.</p>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-lg">Confirmed assignments</CardTitle></CardHeader><CardContent className="space-y-3">
              {myAssignments.map((assignment) => <div key={assignment.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{assignment.position?.position_label || "Assignment"}</div><div className="text-xs text-muted-foreground">{displayDateTime(assignment.position?.starts_at || null)}</div></div><Badge>{formatCoordinationStatus(assignment.status)}</Badge></div>
                {assignment.status === "CONFIRMED" && !assignment.late_assignment && <Button className="mt-3" size="sm" variant="outline" onClick={() => setReplacementAssignment(assignment)}>Request replacement</Button>}
                {assignment.status === "CONFIRMED" && assignment.late_assignment && <Button className="mt-3" size="sm" variant="outline" onClick={() => { setReplacementAssignment(assignment); setReplacementNote("This roster entry is incorrect because "); }}>Report incorrect</Button>}
              </div>)}
              {myAssignments.length === 0 && <p className="text-sm text-muted-foreground">No confirmed assignments.</p>}
            </CardContent></Card>
          </div>
        </TabsContent>

        {canManageMatrix && <TabsContent value="matrix" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-lg">Association Umpire Matrix</CardTitle><CardDescription>Counts include completed confirmed duties only. Restricted coordinator notes are not shown here.</CardDescription></CardHeader><CardContent>
            <div className="mb-4 flex flex-wrap gap-2"><Select value={matrixAssociationId || "__none__"} onValueChange={(value) => setMatrixAssociationId(value === "__none__" ? "" : value)}><SelectTrigger className="w-full max-w-sm"><SelectValue placeholder="Select association" /></SelectTrigger><SelectContent><SelectItem value="__none__">Select association</SelectItem>{associations.map((association) => <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>)}</SelectContent></Select><Button onClick={() => void loadMatrix()} disabled={!matrixAssociationId || working}>Load Matrix</Button><Button variant="outline" onClick={() => setInviteOpen(true)}><MailPlus className="mr-2 h-4 w-4" />Invite</Button></div>
            <div className="space-y-3">{matrix.map((row) => <div key={row.user_id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-medium">{row.name}</div><div className="text-sm text-muted-foreground">{row.completed_games} completed · {row.upcoming_games} upcoming · {row.replacement_requests} replacement requests</div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void openMatrixAction("GRADE", row)}>Add grade</Button><Button size="sm" variant="outline" onClick={() => void openMatrixAction("QUALIFICATION", row)}>Qualification</Button><Button size="sm" variant="outline" onClick={() => void openMatrixAction("NOTE", row)}>Add note</Button><Button size="sm" variant="outline" onClick={() => void openMatrixAction("LOG", row)}>View log</Button></div></div>
              <div className="mt-3 grid gap-2 md:grid-cols-2"><div><div className="text-xs font-medium uppercase text-muted-foreground">Grades</div>{row.grades.slice(0, 4).map((grade, index) => <div key={`${grade.division}-${index}`} className="mt-1 text-sm">{grade.division}: {formatCoordinationStatus(grade.status)} · {grade.signed_by}</div>)}</div><div><div className="text-xs font-medium uppercase text-muted-foreground">Qualifications</div>{row.qualifications.slice(0, 4).map((qualification) => <div key={qualification.id} className="mt-1 text-sm">{qualification.name}{qualification.expires_on ? ` · expires ${format(new Date(qualification.expires_on), "dd/MM/yyyy")}` : ""}</div>)}</div></div>
            </div>)}{matrix.length === 0 && <p className="text-sm text-muted-foreground">Select an association and load its Matrix.</p>}</div>
          </CardContent></Card>
        </TabsContent>}

        {canReviewRoster && <TabsContent value="roster-checks" className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => void loadRosterChecks()} disabled={working}>Load roster flags</Button></div>
          <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Flag only</AlertTitle><AlertDescription>A mismatch never blocks, deletes or changes an Umpire Match Voting submission.</AlertDescription></Alert>
          {rosterChecks.map((check) => <Card key={check.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6"><div><div className="font-medium">{check.fixture}</div><div className="text-sm text-muted-foreground">{displayDateTime(check.fixture_date)} · {formatCoordinationStatus(check.result)}</div><p className="mt-1 text-sm">{check.detail}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void reviewRosterCheck(check.id, "DISMISSED")}>Dismiss</Button><Button size="sm" onClick={() => void reviewRosterCheck(check.id, "CONFIRMED")}>Confirm flag</Button></div></CardContent></Card>)}
          {rosterChecks.length === 0 && <p className="text-sm text-muted-foreground">No pending roster flags loaded.</p>}
        </TabsContent>}

        {canManageActivities && <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => { const start = addHours(new Date(), 24); setActivity((current) => ({ ...current, starts: toLocalInput(start), ends: toLocalInput(addHours(start, 2)) })); setActivityOpen(true); }}><CalendarClock className="mr-2 h-4 w-4" />Create activity</Button></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{activities.map((row) => <Card key={row.id}><CardHeader><CardTitle className="text-base">{row.name}</CardTitle><CardDescription>{row.activity_type}</CardDescription></CardHeader><CardContent className="text-sm"><div>{displayDateTime(row.starts_at)}</div><div className="text-muted-foreground">{row.location || "Location not set"}</div><Badge className="mt-3" variant="outline">{formatCoordinationStatus(row.status)}</Badge></CardContent></Card>)}{activities.length === 0 && <p className="text-sm text-muted-foreground">No upcoming volunteer activities in this scope.</p>}</div>
        </TabsContent>}
      </Tabs>

      <Dialog open={Boolean(offerPosition)} onOpenChange={(open) => !open && setOfferPosition(null)}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{new Date(offerPosition?.starts_at || 0) <= new Date() ? "Add actual person" : `Offer ${offerPosition?.label || "position"}`}</DialogTitle><DialogDescription>Select one or more eligible people. Each recipient sees only their own offer.</DialogDescription></DialogHeader>
        <div className="space-y-4"><div className="max-h-64 space-y-2 overflow-y-auto rounded border p-2">{eligiblePeople.map((person) => { const warnings = [person.availability === "UNAVAILABLE" ? "Unavailable" : "", !person.grade_signed_off ? "Not signed off" : "", person.age_state === "UNKNOWN" ? "Age unknown" : "", person.completed_count === 0 && offerPosition?.type === "TECHNICAL_BENCH" ? "First duty" : ""].filter(Boolean); return <label key={person.user_id} className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted"><Checkbox checked={selectedPeople.includes(person.user_id)} onCheckedChange={(checked) => setSelectedPeople((current) => checked ? [...current, person.user_id] : current.filter((id) => id !== person.user_id))} /><div className="min-w-0 flex-1"><div className="font-medium">{person.name}</div><div className="text-xs text-muted-foreground">{person.confirmed_load} confirmed · {person.completed_count} completed {warnings.length ? `· Warning: ${warnings.join(", ")}` : ""}</div></div></label>; })}</div>
          {offerPosition && new Date(offerPosition.starts_at) > new Date() && <div><Label htmlFor="offer-deadline">Response deadline</Label><Input id="offer-deadline" type="datetime-local" value={offerDeadline} max={toLocalInput(new Date(offerPosition.starts_at))} onChange={(event) => setOfferDeadline(event.target.value)} /></div>}
          <div><Label htmlFor="offer-note">Note to recipient</Label><Textarea id="offer-note" value={offerNote} onChange={(event) => setOfferNote(event.target.value)} placeholder="For example: this game is expected to be difficult, or this duty pays double." /></div>
          <div><Label htmlFor="override-note">Warning override note</Label><Textarea id="override-note" value={overrideNote} onChange={(event) => setOverrideNote(event.target.value)} placeholder="Required if any selected person has a warning." /></div></div>
        <DialogFooter><Button variant="outline" onClick={() => setOfferPosition(null)}>Cancel</Button><Button onClick={() => void sendOffer()} disabled={working || selectedPeople.length === 0}>{working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{offerPosition && new Date(offerPosition.starts_at) <= new Date() ? "Confirm roster entry" : "Send offer"}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={Boolean(declineOffer)} onOpenChange={(open) => !open && setDeclineOffer(null)}><DialogContent><DialogHeader><DialogTitle>Decline offer</DialogTitle><DialogDescription>A short reason is optional and is visible only to you and authorised coordinators.</DialogDescription></DialogHeader><Textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Optional reason" /><DialogFooter><Button variant="outline" onClick={() => setDeclineOffer(null)}>Cancel</Button><Button variant="destructive" onClick={() => declineOffer && void respondToOffer(declineOffer, "DECLINE")}>Decline</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(replacementAssignment)} onOpenChange={(open) => !open && setReplacementAssignment(null)}><DialogContent><DialogHeader><DialogTitle>{replacementAssignment?.late_assignment ? "Report incorrect roster entry" : "Request replacement"}</DialogTitle><DialogDescription>{replacementAssignment?.late_assignment ? "This pauses roster history and mismatch checks until a coordinator reviews it." : "You remain the rostered person, marked not available, until a replacement is confirmed."}</DialogDescription></DialogHeader><div><Label htmlFor="replacement-note">Reason</Label><Textarea id="replacement-note" value={replacementNote} onChange={(event) => setReplacementNote(event.target.value)} placeholder="A note is required." /></div><DialogFooter><Button variant="outline" onClick={() => setReplacementAssignment(null)}>Cancel</Button><Button onClick={() => replacementAssignment?.late_assignment ? void supabase.rpc("coordination_dispute_late_assignment", { p_assignment_id: replacementAssignment.id, p_reason: replacementNote }).then(({ error }) => { if (error) showError(error.message); else { setReplacementAssignment(null); setReplacementNote(""); void loadPersonalWork(); } }) : void requestReplacement()} disabled={replacementNote.trim().length < 2}>Send</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}><DialogContent><DialogHeader><DialogTitle>Create volunteer activity</DialogTitle><DialogDescription>This is a basic coordination activity, not a public event listing.</DialogDescription></DialogHeader><div className="grid gap-3"><div><Label htmlFor="activity-name">Activity name</Label><Input id="activity-name" value={activity.name} onChange={(event) => setActivity({ ...activity, name: event.target.value })} /></div><div><Label htmlFor="activity-type">Activity type</Label><Input id="activity-type" value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="min-w-0"><Label htmlFor="activity-start">Start</Label><Input id="activity-start" type="datetime-local" value={activity.starts} onChange={(event) => setActivity({ ...activity, starts: event.target.value })} /></div><div className="min-w-0"><Label htmlFor="activity-end">End</Label><Input id="activity-end" type="datetime-local" value={activity.ends} onChange={(event) => setActivity({ ...activity, ends: event.target.value })} /></div></div><div><Label htmlFor="activity-location">Location</Label><Input id="activity-location" value={activity.location} onChange={(event) => setActivity({ ...activity, location: event.target.value })} /></div><div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3"><div className="min-w-0"><Label htmlFor="activity-position">Position name</Label><Input id="activity-position" value={activity.position} onChange={(event) => setActivity({ ...activity, position: event.target.value })} /></div><div><Label htmlFor="activity-count">Needed</Label><Input id="activity-count" type="number" min="1" max="50" value={activity.count} onChange={(event) => setActivity({ ...activity, count: event.target.value })} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setActivityOpen(false)}>Cancel</Button><Button onClick={() => void createActivity()} disabled={!activity.name.trim() || !activity.starts || !activity.ends}>Create</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogContent><DialogHeader><DialogTitle>Invite to Coordination</DialogTitle><DialogDescription>Umpires are assigned an association-scoped role in User Management. These invitations are only for other Coordination capabilities and do not reserve a fixture position.</DialogDescription></DialogHeader><div className="grid gap-3"><div><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@example.com" /></div><div><Label>Capability</Label><Select value={inviteCapability} onValueChange={(value) => setInviteCapability(value as typeof inviteCapability)}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUPERVISING_UMPIRE">Supervising Umpire</SelectItem><SelectItem value="TECHNICAL_BENCH">Technical Bench</SelectItem><SelectItem value="VOLUNTEER">Volunteer</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button><Button onClick={() => void sendCapabilityInvite()} disabled={working || !inviteEmail.includes("@")}>Send invite</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(matrixAction)} onOpenChange={(open) => !open && setMatrixAction(null)}><DialogContent><DialogHeader><DialogTitle>{matrixAction?.kind === "LOG" ? "Coordinator log" : `${formatCoordinationStatus(matrixAction?.kind || "")} — ${matrixAction?.name || "Umpire"}`}</DialogTitle><DialogDescription>{matrixAction?.kind === "LOG" ? "This restricted history is visible only to authorised Umpire coordinators." : "This change is added to the permanent audit history."}</DialogDescription></DialogHeader>
        {matrixAction?.kind === "LOG" ? <div className="max-h-80 space-y-2 overflow-y-auto">{matrixNotes.map((note) => <div key={note.id} className="rounded border p-3"><div className="text-sm">{note.content}</div><div className="mt-1 text-xs text-muted-foreground">{formatCoordinationStatus(note.kind)} · {note.created_by} · {displayDateTime(note.created_at)}</div></div>)}{matrixNotes.length === 0 && <p className="text-sm text-muted-foreground">No restricted notes.</p>}</div> : <div className="grid gap-3">
          {matrixAction?.kind === "GRADE" && <><div><Label>Grade</Label><Select value={matrixActionValue || "__none__"} onValueChange={(value) => setMatrixActionValue(value === "__none__" ? "" : value)}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select grade" /></SelectTrigger><SelectContent><SelectItem value="__none__">Select grade</SelectItem>{divisions.filter((division) => division.association_id === matrixAssociationId).map((division) => <SelectItem key={division.id} value={division.id}>{division.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Status</Label><Select value={matrixActionStatus} onValueChange={setMatrixActionStatus}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIGNED_OFF">Signed off</SelectItem><SelectItem value="SUSPENDED">Suspended</SelectItem><SelectItem value="REMOVED">Removed</SelectItem></SelectContent></Select></div></>}
          {matrixAction?.kind === "QUALIFICATION" && <><div><Label htmlFor="matrix-value">Qualification name</Label><Input id="matrix-value" value={matrixActionValue} onChange={(event) => setMatrixActionValue(event.target.value)} /></div><div><Label htmlFor="matrix-extra">Issuer</Label><Input id="matrix-extra" value={matrixActionExtra} onChange={(event) => setMatrixActionExtra(event.target.value)} /></div></>}
          {matrixAction?.kind === "NOTE" && <><div><Label>Note type</Label><Select value={matrixActionStatus} onValueChange={setMatrixActionStatus}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GENERAL">General</SelectItem><SelectItem value="HEALTH">Health</SelectItem><SelectItem value="BEREAVEMENT">Bereavement</SelectItem><SelectItem value="CONDUCT">Conduct</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div><div><Label htmlFor="matrix-note">Restricted note</Label><Textarea id="matrix-note" value={matrixActionValue} onChange={(event) => setMatrixActionValue(event.target.value)} /></div></>}
          {matrixAction?.kind === "GRADE" && matrixActionStatus !== "SIGNED_OFF" && <div><Label htmlFor="matrix-reason">Reason</Label><Textarea id="matrix-reason" value={matrixActionExtra} onChange={(event) => setMatrixActionExtra(event.target.value)} /></div>}
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setMatrixAction(null)}>Close</Button>{matrixAction?.kind !== "LOG" && <Button onClick={() => void saveMatrixAction()} disabled={working || !matrixActionValue || (matrixAction.kind === "GRADE" && matrixActionStatus !== "SIGNED_OFF" && matrixActionExtra.trim().length < 2)}>Save</Button>}</DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
