import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  ShieldAlert,
  Users,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import {
  getDefaultUmpireVoteScheme,
  UMPIRE_VOTE_SCHEMES,
  UmpireVoteSchemeKey,
} from "@/lib/umpireVoteSchemes";
import { UmpireLinkedPlayerPicker } from "@/components/umpire/UmpireLinkedPlayerPicker";
import {
  loadUmpireLinkedPlayers,
  type UmpireLinkedPlayerOption,
} from "@/lib/umpireLinkedPlayers";

type AppMode = "super_admin" | "association" | "club" | "team" | "player";

interface VoteCard {
  schemeLineKey: string;
  label: string;
  points: number;
  profileId: string | null;
  playerName: string;
  playerNumber: string;
  teamId: string;
  badgeType?: "gold" | "silver" | "bronze";
}

interface SelectedFixtureInfo {
  id: string;
  home_team_id: string;
  away_team_id: string;
  division_id: string;
  divisionName: string;
  homeTeamName: string;
  awayTeamName: string;
  round_number: number;
}

export default function UmpireVoteSubmit() {
  const { user } = useAuth();
  const { roles, loading: rolesLoading } = useUserRole();
  const { toast } = useToast();

  // Step state (1, 2, or 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // General wizard state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 - Proxy settings
  const [isProxy, setIsProxy] = useState(false);
  const [proxyUmpireName, setProxyUmpireName] = useState("");
  const [proxyReason, setProxyReason] = useState("");

  // Step 1 - User Associations & Selection
  const [userAssociations, setUserAssociations] = useState<{ id: string; name: string }[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState<string>("");
  const [associationsLoading, setAssociationsLoading] = useState(false);

  // Step 1 - Selection lists
  const [rounds, setRounds] = useState<number[]>([]);
  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [teamsMap, setTeamsMap] = useState<Map<string, string>>(new Map());

  // Step 1 - Current selections
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>("");

  // Step 1 - Fetching states
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [divisionsLoading, setDivisionsLoading] = useState(false);
  const [fixturesLoading, setFixturesLoading] = useState(false);

  // Step 1 - Resolved fixture detail
  const [selectedFixture, setSelectedFixture] = useState<SelectedFixtureInfo | null>(null);

  // Step 2 - Vote cards state
  const [voteCards, setVoteCards] = useState<VoteCard[]>([]);
  const [selectedSchemeKey, setSelectedSchemeKey] = useState<UmpireVoteSchemeKey>("classic_3_2_1");

  // Step 2 - Linked SportStack player options for the selected fixture.
  const [linkedPlayers, setLinkedPlayers] = useState<UmpireLinkedPlayerOption[]>([]);
  const [linkedPlayersLoading, setLinkedPlayersLoading] = useState(false);
  const [linkedPlayersError, setLinkedPlayersError] = useState<string | null>(null);

  // Role Access Protection check
  const isUmpire =
    (roles as string[]).includes("UMPIRE") || (roles as string[]).includes("UMPIRE_ADMIN");

  // Load user's associations
  useEffect(() => {
    if (!isUmpire || !user) return;

    const fetchUserAssociations = async () => {
      setAssociationsLoading(true);
      try {
        const isSuperAdmin = (roles as string[]).includes("SUPER_ADMIN");
        let resolvedAssocs: { id: string; name: string }[] = [];

        if (isSuperAdmin) {
          // Fetch ALL associations for Super Admin
          const { data: allData, error: allError } = await (supabase as any)
            .from("associations")
            .select("id, name")
            .order("name");

          if (allError) throw allError;
          resolvedAssocs = allData || [];
          
          setUserAssociations(resolvedAssocs);
          // Do NOT auto-select for Super Admin
        } else {
          // Query user's roles for any association_id link
          const { data: rolesData, error: rolesError } = await (supabase as any)
            .from("user_roles")
            .select("association_id")
            .eq("user_id", user.id)
            .not("association_id", "is", null);

          if (rolesError) throw rolesError;

          const assocIds = Array.from(
            new Set(
              rolesData?.map((r: any) => r.association_id).filter(Boolean) || []
            )
          ) as string[];

          if (assocIds.length > 0) {
            // Fetch resolved names for the user's specific associations
            const { data: namesData, error: namesError } = await (supabase as any)
              .from("associations")
              .select("id, name")
              .in("id", assocIds)
              .order("name");

            if (namesError) throw namesError;
            resolvedAssocs = namesData || [];
          } else {
            // Fallback: Fetch ALL associations
            const { data: allData, error: allError } = await (supabase as any)
              .from("associations")
              .select("id, name")
              .order("name");

            if (allError) throw allError;
            resolvedAssocs = allData || [];
          }

          setUserAssociations(resolvedAssocs);

          // Auto-select if there is exactly 1 association
          if (resolvedAssocs.length === 1) {
            setSelectedAssociationId(resolvedAssocs[0].id);
          }
        }
      } catch (err: any) {
        console.error("Error fetching associations:", err);
        toast({
          title: "Error",
          description: "Failed to load associations.",
          variant: "destructive",
        });
      } finally {
        setAssociationsLoading(false);
      }
    };

    fetchUserAssociations();
  }, [isUmpire, user?.id, roles]);

  // Step 1 - Load unique rounds filtered by association
  useEffect(() => {
    if (!isUmpire || !selectedAssociationId) {
      setRounds([]);
      setSelectedRound("");
      return;
    }

    const fetchRounds = async () => {
      setRoundsLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("fixtures")
          .select("round_number, divisions!inner(association_id)")
          .eq("divisions.association_id", selectedAssociationId);

        if (error) throw error;

        const uniqueRounds = Array.from(
          new Set(
            data
              ?.map((f: any) => f.round_number)
              .filter((r: any): r is number => r !== null) || []
          )
        ).sort((a: any, b: any) => a - b) as number[];

        setRounds(uniqueRounds);
      } catch (err: any) {
        console.error("Error fetching rounds:", err);
        toast({
          title: "Error",
          description: "Failed to load rounds from fixtures.",
          variant: "destructive",
        });
      } finally {
        setRoundsLoading(false);
      }
    };

    fetchRounds();
  }, [isUmpire, selectedAssociationId]);

  // Step 1 - Fetch divisions when round is chosen, filtered by association
  useEffect(() => {
    if (!selectedRound || !selectedAssociationId) {
      setDivisions([]);
      setSelectedDivisionId("");
      return;
    }

    const fetchDivisions = async () => {
      setDivisionsLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("fixtures")
          .select("division_id, divisions!inner(association_id)")
          .eq("round_number", parseInt(selectedRound, 10))
          .eq("divisions.association_id", selectedAssociationId);

        if (error) throw error;

        const uniqueDivisionIds = Array.from(
          new Set(
            data
              ?.map((f: any) => f.division_id)
              .filter((d: any): d is string => d !== null) || []
          )
        );

        if (uniqueDivisionIds.length === 0) {
          setDivisions([]);
          return;
        }

        const { data: divData, error: divError } = await (supabase as any)
          .from("divisions")
          .select("id, name")
          .in("id", uniqueDivisionIds)
          .order("name");

        if (divError) throw divError;

        setDivisions(divData || []);
      } catch (err: any) {
        console.error("Error fetching divisions:", err);
        toast({
          title: "Error",
          description: "Failed to load divisions.",
          variant: "destructive",
        });
      } finally {
        setDivisionsLoading(false);
      }
    };

    fetchDivisions();
  }, [selectedRound, selectedAssociationId]);

  // Step 1 - Fetch fixtures & teams when division and round are chosen, filtered by association
  useEffect(() => {
    if (!selectedRound || !selectedDivisionId || !selectedAssociationId) {
      setFixtures([]);
      setSelectedFixtureId("");
      return;
    }

    const fetchFixturesAndTeams = async () => {
      setFixturesLoading(true);
      try {
        // Query fixtures for this round and division, filtering out byes (away_team_id not null)
        const { data: fixturesData, error: fixturesError } = await (supabase as any)
          .from("fixtures")
          .select("id, home_team_id, away_team_id, division_id, round_number, divisions!inner(association_id)")
          .eq("round_number", parseInt(selectedRound, 10))
          .eq("division_id", selectedDivisionId)
          .eq("divisions.association_id", selectedAssociationId)
          .not("away_team_id", "is", null);

        if (fixturesError) throw fixturesError;

        if (!fixturesData || fixturesData.length === 0) {
          setFixtures([]);
          return;
        }

        // Fetch all teams in a separate query to build ID -> name map
        const teamIds = Array.from(
          new Set(
            fixturesData.flatMap((f: any) =>
              [f.home_team_id, f.away_team_id].filter((t): t is string => t !== null)
            )
          )
        );

        const { data: teamsData, error: teamsError } = await (supabase as any)
          .from("teams")
          .select("id, name")
          .in("id", teamIds);

        if (teamsError) throw teamsError;

        const newTeamsMap = new Map<string, string>();
        teamsData?.forEach((team: any) => {
          newTeamsMap.set(team.id, team.name);
        });
        setTeamsMap(newTeamsMap);

        // Map fixtures with home/away team names
        const enrichedFixtures = fixturesData.map((f: any) => ({
          ...f,
          homeTeamName: newTeamsMap.get(f.home_team_id) || "Unknown Home Team",
          awayTeamName: newTeamsMap.get(f.away_team_id || "") || "Unknown Away Team",
        }));

        setFixtures(enrichedFixtures);
      } catch (err: any) {
        console.error("Error fetching fixtures/teams:", err);
        toast({
          title: "Error",
          description: "Failed to load fixtures.",
          variant: "destructive",
        });
      } finally {
        setFixturesLoading(false);
      }
    };

    fetchFixturesAndTeams();
  }, [selectedRound, selectedDivisionId, selectedAssociationId]);

  // Step 1 - When a fixture is selected, resolve its details for subsequent steps
  useEffect(() => {
    if (!selectedFixtureId || fixtures.length === 0) {
      setSelectedFixture(null);
      return;
    }

    const matched = fixtures.find((f) => f.id === selectedFixtureId);
    if (matched) {
      const divisionName = divisions.find((d) => d.id === selectedDivisionId)?.name || "";
      setSelectedFixture({
        id: matched.id,
        home_team_id: matched.home_team_id,
        away_team_id: matched.away_team_id || "",
        division_id: matched.division_id,
        divisionName,
        homeTeamName: matched.homeTeamName,
        awayTeamName: matched.awayTeamName,
        round_number: matched.round_number,
      });
    }
  }, [selectedFixtureId, fixtures, selectedDivisionId, divisions]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedFixture) {
      setLinkedPlayers([]);
      setLinkedPlayersError(null);
      return;
    }

    setLinkedPlayersLoading(true);
    setLinkedPlayersError(null);

    loadUmpireLinkedPlayers({
      fixtureId: selectedFixture.id,
      homeTeamId: selectedFixture.home_team_id,
      awayTeamId: selectedFixture.away_team_id,
      homeTeamLabel: selectedFixture.homeTeamName,
      awayTeamLabel: selectedFixture.awayTeamName,
    })
      .then((players) => {
        if (!cancelled) setLinkedPlayers(players);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Error fetching linked player options:", error);
        setLinkedPlayers([]);
        setLinkedPlayersError("Linked players could not be loaded. You can still enter an unlisted player for admin review.");
      })
      .finally(() => {
        if (!cancelled) setLinkedPlayersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFixture]);

  const buildVoteCards = (schemeKey: UmpireVoteSchemeKey): VoteCard[] => {
    return UMPIRE_VOTE_SCHEMES[schemeKey].lines.map((line) => ({
      schemeLineKey: line.key,
      label: line.label,
      points: line.points,
      profileId: null,
      playerName: "",
      playerNumber: "",
      teamId: "",
      badgeType: line.badgeType,
    }));
  };

  const initialiseVoteCards = (divName: string) => {
    const scheme = getDefaultUmpireVoteScheme(divName);
    setSelectedSchemeKey(scheme.key);
    setVoteCards(buildVoteCards(scheme.key));
  };

  const handleSchemeChange = (schemeKey: UmpireVoteSchemeKey) => {
    setSelectedSchemeKey(schemeKey);
    setVoteCards(buildVoteCards(schemeKey));
  };

  // Navigation handlers
  const handleNextStep1 = () => {
    // Validate proxy inputs if checked
    if (isProxy) {
      if (!proxyUmpireName.trim() || !proxyReason.trim()) {
        toast({
          title: "Validation Error",
          description: "Please fill in all proxy details.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!selectedFixture) {
      toast({
        title: "Validation Error",
        description: "Please select a fixture.",
        variant: "destructive",
      });
      return;
    }

    initialiseVoteCards(selectedFixture.divisionName);
    setStep(2);
  };

  const handleNextStep2 = () => {
    // Validate Step 2 inputs
    // Each card is valid if it has EITHER player name OR player number filled in (or both).
    const allValid = voteCards.every(
      (card) => card.playerName.trim() !== "" || card.playerNumber.trim() !== ""
    );

    if (!allValid) {
      toast({
        title: "Validation Error",
        description: "All vote cards must have at least a player name or jersey number entered.",
        variant: "destructive",
      });
      return;
    }

    setStep(3);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as any);
    }
  };

  // Form Reset
  const handleReset = () => {
    setStep(1);
    setIsProxy(false);
    setProxyUmpireName("");
    setProxyReason("");
    if (userAssociations.length > 1) {
      setSelectedAssociationId("");
    }
    setSelectedRound("");
    setSelectedDivisionId("");
    setSelectedFixtureId("");
    setSelectedFixture(null);
    setSelectedSchemeKey("classic_3_2_1");
    setVoteCards([]);
    setSubmitSuccess(false);
    setSubmitError(null);
  };

  // Submit Submission
  const handleSubmit = async () => {
    if (!selectedFixture || !user) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Insert into public.player_vote_submissions
      const { data: subData, error: subError } = await (supabase as any)
        .from("player_vote_submissions")
        .insert({
          fixture_id: selectedFixture.id,
          association_id: selectedAssociationId,
          division_id: selectedFixture.division_id,
          round_number: selectedFixture.round_number,
          home_team_id: selectedFixture.home_team_id,
          away_team_id: selectedFixture.away_team_id,
          umpire_user_id: user.id,
          legacy_umpire_email: null,
          is_approved: false,
          submitted_at: new Date().toISOString(),
          proxy_umpire_name: isProxy ? proxyUmpireName.trim() : null,
          proxy_reason: isProxy ? proxyReason.trim() : null,
        })
        .select("id")
        .single();

      if (subError) throw subError;
      if (!subData) throw new Error("No submission ID returned");

      const submissionId = subData.id;

      // 2. Insert into public.player_vote_lines
      const linesToInsert = voteCards.map((card) => ({
        submission_id: submissionId,
        profile_id: card.profileId,
        player_name: card.playerName.trim(),
        player_number: card.playerNumber.trim() ? parseInt(card.playerNumber, 10) : null,
        team_id: card.teamId === "__none__" || !card.teamId ? null : card.teamId,
        votes: card.points,
      }));

      const { error: linesError } = await (supabase as any)
        .from("player_vote_lines")
        .insert(linesToInsert);

      if (linesError) throw linesError;

      // Success
      setSubmitSuccess(true);
      toast({
        title: "Success",
        description: "Votes submitted successfully!",
      });
    } catch (err: any) {
      console.error("Submission error:", err);
      setSubmitError(err?.message || "An error occurred during submission.");
      toast({
        title: "Submission Failed",
        description: err?.message || "An error occurred during submission.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Access check redirection
  if (rolesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isUmpire) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check validity for Step 1
  const isStep1Valid =
    selectedFixture &&
    (!isProxy || (proxyUmpireName.trim() !== "" && proxyReason.trim() !== ""));

  // Check validity for Step 2
  const isStep2Valid =
    voteCards.length > 0 &&
    voteCards.every((card) => card.playerName.trim() !== "" || card.playerNumber.trim() !== "");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <Trophy className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-foreground font-bold tracking-tight">
            UMPIRE VOTE PORTAL
          </h1>
          <p className="text-muted-foreground text-sm">
            Record best-player votes for matches in SportStack
          </p>
        </div>
      </div>

      {/* Progress Steps Header */}
      {!submitSuccess && (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between relative max-w-lg mx-auto">
            {/* Background line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-muted z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-primary transition-all duration-300 z-0"
              style={{
                width: step === 1 ? "0%" : step === 2 ? "50%" : "100%",
              }}
            />

            {/* Step 1 */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  step >= 1
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                1
              </div>
              <span className={`text-xs mt-2 font-medium ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                Match Info
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  step >= 2
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </div>
              <span className={`text-xs mt-2 font-medium ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                Player Votes
              </span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  step >= 3
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                3
              </div>
              <span className={`text-xs mt-2 font-medium ${step >= 3 ? "text-primary" : "text-muted-foreground"}`}>
                Confirm
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Wizard Form */}
      {submitSuccess ? (
        <Card className="border-green-200/50 bg-green-50/5 dark:bg-green-950/5">
          <CardContent className="pt-8 pb-8 text-center space-y-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-foreground">
                Vote Submitted Successfully!
              </CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Thank you. The votes have been recorded in the SportStack system and will be verified by the administrator.
              </CardDescription>
            </div>
            <Button onClick={handleReset} size="lg" className="px-8">
              Submit Another Vote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          {/* STEP 1: Match Info */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Match Information</CardTitle>
                <CardDescription>
                  Specify who is submitting the vote and select the fixture
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Proxy Section */}
                <div className="bg-muted/40 border border-border/80 rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="isProxy"
                      checked={isProxy}
                      onCheckedChange={(checked) => setIsProxy(!!checked)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="isProxy"
                        className="text-sm font-semibold leading-none cursor-pointer text-foreground"
                      >
                        I am submitting this vote on behalf of another umpire
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Ticking this allows you to input proxy credentials
                      </p>
                    </div>
                  </div>

                  {isProxy && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-fade-in">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Umpire Name *
                        </label>
                        <Input
                          placeholder="Enter umpire's full name"
                          value={proxyUmpireName}
                          onChange={(e) => setProxyUmpireName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Reason for submitting *
                        </label>
                        <Textarea
                          placeholder="e.g. Umpire is travelling and asked me to submit"
                          rows={2}
                          value={proxyReason}
                          onChange={(e) => setProxyReason(e.target.value)}
                          className="resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Match Selection Cascade */}
                <div className="space-y-4 pt-2">
                  <div className="rounded-lg border border-border/70 bg-muted/25 p-3 text-xs text-muted-foreground">
                    Select in order. Each choice narrows the next list so umpires only see fixtures that match the selected round and division.
                  </div>

                  {/* Association Select (only show if 2 or more available) */}
                  {userAssociations.length > 1 && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-sm font-semibold text-foreground">
                        Association
                      </label>
                      <Select
                        value={selectedAssociationId}
                        onValueChange={(val) => {
                          setSelectedAssociationId(val);
                          setSelectedRound("");
                          setSelectedDivisionId("");
                          setSelectedFixtureId("");
                        }}
                        disabled={associationsLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={associationsLoading ? "Loading associations..." : "Select Association"} />
                        </SelectTrigger>
                        <SelectContent>
                          {userAssociations.map((assoc) => (
                            <SelectItem key={assoc.id} value={assoc.id}>
                              {assoc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Round Select */}
                  {selectedAssociationId && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Round
                      </label>
                      <Select
                        value={selectedRound}
                        onValueChange={(val) => {
                          setSelectedRound(val);
                          setSelectedDivisionId("");
                          setSelectedFixtureId("");
                        }}
                        disabled={roundsLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={roundsLoading ? "Loading rounds..." : "Select Round"} />
                        </SelectTrigger>
                        <SelectContent>
                          {rounds.length === 0 ? (
                            <SelectItem value="__none__" disabled>No rounds found</SelectItem>
                          ) : (
                            rounds.map((round) => (
                              <SelectItem key={round} value={String(round)}>
                                Round {round}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Division Select */}
                  {selectedAssociationId && selectedRound && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-sm font-semibold text-foreground">
                        Division
                      </label>
                      <Select
                        value={selectedDivisionId}
                        onValueChange={(val) => {
                          setSelectedDivisionId(val);
                          setSelectedFixtureId("");
                        }}
                        disabled={divisionsLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={divisionsLoading ? "Loading divisions..." : "Select Division"} />
                        </SelectTrigger>
                        <SelectContent>
                          {divisions.length === 0 ? (
                            <SelectItem value="__none__" disabled>No divisions found</SelectItem>
                          ) : (
                            divisions.map((div) => (
                              <SelectItem key={div.id} value={div.id}>
                                {div.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Fixture Select */}
                  {selectedAssociationId && selectedRound && selectedDivisionId && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-sm font-semibold text-foreground">
                        Fixture
                      </label>
                      <Select
                        value={selectedFixtureId}
                        onValueChange={setSelectedFixtureId}
                        disabled={fixturesLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={fixturesLoading ? "Loading fixtures..." : "Select Fixture"} />
                        </SelectTrigger>
                        <SelectContent>
                          {fixtures.length === 0 ? (
                            <SelectItem value="__none__" disabled>No fixtures found</SelectItem>
                          ) : (
                            fixtures.map((fix) => (
                              <SelectItem key={fix.id} value={fix.id}>
                                {fix.homeTeamName} vs {fix.awayTeamName}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedFixture && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Selected fixture</p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Round {selectedFixture.round_number} - {selectedFixture.divisionName}
                      </p>
                    </div>
                  )}
                </div>

                {/* Buttons Navigation */}
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleNextStep1}
                    disabled={!isStep1Valid}
                    className="gap-1.5"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* STEP 2: Player Votes */}
          {step === 2 && selectedFixture && (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Player Votes</CardTitle>
                    <CardDescription>
                      Assign points to best performing players in the match
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="px-2.5 py-1 text-xs">
                    {selectedFixture.divisionName}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Info summary header */}
                <div className="bg-muted/30 border border-border/50 rounded-lg p-3 text-xs md:text-sm text-muted-foreground flex justify-between gap-4">
                  <span>
                    <strong>Match: </strong> {selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}
                  </span>
                  <span>
                    <strong>Round: </strong> {selectedFixture.round_number}
                  </span>
                </div>

                <div className="rounded-lg border border-border/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Voting scheme</p>
                      <p className="text-xs text-muted-foreground">
                        Frontend-only for now. It controls the vote cards shown below and still saves to the existing vote line table.
                      </p>
                    </div>
                    <Select
                      value={selectedSchemeKey}
                      onValueChange={(value) => handleSchemeChange(value as UmpireVoteSchemeKey)}
                    >
                      <SelectTrigger className="w-full md:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(UMPIRE_VOTE_SCHEMES).map((scheme) => (
                          <SelectItem key={scheme.key} value={scheme.key}>
                            {scheme.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {UMPIRE_VOTE_SCHEMES[selectedSchemeKey].description}
                  </p>
                </div>

                {linkedPlayersError && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{linkedPlayersError}</span>
                  </div>
                )}

                {/* Cards rendering */}
                <div className="space-y-4">
                  {voteCards.map((card, idx) => {
                    const is3PtGoldCard = card.points === 3;
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all relative ${
                          is3PtGoldCard
                            ? "border-amber-300 dark:border-amber-700/60 bg-amber-50/5 dark:bg-amber-950/5 shadow-sm"
                            : "border-border bg-card"
                        }`}
                      >
                        {/* Card Indicator Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-foreground">
                            {card.label}
                          </span>
                          <Badge
                            className={
                              is3PtGoldCard
                                ? "bg-amber-500 hover:bg-amber-600 text-white border-0"
                                : card.points === 2
                                ? "bg-slate-400 hover:bg-slate-500 text-white border-0"
                                : "bg-orange-400 hover:bg-orange-500 text-white border-0"
                            }
                          >
                            {card.points} {card.points === 1 ? "Point" : "Points"}
                          </Badge>
                        </div>

                        {/* Card Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          {/* Linked player search with an explicit unlisted fallback. */}
                          <div className="md:col-span-6 space-y-1.5 relative">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              Player Name
                            </label>
                            <UmpireLinkedPlayerPicker
                              value={card.playerName}
                              profileId={card.profileId}
                              options={linkedPlayers}
                              loading={linkedPlayersLoading}
                              onNameChange={(playerName) => {
                                setVoteCards((current) =>
                                  current.map((item, cardIndex) =>
                                    cardIndex === idx
                                      ? { ...item, profileId: null, playerName }
                                      : item,
                                  ),
                                );
                              }}
                              onSelect={(player) => {
                                setVoteCards((current) =>
                                  current.map((item, cardIndex) =>
                                    cardIndex === idx
                                      ? {
                                          ...item,
                                          profileId: player.profileId,
                                          playerName: player.name,
                                          playerNumber: player.number,
                                          teamId: player.teamId || "",
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </div>

                          {/* Jersey number */}
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              No.
                            </label>
                            <Input
                              placeholder="#"
                              value={card.playerNumber}
                              onChange={(e) => {
                                setVoteCards((current) =>
                                  current.map((item, cardIndex) =>
                                    cardIndex === idx
                                      ? { ...item, playerNumber: e.target.value }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </div>

                          {/* Team Select */}
                          <div className="md:col-span-4 space-y-1.5">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              Team
                            </label>
                            <Select
                              value={card.teamId || "__none__"}
                              onValueChange={(val) => {
                                setVoteCards((current) =>
                                  current.map((item, cardIndex) =>
                                    cardIndex === idx ? { ...item, teamId: val } : item,
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Team" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Select Team...</SelectItem>
                                <SelectItem value={selectedFixture.home_team_id}>
                                  {selectedFixture.homeTeamName}
                                </SelectItem>
                                <SelectItem value={selectedFixture.away_team_id}>
                                  {selectedFixture.awayTeamName}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Back and Next navigation buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <Button variant="outline" onClick={handleBack} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNextStep2}
                    disabled={!isStep2Valid}
                    className="gap-1.5"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* STEP 3: Confirm & Submit */}
          {step === 3 && selectedFixture && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Confirm & Submit</CardTitle>
                <CardDescription>
                  Review and verify your submitted votes before saving
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary Card Details */}
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-muted/10 shadow-sm">
                  {/* General Info header block */}
                  <div className="p-4 bg-muted/40 space-y-2">
                    {isProxy && (
                      <div className="border-l-4 border-primary pl-3 py-1 space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          Submitting on behalf of: <span className="text-primary">{proxyUmpireName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reason: {proxyReason}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-1 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground block uppercase font-semibold">Match</span>
                        <span className="font-semibold text-foreground">
                          {selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block uppercase font-semibold">Round</span>
                        <span className="font-semibold text-foreground">
                          Round {selectedFixture.round_number}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-border/40">
                        <span className="text-xs text-muted-foreground block uppercase font-semibold">Division</span>
                        <span className="font-semibold text-foreground">
                          {selectedFixture.divisionName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Vote Lines display */}
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Allocated Player Votes
                    </p>
                    {voteCards.map((card, idx) => {
                      const teamName =
                        card.teamId === selectedFixture.home_team_id
                          ? selectedFixture.homeTeamName
                          : card.teamId === selectedFixture.away_team_id
                          ? selectedFixture.awayTeamName
                          : "No Team Selected";
                      
                      const hasName = card.playerName.trim() !== "";
                      const hasNum = card.playerNumber.trim() !== "";

                      return (
                        <div key={idx} className="flex items-center gap-3 py-1.5">
                          <Badge
                            className={`w-20 text-center justify-center shrink-0 ${
                              card.points === 3
                                ? "bg-amber-500 hover:bg-amber-600 text-white border-0"
                                : card.points === 2
                                ? "bg-slate-400 hover:bg-slate-500 text-white border-0"
                                : "bg-orange-400 hover:bg-orange-500 text-white border-0"
                            }`}
                          >
                            {card.points} {card.points === 1 ? "Pt" : "Pts"}
                          </Badge>
                          <div className="flex-1 text-sm font-medium truncate text-foreground">
                            {hasName ? card.playerName : <span className="italic text-muted-foreground">No name entered</span>}
                            {hasNum && <span className="text-muted-foreground ml-2">#{card.playerNumber}</span>}
                            <span className="text-muted-foreground mx-2">·</span>
                            <span className="text-muted-foreground font-normal text-xs bg-muted px-2 py-0.5 rounded-full border border-border/50">
                              {teamName}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submitting Error alert */}
                {submitError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 flex items-center gap-2.5">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Submission progress actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <Button variant="outline" onClick={handleBack} disabled={submitting} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="gap-2 px-6"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Submit Votes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
