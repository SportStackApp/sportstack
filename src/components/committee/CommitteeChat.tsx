import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type CommitteeMessage = Tables<"committee_messages">;

const formatMessageTime = (value: string) => new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Melbourne",
}).format(new Date(value));

export function CommitteeChat({ committeeId, canChat, profiles }: { committeeId: string; canChat: boolean; profiles: Array<{ id: string; first_name: string | null; last_name: string | null }> }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<CommitteeMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const profileName = (userId: string) => {
    const profile = profiles.find((item) => item.id === userId);
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Committee member";
  };

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase.from("committee_messages").select("*").eq("committee_id", committeeId).order("created_at").limit(250);
    if (error) {
      toast({ title: "Committee chat unavailable", description: error.message, variant: "destructive" });
      setMessages([]);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [committeeId, toast]);

  useEffect(() => {
    setLoading(true);
    void loadMessages();
    const channel = supabase
      .channel(`committee-chat:${committeeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_messages", filter: `committee_id=eq.${committeeId}` }, () => void loadMessages())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [committeeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const sendMessage = async () => {
    if (!user || !body.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.from("committee_messages").insert({
      committee_id: committeeId,
      user_id: user.id,
      body: body.trim(),
    });
    if (error) {
      toast({ title: "Message not sent", description: error.message, variant: "destructive" });
    } else {
      setBody("");
      await loadMessages();
    }
    setSending(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Private committee chat</CardTitle>
        <CardDescription>Only current committee members can read this conversation. Posting also needs the Chat position permission.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[34rem] space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading chat…</p> : messages.length === 0 ? <p className="text-sm text-muted-foreground">No committee messages yet.</p> : messages.map((message) => (
            <div key={message.id} className={`max-w-[88%] rounded-lg p-3 ${message.user_id === user?.id ? "ml-auto bg-primary text-primary-foreground" : "bg-background"}`}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs opacity-80"><span>{profileName(message.user_id)}</span><span>{formatMessageTime(message.created_at)}</span></div>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {canChat ? <div className="space-y-2"><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write to current committee members" maxLength={4000} /><div className="flex justify-end"><Button disabled={sending || !body.trim()} onClick={() => void sendMessage()}>{sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send</Button></div></div> : <p className="text-sm text-muted-foreground">Your current position can read committee records but does not include Chat permission.</p>}
      </CardContent>
    </Card>
  );
}
