import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AtSign,
  CornerUpLeft,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CommunicationSettingsDialog,
  type CommunicationTab,
} from "@/components/communications/CommunicationSettingsDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const database = supabase;
const REACTIONS = ["👍", "❤️", "😊", "🎉"] as const;

interface CommunicationMessage {
  id: string;
  channel_id: string;
  message_type: "CHAT" | "BROADCAST";
  author_id: string;
  content: string;
  reply_to_id: string | null;
  is_important: boolean;
  edited_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  moderation_reason: string | null;
  created_at: string;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface Member {
  id: string;
  name: string;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface MembershipRow {
  user_id: string;
}

type ChannelMap = Record<CommunicationTab, string | null>;
type UnreadMap = Record<CommunicationTab, number>;

const defaultChannels: ChannelMap = { team: null, club: null, association: null };
const defaultUnread: UnreadMap = { team: 0, club: 0, association: 0 };

const formatTime = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
};

const Chat = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as CommunicationTab | null;
  const targetMessageId = searchParams.get("message");
  const [tab, setTab] = useState<CommunicationTab>(
    requestedTab && ["team", "club", "association"].includes(requestedTab) ? requestedTab : "team",
  );
  const { user } = useAuth();
  const {
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
    selectedAssociation,
    selectedClub,
    selectedTeam,
  } = useTeamContext();
  const { toast } = useToast();
  const { isSuperAdmin, canManageAssociation, canManageClub, canManageTeam } = useAdminScope();
  const [channels, setChannels] = useState<ChannelMap>(defaultChannels);
  const [unread, setUnread] = useState<UnreadMap>(defaultUnread);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownPermission, setOwnPermission] = useState<{ can_publish: boolean; can_moderate: boolean } | null>(null);
  const [composer, setComposer] = useState("");
  const [replyTo, setReplyTo] = useState<CommunicationMessage | null>(null);
  const [editing, setEditing] = useState<CommunicationMessage | null>(null);
  const [important, setImportant] = useState(false);
  const [pendingMentions, setPendingMentions] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moderating, setModerating] = useState<CommunicationMessage | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channelId = channels[tab];
  const canAdminister = isSuperAdmin || (
    tab === "association"
      ? Boolean(selectedAssociationId && canManageAssociation(selectedAssociationId))
      : Boolean(selectedClubId && canManageClub(selectedClubId))
  );
  const canPublish = tab === "team" || canAdminister || Boolean(ownPermission?.can_publish);
  const canModerate = canAdminister || Boolean(ownPermission?.can_moderate);
  const canOpenSettings = tab === "team"
    ? Boolean(selectedTeamId && canManageTeam(selectedTeamId)) || canAdminister
    : canAdminister;

  const scopeLabel = tab === "team"
    ? selectedTeam?.name || "Select a team"
    : tab === "club"
      ? selectedClub?.name || "Select a club"
      : selectedAssociation?.name || "Select an association";
  const audienceLabel = tab === "team"
    ? `Active members with access to ${scopeLabel} Team Chat`
    : `Members with access to ${scopeLabel} ${tab === "club" ? "Club Updates" : "Association Updates"}`;

  useEffect(() => {
    if (requestedTab && ["team", "club", "association"].includes(requestedTab)) setTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    if (!user) return;
    const loadChannels = async () => {
      setLoadError(false);
      const requests = [
        selectedTeamId
          ? database.from("communication_channels").select("id").eq("team_id", selectedTeamId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        selectedClubId
          ? database.from("communication_channels").select("id").eq("club_id", selectedClubId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        selectedAssociationId
          ? database.from("communication_channels").select("id").eq("association_id", selectedAssociationId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ];
      const [teamResult, clubResult, associationResult] = await Promise.all(requests);
      if (teamResult.error || clubResult.error || associationResult.error) {
        setChannels(defaultChannels);
        setUnread(defaultUnread);
        setLoadError(true);
        return;
      }
      const nextChannels: ChannelMap = {
        team: teamResult.data?.id || null,
        club: clubResult.data?.id || null,
        association: associationResult.data?.id || null,
      };
      setChannels(nextChannels);

      const ids = Object.values(nextChannels).filter(Boolean) as string[];
      if (ids.length === 0) {
        setUnread(defaultUnread);
        return;
      }
      const { data: states } = await database
        .from("communication_read_state")
        .select("channel_id, last_read_at")
        .eq("user_id", user.id)
        .in("channel_id", ids);
      const nextUnread: UnreadMap = { ...defaultUnread };
      await Promise.all((Object.entries(nextChannels) as Array<[CommunicationTab, string | null]>).map(async ([key, id]) => {
        if (!id) return;
        const state = ((states || []) as Array<{ channel_id: string; last_read_at: string | null }>)
          .find((item) => item.channel_id === id);
        let query = database
          .from("communication_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", id)
          .is("removed_at", null);
        if (state?.last_read_at) query = query.gt("created_at", state.last_read_at);
        const result = await query;
        nextUnread[key] = result.count || 0;
      }));
      setUnread(nextUnread);
    };
    void loadChannels();
  }, [selectedAssociationId, selectedClubId, selectedTeamId, user]);

  const markChannelRead = useCallback(async (latestMessage?: CommunicationMessage) => {
    if (!user || !channelId) return;
    await database.from("communication_read_state").upsert(
      {
        channel_id: channelId,
        user_id: user.id,
        last_read_message_id: latestMessage?.id || null,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,user_id" },
    );
    setUnread((current) => ({ ...current, [tab]: 0 }));
  }, [channelId, tab, user]);

  const loadMessages = useCallback(async () => {
    if (!channelId || !user) {
      setMessages([]);
      setReactions([]);
      setOwnPermission(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    setOwnPermission(null);
    const { data, error } = await database
      .from("communication_messages")
      .select("id, channel_id, message_type, author_id, content, reply_to_id, is_important, edited_at, removed_at, removed_by, moderation_reason, created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(150);
    if (error) {
      console.error("Unable to load communications", error);
      setMessages([]);
      setLoadError(true);
      setLoading(false);
      return;
    }
    const loaded = (data || []) as CommunicationMessage[];
    setMessages(loaded);
    const messageIds = loaded.map((message) => message.id);
    const authorIds = [...new Set(loaded.map((message) => message.author_id))];
    const [reactionResult, profileResult, permissionResult] = await Promise.all([
      messageIds.length > 0
        ? database.from("communication_reactions").select("id, message_id, user_id, emoji").in("message_id", messageIds)
        : Promise.resolve({ data: [] }),
      authorIds.length > 0
        ? database.from("profiles").select("id, first_name, last_name").in("id", authorIds)
        : Promise.resolve({ data: [] }),
      database
        .from("communication_permissions")
        .select("can_publish, can_moderate")
        .eq("channel_id", channelId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    setReactions((reactionResult.data || []) as Reaction[]);
    setProfiles(Object.fromEntries(((profileResult.data || []) as ProfileRow[]).map((profile) => [
      profile.id,
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
    ])));
    setOwnPermission(permissionResult.data || null);
    setLoading(false);
    await markChannelRead(loaded.at(-1));
  }, [channelId, markChannelRead, user]);

  useEffect(() => {
    void loadMessages();
    if (!channelId) return;
    const realtime = supabase
      .channel(`communications:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "communication_messages", filter: `channel_id=eq.${channelId}` },
        () => void loadMessages(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "communication_reactions" },
        () => void loadMessages(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(realtime);
    };
  }, [channelId, loadMessages]);

  useEffect(() => {
    if (tab !== "team" || !selectedTeamId) {
      setMembers([]);
      return;
    }
    const loadMembers = async () => {
      const { data: memberships } = await database
        .from("team_memberships")
        .select("user_id")
        .eq("team_id", selectedTeamId)
        .eq("status", "ACTIVE");
      const ids = [...new Set(((memberships || []) as MembershipRow[]).map((membership) => membership.user_id))];
      if (ids.length === 0) return setMembers([]);
      const { data: memberProfiles } = await database
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      setMembers(((memberProfiles || []) as ProfileRow[]).map((profile) => ({
        id: profile.id,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
      })).sort((a: Member, b: Member) => a.name.localeCompare(b.name)));
    };
    void loadMembers();
  }, [selectedTeamId, tab]);

  useEffect(() => {
    if (!targetMessageId || loading) return;
    requestAnimationFrame(() => document.getElementById(`communication-${targetMessageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [loading, messages, targetMessageId]);

  useEffect(() => {
    if (!targetMessageId) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, targetMessageId]);

  const mentionQuery = useMemo(() => {
    if (tab !== "team") return null;
    const match = composer.match(/(?:^|\s)@([^@\n]*)$/);
    return match ? match[1].trim().toLowerCase() : null;
  }, [composer, tab]);
  const mentionSuggestions = mentionQuery === null
    ? []
    : members.filter((member) => member.id !== user?.id && member.name.toLowerCase().includes(mentionQuery)).slice(0, 6);
  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const reactionsByMessage = useMemo(() => {
    const grouped = new Map<string, Reaction[]>();
    for (const reaction of reactions) {
      const existing = grouped.get(reaction.message_id) || [];
      existing.push(reaction);
      grouped.set(reaction.message_id, existing);
    }
    return grouped;
  }, [reactions]);

  const chooseMention = (member: Member) => {
    setComposer((current) => current.replace(/(?:^|\s)@([^@\n]*)$/, (value) => `${value.startsWith(" ") ? " " : ""}@${member.name} `));
    setPendingMentions((current) => current.some((item) => item.id === member.id) ? current : [...current, member]);
  };

  const resetComposer = () => {
    setComposer("");
    setReplyTo(null);
    setEditing(null);
    setImportant(false);
    setPendingMentions([]);
  };

  const sendMessage = async (broadcastConfirmed = false) => {
    if (!user || !channelId || !composer.trim() || !canPublish || sending) return;
    if (tab !== "team" && !editing && !broadcastConfirmed) {
      setPublishConfirmOpen(true);
      return;
    }
    setSending(true);
    if (editing) {
      const { error } = await database
        .from("communication_messages")
        .update({ content: composer.trim() })
        .eq("id", editing.id);
      setSending(false);
      if (error) return toast({ title: "Message not updated", description: error.message, variant: "destructive" });
      resetComposer();
      await loadMessages();
      return;
    }

    const { data, error } = await database
      .from("communication_messages")
      .insert({
        channel_id: channelId,
        message_type: tab === "team" ? "CHAT" : "BROADCAST",
        author_id: user.id,
        content: composer.trim(),
        reply_to_id: tab === "team" ? replyTo?.id || null : null,
        is_important: tab === "team" ? false : important,
      })
      .select("id")
      .single();
    if (!error && data?.id && tab === "team") {
      const mentioned = pendingMentions.filter((member) => composer.includes(`@${member.name}`));
      if (mentioned.length > 0) {
        await database.from("communication_mentions").insert(
          mentioned.map((member) => ({ message_id: data.id, mentioned_user_id: member.id })),
        );
      }
    }
    setSending(false);
    if (error) return toast({ title: "Message not sent", description: error.message, variant: "destructive" });
    resetComposer();
    await loadMessages();
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((reaction) => reaction.message_id === messageId && reaction.user_id === user.id && reaction.emoji === emoji);
    let error;
    if (existing) {
      ({ error } = await database.from("communication_reactions").delete().eq("id", existing.id));
    } else {
      ({ error } = await database.from("communication_reactions").insert({ message_id: messageId, user_id: user.id, emoji }));
    }
    if (error) {
      toast({ title: "Reaction not saved", description: error.message, variant: "destructive" });
      return;
    }
    await loadMessages();
  };

  const startEdit = (message: CommunicationMessage) => {
    setEditing(message);
    setReplyTo(null);
    setComposer(message.content);
  };

  const removeOwnMessage = async (message: CommunicationMessage) => {
    if (!user) return;
    const { error } = await database
      .from("communication_messages")
      .update({ removed_at: new Date().toISOString(), removed_by: user.id })
      .eq("id", message.id);
    if (error) toast({ title: "Message not removed", description: error.message, variant: "destructive" });
    else await loadMessages();
  };

  const moderateMessage = async () => {
    if (!user || !moderating || !moderationReason.trim()) return;
    const { error } = await database
      .from("communication_messages")
      .update({
        removed_at: new Date().toISOString(),
        removed_by: user.id,
        moderation_reason: moderationReason.trim(),
      })
      .eq("id", moderating.id);
    if (error) toast({ title: "Content not removed", description: error.message, variant: "destructive" });
    setModerating(null);
    setModerationReason("");
    await loadMessages();
  };

  const changeTab = (value: string) => {
    const next = value as CommunicationTab;
    setTab(next);
    setSearchParams({ tab: next });
    resetComposer();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground md:text-4xl">COMMUNICATIONS</h1>
          <p className="mt-1 flex items-center gap-2 text-muted-foreground">
            {tab === "team" ? <Users className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            {scopeLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Audience: {audienceLabel}</p>
        </div>
        {canOpenSettings && (
          <Button variant="outline" className="gap-2" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" /> Manage
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="grid h-auto w-full grid-cols-3">
          {([
            ["team", "Team Chat"],
            ["club", "Club Updates"],
            ["association", "Association Updates"],
          ] as Array<[CommunicationTab, string]>).map(([key, label]) => (
            <TabsTrigger key={key} value={key} className="gap-2 py-2">
              {label}
              {unread[key] > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{unread[key]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[52vh] min-h-[360px] space-y-4 overflow-y-auto p-4">
            {!channelId ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                {loadError ? "This communication area could not be loaded. Refresh and try again." : `Select a ${tab} to open this communication area.`}
              </div>
            ) : loading ? (
              [1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)
            ) : loadError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                <ShieldAlert className="h-6 w-6 text-destructive" />
                <p>Messages could not be loaded.</p>
                <Button variant="outline" size="sm" onClick={() => void loadMessages()}>Try again</Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                {tab === "team" ? "No team messages yet. Start the conversation." : "No official updates have been published."}
              </div>
            ) : messages.map((message) => {
              const own = message.author_id === user?.id;
              const reply = message.reply_to_id ? messagesById.get(message.reply_to_id) : undefined;
              const reactionsForMessage = reactionsByMessage.get(message.id) || [];
              const messageReactions = REACTIONS.map((emoji) => ({
                emoji,
                rows: reactionsForMessage.filter((reaction) => reaction.emoji === emoji),
              })).filter((group) => group.rows.length > 0);
              return (
                <article
                  id={`communication-${message.id}`}
                  key={message.id}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    message.is_important && "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20",
                    targetMessageId === message.id && "ring-2 ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{own ? "You" : profiles[message.author_id] || "Member"}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
                        {message.edited_at && <span className="text-xs text-muted-foreground">Edited</span>}
                        {message.is_important && <span className="rounded bg-amber-200 px-1.5 text-xs text-amber-900">Important</span>}
                      </div>
                    </div>
                    {!message.removed_at && (own || canModerate) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Message actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {own && (
                            <DropdownMenuItem onClick={() => startEdit(message)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          )}
                          {own ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => void removeOwnMessage(message)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </DropdownMenuItem>
                          ) : canModerate ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => setModerating(message)}>
                              <ShieldAlert className="mr-2 h-4 w-4" /> Moderate
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {message.removed_at ? (
                    <p className="mt-2 text-sm italic text-muted-foreground">This content was removed.</p>
                  ) : (
                    <>
                      {reply && (
                        <div className="mt-2 rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-medium">{profiles[reply.author_id] || "Member"}: </span>
                          {reply.removed_at ? "Removed message" : reply.content.slice(0, 160)}
                        </div>
                      )}
                      <p className="mt-2 whitespace-pre-wrap text-sm">{message.content}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {messageReactions.map((group) => (
                          <button
                            type="button"
                            key={group.emoji}
                            onClick={() => void toggleReaction(message.id, group.emoji)}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs",
                              group.rows.some((reaction) => reaction.user_id === user?.id) && "border-primary bg-primary/10",
                            )}
                          >
                            {group.emoji} {group.rows.length}
                          </button>
                        ))}
                        {REACTIONS.map((emoji) => (
                          <button
                            type="button"
                            key={`add-${emoji}`}
                            aria-label={`React ${emoji}`}
                            onClick={() => void toggleReaction(message.id, emoji)}
                            className="rounded-full px-1.5 py-0.5 text-xs opacity-60 hover:bg-muted hover:opacity-100"
                          >
                            {emoji}
                          </button>
                        ))}
                        {tab === "team" && (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setReplyTo(message)}>
                            <CornerUpLeft className="h-3 w-3" /> Reply
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {channelId && canPublish && (
            <div className="relative space-y-2 border-t bg-background p-4">
              {(replyTo || editing) && (
                <div className="flex items-start justify-between gap-3 rounded-md bg-muted px-3 py-2 text-xs">
                  <span className="min-w-0 truncate">
                    {editing ? "Editing your message" : `Replying to ${profiles[replyTo?.author_id || ""] || "Member"}`}
                  </span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={resetComposer}><X className="h-3 w-3" /></Button>
                </div>
              )}
              {mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full left-4 z-20 mb-1 w-72 rounded-md border bg-popover p-1 shadow-md">
                  {mentionSuggestions.map((member) => (
                    <button
                      type="button"
                      key={member.id}
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => chooseMention(member)}
                    >
                      <AtSign className="h-4 w-4" /> {member.name}
                    </button>
                  ))}
                </div>
              )}
              <Label htmlFor="communication-message" className="text-sm font-semibold">
                {editing ? "Edit message" : tab === "team" ? "Write a team message" : "Write an official update"}
              </Label>
              <Textarea
                id="communication-message"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (tab === "team" && event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                maxLength={4000}
                placeholder={tab === "team" ? "Message the team… Use @ to mention someone" : "Write an official update…"}
                className="min-h-24 resize-none border-2 border-primary/35 bg-card shadow-sm placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              />
              <div className="flex items-center justify-between gap-3">
                {tab !== "team" && !editing ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={important} onCheckedChange={setImportant} /> Important
                  </label>
                ) : <span className="text-xs text-muted-foreground">{tab === "team" ? "Enter to send · Shift+Enter for a new line" : "Text only"}</span>}
                <Button className="gap-2" onClick={() => void sendMessage()} disabled={!composer.trim() || sending}>
                  <Send className="h-4 w-4" /> {editing ? "Save" : tab === "team" ? "Send" : "Publish"}
                </Button>
              </div>
            </div>
          )}
          {channelId && tab !== "team" && !canPublish && (
            <div className="border-t p-4 text-sm text-muted-foreground">
              Official updates accept reactions but no text replies.
            </div>
          )}
        </CardContent>
      </Card>

      <CommunicationSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tab={tab}
        channelId={channelId}
        teamId={selectedTeamId}
        clubId={selectedClubId}
        associationId={selectedAssociationId}
      />

      <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish official update?</DialogTitle>
            <DialogDescription>
              This will publish to: {audienceLabel}. People will receive alerts according
              to their notification preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{important ? "Important update" : "Official update"}</p>
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-muted-foreground">{composer.trim()}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setPublishConfirmOpen(false);
                void sendMessage(true);
              }}
              disabled={sending}
            >
              Publish update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(moderating)} onOpenChange={(open) => !open && setModerating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove content</DialogTitle>
            <DialogDescription>A reason is required and will be kept in the administrator audit log.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={moderationReason}
            onChange={(event) => setModerationReason(event.target.value)}
            placeholder="Reason for removal"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerating(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void moderateMessage()} disabled={!moderationReason.trim()}>
              Remove content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
