import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarClock, Check, Eye, Palette, Send, Trophy, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  listMvpTallyPresentations,
  previewMvpTally,
  publishMvpTally,
  saveMvpTallyDraft,
  withdrawMvpTally,
} from "@/features/player-mvp-tally/api";
import { mergeInheritedTheme } from "@/features/player-mvp-tally/logic";
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

const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("MVP_TALLY_PREVIEW_STALE")) return "Rounds, votes or the audience changed. Preview the tally again.";
  if (message.includes("MVP_TALLY_ROUNDS_CHANGED")) return "A selected round is no longer closed and undisputed.";
  if (message.includes("MVP_TALLY_AUDIENCE_CHANGED")) return "One or more selected players are no longer eligible for this team and these rounds.";
  if (message.includes("permission")) return "Your current SportStack role cannot manage this team.";
  return "The tally presentation could not be saved. Please try again.";
};

export default function MvpTallyAdmin() {
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team");
  const { toast } = useToast();
  const [builderData, setBuilderData] = useState<MvpTallyBuilderData | null>(null);
  const [presentations, setPresentations] = useState<MvpTallyPresentationRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [replacesId, setReplacesId] = useState<string | null>(null);
  const [title, setTitle] = useState("Player MVP Season Tally");
  const [subtitle, setSubtitle] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [audience, setAudience] = useState<MvpTallyAudienceMember[]>([]);
  const [theme, setTheme] = useState<MvpTallyTheme | null>(null);
  const [speed, setSpeed] = useState<MvpTallySpeed>(1);
  const [preview, setPreview] = useState<{ cards: NonNullable<MvpTallyPresentationRecord["card_snapshot"]>; results: NonNullable<MvpTallyPresentationRecord["result_snapshot"]> } | null>(null);
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
    setSelectedSessions((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    resetPreview();
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
      setPreview({ cards: result.cards, results: result.results });
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
      setPreview(item.card_snapshot && item.result_snapshot ? { cards: item.card_snapshot, results: item.result_snapshot } : null);
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
          <CardHeader><CardTitle>Select a team first</CardTitle><CardDescription>Use the normal Association → Club → Division → Team filters before opening the tally builder.</CardDescription></CardHeader>
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
          <CardHeader><CardTitle>Saved presentations</CardTitle><CardDescription>Published results cannot be edited. Withdraw them and create a replacement if a correction is needed.</CardDescription></CardHeader>
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
          <CardTitle>{draftId ? "Continue draft" : replacesId ? "Replacement presentation" : "New presentation"}</CardTitle>
          <CardDescription>Choose closed rounds, the audience and the broadcast look, then watch the full preview before publishing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-8 grid grid-cols-5 gap-1">
            {STEPS.map((label, index) => (
              <div key={label} className="text-center">
                <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</div>
                <p className="mt-1 hidden text-xs font-medium sm:block">{label}</p>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="tally-title">Presentation title</Label><Input id="tally-title" value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); resetPreview(); }} /></div><div className="space-y-2"><Label htmlFor="tally-subtitle">Subtitle (optional)</Label><Input id="tally-subtitle" value={subtitle} maxLength={240} onChange={(event) => { setSubtitle(event.target.value); resetPreview(); }} /></div></div>
              <div className="space-y-2"><Label>Closed, undisputed rounds</Label>{builderData.sessions.length === 0 ? <Alert><AlertTitle>No eligible rounds</AlertTitle><AlertDescription>Close and resolve at least one Player MVP session first.</AlertDescription></Alert> : <div className="grid gap-3 md:grid-cols-2">{builderData.sessions.map((session) => <label key={session.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><Checkbox checked={selectedSessions.includes(session.id)} onCheckedChange={() => toggleSession(session.id)} /><span className="min-w-0"><span className="block font-semibold">{session.round} · {session.homeTeam} v {session.awayTeam}</span><span className="text-xs text-muted-foreground">{session.gameDate ? new Date(`${session.gameDate}T00:00:00`).toLocaleDateString("en-AU") : "Date unavailable"} · {session.voteCount} vote lines</span>{session.unlinkedCount > 0 && <span className="mt-1 block text-xs text-amber-700">{session.unlinkedCount} unlinked named {session.unlinkedCount === 1 ? "entry" : "entries"}</span>}</span></label>)}</div>}</div>
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
              <div className="space-y-4"><div className="space-y-2"><Label htmlFor="logo-url">Logo URL</Label><Input id="logo-url" value={theme.logoUrl || ""} placeholder="Inherited team logo" onChange={(event) => { setTheme({ ...theme, logoUrl: event.target.value || null }); resetPreview(); }} /></div><div className="space-y-2"><Label>Background style</Label><Select value={theme.backgroundStyle} onValueChange={(value) => { setTheme({ ...theme, backgroundStyle: value as MvpTallyTheme["backgroundStyle"] }); resetPreview(); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SPOTLIGHT">Sports spotlight</SelectItem><SelectItem value="GRADIENT">Colour gradient</SelectItem><SelectItem value="SOLID">Solid colour</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Default speed</Label><Select value={String(speed)} onValueChange={(value) => { setSpeed(Number(value) as MvpTallySpeed); resetPreview(); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[0.5, 1, 1.5, 2].map((option) => <SelectItem key={option} value={String(option)}>{option}×</SelectItem>)}</SelectContent></Select></div></div>
              <div className="grid grid-cols-3 gap-4">{(["primaryColour", "secondaryColour", "accentColour"] as const).map((key) => <div key={key} className="space-y-2"><Label htmlFor={key}>{key === "primaryColour" ? "Primary" : key === "secondaryColour" ? "Secondary" : "Accent"}</Label><Input id={key} type="color" className="h-12 p-1" value={theme[key]} onChange={(event) => { setTheme({ ...theme, [key]: event.target.value }); resetPreview(); }} /><Input value={theme[key]} maxLength={7} onChange={(event) => { setTheme({ ...theme, [key]: event.target.value }); resetPreview(); }} /></div>)}</div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">{unlinkedCount > 0 && <Alert><AlertTitle>Unlinked result entries</AlertTitle><AlertDescription>{unlinkedCount} named result {unlinkedCount === 1 ? "entry is" : "entries are"} not linked to SportStack profiles. They remain in the tally but cannot receive access or notifications.</AlertDescription></Alert>}{preview ? <div className="overflow-hidden rounded-xl border"><MvpTallyPresentation title={title} subtitle={subtitle} teamName={builderData.branding.teamName} theme={theme} snapshot={preview.cards} finalResults={preview.results} initialSpeed={speed} preview /></div> : <div className="rounded-xl border border-dashed p-12 text-center"><Eye className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-semibold">A fresh full preview is required</p><p className="mt-1 text-sm text-muted-foreground">SportStack will recheck every round, vote and recipient first.</p><Button className="mt-4" disabled={busy} onClick={() => void buildPreview()}>{busy ? "Building…" : "Build and watch preview"}</Button></div>}</div>
          )}

          {step === 4 && (
            <div className="mx-auto max-w-2xl space-y-5"><Alert><Send className="h-4 w-4" /><AlertTitle>Ready to publish</AlertTitle><AlertDescription>{selectedRoundOptions.length} rounds · {selectedAudienceCount} selected players. Publishing creates in-app notifications. Email is sent only when the team and player settings allow it.</AlertDescription></Alert><div className="rounded-lg border p-4"><Label htmlFor="scheduled-for" className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />Schedule for later (optional)</Label><Input id="scheduled-for" type="datetime-local" className="mt-2" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></div><div className="flex flex-col gap-3 sm:flex-row"><Button className="flex-1" disabled={busy} onClick={() => void publish(false)}>Publish now</Button><Button className="flex-1" variant="outline" disabled={busy || !scheduledFor} onClick={() => void publish(true)}>Schedule publication</Button></div></div>
          )}

          <div className="mt-8 flex items-center justify-between border-t pt-4">
            <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            {step < 2 && <Button disabled={busy || (step === 0 && selectedSessions.length === 0) || (step === 1 && selectedAudienceCount === 0)} onClick={async () => { if (step === 0 && !(await refreshAudience())) return; setStep((current) => current + 1); }} >Next<ArrowRight className="ml-2 h-4 w-4" /></Button>}
            {step === 2 && <Button disabled={busy} onClick={() => void buildPreview()}><Palette className="mr-2 h-4 w-4" />Build preview</Button>}
            {step === 3 && preview && <Button onClick={() => setStep(4)}>Continue to publish<ArrowRight className="ml-2 h-4 w-4" /></Button>}
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
