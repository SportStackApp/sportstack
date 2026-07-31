import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Activity = Tables<"committee_activity_log">;

const formatActivityTime = (value: string) => new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Melbourne",
}).format(new Date(value));

export function CommitteeActivity({ committeeId, profiles }: { committeeId: string; profiles: Array<{ id: string; first_name: string | null; last_name: string | null }> }) {
  const { toast } = useToast();
  const [events, setEvents] = useState<Activity[]>([]);

  const loadActivity = useCallback(async () => {
    const { data, error } = await supabase.from("committee_activity_log").select("*").eq("committee_id", committeeId).order("created_at", { ascending: false }).limit(250);
    if (error) toast({ title: "Committee history unavailable", description: error.message, variant: "destructive" });
    else setEvents(data || []);
  }, [committeeId, toast]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const actorName = (actorId: string | null) => {
    const profile = profiles.find((item) => item.id === actorId);
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "System";
  };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Committee activity</CardTitle><CardDescription>Append-only history for setup, polls, meetings, minutes and chat.</CardDescription></CardHeader><CardContent className="space-y-2">{events.length === 0 ? <p className="text-sm text-muted-foreground">No committee activity recorded.</p> : events.map((event) => <div key={event.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{event.action} {event.record_type.replaceAll("_", " ")}</p><p className="text-sm text-muted-foreground">{event.record_title || event.record_id || "Record"}</p></div><div className="text-right text-xs text-muted-foreground"><p>{actorName(event.actor_id)}</p><p>{formatActivityTime(event.created_at)}</p></div></div>)}</CardContent></Card>;
}
