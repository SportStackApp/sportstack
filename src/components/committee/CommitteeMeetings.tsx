import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AgendaTemplate = Tables<"committee_agenda_templates">;
type AgendaTemplateItem = Tables<"committee_agenda_template_items">;
type Meeting = Tables<"committee_meetings">;
type MeetingItem = Tables<"committee_meeting_items">;

interface DraftAgendaItem {
  localId: string;
  title: string;
  notesPrompt: string;
  presenter: string;
}

interface MinuteDraft {
  minutes: string;
  decision: string;
  actionText: string;
  actionOwnerId: string;
  actionDueDate: string;
}

const newAgendaItem = (): DraftAgendaItem => ({ localId: crypto.randomUUID(), title: "", notesPrompt: "", presenter: "" });

const formatMeetingDate = (value: string) => new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Melbourne",
}).format(new Date(value));

export function CommitteeMeetings({ committeeId, canManage, canRecordMinutes, profiles }: { committeeId: string; canManage: boolean; canRecordMinutes: boolean; profiles: Array<{ id: string; first_name: string | null; last_name: string | null }> }) {
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

  const profileName = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unassigned";
  };

  const loadMeetings = useCallback(async () => {
    const [templateResult, templateItemResult, meetingResult, meetingItemResult] = await Promise.all([
      supabase.from("committee_agenda_templates").select("*").eq("committee_id", committeeId).eq("is_active", true).order("title"),
      supabase.from("committee_agenda_template_items").select("*").order("sort_order"),
      supabase.from("committee_meetings").select("*").eq("committee_id", committeeId).order("scheduled_at", { ascending: false }),
      supabase.from("committee_meeting_items").select("*").order("sort_order"),
    ]);
    const failure = [templateResult, templateItemResult, meetingResult, meetingItemResult].find((result) => result.error)?.error;
    if (failure) {
      toast({ title: "Committee meetings unavailable", description: failure.message, variant: "destructive" });
      return;
    }
    const loadedTemplates = templateResult.data || [];
    const loadedMeetings = meetingResult.data || [];
    const templateIds = new Set(loadedTemplates.map((template) => template.id));
    const meetingIds = new Set(loadedMeetings.map((meeting) => meeting.id));
    setTemplates(loadedTemplates);
    setTemplateItems((templateItemResult.data || []).filter((item) => templateIds.has(item.template_id)));
    setMeetings(loadedMeetings);
    const loadedItems = (meetingItemResult.data || []).filter((item) => meetingIds.has(item.meeting_id));
    setMeetingItems(loadedItems);
    setSelectedMeetingId((current) => current && meetingIds.has(current) ? current : loadedMeetings[0]?.id || "");
    setMinuteDrafts(Object.fromEntries(loadedItems.map((item) => [item.id, {
      minutes: item.minutes || "",
      decision: item.decision || "",
      actionText: item.action_text || "",
      actionOwnerId: item.action_owner_id || "",
      actionDueDate: item.action_due_date || "",
    }])));
  }, [committeeId, toast]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId);
  const selectedItems = useMemo(
    () => meetingItems.filter((item) => item.meeting_id === selectedMeetingId).sort((left, right) => left.sort_order - right.sort_order),
    [meetingItems, selectedMeetingId],
  );

  const openTemplate = () => {
    setTemplateForm({ title: "", description: "" });
    setDraftItems([newAgendaItem()]);
    setTemplateOpen(true);
  };

  const createTemplate = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("create_committee_agenda_template", {
      p_committee_id: committeeId,
      p_title: templateForm.title,
      p_description: templateForm.description,
      p_items: draftItems.map((item) => ({ title: item.title, notes_prompt: item.notesPrompt, presenter: item.presenter })),
    });
    if (error) {
      toast({ title: "Agenda template not created", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agenda template created" });
      setTemplateOpen(false);
      await loadMeetings();
    }
    setSaving(false);
  };

  const openMeeting = (template?: AgendaTemplate) => {
    setMeetingForm({
      templateId: template?.id || templates[0]?.id || "",
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
    if (error) {
      toast({ title: "Meeting not created", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Meeting created from template" });
      setMeetingOpen(false);
      await loadMeetings();
      setSelectedMeetingId(data);
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
    }).eq("id", item.id);
    if (error) {
      toast({ title: "Minutes not saved", description: error.message, variant: "destructive" });
    } else {
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div><CardTitle>Agenda templates</CardTitle><CardDescription>Reusable agenda points with prompts for the minutes.</CardDescription></div>
          {canManage && <Button size="sm" onClick={openTemplate}><Plus className="mr-2 h-4 w-4" />Template</Button>}
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {templates.length === 0 ? <p className="text-sm text-muted-foreground">No agenda templates created.</p> : templates.map((template) => (
            <div key={template.id} className="space-y-2 rounded-lg border p-3">
              <p className="font-medium">{template.title}</p>
              <p className="text-sm text-muted-foreground">{template.description || "No description"}</p>
              <p className="text-xs text-muted-foreground">{templateItems.filter((item) => item.template_id === template.id).length} agenda point(s)</p>
              {canManage && <Button size="sm" variant="outline" onClick={() => openMeeting(template)}>Use for meeting</Button>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div><CardTitle>Meetings & minutes</CardTitle><CardDescription>Each agenda point has its own minutes, decision and action fields.</CardDescription></div>
          {canManage && templates.length > 0 && <Button size="sm" onClick={() => openMeeting()}><Plus className="mr-2 h-4 w-4" />Meeting</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          {meetings.length === 0 ? <p className="text-sm text-muted-foreground">No meetings created.</p> : <>
            <div className="space-y-2"><Label>Meeting</Label><Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent>{meetings.map((meeting) => <SelectItem key={meeting.id} value={meeting.id}>{formatMeetingDate(meeting.scheduled_at)} — {meeting.title}</SelectItem>)}</SelectContent></Select></div>
            {selectedMeeting && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3"><div><p className="font-medium">{selectedMeeting.title}</p><p className="text-sm text-muted-foreground">{formatMeetingDate(selectedMeeting.scheduled_at)}{selectedMeeting.location ? ` • ${selectedMeeting.location}` : ""}</p></div><div className="flex items-center gap-2"><Badge>{selectedMeeting.status}</Badge>{canManage && selectedMeeting.status !== "COMPLETED" && <Button size="sm" variant="outline" onClick={() => void completeMeeting()}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</Button>}</div></div>}
            <div className="space-y-4">{selectedItems.map((item, index) => {
              const draft = minuteDrafts[item.id] || { minutes: "", decision: "", actionText: "", actionOwnerId: "", actionDueDate: "" };
              const canWrite = canManage || canRecordMinutes;
              return <fieldset key={item.id} className="space-y-3 rounded-lg border p-4"><legend className="px-1 font-semibold">{index + 1}. {item.title}</legend>{item.agenda_notes && <p className="text-sm text-muted-foreground">{item.agenda_notes}</p>}<div className="space-y-2"><Label>Minutes</Label><Textarea disabled={!canWrite} rows={4} value={draft.minutes} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, minutes: event.target.value } }))} /></div><div className="space-y-2"><Label>Decision</Label><Textarea disabled={!canWrite} value={draft.decision} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, decision: event.target.value } }))} /></div><div className="space-y-2"><Label>Assigned action</Label><Input disabled={!canWrite} value={draft.actionText} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, actionText: event.target.value } }))} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Action owner</Label><Select disabled={!canWrite} value={draft.actionOwnerId || "__none__"} onValueChange={(actionOwnerId) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, actionOwnerId: actionOwnerId === "__none__" ? "" : actionOwnerId } }))}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Unassigned</SelectItem>{profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profileName(profile.id)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Action due date</Label><Input disabled={!canWrite} type="date" value={draft.actionDueDate} onChange={(event) => setMinuteDrafts((current) => ({ ...current, [item.id]: { ...draft, actionDueDate: event.target.value } }))} /></div></div>{canWrite && <Button size="sm" disabled={saving} onClick={() => void saveMinutes(item)}><Save className="mr-2 h-4 w-4" />Save agenda point</Button>}</fieldset>;
            })}</div>
          </>}
        </CardContent>
      </Card>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Create agenda template</DialogTitle><DialogDescription>Build the reusable order once, then create meetings from it.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Template title</Label><Input value={templateForm.title} onChange={(event) => setTemplateForm((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2"><Label>Description</Label><Textarea value={templateForm.description} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} /></div><div className="space-y-3"><div className="flex items-center justify-between"><Label>Agenda points</Label><Button size="sm" variant="outline" onClick={() => setDraftItems((current) => [...current, newAgendaItem()])}><Plus className="mr-2 h-4 w-4" />Point</Button></div>{draftItems.map((item, index) => <div key={item.localId} className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Point {index + 1}</p>{draftItems.length > 1 && <Button size="icon" variant="ghost" aria-label={`Remove agenda point ${index + 1}`} onClick={() => setDraftItems((current) => current.filter((draft) => draft.localId !== item.localId))}><X className="h-4 w-4" /></Button>}</div><Input placeholder="Agenda point title" value={item.title} onChange={(event) => setDraftItems((current) => current.map((draft) => draft.localId === item.localId ? { ...draft, title: event.target.value } : draft))} /><Textarea placeholder="Prompt shown beside the minutes" value={item.notesPrompt} onChange={(event) => setDraftItems((current) => current.map((draft) => draft.localId === item.localId ? { ...draft, notesPrompt: event.target.value } : draft))} /><Input placeholder="Usual presenter (optional)" value={item.presenter} onChange={(event) => setDraftItems((current) => current.map((draft) => draft.localId === item.localId ? { ...draft, presenter: event.target.value } : draft))} /></div>)}</div></div><DialogFooter><Button variant="outline" onClick={() => setTemplateOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void createTemplate()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create template</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}><DialogContent><DialogHeader><DialogTitle>Create meeting from template</DialogTitle><DialogDescription>The agenda points are copied with blank spaces ready for minutes.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Agenda template</Label><Select value={meetingForm.templateId} onValueChange={(templateId) => setMeetingForm((current) => ({ ...current, templateId }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Meeting title</Label><Input value={meetingForm.title} onChange={(event) => setMeetingForm((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2"><Label>Date and time</Label><Input type="datetime-local" value={meetingForm.scheduledAt} onChange={(event) => setMeetingForm((current) => ({ ...current, scheduledAt: event.target.value }))} /></div><div className="space-y-2"><Label>Location or meeting link</Label><Input value={meetingForm.location} onChange={(event) => setMeetingForm((current) => ({ ...current, location: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setMeetingOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void createMeeting()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create meeting</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
