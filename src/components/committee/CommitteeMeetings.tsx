import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw, Save, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AgendaTemplate = Tables<"committee_agenda_templates">;
type AgendaTemplateItem = Tables<"committee_agenda_template_items"> & {
  item_type?: "SECTION" | "POINT";
  include_open_actions?: boolean;
};
type Meeting = Tables<"committee_meetings"> & {
  attendee_ids?: string[];
  apology_ids?: string[];
};
type MeetingItem = Tables<"committee_meeting_items"> & {
  item_type?: "SECTION" | "POINT";
  include_open_actions?: boolean;
};

interface DraftAgendaItem {
  localId: string;
  title: string;
  notesPrompt: string;
  presenter: string;
  itemType: "SECTION" | "POINT";
  includeOpenActions: boolean;
}

interface MinuteDraft {
  minutes: string;
  decision: string;
  actionText: string;
  actionOwnerId: string;
  actionDueDate: string;
  linkedRecordKeys: string[];
}

interface SafetyLinkOption {
  key: string;
  label: string;
}

interface MeetingLinkRow {
  meeting_item_id: string;
  record_type: string;
  record_id: string;
}

type CommitteeMeetingMode = "calendar" | "meetings" | "minutes" | "templates";

const newAgendaItem = (itemType: "SECTION" | "POINT" = "POINT"): DraftAgendaItem => ({
  localId: crypto.randomUUID(),
  title: itemType === "SECTION" ? "General Business" : "",
  notesPrompt: "",
  presenter: "",
  itemType,
  includeOpenActions: false,
});

const formatMeetingDate = (value: string) => new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Melbourne",
}).format(new Date(value));

const dateKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Australia/Melbourne",
}).format(typeof value === "string" ? new Date(value) : value);

const emptyMinuteDraft = (): MinuteDraft => ({
  minutes: "",
  decision: "",
  actionText: "",
  actionOwnerId: "",
  actionDueDate: "",
  linkedRecordKeys: [],
});

export function CommitteeMeetings({
  mode,
  committeeId,
  associationId,
  clubId,
  canManage,
  canRecordMinutes,
  profiles,
  memberProfileIds,
}: {
  mode: CommitteeMeetingMode;
  committeeId: string;
  associationId: string;
  clubId: string | null;
  canManage: boolean;
  canRecordMinutes: boolean;
  profiles: Array<{ id: string; first_name: string | null; last_name: string | null }>;
  memberProfileIds?: string[];
}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AgendaTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<AgendaTemplateItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingItems, setMeetingItems] = useState<MeetingItem[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateForm, setTemplateForm] = useState({ title: "", description: "" });
  const [draftItems, setDraftItems] = useState<DraftAgendaItem[]>([newAgendaItem()]);
  const [meetingForm, setMeetingForm] = useState({ templateId: "", title: "", scheduledAt: "", location: "" });
  const [minuteDrafts, setMinuteDrafts] = useState<Record<string, MinuteDraft>>({});
  const [safetyLinkOptions, setSafetyLinkOptions] = useState<SafetyLinkOption[]>([]);
  const [attendanceDraft, setAttendanceDraft] = useState({ attendeeIds: [] as string[], apologyIds: [] as string[] });
  const [minutesSearch, setMinutesSearch] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const profileName = useCallback((id: string) => {
    const profile = profiles.find((item) => item.id === id);
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unassigned";
  }, [profiles]);

  const committeeProfiles = useMemo(() => {
    const allowed = new Set(memberProfileIds || profiles.map((profile) => profile.id));
    return profiles.filter((profile) => allowed.has(profile.id));
  }, [memberProfileIds, profiles]);

  const loadMeetings = useCallback(async () => {
    const [templateResult, templateItemResult, meetingResult, meetingItemResult, linkResult, riskResult, actionResult, qiResult, ideaResult] = await Promise.all([
      supabase.from("committee_agenda_templates").select("*").eq("committee_id", committeeId).order("is_active", { ascending: false }).order("title"),
      supabase.from("committee_agenda_template_items").select("*").order("sort_order"),
      supabase.from("committee_meetings").select("*").eq("committee_id", committeeId).order("scheduled_at", { ascending: false }),
      supabase.from("committee_meeting_items").select("*").order("sort_order"),
      supabase.rpc("get_committee_meeting_item_links" as never, { p_committee_id: committeeId } as never),
      supabase.from("rg_risk_register").select("id, display_number, title, association_id, club_id").order("display_number"),
      supabase.from("rg_be_smart_actions").select("id, display_number, title, association_id, club_id").order("display_number"),
      supabase.from("rg_quality_improvement_items").select("id, display_number, title, association_id, club_id").order("display_number"),
      supabase.from("rg_bright_ideas").select("id, display_number, title, association_id, club_id").order("display_number"),
    ]);
    const failure = [templateResult, templateItemResult, meetingResult, meetingItemResult, linkResult, riskResult, actionResult, qiResult, ideaResult].find((result) => result.error)?.error;
    if (failure) {
      toast({ title: "Committee meetings unavailable", description: failure.message, variant: "destructive" });
      return;
    }

    const loadedTemplates = templateResult.data || [];
    const loadedMeetings = (meetingResult.data || []) as Meeting[];
    const templateIds = new Set(loadedTemplates.map((template) => template.id));
    const meetingIds = new Set(loadedMeetings.map((meeting) => meeting.id));
    const loadedItems = (meetingItemResult.data || []).filter((item) => meetingIds.has(item.meeting_id)) as MeetingItem[];
    const loadedLinks = (linkResult.data || []) as unknown as MeetingLinkRow[];
    const linksByItem = new Map<string, string[]>();
    loadedLinks.forEach((link) => {
      const keys = linksByItem.get(link.meeting_item_id) || [];
      keys.push(`${link.record_type}:${link.record_id}`);
      linksByItem.set(link.meeting_item_id, keys);
    });

    setTemplates(loadedTemplates);
    setTemplateItems((templateItemResult.data || []).filter((item) => templateIds.has(item.template_id)) as AgendaTemplateItem[]);
    setMeetings(loadedMeetings);
    setMeetingItems(loadedItems);

    const inCommitteeScope = (record: { association_id: string; club_id: string | null }) =>
      record.association_id === associationId && (!clubId || record.club_id === clubId);
    setSafetyLinkOptions([
      ...(riskResult.data || []).filter(inCommitteeScope).map((record) => ({ key: `RISK:${record.id}`, label: `R-${String(record.display_number).padStart(3, "0")} — ${record.title}` })),
      ...(actionResult.data || []).filter(inCommitteeScope).map((record) => ({ key: `ACTION:${record.id}`, label: `A-${String(record.display_number).padStart(3, "0")} — ${record.title}` })),
      ...(qiResult.data || []).filter(inCommitteeScope).map((record) => ({ key: `QI:${record.id}`, label: `QI-${String(record.display_number).padStart(3, "0")} — ${record.title}` })),
      ...(ideaResult.data || []).filter(inCommitteeScope).map((record) => ({ key: `BRIGHT_IDEA:${record.id}`, label: `BI-${String(record.display_number).padStart(3, "0")} — ${record.title}` })),
    ]);

    setSelectedMeetingId((current) => current && meetingIds.has(current) ? current : loadedMeetings[0]?.id || "");
    setMinuteDrafts(Object.fromEntries(loadedItems.map((item) => [item.id, {
      minutes: item.minutes || "",
      decision: item.decision || "",
      actionText: item.action_text || "",
      actionOwnerId: item.action_owner_id || "",
      actionDueDate: item.action_due_date || "",
      linkedRecordKeys: linksByItem.get(item.id) || (item.linked_record_type && item.linked_record_id ? [`${item.linked_record_type}:${item.linked_record_id}`] : []),
    }])));
  }, [associationId, clubId, committeeId, toast]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId);
  const selectedItems = useMemo(
    () => meetingItems.filter((item) => item.meeting_id === selectedMeetingId).sort((left, right) => left.sort_order - right.sort_order),
    [meetingItems, selectedMeetingId],
  );

  useEffect(() => {
    setAttendanceDraft({
      attendeeIds: selectedMeeting?.attendee_ids || [],
      apologyIds: selectedMeeting?.apology_ids || [],
    });
  }, [selectedMeeting]);

  const openTemplate = () => {
    setTemplateForm({ title: "", description: "" });
    setDraftItems([newAgendaItem("SECTION"), newAgendaItem(), { ...newAgendaItem("SECTION"), title: "General Business" }, { ...newAgendaItem(), title: "Review open actions", includeOpenActions: true }]);
    setTemplateOpen(true);
  };

  const createTemplate = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("create_committee_agenda_template", {
      p_committee_id: committeeId,
      p_title: templateForm.title,
      p_description: templateForm.description,
      p_items: draftItems.map((item) => ({
        title: item.title,
        notes_prompt: item.notesPrompt,
        presenter: item.presenter,
        item_type: item.itemType,
        include_open_actions: item.includeOpenActions,
      })),
    });
    if (error) toast({ title: "Agenda template not created", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Agenda template created" });
      setTemplateOpen(false);
      await loadMeetings();
    }
    setSaving(false);
  };

  const setTemplateActive = async (template: AgendaTemplate, isActive: boolean) => {
    const { error } = await supabase.from("committee_agenda_templates").update({ is_active: isActive }).eq("id", template.id);
    if (error) toast({ title: "Template not updated", description: error.message, variant: "destructive" });
    else {
      toast({ title: isActive ? "Template restored" : "Template archived" });
      await loadMeetings();
    }
  };

  const openMeeting = (template?: AgendaTemplate) => {
    const activeTemplates = templates.filter((item) => item.is_active);
    setMeetingForm({
      templateId: template?.id || activeTemplates[0]?.id || "",
      title: template ? `${template.title} meeting` : "",
      scheduledAt: "",
      location: "",
    });
    setMeetingOpen(true);
  };

  const createMeeting = async () => {
    if (!meetingForm.scheduledAt) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("create_committee_meeting_from_template", {
      p_committee_id: committeeId,
      p_template_id: meetingForm.templateId,
      p_title: meetingForm.title,
      p_scheduled_at: new Date(meetingForm.scheduledAt).toISOString(),
      p_location: meetingForm.location,
    });
    if (error) toast({ title: "Meeting not created", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Meeting scheduled" });
      setMeetingOpen(false);
      await loadMeetings();
      setSelectedMeetingId(data);
    }
    setSaving(false);
  };

  const saveAttendance = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_committee_meeting_attendance" as never, {
      p_meeting_id: selectedMeeting.id,
      p_attendee_ids: attendanceDraft.attendeeIds,
      p_apology_ids: attendanceDraft.apologyIds,
    } as never);
    if (error) toast({ title: "Attendance not saved", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Attendance saved" });
      await loadMeetings();
    }
    setSaving(false);
  };

  const saveMinutes = async (item: MeetingItem) => {
    const draft = minuteDrafts[item.id];
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase.from("committee_meeting_items").update({
      minutes: draft.minutes.trim() || null,
      decision: draft.decision.trim() || null,
      action_text: draft.actionText.trim() || null,
      action_owner_id: draft.actionOwnerId || null,
      action_due_date: draft.actionDueDate || null,
      linked_record_type: null,
      linked_record_id: null,
    }).eq("id", item.id);
    const links = draft.linkedRecordKeys.map((key) => {
      const [recordType, recordId] = key.split(":");
      return { record_type: recordType, record_id: recordId };
    });
    const linkResult = error ? null : await supabase.rpc("set_committee_meeting_item_links" as never, {
      p_meeting_item_id: item.id,
      p_links: links,
    } as never);
    const saveError = error || linkResult?.error;
    if (saveError) toast({ title: "Minutes not saved", description: saveError.message, variant: "destructive" });
    else {
      toast({ title: `Saved: ${item.title}` });
      await loadMeetings();
    }
    setSaving(false);
  };

  const completeMeeting = async () => {
    if (!selectedMeeting) return;
    const { error } = await supabase.from("committee_meetings").update({ status: "COMPLETED" }).eq("id", selectedMeeting.id);
    if (error) toast({ title: "Meeting not completed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Meeting marked complete" });
      await loadMeetings();
    }
  };

  const activeTemplates = templates.filter((template) => template.is_active);

  if (mode === "templates") {
    return <TemplateLibrary templates={templates} templateItems={templateItems} canManage={canManage} onCreate={openTemplate} onUse={openMeeting} onSetActive={setTemplateActive} dialogs={<MeetingDialogs templates={activeTemplates} templateOpen={templateOpen} setTemplateOpen={setTemplateOpen} templateForm={templateForm} setTemplateForm={setTemplateForm} draftItems={draftItems} setDraftItems={setDraftItems} createTemplate={createTemplate} meetingOpen={meetingOpen} setMeetingOpen={setMeetingOpen} meetingForm={meetingForm} setMeetingForm={setMeetingForm} createMeeting={createMeeting} saving={saving} />} />;
  }

  if (mode === "calendar") {
    return <><MeetingCalendar month={calendarMonth} setMonth={setCalendarMonth} meetings={meetings} canManage={canManage && activeTemplates.length > 0} onCreate={() => openMeeting()} /><MeetingDialogs templates={activeTemplates} templateOpen={templateOpen} setTemplateOpen={setTemplateOpen} templateForm={templateForm} setTemplateForm={setTemplateForm} draftItems={draftItems} setDraftItems={setDraftItems} createTemplate={createTemplate} meetingOpen={meetingOpen} setMeetingOpen={setMeetingOpen} meetingForm={meetingForm} setMeetingForm={setMeetingForm} createMeeting={createMeeting} saving={saving} /></>;
  }

  if (mode === "minutes") {
    const query = minutesSearch.trim().toLowerCase();
    const completedMeetings = meetings.filter((meeting) => meeting.status === "COMPLETED").filter((meeting) => {
      const items = meetingItems.filter((item) => item.meeting_id === meeting.id);
      return !query || meeting.title.toLowerCase().includes(query) || items.some((item) => `${item.title} ${item.minutes || ""} ${item.decision || ""}`.toLowerCase().includes(query));
    });
    return <Card><CardHeader><CardTitle>Minutes Library</CardTitle><CardDescription>Search completed committee meetings and decisions.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search meeting, agenda point, minutes or decision" value={minutesSearch} onChange={(event) => setMinutesSearch(event.target.value)} /></div>{completedMeetings.length === 0 ? <p className="text-sm text-muted-foreground">No matching completed minutes.</p> : completedMeetings.map((meeting) => <div key={meeting.id} className="space-y-2 rounded-lg border p-3"><div><p className="font-medium">{meeting.title}</p><p className="text-xs text-muted-foreground">{formatMeetingDate(meeting.scheduled_at)}{meeting.location ? ` • ${meeting.location}` : ""}</p></div>{meetingItems.filter((item) => item.meeting_id === meeting.id && item.item_type !== "SECTION").map((item) => <div key={item.id} className="rounded-md bg-muted/40 p-2 text-sm"><p className="font-medium">{item.title}</p><p>{item.minutes || "No minutes recorded."}</p>{item.decision && <p className="mt-1 text-muted-foreground">Decision: {item.decision}</p>}</div>)}</div>)}</CardContent></Card>;
  }

  const canWrite = canManage || canRecordMinutes;
  return <>
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Meetings & minutes</CardTitle><CardDescription>Schedule meetings, record attendance, minutes, decisions and linked actions.</CardDescription></div>{canManage && activeTemplates.length > 0 && <Button size="sm" onClick={() => openMeeting()}><Plus className="mr-2 h-4 w-4" />Meeting</Button>}</CardHeader>
      <CardContent className="space-y-4">
        {meetings.length === 0 ? <p className="text-sm text-muted-foreground">No meetings scheduled.</p> : <>
          <div className="space-y-2"><Label>Meeting</Label><Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent>{meetings.map((meeting) => <SelectItem key={meeting.id} value={meeting.id}>{formatMeetingDate(meeting.scheduled_at)} — {meeting.title}</SelectItem>)}</SelectContent></Select></div>
          {selectedMeeting && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3"><div><p className="font-medium">{selectedMeeting.title}</p><p className="text-sm text-muted-foreground">{formatMeetingDate(selectedMeeting.scheduled_at)}{selectedMeeting.location ? ` • ${selectedMeeting.location}` : ""}</p></div><div className="flex items-center gap-2"><Badge>{selectedMeeting.status}</Badge>{canManage && selectedMeeting.status !== "COMPLETED" && <Button size="sm" variant="outline" onClick={() => void completeMeeting()}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</Button>}</div></div>}
          {selectedMeeting && <AttendancePanel profiles={committeeProfiles} profileName={profileName} draft={attendanceDraft} setDraft={setAttendanceDraft} disabled={!canWrite} saving={saving} onSave={saveAttendance} />}
          <div className="space-y-4">{selectedItems.map((item, index) => {
            if (item.item_type === "SECTION") return <div key={item.id} className="rounded-lg bg-muted px-4 py-3"><h3 className="font-semibold">{item.title}</h3>{item.agenda_notes && <p className="text-sm text-muted-foreground">{item.agenda_notes}</p>}</div>;
            const draft = minuteDrafts[item.id] || emptyMinuteDraft();
            return <fieldset key={item.id} className="space-y-3 rounded-lg border p-4"><legend className="px-1 font-semibold">{index + 1}. {item.title}</legend>{item.agenda_notes && <p className="text-sm text-muted-foreground">{item.agenda_notes}</p>}{item.include_open_actions && <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Select the open actions being reviewed in Linked Safety Hub records below.</p>}<div className="space-y-2"><Label>Minutes</Label><Textarea disabled={!canWrite} rows={4} value={draft.minutes} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, minutes: event.target.value } }))} /></div><div className="space-y-2"><Label>Decision</Label><Textarea disabled={!canWrite} value={draft.decision} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, decision: event.target.value } }))} /></div><div className="space-y-2"><Label>Resulting action</Label><Input disabled={!canWrite} value={draft.actionText} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, actionText: event.target.value } }))} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Action owner</Label><Select disabled={!canWrite} value={draft.actionOwnerId || "__none__"} onValueChange={(value) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, actionOwnerId: value === "__none__" ? "" : value } }))}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Unassigned</SelectItem>{profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profileName(profile.id)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Action due date</Label><Input disabled={!canWrite} type="date" value={draft.actionDueDate} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, actionDueDate: event.target.value } }))} /></div></div><SafetyLinks disabled={!canWrite} options={safetyLinkOptions} selected={draft.linkedRecordKeys} onChange={(linkedRecordKeys) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, linkedRecordKeys } }))} />{canWrite && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={saving} onClick={() => void saveMinutes(item)}><Save className="mr-2 h-4 w-4" />Save agenda point</Button><Button asChild size="sm" variant="outline"><Link to="/admin/safety-risk">Create Safety Hub record</Link></Button></div>}</fieldset>;
          })}</div>
        </>}
      </CardContent>
    </Card>
    <MeetingDialogs templates={activeTemplates} templateOpen={templateOpen} setTemplateOpen={setTemplateOpen} templateForm={templateForm} setTemplateForm={setTemplateForm} draftItems={draftItems} setDraftItems={setDraftItems} createTemplate={createTemplate} meetingOpen={meetingOpen} setMeetingOpen={setMeetingOpen} meetingForm={meetingForm} setMeetingForm={setMeetingForm} createMeeting={createMeeting} saving={saving} />
  </>;
}

function TemplateLibrary({ templates, templateItems, canManage, onCreate, onUse, onSetActive, dialogs }: { templates: AgendaTemplate[]; templateItems: AgendaTemplateItem[]; canManage: boolean; onCreate: () => void; onUse: (template: AgendaTemplate) => void; onSetActive: (template: AgendaTemplate, isActive: boolean) => void; dialogs: React.ReactNode }) {
  return <><Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Agenda templates</CardTitle><CardDescription>Reusable sections, agenda points, attendance and action review.</CardDescription></div>{canManage && <Button size="sm" onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Template</Button>}</CardHeader><CardContent className="grid gap-3 lg:grid-cols-2">{templates.length === 0 ? <p className="text-sm text-muted-foreground">No agenda templates created.</p> : templates.map((template) => <div key={template.id} className={`space-y-2 rounded-lg border p-3 ${template.is_active ? "" : "opacity-65"}`}><div className="flex items-center justify-between gap-2"><p className="font-medium">{template.title}</p><Badge variant={template.is_active ? "secondary" : "outline"}>{template.is_active ? "Active" : "Archived"}</Badge></div><p className="text-sm text-muted-foreground">{template.description || "No description"}</p><p className="text-xs text-muted-foreground">{templateItems.filter((item) => item.template_id === template.id).length} section/point(s)</p>{canManage && <div className="flex flex-wrap gap-2">{template.is_active && <Button size="sm" variant="outline" onClick={() => onUse(template)}>Use for meeting</Button>}<Button size="sm" variant="ghost" onClick={() => void onSetActive(template, !template.is_active)}>{template.is_active ? <Archive className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}{template.is_active ? "Archive" : "Restore"}</Button></div>}</div>)}</CardContent></Card>{dialogs}</>;
}

function MeetingCalendar({ month, setMonth, meetings, canManage, onCreate }: { month: Date; setMonth: React.Dispatch<React.SetStateAction<Date>>; meetings: Meeting[]; canManage: boolean; onCreate: () => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(month);
  return <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Meeting calendar</CardTitle><CardDescription>Upcoming and past committee meetings.</CardDescription></div>{canManage && <Button size="sm" onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Schedule meeting</Button>}</CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between"><Button size="icon" variant="outline" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button><p className="font-semibold">{monthLabel}</p><Button size="icon" variant="outline" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button></div><div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border"><>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="bg-muted p-2 text-center text-xs font-medium">{day}</div>)}</>{days.map((day) => { const dayMeetings = meetings.filter((meeting) => dateKey(meeting.scheduled_at) === dateKey(day)); const inMonth = day.getMonth() === month.getMonth(); return <div key={day.toISOString()} className={`min-h-24 bg-background p-1.5 ${inMonth ? "" : "text-muted-foreground/50"}`}><p className="text-xs font-medium">{day.getDate()}</p><div className="mt-1 space-y-1">{dayMeetings.map((meeting) => <div key={meeting.id} className="rounded bg-primary/10 px-1.5 py-1 text-[11px] text-primary"><p className="truncate font-medium">{meeting.title}</p><p>{new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" }).format(new Date(meeting.scheduled_at))}</p></div>)}</div></div>; })}</div></CardContent></Card>;
}

function AttendancePanel({ profiles, profileName, draft, setDraft, disabled, saving, onSave }: { profiles: Array<{ id: string }>; profileName: (id: string) => string; draft: { attendeeIds: string[]; apologyIds: string[] }; setDraft: React.Dispatch<React.SetStateAction<{ attendeeIds: string[]; apologyIds: string[] }>>; disabled: boolean; saving: boolean; onSave: () => void }) {
  const toggle = (kind: "attendeeIds" | "apologyIds", id: string, checked: boolean) => setDraft((current) => ({ ...current, [kind]: checked ? [...current[kind], id] : current[kind].filter((value) => value !== id), [kind === "attendeeIds" ? "apologyIds" : "attendeeIds"]: checked ? current[kind === "attendeeIds" ? "apologyIds" : "attendeeIds"].filter((value) => value !== id) : current[kind === "attendeeIds" ? "apologyIds" : "attendeeIds"] }));
  return <div className="space-y-3 rounded-lg border p-3"><div><p className="font-medium">Attendance & apologies</p><p className="text-xs text-muted-foreground">Record who attended and who sent an apology.</p></div><div className="grid gap-2 md:grid-cols-2">{profiles.map((profile) => <div key={profile.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md bg-muted/40 p-2 text-sm"><span className="truncate">{profileName(profile.id)}</span><label className="flex items-center gap-1"><Checkbox disabled={disabled} checked={draft.attendeeIds.includes(profile.id)} onCheckedChange={(checked) => toggle("attendeeIds", profile.id, checked === true)} />Attended</label><label className="flex items-center gap-1"><Checkbox disabled={disabled} checked={draft.apologyIds.includes(profile.id)} onCheckedChange={(checked) => toggle("apologyIds", profile.id, checked === true)} />Apology</label></div>)}</div>{!disabled && <Button size="sm" variant="outline" disabled={saving} onClick={() => void onSave()}><Save className="mr-2 h-4 w-4" />Save attendance</Button>}</div>;
}

function SafetyLinks({ disabled, options, selected, onChange }: { disabled: boolean; options: SafetyLinkOption[]; selected: string[]; onChange: (keys: string[]) => void }) {
  const available = options.filter((option) => !selected.includes(option.key));
  return <div className="space-y-2"><Label>Linked Safety Hub records</Label><div className="flex flex-wrap gap-1">{selected.map((key) => { const option = options.find((item) => item.key === key); return <Badge key={key} variant="secondary" className="gap-1">{option?.label || key}{!disabled && <button type="button" aria-label={`Remove ${option?.label || key}`} onClick={() => onChange(selected.filter((item) => item !== key))}><X className="h-3 w-3" /></button>}</Badge>; })}</div><Select disabled={disabled || available.length === 0} value="__none__" onValueChange={(value) => value !== "__none__" && onChange([...selected, value])}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Add a linked record" /></SelectTrigger><SelectContent><SelectItem value="__none__">Add a linked record</SelectItem>{available.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function MeetingDialogs({ templates, templateOpen, setTemplateOpen, templateForm, setTemplateForm, draftItems, setDraftItems, createTemplate, meetingOpen, setMeetingOpen, meetingForm, setMeetingForm, createMeeting, saving }: { templates: AgendaTemplate[]; templateOpen: boolean; setTemplateOpen: (open: boolean) => void; templateForm: { title: string; description: string }; setTemplateForm: React.Dispatch<React.SetStateAction<{ title: string; description: string }>>; draftItems: DraftAgendaItem[]; setDraftItems: React.Dispatch<React.SetStateAction<DraftAgendaItem[]>>; createTemplate: () => void; meetingOpen: boolean; setMeetingOpen: (open: boolean) => void; meetingForm: { templateId: string; title: string; scheduledAt: string; location: string }; setMeetingForm: React.Dispatch<React.SetStateAction<{ templateId: string; title: string; scheduledAt: string; location: string }>>; createMeeting: () => void; saving: boolean }) {
  const moveItem = (index: number, direction: -1 | 1) => setDraftItems((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  return <>
    <Dialog open={templateOpen} onOpenChange={setTemplateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Create agenda template</DialogTitle><DialogDescription>Add reorderable sections and points. Attendance and apologies are included in every meeting.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Template header</Label><Input value={templateForm.title} onChange={(event) => setTemplateForm((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2"><Label>Description</Label><Textarea value={templateForm.description} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} /></div><div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><Label>Sections and agenda points</Label><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setDraftItems((current) => [...current, newAgendaItem("SECTION")])}><Plus className="mr-2 h-4 w-4" />Section</Button><Button size="sm" variant="outline" onClick={() => setDraftItems((current) => [...current, newAgendaItem()])}><Plus className="mr-2 h-4 w-4" />Point</Button></div></div>{draftItems.map((item, index) => <div key={item.localId} className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><Badge variant="outline">{item.itemType === "SECTION" ? "Section" : `Point ${index + 1}`}</Badge><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => moveItem(index, -1)}><ChevronLeft className="h-4 w-4 rotate-90" /></Button><Button size="icon" variant="ghost" aria-label="Move down" disabled={index === draftItems.length - 1} onClick={() => moveItem(index, 1)}><ChevronRight className="h-4 w-4 rotate-90" /></Button>{draftItems.length > 1 && <Button size="icon" variant="ghost" aria-label={`Remove ${item.title || "agenda item"}`} onClick={() => setDraftItems((current) => current.filter((draft) => draft.localId !== item.localId))}><X className="h-4 w-4" /></Button>}</div></div><Input placeholder={item.itemType === "SECTION" ? "Section title" : "Agenda point title"} value={item.title} onChange={(event) => setDraftItems((current) => current.map((draft) => draft.localId === item.localId ? { ...draft, title: event.target.value } : draft))} />{item.itemType === "POINT" && <><Textarea placeholder="Prompt shown beside the minutes" value={item.notesPrompt} onChange={(event) => setDraftItems((current) => current.map((draft) => draft.localId === item.localId ? { ...draft, notesPrompt: event.target.value } : draft))} /><Input placeholder="Usual presenter (optional)" value={item.presenter} onChange={(event) => setDraftItems((current) => current.map((draft) => draft.localId === item.localId ? { ...draft, presenter: event.target.value } : draft))} /><label className="flex items-center gap-2 text-sm"><Checkbox checked={item.includeOpenActions} onCheckedChange={(checked) => setDraftItems((current) => current.map((draft) => draft.localId === item.localId ? { ...draft, includeOpenActions: checked === true } : draft))} />Review selected open actions</label></>}</div>)}</div></div><DialogFooter><Button variant="outline" onClick={() => setTemplateOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void createTemplate()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create template</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}><DialogContent><DialogHeader><DialogTitle>Schedule committee meeting</DialogTitle><DialogDescription>The selected template becomes the agenda with blank minute spaces.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Agenda template</Label><Select value={meetingForm.templateId} onValueChange={(templateId) => setMeetingForm((current) => ({ ...current, templateId }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Meeting title</Label><Input value={meetingForm.title} onChange={(event) => setMeetingForm((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2"><Label>Date and time</Label><Input type="datetime-local" value={meetingForm.scheduledAt} onChange={(event) => setMeetingForm((current) => ({ ...current, scheduledAt: event.target.value }))} /></div><div className="space-y-2"><Label>Location or meeting link</Label><Input value={meetingForm.location} onChange={(event) => setMeetingForm((current) => ({ ...current, location: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setMeetingOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void createMeeting()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Schedule meeting</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
