import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

type Poll = Tables<"committee_polls">;
type PollQuestion = Tables<"committee_poll_questions">;
type PollResponse = Tables<"committee_poll_responses">;
type QuestionType = "FREE_TEXT" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "YES_NO_ABSTAIN";

interface DraftQuestion {
  localId: string;
  prompt: string;
  questionType: QuestionType;
  optionsText: string;
}

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: "FREE_TEXT", label: "Free text" },
  { value: "SINGLE_CHOICE", label: "Choose one" },
  { value: "MULTIPLE_CHOICE", label: "Choose multiple" },
  { value: "YES_NO_ABSTAIN", label: "Yes / No / Abstain" },
];

const newQuestion = (): DraftQuestion => ({
  localId: crypto.randomUUID(),
  prompt: "",
  questionType: "YES_NO_ABSTAIN",
  optionsText: "",
});

const stringOptions = (value: Json): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function CommitteePolls({ committeeId, canManage, canVote }: { committeeId: string; canManage: boolean; canVote: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [questions, setQuestions] = useState<PollQuestion[]>([]);
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pollForm, setPollForm] = useState({ title: "", description: "", closesAt: "", status: "OPEN" });
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const loadPolls = useCallback(async () => {
    setLoading(true);
    const [pollResult, questionResult, responseResult] = await Promise.all([
      supabase.from("committee_polls").select("*").eq("committee_id", committeeId).order("created_at", { ascending: false }),
      supabase.from("committee_poll_questions").select("*").order("sort_order"),
      supabase.from("committee_poll_responses").select("*").order("submitted_at", { ascending: false }),
    ]);
    const failure = [pollResult, questionResult, responseResult].find((result) => result.error)?.error;
    if (failure) {
      toast({ title: "Committee polls unavailable", description: failure.message, variant: "destructive" });
    } else {
      const loadedPolls = pollResult.data || [];
      const pollIds = new Set(loadedPolls.map((poll) => poll.id));
      setPolls(loadedPolls);
      setQuestions((questionResult.data || []).filter((question) => pollIds.has(question.poll_id)));
      setResponses((responseResult.data || []).filter((response) => pollIds.has(response.poll_id)));
    }
    setLoading(false);
  }, [committeeId, toast]);

  useEffect(() => {
    void loadPolls();
  }, [loadPolls]);

  const questionsByPoll = useMemo(() => {
    const map = new Map<string, PollQuestion[]>();
    questions.forEach((question) => map.set(question.poll_id, [...(map.get(question.poll_id) || []), question]));
    return map;
  }, [questions]);

  const responseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    responses.forEach((response) => counts.set(response.poll_id, (counts.get(response.poll_id) || 0) + 1));
    return counts;
  }, [responses]);

  const openCreate = () => {
    setPollForm({ title: "", description: "", closesAt: "", status: "OPEN" });
    setDraftQuestions([newQuestion()]);
    setCreateOpen(true);
  };

  const createPoll = async () => {
    if (!pollForm.title.trim()) return;
    setSaving(true);
    const payload = draftQuestions.map((question) => ({
      prompt: question.prompt.trim(),
      question_type: question.questionType,
      options: question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTIPLE_CHOICE"
        ? question.optionsText.split("\n").map((option) => option.trim()).filter(Boolean)
        : [],
    }));
    const { error } = await supabase.rpc("create_committee_poll", {
      p_committee_id: committeeId,
      p_title: pollForm.title,
      p_description: pollForm.description,
      // The SQL function accepts null; generated Supabase RPC types model it as a string.
      p_closes_at: (pollForm.closesAt ? new Date(pollForm.closesAt).toISOString() : null) as string,
      p_status: pollForm.status,
      p_questions: payload,
    });
    if (error) {
      toast({ title: "Poll not created", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pollForm.status === "OPEN" ? "Committee poll opened" : "Committee poll saved as draft" });
      setCreateOpen(false);
      await loadPolls();
    }
    setSaving(false);
  };

  const updatePollStatus = async (pollId: string, status: "OPEN" | "CLOSED") => {
    const { error } = await supabase.from("committee_polls").update({ status }).eq("id", pollId);
    if (error) {
      toast({ title: "Poll status not changed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "OPEN" ? "Poll opened" : "Poll closed" });
      await loadPolls();
    }
  };

  const setSingleAnswer = (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const toggleMultipleAnswer = (questionId: string, value: string, checked: boolean) => {
    setAnswers((current) => {
      const selected = Array.isArray(current[questionId]) ? current[questionId] as string[] : [];
      return {
        ...current,
        [questionId]: checked ? [...new Set([...selected, value])] : selected.filter((item) => item !== value),
      };
    });
  };

  const submitPoll = async (poll: Poll) => {
    const pollQuestions = questionsByPoll.get(poll.id) || [];
    setSaving(true);
    const payload = pollQuestions.map((question) => {
      const answer = answers[question.id];
      return {
        question_id: question.id,
        free_text: question.question_type === "FREE_TEXT" && typeof answer === "string" ? answer : null,
        selected_options: question.question_type === "FREE_TEXT"
          ? []
          : Array.isArray(answer)
            ? answer
            : answer
              ? [answer]
              : [],
      };
    });
    const { error } = await supabase.rpc("submit_committee_poll_response", { p_poll_id: poll.id, p_answers: payload });
    if (error) {
      toast({ title: "Vote not submitted", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Committee vote submitted", description: "Your complete response was saved once." });
      setAnswers({});
      await loadPolls();
    }
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading committee polls…</p>;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div><CardTitle>Committee polls</CardTitle><CardDescription>Free text, choose one, choose multiple, or Yes / No / Abstain.</CardDescription></div>
          {canManage && <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Poll</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          {polls.length === 0 ? <p className="text-sm text-muted-foreground">No committee polls created.</p> : polls.map((poll) => {
            const pollQuestions = questionsByPoll.get(poll.id) || [];
            const hasResponded = responses.some((response) => response.poll_id === poll.id && response.user_id === user?.id);
            const isOpen = poll.status === "OPEN" && (!poll.closes_at || new Date(poll.closes_at) > new Date());
            return (
              <div key={poll.id} className="space-y-4 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{poll.title}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{poll.description || "No additional information."}</p></div>
                  <div className="flex items-center gap-2"><Badge variant={isOpen ? "default" : "secondary"}>{poll.status}</Badge>{canManage && <Badge variant="outline">{responseCounts.get(poll.id) || 0} response(s)</Badge>}</div>
                </div>
                {hasResponded ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Your response has been submitted.</div>
                ) : isOpen && canVote ? (
                  <div className="space-y-4">
                    {pollQuestions.map((question, index) => <PollQuestionField key={question.id} question={question} index={index} value={answers[question.id]} onSingle={setSingleAnswer} onMultiple={toggleMultipleAnswer} />)}
                    <Button disabled={saving} onClick={() => void submitPoll(poll)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit complete response</Button>
                  </div>
                ) : !canVote && isOpen ? <p className="text-sm text-muted-foreground">Your committee position does not include voting permission.</p> : null}
                {canManage && <div className="flex gap-2">{poll.status !== "OPEN" && <Button size="sm" variant="outline" onClick={() => void updatePollStatus(poll.id, "OPEN")}>Open</Button>}{poll.status !== "CLOSED" && <Button size="sm" variant="outline" onClick={() => void updatePollStatus(poll.id, "CLOSED")}>Close</Button>}</div>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Create committee poll</DialogTitle><DialogDescription>Add a title, supporting text and one or more questions.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Poll title</Label><Input value={pollForm.title} onChange={(event) => setPollForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Information shown under the title</Label><Textarea value={pollForm.description} onChange={(event) => setPollForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Closes (optional)</Label><Input type="datetime-local" value={pollForm.closesAt} onChange={(event) => setPollForm((current) => ({ ...current, closesAt: event.target.value }))} /></div><div className="space-y-2"><Label>Initial status</Label><Select value={pollForm.status} onValueChange={(status) => setPollForm((current) => ({ ...current, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open now</SelectItem><SelectItem value="DRAFT">Draft</SelectItem></SelectContent></Select></div></div>
            <div className="space-y-3"><div className="flex items-center justify-between"><Label>Questions</Label><Button size="sm" variant="outline" onClick={() => setDraftQuestions((current) => [...current, newQuestion()])}><Plus className="mr-2 h-4 w-4" />Question</Button></div>{draftQuestions.map((question, index) => <div key={question.localId} className="space-y-3 rounded-lg border p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Question {index + 1}</p>{draftQuestions.length > 1 && <Button size="icon" variant="ghost" aria-label={`Remove question ${index + 1}`} onClick={() => setDraftQuestions((current) => current.filter((item) => item.localId !== question.localId))}><X className="h-4 w-4" /></Button>}</div><Input placeholder="Question text" value={question.prompt} onChange={(event) => setDraftQuestions((current) => current.map((item) => item.localId === question.localId ? { ...item, prompt: event.target.value } : item))} /><Select value={question.questionType} onValueChange={(questionType) => setDraftQuestions((current) => current.map((item) => item.localId === question.localId ? { ...item, questionType: questionType as QuestionType } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{QUESTION_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select>{(question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTIPLE_CHOICE") && <Textarea placeholder="One option per line" value={question.optionsText} onChange={(event) => setDraftQuestions((current) => current.map((item) => item.localId === question.localId ? { ...item, optionsText: event.target.value } : item))} />}</div>)}</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void createPoll()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create poll</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PollQuestionField({ question, index, value, onSingle, onMultiple }: { question: PollQuestion; index: number; value: string | string[] | undefined; onSingle: (questionId: string, value: string) => void; onMultiple: (questionId: string, value: string, checked: boolean) => void }) {
  const options = stringOptions(question.options);
  return <fieldset className="space-y-3 rounded-lg bg-muted/40 p-3"><legend className="font-medium">{index + 1}. {question.prompt}</legend>{question.question_type === "FREE_TEXT" ? <Textarea value={typeof value === "string" ? value : ""} onChange={(event) => onSingle(question.id, event.target.value)} placeholder="Enter your response" /> : question.question_type === "MULTIPLE_CHOICE" ? <div className="space-y-2">{options.map((option) => <label key={option} className="flex items-center gap-2 text-sm"><Checkbox checked={Array.isArray(value) && value.includes(option)} onCheckedChange={(checked) => onMultiple(question.id, option, checked === true)} />{option}</label>)}</div> : <RadioGroup value={typeof value === "string" ? value : ""} onValueChange={(answer) => onSingle(question.id, answer)}>{options.map((option) => <label key={option} className="flex items-center gap-2 text-sm"><RadioGroupItem value={option} />{option}</label>)}</RadioGroup>}</fieldset>;
}
