import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileWidget } from "@/components/umpire/TurnstileWidget";
import { UmpireLinkedPlayerPicker } from "@/components/umpire/UmpireLinkedPlayerPicker";
import type { UmpireLinkedPlayerOption } from "@/lib/umpireLinkedPlayers";
import {
  loadPublicUmpireFixtures,
  loadPublicUmpirePlayers,
  submitPublicUmpireVotes,
  type PublicUmpireFixture,
} from "@/lib/publicUmpirePortal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildLoginPath } from "@/lib/authRedirect";

interface VoteCard {
  lineKey: string;
  label: string;
  points: number;
  optionId: string | null;
  profileId: string | null;
  playerName: string;
  playerNumber: string;
  teamId: string;
}

const createVoteCards = (fixture: PublicUmpireFixture): VoteCard[] =>
  fixture.schemeLines.map((line) => ({
    lineKey: line.key,
    label: line.label,
    points: line.points,
    optionId: null,
    profileId: null,
    playerName: "",
    playerNumber: "",
    teamId: "",
  }));

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The umpire portal could not complete this request.";

const wizardSteps = [
  { number: 1, label: "Match Info" },
  { number: 2, label: "Vote" },
  { number: 3, label: "Confirm" },
] as const;

const fixtureDateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Australia/Melbourne",
});

const formatRoundDateRange = (timestamps: number[]) => {
  if (timestamps.length === 0) return "";

  const firstDate = fixtureDateFormatter.format(new Date(Math.min(...timestamps)));
  const lastDate = fixtureDateFormatter.format(new Date(Math.max(...timestamps)));
  return firstDate === lastDate ? firstDate : `${firstDate} – ${lastDate}`;
};

export default function PublicUmpireVote() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const useAccountIdentity = searchParams.get("account") === "1";
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fixtures, setFixtures] = useState<PublicUmpireFixture[]>([]);
  const [associationName, setAssociationName] = useState("Hockey Ballarat");
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [players, setPlayers] = useState<UmpireLinkedPlayerOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [loadingAccountIdentity, setLoadingAccountIdentity] = useState(useAccountIdentity);
  const [accountIdentityError, setAccountIdentityError] = useState<string | null>(null);
  const [submissionMode, setSubmissionMode] = useState<"self" | "proxy">("self");
  const [proxyUmpireName, setProxyUmpireName] = useState("");
  const [proxyReason, setProxyReason] = useState("");
  const [website, setWebsite] = useState("");

  const [selectedRound, setSelectedRound] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [voteCards, setVoteCards] = useState<VoteCard[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  const refreshFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    setLoadError(null);
    try {
      const result = await loadPublicUmpireFixtures();
      setAssociationName(result.association.name);
      setFixtures(result.fixtures);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoadingFixtures(false);
    }
  }, []);

  useEffect(() => {
    void refreshFixtures();
  }, [refreshFixtures]);

  useEffect(() => {
    if (!useAccountIdentity || authLoading) return;

    if (!user) {
      navigate(buildLoginPath("/umpire/public-vote?account=1"), { replace: true });
      return;
    }

    let cancelled = false;

    const loadAccountIdentity = async () => {
      setLoadingAccountIdentity(true);
      setAccountIdentityError(null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const profileName = [profile?.first_name, profile?.last_name]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(" ")
        .trim();
      const metadata = user.user_metadata as Record<string, unknown>;
      const metadataName = [metadata.full_name, metadata.name]
        .find((value): value is string => typeof value === "string" && Boolean(value.trim()))
        ?.trim() || "";
      const accountName = profileName || metadataName;
      const accountEmail = user.email?.trim() || "";

      setSubmitterName(accountName);
      setSubmitterEmail(accountEmail);

      if (!accountName || !accountEmail) {
        setAccountIdentityError(
          "We could not load a complete name and email from your SportStack account. Please try signing in again.",
        );
      }

      setLoadingAccountIdentity(false);
    };

    void loadAccountIdentity();

    return () => {
      cancelled = true;
    };
  }, [authLoading, navigate, useAccountIdentity, user]);

  const rounds = useMemo(() => {
    const fixtureDatesByRound = new Map<number, number[]>();

    fixtures.forEach((fixture) => {
      const timestamps = fixtureDatesByRound.get(fixture.roundNumber) || [];
      const timestamp = fixture.fixtureDate ? Date.parse(fixture.fixtureDate) : Number.NaN;
      if (Number.isFinite(timestamp)) timestamps.push(timestamp);
      fixtureDatesByRound.set(fixture.roundNumber, timestamps);
    });

    return Array.from(fixtureDatesByRound, ([number, timestamps]) => ({
      number,
      dateRange: formatRoundDateRange(timestamps),
    })).sort((left, right) => left.number - right.number);
  }, [fixtures]);

  const divisions = useMemo(() => {
    const byId = new Map<string, string>();
    fixtures
      .filter((fixture) => String(fixture.roundNumber) === selectedRound)
      .forEach((fixture) => byId.set(fixture.divisionId, fixture.divisionName));
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [fixtures, selectedRound]);

  const availableFixtures = useMemo(
    () =>
      fixtures.filter(
        (fixture) =>
          String(fixture.roundNumber) === selectedRound &&
          fixture.divisionId === selectedDivisionId,
      ),
    [fixtures, selectedDivisionId, selectedRound],
  );

  const selectedFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedFixtureId) || null,
    [fixtures, selectedFixtureId],
  );

  const matchStepIsValid = Boolean(
    submitterName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail.trim()) &&
      (!useAccountIdentity || (!loadingAccountIdentity && !accountIdentityError)) &&
      selectedFixture &&
      (submissionMode === "self" || (proxyUmpireName.trim() && proxyReason.trim())),
  );

  const votesStepIsValid =
    voteCards.length > 0 &&
    voteCards.every(
      (card) =>
        (card.playerName.trim() || card.playerNumber.trim()) &&
        card.teamId,
    );

  const handleNextFromMatch = async () => {
    if (!matchStepIsValid || !selectedFixture) return;
    setLoadingPlayers(true);
    setLoadError(null);
    try {
      const result = await loadPublicUmpirePlayers(selectedFixture.id);
      setPlayers(result.candidates);
      setVoteCards(createVoteCards(selectedFixture));
      setStep(2);
    } catch (error) {
      const message = getErrorMessage(error);
      setLoadError(message);
      toast({ title: "Player names could not be loaded", description: message, variant: "destructive" });
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleNextFromVotes = () => {
    const invalidNumber = voteCards.find(
      (card) => card.playerNumber.trim() && !/^\d{1,3}$/.test(card.playerNumber.trim()),
    );
    if (invalidNumber) {
      toast({
        title: "Check the player number",
        description: `${invalidNumber.label} must use numbers only.`,
        variant: "destructive",
      });
      return;
    }

    const identities = new Set<string>();
    for (const card of voteCards) {
      const key = `${card.playerName.trim().toLowerCase() || `#${card.playerNumber.trim()}`}:${card.playerNumber.trim()}:${card.teamId}`;
      if (identities.has(key)) {
        toast({
          title: "Duplicate player",
          description: "The same player cannot receive more than one vote.",
          variant: "destructive",
        });
        return;
      }
      identities.add(key);
    }
    setStep(3);
  };

  const updateVoteCard = (index: number, changes: Partial<VoteCard>) => {
    setVoteCards((current) =>
      current.map((card, cardIndex) => (cardIndex === index ? { ...card, ...changes } : card)),
    );
  };

  const handleSubmit = async () => {
    if (!selectedFixture || !votesStepIsValid || !turnstileToken) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitPublicUmpireVotes({
        submitterName: submitterName.trim(),
        submitterEmail: submitterEmail.trim(),
        submissionMode,
        proxyUmpireName: proxyUmpireName.trim(),
        proxyReason: proxyReason.trim(),
        fixtureId: selectedFixture.id,
        turnstileToken,
        idempotencyKey,
        website,
        votes: voteCards.map((card) => ({
          lineKey: card.lineKey,
          profileId: card.profileId,
          playerName: card.playerName.trim(),
          playerNumber: card.playerNumber.trim(),
          teamId: card.teamId,
        })),
      });
      setReference(result.reference);
      toast({ title: "Votes submitted", description: "The submission is pending administrator review." });
    } catch (error) {
      const message = getErrorMessage(error);
      setSubmitError(message);
      setTurnstileToken("");
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForAnotherVote = () => {
    setStep(1);
    setReference(null);
    setSubmissionMode("self");
    setProxyUmpireName("");
    setProxyReason("");
    setSelectedRound("");
    setSelectedDivisionId("");
    setSelectedFixtureId("");
    setVoteCards([]);
    setPlayers([]);
    setSubmitError(null);
    setTurnstileToken("");
    setTurnstileResetKey((value) => value + 1);
    setIdempotencyKey(crypto.randomUUID());
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div>
            <p className="font-display text-xl font-semibold">Umpire Portal</p>
            <p className="text-xs text-primary-foreground/75">{associationName}</p>
          </div>
          <Link to="/umpire" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Portal home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
        {!reference && (
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
            {wizardSteps.map(({ number, label }) => (
              <div key={number} className="flex flex-col items-center gap-2 text-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    step >= number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > number ? <Check className="h-4 w-4" /> : number}
                </div>
                <span className={`text-xs font-medium ${step >= number ? "text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {loadError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loadError}</span>
            </div>
            {step === 1 && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void refreshFixtures()}>
                Try again
              </Button>
            )}
          </div>
        )}

        {reference ? (
          <Card>
            <CardContent className="space-y-6 p-8 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
              <div>
                <h1 className="text-2xl font-bold">Votes submitted</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your submission is pending administrator review.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Reference</p>
                <p className="mt-1 font-mono text-lg font-bold">{reference}</p>
              </div>
              <Button className="w-full" onClick={resetForAnotherVote}>
                Submit another vote
              </Button>
            </CardContent>
          </Card>
        ) : step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>Match Information</CardTitle>
              <CardDescription>Tell us who is submitting, then choose the completed fixture.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {useAccountIdentity && (
                <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Using your SportStack account</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your name and email are filled from your account and cannot be changed here.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={submissionMode === "self" ? "default" : "outline"}
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => setSubmissionMode("self")}
                >
                  <UserRound className="h-5 w-5" />
                  Submitting myself
                </Button>
                <Button
                  type="button"
                  variant={submissionMode === "proxy" ? "default" : "outline"}
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => setSubmissionMode("proxy")}
                >
                  <Users className="h-5 w-5" />
                  On behalf of someone
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="submitter-name">Your full name</Label>
                  <Input
                    id="submitter-name"
                    value={submitterName}
                    onChange={(event) => setSubmitterName(event.target.value)}
                    readOnly={useAccountIdentity}
                    maxLength={100}
                    autoComplete="name"
                    className={useAccountIdentity ? "bg-muted" : undefined}
                    placeholder={loadingAccountIdentity ? "Loading account name..." : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submitter-email">Your email</Label>
                  <Input
                    id="submitter-email"
                    type="email"
                    value={submitterEmail}
                    onChange={(event) => setSubmitterEmail(event.target.value)}
                    readOnly={useAccountIdentity}
                    maxLength={254}
                    autoComplete="email"
                    className={useAccountIdentity ? "bg-muted" : undefined}
                    placeholder={loadingAccountIdentity ? "Loading account email..." : undefined}
                  />
                </div>
              </div>

              {useAccountIdentity && accountIdentityError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {accountIdentityError}
                </div>
              )}

              {submissionMode === "proxy" && (
                <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="proxy-umpire-name">Umpire's full name</Label>
                    <Input
                      id="proxy-umpire-name"
                      value={proxyUmpireName}
                      onChange={(event) => setProxyUmpireName(event.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proxy-reason">Reason for submitting on their behalf</Label>
                    <Textarea
                      id="proxy-reason"
                      value={proxyReason}
                      onChange={(event) => setProxyReason(event.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="For example: the umpire asked me to submit while they are travelling"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4 border-t pt-5">
                <div className="space-y-2">
                  <Label>Round</Label>
                  <Select
                    value={selectedRound}
                    onValueChange={(value) => {
                      setSelectedRound(value);
                      setSelectedDivisionId("");
                      setSelectedFixtureId("");
                    }}
                    disabled={loadingFixtures}
                  >
                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                      <SelectValue placeholder={loadingFixtures ? "Loading rounds..." : "Select round"} />
                    </SelectTrigger>
                    <SelectContent>
                      {rounds.map((round) => (
                        <SelectItem key={round.number} value={String(round.number)}>
                          Round {round.number}{round.dateRange ? ` · ${round.dateRange}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Division</Label>
                  <Select
                    value={selectedDivisionId}
                    onValueChange={(value) => {
                      setSelectedDivisionId(value);
                      setSelectedFixtureId("");
                    }}
                    disabled={!selectedRound}
                  >
                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>{division.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fixture</Label>
                  <Select
                    value={selectedFixtureId}
                    onValueChange={setSelectedFixtureId}
                    disabled={!selectedDivisionId}
                  >
                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                      <SelectValue placeholder="Select fixture" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFixtures.map((fixture) => (
                        <SelectItem key={fixture.id} value={fixture.id}>
                          {fixture.homeTeamName} vs {fixture.awayTeamName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                disabled={!matchStepIsValid || loadingPlayers}
                onClick={() => void handleNextFromMatch()}
              >
                {loadingPlayers ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Next: Player Votes
                {!loadingPlayers && <ChevronRight className="h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>
        ) : step === 2 && selectedFixture ? (
          <Card>
            <CardHeader>
              <CardTitle>Player Votes</CardTitle>
              <CardDescription>
                {selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName} · {selectedFixture.divisionName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Start typing a player's name. You can also enter a new name.
              </div>

              {voteCards.map((card, index) => {
                const numberOnly = !card.playerName.trim() && Boolean(card.playerNumber.trim());
                return (
                  <div key={card.lineKey} className="space-y-4 rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{card.label}</p>
                      <Badge>{card.points} {card.points === 1 ? "point" : "points"}</Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
                      <div className="min-w-0 space-y-1.5">
                        <Label>Player name</Label>
                        <UmpireLinkedPlayerPicker
                          value={card.playerName}
                          profileId={card.profileId}
                          selectedOptionId={card.optionId}
                          options={players}
                          simplifiedSuggestions
                          onNameChange={(playerName) =>
                            updateVoteCard(index, { optionId: null, profileId: null, playerName })
                          }
                          onSelect={(player) =>
                            updateVoteCard(index, {
                              optionId: player.optionId,
                              profileId: player.profileId,
                              playerName: player.name,
                              playerNumber: player.number || card.playerNumber,
                              teamId: player.teamId || card.teamId,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`player-number-${card.lineKey}`}>Number</Label>
                        <Input
                          id={`player-number-${card.lineKey}`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={3}
                          placeholder="#"
                          value={card.playerNumber}
                          onChange={(event) => updateVoteCard(index, { playerNumber: event.target.value })}
                        />
                      </div>
                    </div>

                    {numberOnly && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          Be aware: a player number alone may not be enough for an administrator to identify the correct player and allocate these votes.
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label>Team</Label>
                      <Select value={card.teamId} onValueChange={(teamId) => updateVoteCard(index, { teamId })}>
                        <SelectTrigger className="w-full min-w-0 overflow-hidden">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={selectedFixture.homeTeamId}>{selectedFixture.homeTeamName}</SelectItem>
                          <SelectItem value={selectedFixture.awayTeamId}>{selectedFixture.awayTeamName}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-3 border-t pt-4">
                <Button variant="outline" className="flex-1 gap-1" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button className="flex-1 gap-1" disabled={!votesStepIsValid} onClick={handleNextFromVotes}>
                  Next: Review <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : step === 3 && selectedFixture ? (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Your Votes</CardTitle>
              <CardDescription>{selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Submitting for</p>
                  <p className="font-medium">{submissionMode === "proxy" ? proxyUmpireName : submitterName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Submitted by</p>
                  <p className="font-medium">{submitterName}</p>
                  <p className="text-xs text-muted-foreground">{submitterEmail}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Round / Division</p>
                  <p className="font-medium">Round {selectedFixture.roundNumber} · {selectedFixture.divisionName}</p>
                </div>
                {submissionMode === "proxy" && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Reason</p>
                    <p>{proxyReason}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {voteCards.map((card) => {
                  const teamName = card.teamId === selectedFixture.homeTeamId
                    ? selectedFixture.homeTeamName
                    : selectedFixture.awayTeamName;
                  return (
                    <div key={card.lineKey} className="flex items-center gap-3 rounded-lg border p-3">
                      <Badge className="w-10 justify-center">{card.points}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {card.playerName || "No name entered"}
                          {card.playerNumber && <span className="ml-2 text-muted-foreground">#{card.playerNumber}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{card.label} · {teamName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute -left-[10000px]" aria-hidden="true">
                <Label htmlFor="umpire-website">Website</Label>
                <Input
                  id="umpire-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Security check
                </div>
                <TurnstileWidget onTokenChange={handleTurnstileToken} resetKey={turnstileResetKey} />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex gap-3 border-t pt-4">
                <Button variant="outline" className="flex-1" disabled={submitting} onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button className="flex-1" disabled={submitting || !turnstileToken} onClick={() => void handleSubmit()}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Submitting..." : "Submit Votes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
