import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarClock, Check, Eye, ImageOff, Palette, Send, Trophy, Upload, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MvpTallyPresentation } from "@/features/player-mvp-tally/MvpTallyPresentation";
import {
  getMvpTallyBuilderData,
  getMvpTallyDraftDetails,
  generateMvpTallyCommentary,
  listMvpTallyPresentations,
  previewMvpTally,
  publishMvpTally,
  removeMvpTallyLogo,
  saveMvpTallyCommentary,
  saveMvpTallyDraft,
  uploadMvpTallyLogo,
  withdrawMvpTally,
} from "@/features/player-mvp-tally/api";
import { buildRuleCommentary, mergeInheritedTheme, TALLY_SPEEDS } from "@/features/player-mvp-tally/logic";
import type {
  MvpTallyAudienceGroup,
  MvpTallyAudienceMember,
  MvpTallyBuilderData,
  MvpTallyPresentationRecord,
  MvpTallySpeed,
  MvpTallyTheme,
} from "@/features/player-mvp-tally/types";

const STEPS = ["Rounds", "Audience", "Appearance", "Preview", "Publish"] as const;
const GROUP_LABELS: Record<MvpTallyAudienceGroup, string> = {
  PRIMARY: "Primary players",
  SECONDARY: "Secondary players",
  FILL_IN: "Fill-ins",
};

const TallyCardHeading = ({ children }: { children: ReactNode }) => (
  <h2 className="font-display text-2xl font-semibold leading-none tracking-wide">{children}</h2>
);

const friendlyError = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error);
  if (message.includes("MVP_TALLY_PREVIEW_STALE")) return "Rounds, votes or the audience changed. Preview the tally again.";
  if (message.includes("MVP_TALLY_ROUND_NOT_CLOSED")) return "A selected round is not closed yet.";
  if (message.includes("MVP_TALLY_ROUND_RESULT_CONCERN")) return "Resolve the result concern before adding that round.";
  if (message.includes("MVP_TALLY_ROUND_NO_BALLOTS")) return "A selected round has no submitted ballots.";
  if (message.includes("MVP_TALLY_ROUND_WRONG_TEAM")) return "A selected round belongs to another team.";
  if (message.includes("MVP_TALLY_INVALID_PLAYER_LIMIT")) return "Players shown must be All or a whole number from 3 to 50.";
  if (message.includes("MVP_TALLY_INVALID_LOGO")) return "That logo is no longer available. Upload it again or use the inherited logo.";
  if (message.includes("MVP_TALLY_INVALID_SPEED")) return "Choose one of the available playback speeds.";
  if (message.includes("MVP_TALLY_AUDIENCE_CHANGED")) return "One or more selected players are no longer eligible for this team and these rounds.";
  if (message.includes("permission")) return "Your current SportStack role cannot manage this team.";
  return message && message !== "[object Object]" ? message : "The tally presentation could not be saved. Please try again.";
};

export default function MvpTallyAdmin() {
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team");
  const { toast } = useToast();
  const [builderData, setBuilderData] = useState<MvpTallyBuilderData | null>(null);
  const [presentations, setPresentations] = useState<MvpTallyPresentationRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [replacesId, setReplacesId] = useState<string | null>(null);
  const [title, setTitle] = useState("Player MVP Season Tally");
  const [subtitle, setSubtitle] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [audience, setAudience] = useState<MvpTallyAudienceMember[]>([]);
  const [theme, setTheme] = useState<MvpTallyTheme | null>(null);
  const [speed, setSpeed] = useState<MvpTallySpeed>(1);
  const [preview, setPreview] = useState<{
    cards: NonNullable<MvpTallyPresentationRecord["card_snapshot"]>;
    results: NonNullable<MvpTallyPresentationRecord["result_snapshot"]>;
    commentary: MvpTallyPresentationRecord["commentary_snapshot"];
  } | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [withdrawTarget, setWithdrawTarget] = useState<MvpTallyPresentationRecord | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [data, saved] = await Promise.all([
        getMvpTallyBuilderData(teamId),
        listMvpTallyPresentations(teamId),
      ]);
      setBuilderData(data);
      setPresentations(saved);
      setAudience(data.audience);
      setTheme(mergeInheritedTheme({
        logoUrl: data.branding.logoUrl,
        logoStoragePath: null,
        bannerUrl: data.branding.bannerUrl,
        primaryColour: data.branding.primaryColour,
        secondaryColour: data.branding.secondaryColour,
        accentColour: data.branding.accentColour,
      }));
    } catch (error) {
      toast({ title: "Tally presentations unavailable", description: friendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [teamId, toast]);

  useEffect(() => { void load(); }, [load]);

  const selectedRoundOptions = useMemo(
    () => builderData?.sessions.filter((session) => selectedSessions.includes(session.id)) || [],
    [builderData?.sessions, selectedSessions],
  );
  const selectedAudienceCount = audience.filter((person) => person.selected).length;
  const unlinkedCount = selectedRoundOptions.reduce((total, session) => total + session.unlinkedCount, 0);

  const resetPreview = () => setPreview(null);
  const toggleSession = (id: string) => {
    setSelectedSessions((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      return (builderData?.sessions || []).filter((session) => next.includes(session.id)).map((session) => session.id);
    });
    resetPreview();
  };

  const uploadLogo = async (file: File) => {
    if (!teamId || !theme) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast({ title: "Logo not uploaded", description: "Choose a PNG, JPG or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo not uploaded", description: "Choose an image smaller than 2 MB.", variant: "destructive" });
      return;
    }
    setLogoBusy(true);
    try {
      const previousPath = theme.logoStoragePath;
      const uploaded = await uploadMvpTallyLogo(teamId, file);
      setTheme({ ...theme, logoUrl: uploaded.publicUrl, logoStoragePath: uploaded.path });
      resetPreview();
      if (previousPath) await removeMvpTallyLogo(previousPath);
    } catch (error) {
      toast({ title: "Logo not uploaded", description: friendlyError(error), variant: "destructive" });
    } finally {
      setLogoBusy(false);
    }
  };

  const clearOwnedLogo = async (useInherited: boolean) => {
    if (!theme || !builderData) return;
    const previousPath = theme.logoStoragePath;
    setTheme({
      ...theme,
      logoUrl: useInherited ? builderData.branding.logoUrl : null,
      logoStoragePath: null,
    });
    resetPreview();
    if (!previousPath) return;
    setLogoBusy(true);
    try {
      await removeMvpTallyLogo(previousPath);
    } catch (error) {
      toast({ title: "Old logo not removed", description: friendlyError(error), variant: "destructive" });
    } finally {
      setLogoBusy(false);
    }
  };

  const refreshAudience = async () => {
    if (!teamId || selectedSessions.length === 0) return false;
    try {
      const fresh = await getMvpTallyBuilderData(teamId, selectedSessions);
      setBuilderData((current) => current ? { ...current, audience: fresh.audience } : fresh);
      setAudience(fresh.audience);
      return true;
    } catch (error) {
      toast({ title: "Audience not loaded", description: friendlyError(error), variant: "destructive" });
      return false;
    }
  };

  const saveDraft = async () => {
    if (!teamId || !theme) return null;
    if (!title.trim() || selectedSessions.length === 0 || selectedAudienceCount === 0) {
      toast({ title: "More information needed", description: "Choose at least one round and one recipient, and add a title." });
      return null;
    }
    setBusy(true);
    try {
      const id = await saveMvpTallyDraft({
        id: draftId,
        teamId,
        title,
        subtitle,
        theme,
        speed,
        sessionIds: selectedSessions,
        audience,
        replacesPresentationId: replacesId,
      });
      setDraftId(id);
      return id;
    } catch (error) {
      toast({ title: "Draft not saved", description: friendlyError(error), variant: "destructive" });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const buildPreview = async () => {
    const id = await saveDraft();
    if (!id) return;
    setBusy(true);
    try {
      const result = await previewMvpTally(id);
      if (!result.cards || !result.results) throw new Error("Preview snapshot missing");
      const rules = buildRuleCommentary(result.cards);
      await saveMvpTallyCommentary(id, result.sourceFingerprint, rules);
      let commentary = rules;
      try {
        commentary = await generateMvpTallyCommentary(id, result.sourceFingerprint);
      } catch (commentaryError) {
        console.warn("AI tally commentary unavailable; using local commentary", commentaryError);
      }
      setPreview({ cards: result.cards, results: result.results, commentary });
      setStep(3);
    } catch (error) {
      toast({ title: "Preview not ready", description: friendlyError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const publish = async (schedule: boolean) => {
    if (!draftId || !preview) return;
    if (schedule && !scheduledFor) {
      toast({ title: "Choose a publication time", description: "Select when players should receive the tally." });
      return;
    }
    setBusy(true);
    try {
      const status = await publishMvpTally(draftId, schedule ? new Date(scheduledFor).toISOString() : null);
      toast({
        title: status === "PUBLISHED" ? "Tally published" : "Tally scheduled",
        description: status === "PUBLISHED" ? "Selected players have received an in-app notification." : "The tally will publish at the selected time.",
      });
      setDraftId(null);
      setPreview(null);
      setStep(0);
      setSelectedSessions([]);
      setReplacesId(null);
      await load();
    } catch (error) {
      setPreview(null);
      setStep(3);
      toast({ title: "Tally not published", description: friendlyError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!withdrawTarget) return;
    setBusy(true);
    try {
      await withdrawMvpTally(withdrawTarget.id, withdrawReason);
      setWithdrawTarget(null);
      setWithdrawReason("");
      await load();
      toast({ title: "Tally withdrawn", description: "Players can no longer open this presentation." });
    } catch (error) {
      toast({ title: "Tally not withdrawn", description: friendlyError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const continueDraft = async (item: MvpTallyPresentationRecord) => {
    setBusy(true);
    try {
      const details = await getMvpTallyDraftDetails(item.id);
      const fresh = await getMvpTallyBuilderData(item.team_id, details.sessionIds);
      const selectedProfiles = new Map(details.recipients.map((recipient) => [recipient.profile_id, recipient.audience_group]));
      setBuilderData((current) => current ? { ...current, audience: fresh.audience } : fresh);
      setDraftId(item.id);
      setReplacesId(item.replaces_presentation_id);
      setTitle(item.title);
      setSubtitle(item.subtitle || "");
      setSelectedSessions(details.sessionIds);
      setAudience(fresh.audience.map((person) => ({
        ...person,
        group: selectedProfiles.get(person.profileId) || person.group,
        selected: selectedProfiles.has(person.profileId),
      })));
      setTheme(mergeInheritedTheme(item.theme));
      setSpeed(item.playback_speed);
      setPreview(item.card_snapshot && item.result_snapshot ? {
        cards: item.card_snapshot,
        results: item.result_snapshot,
        commentary: item.commentary_snapshot,
      } : null);
      setStep(item.card_snapshot && item.result_snapshot ? 3 : 0);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (error) {
      toast({ title: "Draft not loaded", description: friendlyError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!teamId) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader><h1 className="font-display text-2xl font-semibold leading-none tracking-wide">Select a team first</h1><CardDescription>Use the normal Association → Club → Division → Team filters before opening the tally builder.</CardDescription></CardHeader>
          <CardContent><Button asChild><Link to="/admin/mvp-voting"><ArrowLeft className="mr-2 h-4 w-4" />Back to Player MVP administration</Link></Button></CardContent>
        </Card>
      </div>
    );
  }
  if (loading || !builderData || !theme) return <div className="container mx-auto p-6 text-sm text-muted-foreground">Loading tally presentations…</div>;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3"><Link to={`/admin/mvp-voting`}><ArrowLeft className="mr-2 h-4 w-4" />Player MVP administration</Link></Button>
          <h1 className="flex items-center gap-2 text-3xl font-black"><Trophy className="text-yellow-500" />Tally presentations</h1>
          <p className="mt-1 text-muted-foreground">{builderData.branding.teamName} · saved private Player MVP result shows</p>
        </div>
      </div>

      {presentations.length > 0 && (
        <Card>
          <CardHeader><TallyCardHeading>Saved presentations</TallyCardHeading><CardDescription>Published results cannot be edited. Withdraw them and create a replacement if a correction is needed.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {presentations.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">Created {new Date(item.created_at).toLocaleDateString("en-AU")}</p></div><Badge variant="outline">{item.status}</Badge></div>
                {item.validation_error && <p className="mt-2 text-sm text-amber-700">{item.validation_error}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === "DRAFT" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void continueDraft(item)}>Continue draft</Button>}
                  {item.status === "PUBLISHED" && <Button asChild size="sm" variant="outline"><Link to={`/mvp-votes/tallies/${item.id}`}><Eye className="mr-2 h-4 w-4" />View</Link></Button>}
                  {item.status === "PUBLISHED" && <Button size="sm" variant="outline" onClick={() => setWithdrawTarget(item)}>Withdraw</Button>}
                  {item.status === "WITHDRAWN" && <Button size="sm" variant="outline" onClick={() => { setReplacesId(item.id); setTitle(`${item.title} — corrected`); setStep(0); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Create replacement</Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <TallyCardHeading>{draftId ? "Continue draft" : replacesId ? "Replacement presentation" : "New presentation"}</TallyCardHeading>
          <CardDescription>Choose closed rounds, the audience and the broadcast look, then watch the full preview before publishing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-8 grid grid-cols-5 gap-1">
            {STEPS.map((label, index) => (
              <div key={label} className="text-center">
                <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index <= step ? "bg-blue-700 text-white" : "bg-muted text-muted-foreground"}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</div>
                <p className="mt-1 hidden text-xs font-medium sm:block">{label}</p>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="tally-title">Presentation title</Label><Input id="tally-title" value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); resetPreview(); }} /></div><div className="space-y-2"><Label htmlFor="tally-subtitle">Subtitle (optional)</Label><Input id="tally-subtitle" value={subtitle} maxLength={240} onChange={(event) => { setSubtitle(event.target.value); resetPreview(); }} /></div></div>
              <div className="space-y-2">
                <Label>Player MVP rounds</Label>
                <p className="text-sm text-muted-foreground">Every round is shown. Closed rounds with at least one ballot and no result concern can be selected.</p>
                {builderData.sessions.length === 0 ? (
                  <Alert><AlertTitle>No rounds found</AlertTitle><AlertDescription>This team does not have any Player MVP rounds yet.</AlertDescription></Alert>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {builderData.sessions.map((session) => (
                      <label
                        key={session.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${session.selectable ? "cursor-pointer" : "cursor-not-allowed bg-muted/30 opacity-75"}`}
                      >
                        <Checkbox
                          checked={selectedSessions.includes(session.id)}
                          disabled={!session.selectable}
                          onCheckedChange={() => toggleSession(session.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{session.round} · {session.homeTeam} v {session.awayTeam}</span>
                            <Badge variant={session.status === "CLOSED" ? "secondary" : "outline"}>{session.status.replace("_", " ")}</Badge>
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {session.gameDate ? new Date(`${session.gameDate}T00:00:00`).toLocaleDateString("en-AU") : "Date unavailable"}
                            {` · ${session.ballotsReceived} of ${session.eligibleVoterCount} voted`}
                          </span>
                          {!session.selectable && session.unselectableReason && (
                            <span className="mt-1 block text-xs text-amber-700">{session.unselectableReason}</span>
                          )}
                          {session.unlinkedCount > 0 && (
                            <span className="mt-1 block text-xs text-amber-700">
                              {session.unlinkedCount} unlinked named {session.unlinkedCount === 1 ? "entry" : "entries"}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Alert><Users className="h-4 w-4" /><AlertTitle>{selectedAudienceCount} selected recipients</AlertTitle><AlertDescription>Primary, Secondary and participating fill-in players start selected. People without a SportStack profile cannot be included.</AlertDescription></Alert>
              {(["PRIMARY", "SECONDARY", "FILL_IN"] as MvpTallyAudienceGroup[]).map((group) => {
                const people = audience.filter((person) => person.group === group);
                if (people.length === 0) return null;
                const allSelected = people.every((person) => person.selected);
                return <div key={group} className="rounded-lg border"><div className="flex items-center justify-between border-b bg-muted/30 p-3"><div><p className="font-semibold">{GROUP_LABELS[group]}</p><p className="text-xs text-muted-foreground">{people.filter((person) => person.selected).length} of {people.length} selected</p></div><Button size="sm" variant="outline" onClick={() => { setAudience((current) => current.map((person) => person.group === group ? { ...person, selected: !allSelected } : person)); resetPreview(); }}>{allSelected ? "Untick group" : "Select group"}</Button></div><div className="divide-y">{people.map((person) => <label key={person.profileId} className="flex cursor-pointer items-center gap-3 p-3"><Checkbox checked={person.selected} onCheckedChange={() => { setAudience((current) => current.map((item) => item.profileId === person.profileId ? { ...item, selected: !item.selected } : item)); resetPreview(); }} /><span className="font-medium">{person.name}</span></label>)}</div></div>;
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Presentation logo</Label>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    {theme.logoUrl ? (
                      <img className="h-20 w-20 rounded-lg bg-white object-contain p-1" src={theme.logoUrl} alt="Current tally logo" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted"><ImageOff className="h-7 w-7 text-muted-foreground" /></div>
                    )}
                    <div className="flex flex-1 flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" disabled={logoBusy}>
                        <label htmlFor="tally-logo-upload" className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{logoBusy ? "Uploading…" : "Upload logo"}</label>
                      </Button>
                      <input
                        id="tally-logo-upload"
                        type="file"
                        className="sr-only"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={logoBusy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadLogo(file);
                          event.target.value = "";
                        }}
                      />
                      <Button size="sm" variant="outline" disabled={logoBusy} onClick={() => void clearOwnedLogo(true)}>Use inherited</Button>
                      <Button size="sm" variant="ghost" disabled={logoBusy || !theme.logoUrl} onClick={() => void clearOwnedLogo(false)}>Remove</Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB. The team, Club or Association logo remains available as the inherited option.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tally-background-style">Background style</Label>
                  <Select value={theme.backgroundStyle} onValueChange={(value) => { setTheme({ ...theme, backgroundStyle: value as MvpTallyTheme["backgroundStyle"] }); resetPreview(); }}>
                    <SelectTrigger id="tally-background-style" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPOTLIGHT">Sports spotlight</SelectItem>
                      <SelectItem value="GRADIENT">Colour gradient</SelectItem>
                      <SelectItem value="SOLID">Solid colour</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {theme.backgroundStyle === "SPOTLIGHT" && "A dark broadcast background with a bright team-colour spotlight."}
                    {theme.backgroundStyle === "GRADIENT" && "A smooth blend from the secondary colour into the primary colour."}
                    {theme.backgroundStyle === "SOLID" && "A clean single-colour background using the secondary colour."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tally-default-speed">Default speed</Label>
                    <Select value={String(speed)} onValueChange={(value) => { setSpeed(Number(value) as MvpTallySpeed); resetPreview(); }}>
                      <SelectTrigger id="tally-default-speed" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{TALLY_SPEEDS.map((option) => <SelectItem key={option} value={String(option)}>{option}×</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="players-shown">Players shown</Label>
                    <div className="flex gap-2">
                      <Select
                        value={theme.leaderboardLimit == null ? "ALL" : "LIMIT"}
                        onValueChange={(value) => {
                          setTheme({ ...theme, leaderboardLimit: value === "ALL" ? null : theme.leaderboardLimit || 10 });
                          resetPreview();
                        }}
                      >
                        <SelectTrigger className="w-28" aria-label="Players shown mode"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="LIMIT">Top</SelectItem><SelectItem value="ALL">All</SelectItem></SelectContent>
                      </Select>
                      {theme.leaderboardLimit != null && (
                        <Input
                          id="players-shown"
                          type="number"
                          min={3}
                          max={50}
                          value={theme.leaderboardLimit}
                          onChange={(event) => { setTheme({ ...theme, leaderboardLimit: Math.min(50, Math.max(3, Number(event.target.value) || 3)) }); resetPreview(); }}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Players tied at the cutoff are all shown.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {(["primaryColour", "secondaryColour", "accentColour"] as const).map((key) => {
                  const colourLabel = key === "primaryColour" ? "Primary" : key === "secondaryColour" ? "Secondary" : "Accent";
                  return <div key={key} className="space-y-2"><Label htmlFor={key}>{colourLabel}</Label><Input id={key} type="color" className="h-12 p-1" value={theme[key]} onChange={(event) => { setTheme({ ...theme, [key]: event.target.value }); resetPreview(); }} /><Input aria-label={`${colourLabel} hex colour`} value={theme[key]} maxLength={7} onChange={(event) => { setTheme({ ...theme, [key]: event.target.value }); resetPreview(); }} /></div>;
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">{unlinkedCount > 0 && <Alert><AlertTitle>Unlinked result entries</AlertTitle><AlertDescription>{unlinkedCount} named result {unlinkedCount === 1 ? "entry is" : "entries are"} not linked to SportStack profiles. They remain in the tally but cannot receive access or notifications.</AlertDescription></Alert>}{preview ? <div className="overflow-hidden rounded-xl border"><MvpTallyPresentation title={title} subtitle={subtitle} teamName={builderData.branding.teamName} theme={theme} snapshot={preview.cards} finalResults={preview.results} commentary={preview.commentary} initialSpeed={speed} preview /></div> : <div className="rounded-xl border border-dashed p-12 text-center"><Eye className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-semibold">A fresh full preview is required</p><p className="mt-1 text-sm text-muted-foreground">SportStack will recheck every round, vote and recipient first.</p><Button className="mt-4 bg-blue-700 text-white hover:bg-blue-800" disabled={busy} onClick={() => void buildPreview()}>{busy ? "Building…" : "Build and watch preview"}</Button></div>}</div>
          )}

          {step === 4 && (
            <div className="mx-auto max-w-2xl space-y-5"><Alert><Send className="h-4 w-4" /><AlertTitle>Ready to publish</AlertTitle><AlertDescription>{selectedRoundOptions.length} rounds · {selectedAudienceCount} selected players. Publishing creates in-app notifications. Email is sent only when the team and player settings allow it.</AlertDescription></Alert><div className="rounded-lg border p-4"><Label htmlFor="scheduled-for" className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />Schedule for later (optional)</Label><Input id="scheduled-for" type="datetime-local" className="mt-2" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></div><div className="flex flex-col gap-3 sm:flex-row"><Button className="flex-1 bg-blue-700 text-white hover:bg-blue-800" disabled={busy} onClick={() => void publish(false)}>Publish now</Button><Button className="flex-1" variant="outline" disabled={busy || !scheduledFor} onClick={() => void publish(true)}>Schedule publication</Button></div></div>
          )}

          <div className="mt-8 flex items-center justify-between border-t pt-4">
            <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            {step < 2 && <Button className="bg-blue-700 text-white hover:bg-blue-800" disabled={busy || (step === 0 && selectedSessions.length === 0) || (step === 1 && selectedAudienceCount === 0)} onClick={async () => { if (step === 0 && !(await refreshAudience())) return; setStep((current) => current + 1); }} >Next<ArrowRight className="ml-2 h-4 w-4" /></Button>}
            {step === 2 && <Button className="bg-blue-700 text-white hover:bg-blue-800" disabled={busy} onClick={() => void buildPreview()}><Palette className="mr-2 h-4 w-4" />Build preview</Button>}
            {step === 3 && preview && <Button className="bg-blue-700 text-white hover:bg-blue-800" onClick={() => setStep(4)}>Continue to publish<ArrowRight className="ml-2 h-4 w-4" /></Button>}
            {step === 4 && <span />}
          </div>
          {(step === 1 || step === 2) && (
            <div className="mt-3 text-right">
              <Button variant="ghost" size="sm" disabled={busy || selectedAudienceCount === 0} onClick={async () => {
                const savedId = await saveDraft();
                if (savedId) toast({ title: "Draft saved", description: "You can safely return to it later." });
              }}>
                Save draft
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(withdrawTarget)} onOpenChange={(open) => !open && setWithdrawTarget(null)}>
        <DialogContent><DialogHeader><DialogTitle>Withdraw published tally?</DialogTitle><DialogDescription>Selected players will immediately lose access. The original votes are not changed. Add a clear reason for the audit record.</DialogDescription></DialogHeader><Textarea value={withdrawReason} maxLength={1000} placeholder="Reason for withdrawal" onChange={(event) => setWithdrawReason(event.target.value)} /><DialogFooter><Button variant="outline" onClick={() => setWithdrawTarget(null)}>Cancel</Button><Button variant="destructive" disabled={busy || withdrawReason.trim().length < 3} onClick={() => void withdraw()}>Withdraw tally</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
