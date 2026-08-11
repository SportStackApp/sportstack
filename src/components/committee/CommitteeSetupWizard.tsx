import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, CalendarRange, Check, ChevronsUpDown, Plus, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GuidedWorkflowDialog, type GuidedWorkflowStep } from "@/components/workflows/GuidedWorkflowDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  ACCESS_PRESET_LABELS,
  applyPurposePreset,
  buildCommitteeCreatePayload,
  committeeWizardStepIsValid,
  MAIN_COMMITTEE_PURPOSES,
  SUBCOMMITTEE_PURPOSES,
  type CommitteeAccessPreset,
  type CommitteePositionDraft,
  type CommitteeWizardDraft,
} from "@/lib/committeeWorkflow";
import { cn } from "@/lib/utils";

interface CommitteeOption {
  id: string;
  name: string;
}

interface ClubOption extends CommitteeOption {
  association_id: string;
}

export interface CommitteeWizardParent {
  id: string;
  name: string;
  associationId: string;
  associationName: string;
  clubId: string | null;
  clubName: string | null;
  scopeType: "ASSOCIATION" | "CLUB";
}

interface CommitteeCandidate {
  profile_id: string;
  display_name: string;
  is_current_club_president: boolean;
}

interface CommitteeSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  associations: CommitteeOption[];
  clubs: ClubOption[];
  canCreateAssociationCommittee: boolean;
  initialAssociationId: string;
  initialClubId: string;
  parent?: CommitteeWizardParent | null;
  onCreated: (committeeId: string) => Promise<void> | void;
}

const STEPS: GuidedWorkflowStep[] = [
  { id: "purpose", title: "Purpose", description: "Start with a common purpose or write your own." },
  { id: "organisation", title: "Structure", description: "Choose where the committee belongs and how long it will operate." },
  { id: "details", title: "Details", description: "Give people a clear name and explanation." },
  { id: "people", title: "People", description: "Optionally prepare positions and appoint initial members." },
  { id: "review", title: "Review", description: "Check everything before creating the private workspace." },
];

const today = () => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const formatDisplayDate = (value: string) => new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Australia/Melbourne",
}).format(new Date(`${value}T00:00:00`));

function makeInitialDraft({
  parent,
  associations,
  clubs,
  canCreateAssociationCommittee,
  initialAssociationId,
  initialClubId,
}: Pick<CommitteeSetupWizardProps, "parent" | "associations" | "clubs" | "canCreateAssociationCommittee" | "initialAssociationId" | "initialClubId">): CommitteeWizardDraft {
  if (parent) {
    return {
      kind: "SUBCOMMITTEE",
      purposeId: "",
      scopeType: parent.scopeType,
      associationId: parent.associationId,
      clubId: parent.clubId || "",
      parentCommitteeId: parent.id,
      lifecycleType: "STANDING",
      startsOn: today(),
      targetEndOn: "",
      name: "",
      description: "",
      positions: [],
      skipSetup: false,
    };
  }

  const preferredClub = clubs.find((club) => club.id === initialClubId)
    || (!canCreateAssociationCommittee ? clubs[0] : undefined);
  const associationId = initialAssociationId
    || preferredClub?.association_id
    || associations[0]?.id
    || "";
  const scopeType = preferredClub ? "CLUB" : canCreateAssociationCommittee ? "ASSOCIATION" : "CLUB";
  return {
    kind: "COMMITTEE",
    purposeId: "",
    scopeType,
    associationId,
    clubId: preferredClub?.association_id === associationId ? preferredClub.id : "",
    parentCommitteeId: "",
    lifecycleType: "STANDING",
    startsOn: today(),
    targetEndOn: "",
    name: "",
    description: "",
    positions: [],
    skipSetup: false,
  };
}

export function CommitteeSetupWizard(props: CommitteeSetupWizardProps) {
  const { open, onOpenChange, userId, associations, clubs, canCreateAssociationCommittee, initialAssociationId, initialClubId, parent, onCreated } = props;
  const { toast } = useToast();
  const initialDraft = useMemo(() => makeInitialDraft({ parent, associations, clubs, canCreateAssociationCommittee, initialAssociationId, initialClubId }), [associations, canCreateAssociationCommittee, clubs, initialAssociationId, initialClubId, parent]);
  const storageKey = `sportstack:committee-setup:v1:${userId}:${parent?.id || "root"}`;
  const [draft, setDraft] = useState<CommitteeWizardDraft>(initialDraft);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [candidates, setCandidates] = useState<CommitteeCandidate[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const purposes = draft.kind === "SUBCOMMITTEE" ? SUBCOMMITTEE_PURPOSES : MAIN_COMMITTEE_PURPOSES;
  const visibleClubs = clubs.filter((club) => club.association_id === draft.associationId);
  const selectedAssociation = associations.find((item) => item.id === draft.associationId);
  const selectedClub = clubs.find((item) => item.id === draft.clubId);
  const selectedPurpose = purposes.find((item) => item.id === draft.purposeId);
  const isDirty = Boolean(draft.purposeId || draft.name || draft.description || draft.positions.length);

  useEffect(() => {
    if (!open) return;
    setSubmitError("");
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        const restored = JSON.parse(stored) as CommitteeWizardDraft;
        if (restored.kind === initialDraft.kind && restored.parentCommitteeId === initialDraft.parentCommitteeId) {
          setDraft(restored);
          return;
        }
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }
    setDraft(initialDraft);
    setCurrentStep(0);
  }, [initialDraft, open, storageKey]);

  useEffect(() => {
    if (!open || !isDirty) return;
    sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, isDirty, open, storageKey]);

  const loadCandidates = useCallback(async () => {
    if (!draft.associationId || (draft.scopeType === "CLUB" && !draft.clubId)) return;
    setCandidateLoading(true);
    setCandidateError("");
    const { data, error } = await supabase.rpc("list_committee_candidates", {
      p_association_id: draft.associationId,
      ...(draft.scopeType === "CLUB" ? { p_club_id: draft.clubId } : {}),
      ...(draft.parentCommitteeId ? { p_parent_committee_id: draft.parentCommitteeId } : {}),
    });
    if (error) {
      setCandidateError(error.message);
      setCandidates([]);
    } else {
      setCandidates(data || []);
    }
    setCandidateLoading(false);
  }, [draft.associationId, draft.clubId, draft.parentCommitteeId, draft.scopeType]);

  useEffect(() => {
    if (open && currentStep >= 3) void loadCandidates();
  }, [currentStep, loadCandidates, open]);

  const closeRequested = (nextOpen: boolean) => {
    if (nextOpen) return;
    if (isDirty && !saving) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const discardDraft = () => {
    sessionStorage.removeItem(storageKey);
    setDraft(initialDraft);
    setCurrentStep(0);
    setDiscardOpen(false);
    setSubmitError("");
    onOpenChange(false);
  };

  const selectPurpose = (purposeId: string) => {
    const preset = purposes.find((item) => item.id === purposeId);
    if (preset) setDraft((current) => applyPurposePreset(current, preset));
  };

  const updatePosition = (key: string, change: Partial<CommitteePositionDraft>) => {
    setDraft((current) => ({ ...current, positions: current.positions.map((item) => item.key === key ? { ...item, ...change } : item) }));
  };

  const addCustomPosition = () => {
    setDraft((current) => ({
      ...current,
      skipSetup: false,
      positions: [...current.positions, {
        key: `custom-${crypto.randomUUID()}`,
        title: "",
        description: "",
        accessPreset: "MEMBER",
        isPresident: false,
        selected: true,
        memberIds: [],
      }],
    }));
  };

  const addCurrentPresidents = () => {
    const presidentIds = candidates.filter((item) => item.is_current_club_president).map((item) => item.profile_id);
    if (presidentIds.length === 0) {
      toast({ title: "No current Club Presidents found", description: "You can still select people manually." });
      return;
    }
    setDraft((current) => ({
      ...current,
      skipSetup: false,
      positions: current.positions.map((item) => item.key === "club-president" ? { ...item, selected: true, memberIds: presidentIds } : item),
    }));
    toast({ title: `${presidentIds.length} current Club President${presidentIds.length === 1 ? "" : "s"} added`, description: "Review the matched people before creating the subcommittee." });
  };

  const submit = async () => {
    if (!committeeWizardStepIsValid(draft, 2)) return;
    setSaving(true);
    setSubmitError("");
    const payload = buildCommitteeCreatePayload(draft);
    const { data, error } = await supabase.rpc("create_committee_with_setup", {
      p_committee: payload.committee as unknown as Json,
      p_positions: payload.positions as unknown as Json,
    });
    if (error) {
      setSubmitError(error.message);
      toast({ title: `${draft.kind === "SUBCOMMITTEE" ? "Subcommittee" : "Committee"} not created`, description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    sessionStorage.removeItem(storageKey);
    setDraft(initialDraft);
    setCurrentStep(0);
    onOpenChange(false);
    await onCreated(String(data));
    toast({ title: `${draft.kind === "SUBCOMMITTEE" ? "Subcommittee" : "Committee"} created`, description: payload.positions.length ? "Positions and appointments were created with it." : "You can add positions and members whenever you are ready." });
    setSaving(false);
  };

  const stepContent = (() => {
    if (currentStep === 0) {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {purposes.map((purpose) => (
              <button
                key={purpose.id}
                type="button"
                aria-pressed={draft.purposeId === purpose.id}
                onClick={() => selectPurpose(purpose.id)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5",
                  draft.purposeId === purpose.id ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{purpose.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{purpose.description || "Start with a blank name and purpose."}</p>
                  </div>
                  {draft.purposeId === purpose.id && <span className="rounded-full bg-primary p-1 text-primary-foreground"><Check className="h-4 w-4" /></span>}
                </div>
              </button>
            ))}
          </div>
          {!draft.purposeId && <p className="text-sm text-destructive">Choose a purpose to continue.</p>}
        </div>
      );
    }

    if (currentStep === 1 && draft.kind === "SUBCOMMITTEE") {
      return (
        <div className="space-y-5">
          <Card className="border-primary/30 bg-primary/5"><CardContent className="flex items-start gap-3 pt-5"><Building2 className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">{parent?.name}</p><p className="text-sm text-muted-foreground">{parent?.associationName}{parent?.clubName ? ` • ${parent.clubName}` : ""}. The subcommittee inherits this organisation.</p></div></CardContent></Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["STANDING", "TEMPORARY"] as const).map((lifecycle) => (
              <button key={lifecycle} type="button" aria-pressed={draft.lifecycleType === lifecycle} onClick={() => setDraft((current) => ({ ...current, lifecycleType: lifecycle, targetEndOn: lifecycle === "STANDING" ? "" : current.targetEndOn }))} className={cn("rounded-xl border-2 p-4 text-left transition-colors", draft.lifecycleType === lifecycle ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}>
                <p className="font-semibold">{lifecycle === "STANDING" ? "Standing subcommittee" : "Temporary panel or working group"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{lifecycle === "STANDING" ? "Ongoing until it is formally closed." : "Created for a defined matter, project or event."}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date"><Input type="date" value={draft.startsOn} onChange={(event) => setDraft((current) => ({ ...current, startsOn: event.target.value }))} /></Field>
            {draft.lifecycleType === "TEMPORARY" && <Field label="Target completion date (optional)"><Input type="date" min={draft.startsOn} value={draft.targetEndOn} onChange={(event) => setDraft((current) => ({ ...current, targetEndOn: event.target.value }))} /></Field>}
          </div>
          {draft.lifecycleType === "TEMPORARY" && draft.targetEndOn && draft.targetEndOn < draft.startsOn && <p className="text-sm text-destructive">The target completion date cannot be before the start date.</p>}
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="space-y-5">
          {canCreateAssociationCommittee && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["ASSOCIATION", "CLUB"] as const).map((scopeType) => (
                <button key={scopeType} type="button" aria-pressed={draft.scopeType === scopeType} onClick={() => setDraft((current) => ({ ...current, scopeType, clubId: scopeType === "CLUB" ? current.clubId : "" }))} className={cn("rounded-xl border-2 p-4 text-left transition-colors", draft.scopeType === scopeType ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}>
                  <p className="font-semibold">{scopeType === "ASSOCIATION" ? "Association committee" : "Club committee"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{scopeType === "ASSOCIATION" ? "Works across the whole association." : "Belongs to one selected club."}</p>
                </button>
              ))}
            </div>
          )}
          <Field label="Association">
            <Select value={draft.associationId || undefined} onValueChange={(associationId) => setDraft((current) => ({ ...current, associationId, clubId: "" }))}>
              <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select association" /></SelectTrigger>
              <SelectContent>{associations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {draft.scopeType === "CLUB" && <Field label="Club"><Select value={draft.clubId || undefined} onValueChange={(clubId) => setDraft((current) => ({ ...current, clubId }))}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select club" /></SelectTrigger><SelectContent>{visibleClubs.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}
          {!committeeWizardStepIsValid(draft, 1) && <p className="text-sm text-destructive">Select the organisation before continuing.</p>}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-5">
          <Card className="bg-muted/20"><CardContent className="pt-5 text-sm"><p className="font-medium">{draft.kind === "SUBCOMMITTEE" ? `Subcommittee of ${parent?.name}` : draft.scopeType === "CLUB" ? selectedClub?.name : selectedAssociation?.name}</p><p className="mt-1 text-muted-foreground">{draft.kind === "SUBCOMMITTEE" ? `${parent?.associationName}${parent?.clubName ? ` • ${parent.clubName}` : ""}` : "Only authorised administrators and appointed members will have access."}</p></CardContent></Card>
          <Field label={`${draft.kind === "SUBCOMMITTEE" ? "Subcommittee" : "Committee"} name`}><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Enter a clear name" /></Field>
          <Field label="Purpose"><Textarea className="min-h-32" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Explain what this committee is responsible for" /></Field>
          {!committeeWizardStepIsValid(draft, 2) && <p className="text-sm text-destructive">Enter both a name and a purpose before continuing.</p>}
        </div>
      );
    }

    if (currentStep === 3) {
      const currentPresidents = candidates.filter((item) => item.is_current_club_president);
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
            <div><p className="font-medium">Suggested starting positions</p><p className="text-sm text-muted-foreground">Turn positions off, rename them or add your own. Every appointment remains optional.</p></div>
            <Button type="button" variant="outline" onClick={addCustomPosition}><Plus className="mr-2 h-4 w-4" />Custom position</Button>
          </div>
          {draft.kind === "SUBCOMMITTEE" && draft.purposeId === "presidents" && (
            <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5"><div><p className="font-medium">Current Club Presidents</p><p className="text-sm text-muted-foreground">{candidateLoading ? "Finding current appointments…" : `${currentPresidents.length} current President${currentPresidents.length === 1 ? "" : "s"} found. You will review them before creation.`}</p></div><Button type="button" onClick={addCurrentPresidents} disabled={candidateLoading}><Users className="mr-2 h-4 w-4" />Add current Presidents</Button></CardContent></Card>
          )}
          {candidateError && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">People could not be loaded: {candidateError}</p>}
          <div className="space-y-3">
            {draft.positions.map((item) => (
              <div key={item.key} className={cn("rounded-xl border p-4", item.selected ? "bg-card" : "bg-muted/30 opacity-70")}>
                <div className="flex items-start gap-3">
                  <Checkbox checked={item.selected} onCheckedChange={(checked) => updatePosition(item.key, { selected: checked === true })} aria-label={`Include ${item.title || "custom position"}`} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                      <Input value={item.title} onChange={(event) => updatePosition(item.key, { title: event.target.value })} placeholder="Position title" disabled={!item.selected} />
                      <Select value={item.accessPreset} onValueChange={(value) => updatePosition(item.key, { accessPreset: value as CommitteeAccessPreset })} disabled={!item.selected}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACCESS_PRESET_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    {item.selected && <CandidatePicker candidates={candidates} selectedIds={item.memberIds} loading={candidateLoading} onChange={(memberIds) => updatePosition(item.key, { memberIds })} />}
                  </div>
                  {item.isPresident && <Badge variant="secondary">Lead</Badge>}
                  {item.key.startsWith("custom-") && <Button type="button" variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, positions: current.positions.filter((position) => position.key !== item.key) }))}><X className="h-4 w-4" /><span className="sr-only">Remove position</span></Button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const selectedPositions = draft.skipSetup ? [] : draft.positions.filter((item) => item.selected && item.title.trim());
    const appointmentCount = selectedPositions.reduce((total, item) => total + item.memberIds.length, 0);
    return (
      <div className="space-y-4">
        <ReviewRow icon={<Sparkles className="h-5 w-5" />} label="Purpose" value={selectedPurpose?.label || "Custom"} detail={draft.description} />
        <ReviewRow icon={<Building2 className="h-5 w-5" />} label="Organisation" value={draft.kind === "SUBCOMMITTEE" ? `Subcommittee of ${parent?.name}` : draft.scopeType === "CLUB" ? selectedClub?.name || "Club" : selectedAssociation?.name || "Association"} detail={draft.kind === "SUBCOMMITTEE" ? `${draft.lifecycleType === "STANDING" ? "Standing subcommittee" : "Temporary panel or working group"} • Private to appointed members` : draft.name} />
        <ReviewRow icon={<CalendarRange className="h-5 w-5" />} label="Duration" value={draft.lifecycleType === "STANDING" ? "Standing" : "Temporary"} detail={draft.lifecycleType === "STANDING" ? "Ongoing until formally closed." : `${formatDisplayDate(draft.startsOn)}${draft.targetEndOn ? ` to ${formatDisplayDate(draft.targetEndOn)}` : " — no target completion date"}`} />
        <ReviewRow icon={<Users className="h-5 w-5" />} label="Initial setup" value={draft.skipSetup ? "Add later" : `${selectedPositions.length} position${selectedPositions.length === 1 ? "" : "s"}`} detail={draft.skipSetup ? "No positions or appointments will be created yet." : `${appointmentCount} initial appointment${appointmentCount === 1 ? "" : "s"}. Access can be customised later.`} />
        {!draft.skipSetup && selectedPositions.length > 0 && (
          <Card>
            <CardContent className="space-y-3 pt-5">
              {selectedPositions.map((position) => {
                const appointed = candidates.filter((candidate) => position.memberIds.includes(candidate.profile_id));
                return (
                  <div key={position.key} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">{position.title}</p>
                      <p className="text-sm text-muted-foreground">{ACCESS_PRESET_LABELS[position.accessPreset]}</p>
                    </div>
                    <div className="flex max-w-full flex-wrap justify-end gap-1">
                      {appointed.length === 0
                        ? <Badge variant="outline">No appointment</Badge>
                        : appointed.map((candidate) => <Badge key={candidate.profile_id} variant="secondary">{candidate.display_name}</Badge>)}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="flex items-start gap-3 pt-5"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Access is checked by SportStack</p><p className="text-sm text-muted-foreground">Only authorised administrators and explicitly appointed members can access this workspace. Subcommittee records remain separate from the parent.</p></div></CardContent></Card>
        {submitError && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Creation failed: {submitError}</p>}
      </div>
    );
  })();

  return (
    <>
      <GuidedWorkflowDialog
        open={open}
        onOpenChange={closeRequested}
        title={draft.kind === "SUBCOMMITTEE" ? "Create subcommittee" : "Create committee"}
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        canContinue={committeeWizardStepIsValid(draft, currentStep)}
        saving={saving}
        onFinish={() => void submit()}
        onSkip={currentStep === 3 ? () => { setDraft((current) => ({ ...current, skipSetup: true })); setCurrentStep(4); } : undefined}
        skipLabel="Skip roles and members for now"
        finishLabel={draft.kind === "SUBCOMMITTEE" ? "Create subcommittee" : "Create committee"}
      >
        {stepContent}
      </GuidedWorkflowDialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Discard this setup?</AlertDialogTitle><AlertDialogDescription>Your unfinished answers will be removed. You can stay here and continue instead.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep working</AlertDialogCancel><AlertDialogAction onClick={discardDraft}>Discard setup</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ReviewRow({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <Card><CardContent className="flex items-start gap-3 pt-5"><span className="mt-0.5 text-primary">{icon}</span><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function CandidatePicker({ candidates, selectedIds, loading, onChange }: { candidates: CommitteeCandidate[]; selectedIds: string[]; loading: boolean; onChange: (ids: string[]) => void }) {
  const selectedCandidates = candidates.filter((candidate) => selectedIds.includes(candidate.profile_id));
  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
            {loading ? "Loading eligible people…" : selectedIds.length ? `${selectedIds.length} person${selectedIds.length === 1 ? "" : "s"} appointed` : "Optionally appoint people"}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search eligible people…" />
            <CommandList><CommandEmpty>No eligible people found.</CommandEmpty><CommandGroup>{candidates.map((candidate) => {
              const selected = selectedIds.includes(candidate.profile_id);
              return <CommandItem key={candidate.profile_id} value={`${candidate.display_name} ${candidate.profile_id}`} onSelect={() => onChange(selected ? selectedIds.filter((id) => id !== candidate.profile_id) : [...selectedIds, candidate.profile_id])}><span className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}><Check className="h-3 w-3" /></span><span className="flex-1">{candidate.display_name}</span>{candidate.is_current_club_president && <Badge variant="secondary">President</Badge>}</CommandItem>;
            })}</CommandGroup></CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedCandidates.length > 0 && <div className="flex flex-wrap gap-1.5">{selectedCandidates.map((candidate) => <Badge key={candidate.profile_id} variant="secondary" className="gap-1">{candidate.display_name}<button type="button" onClick={() => onChange(selectedIds.filter((id) => id !== candidate.profile_id))} className="rounded-full hover:bg-background/50"><X className="h-3 w-3" /><span className="sr-only">Remove {candidate.display_name}</span></button></Badge>)}</div>}
    </div>
  );
}
