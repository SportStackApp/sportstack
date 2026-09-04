import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AtSign,
  CornerUpLeft,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  History,
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
import {
  hasOlderMessagePage,
  mergeLatestMessages,
  prependOlderMessages,
} from "@/lib/communicationMessages";
import {
  buildChatDraftKey,
  clearChatDraftIfUnchanged,
  loadChatDraft,
  saveChatDraft,
  takeLegacyChatDraft,
  type ChatDraft,
} from "@/lib/chatDraft";

const database = supabase;
const REACTIONS = ["👍", "❤️", "😊", "🎉"] as const;
const MESSAGE_PAGE_SIZE = 50;

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

interface MessageRevision {
  id: string;
  message_id: string;
  revision_number: number;
  content: string;
  edited_by: string;
  edited_at: string;
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
  const accountId = user?.id ?? null;
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
  const [resolvedChannelContextKey, setResolvedChannelContextKey] = useState<string | null>(null);
  const [channelReloadToken, setChannelReloadToken] = useState(0);
  const [unread, setUnread] = useState<UnreadMap>(defaultUnread);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [loadedMessageContextKey, setLoadedMessageContextKey] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownPermission, setOwnPermission] = useState<{ can_publish: boolean; can_moderate: boolean } | null>(null);
  const [composer, setComposer] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CommunicationMessage | null>(null);
  const [important, setImportant] = useState(false);
  const [pendingMentionIds, setPendingMentionIds] = useState<string[]>([]);
  const [membersLoadedForTeamId, setMembersLoadedForTeamId] = useState<string | null>(null);
  const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
  const [membersReloadToken, setMembersReloadToken] = useState(0);
  const [replyAuthorId, setReplyAuthorId] = useState<string | null>(null);
  const [replyValidationPending, setReplyValidationPending] = useState(false);
  const [replyValidationFailed, setReplyValidationFailed] = useState(false);
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moderating, setModerating] = useState<CommunicationMessage | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [historyMessage, setHistoryMessage] = useState<CommunicationMessage | null>(null);
  const [messageRevisions, setMessageRevisions] = useState<MessageRevision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const channelRequestIdRef = useRef(0);
  const messageRequestIdRef = useRef(0);
  const olderMessagesRequestIdRef = useRef(0);
  const sendRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const activeComposerFingerprintRef = useRef("");
  const lastPersistedDraftRef = useRef<{ key: string; draft: ChatDraft } | null>(null);

  const channelContextKey = accountId
    ? [accountId, selectedAssociationId || "__none__", selectedClubId || "__none__", selectedTeamId || "__none__"].join("|")
    : null;
  const channelId = resolvedChannelContextKey === channelContextKey ? channels[tab] : null;
  const messageContextKey = accountId && channelId ? `${accountId}|${channelId}` : null;
  const activeChannelContextRef = useRef(channelContextKey);
  const activeMessageContextRef = useRef(messageContextKey);
  const activeDraftKeyRef = useRef<string | null>(null);
  const loadedMessageContextRef = useRef(loadedMessageContextKey);
  activeChannelContextRef.current = channelContextKey;
  activeMessageContextRef.current = messageContextKey;
  loadedMessageContextRef.current = loadedMessageContextKey;
  const visibleMessages = useMemo(
    () => loadedMessageContextKey === messageContextKey ? messages : [],
    [loadedMessageContextKey, messageContextKey, messages],
  );
  const visibleHasOlderMessages = loadedMessageContextKey === messageContextKey && hasOlderMessages;
  const visibleUnread = resolvedChannelContextKey === channelContextKey ? unread : defaultUnread;
  const effectiveOwnPermission = loadedMessageContextKey === messageContextKey ? ownPermission : null;
  const canAdminister = isSuperAdmin || (
    tab === "association"
      ? Boolean(selectedAssociationId && canManageAssociation(selectedAssociationId))
      : Boolean(selectedClubId && canManageClub(selectedClubId))
  );
  const canPublish = tab === "team" || canAdminister || Boolean(effectiveOwnPermission?.can_publish);
  const canModerate = canAdminister || Boolean(effectiveOwnPermission?.can_moderate);
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
    const requestId = ++channelRequestIdRef.current;
    setResolvedChannelContextKey(null);
    setChannels(defaultChannels);
    setUnread(defaultUnread);
    if (!accountId || !channelContextKey) return;

    const requestedAccountId = accountId;
    let cancelled = false;
    const isCurrentRequest = () => !cancelled
      && channelRequestIdRef.current === requestId
      && activeChannelContextRef.current === channelContextKey;
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
      if (!isCurrentRequest()) return;
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
      setResolvedChannelContextKey(channelContextKey);

      const ids = Object.values(nextChannels).filter(Boolean) as string[];
      if (ids.length === 0) {
        setUnread(defaultUnread);
        return;
      }
      const { data: states } = await database
        .from("communication_read_state")
        .select("channel_id, last_read_at")
        .eq("user_id", requestedAccountId)
        .in("channel_id", ids);
      if (!isCurrentRequest()) return;
      const nextUnread: UnreadMap = { ...defaultUnread };
      await Promise.all((Object.entries(nextChannels) as Array<[CommunicationTab, string | null]>).map(async ([key, id]) => {
        if (!id) return;
        const state = ((states || []) as Array<{ channel_id: string; last_read_at: string | null }>)
          .find((item) => item.channel_id === id);
        let query = database
          .from("communication_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", id)
          .neq("author_id", requestedAccountId)
          .is("removed_at", null);
        if (state?.last_read_at) query = query.gt("created_at", state.last_read_at);
        const result = await query;
        nextUnread[key] = result.count || 0;
      }));
      if (isCurrentRequest()) setUnread(nextUnread);
    };
    void loadChannels();
    return () => {
      cancelled = true;
    };
  }, [accountId, channelContextKey, channelReloadToken, selectedAssociationId, selectedClubId, selectedTeamId]);

  const markChannelRead = useCallback(async (latestMessage?: CommunicationMessage, expectedContextKey = messageContextKey) => {
    if (!accountId || !channelId || !expectedContextKey || activeMessageContextRef.current !== expectedContextKey) return;
    const readAccountId = accountId;
    const readChannelId = channelId;
    const readTab = tab;
    await database.from("communication_read_state").upsert(
      {
        channel_id: readChannelId,
        user_id: readAccountId,
        last_read_message_id: latestMessage?.id || null,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,user_id" },
    );
    if (activeMessageContextRef.current !== expectedContextKey) return;
    setUnread((current) => ({ ...current, [readTab]: 0 }));
  }, [accountId, channelId, messageContextKey, tab]);

  const loadMessages = useCallback(async () => {
    const contextKey = messageContextKey;
    if (contextKey && activeMessageContextRef.current !== contextKey) return;
    const requestId = ++messageRequestIdRef.current;
    if (!accountId || !channelId || !contextKey) {
      setMessages([]);
      setReactions([]);
      setProfiles({});
      setOwnPermission(null);
      setHasOlderMessages(false);
      setLoadedMessageContextKey(null);
      setLoading(false);
      return;
    }
    const requestedAccountId = accountId;
    const requestedChannelId = channelId;
    const isCurrentRequest = () => messageRequestIdRef.current === requestId
      && activeMessageContextRef.current === contextKey;
    setLoading(true);
    setLoadError(false);
    setOwnPermission(null);
    const { data, error } = await database
      .from("communication_messages")
      .select("id, channel_id, message_type, author_id, content, reply_to_id, is_important, edited_at, removed_at, removed_by, moderation_reason, created_at")
      .eq("channel_id", requestedChannelId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
    if (!isCurrentRequest()) return;
    if (error) {
      console.error("Unable to load communications", error);
      setMessages([]);
      setReactions([]);
      setProfiles({});
      setOwnPermission(null);
      setLoadedMessageContextKey(contextKey);
      setLoadError(true);
      setLoading(false);
      return;
    }
    const loaded = ((data || []) as CommunicationMessage[]).reverse();
    const isSameChannel = loadedMessageContextRef.current === contextKey;
    setMessages((current) => mergeLatestMessages(current, loaded, isSameChannel));
    setHasOlderMessages(hasOlderMessagePage(loaded.length, MESSAGE_PAGE_SIZE));
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
        .eq("channel_id", requestedChannelId)
        .eq("user_id", requestedAccountId)
        .maybeSingle(),
    ]);
    if (!isCurrentRequest()) return;
    setReactions((reactionResult.data || []) as Reaction[]);
    setProfiles(Object.fromEntries(((profileResult.data || []) as ProfileRow[]).map((profile) => [
      profile.id,
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
    ])));
    setOwnPermission(permissionResult.data || null);
    setLoadedMessageContextKey(contextKey);
    loadedMessageContextRef.current = contextKey;
    setLoading(false);
    await markChannelRead(loaded.at(-1), contextKey);
    if (!isCurrentRequest()) return;
    if (!targetMessageId) requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: isSameChannel ? "smooth" : "auto" }));
  }, [accountId, channelId, markChannelRead, messageContextKey, targetMessageId]);

  useEffect(() => {
    olderMessagesRequestIdRef.current += 1;
    setLoadingOlderMessages(false);
  }, [messageContextKey]);

  const loadOlderMessages = useCallback(async () => {
    const contextKey = messageContextKey;
    const oldest = visibleMessages[0];
    const viewport = messagesViewportRef.current;
    if (!channelId || !contextKey || !oldest || !visibleHasOlderMessages || loadingOlderMessages || !viewport) return;

    const requestId = ++olderMessagesRequestIdRef.current;
    const requestedChannelId = channelId;
    const isCurrentRequest = () => olderMessagesRequestIdRef.current === requestId
      && activeMessageContextRef.current === contextKey;
    setLoadingOlderMessages(true);
    const previousHeight = viewport.scrollHeight;
    const { data, error } = await database
      .from("communication_messages")
      .select("id, channel_id, message_type, author_id, content, reply_to_id, is_important, edited_at, removed_at, removed_by, moderation_reason, created_at")
      .eq("channel_id", requestedChannelId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);

    if (!isCurrentRequest()) return;
    if (error) {
      setLoadingOlderMessages(false);
      toast({ title: "Older messages not loaded", description: error.message, variant: "destructive" });
      return;
    }

    const older = ((data || []) as CommunicationMessage[]).reverse();
    setMessages((current) => prependOlderMessages(current, older));
    setHasOlderMessages(hasOlderMessagePage(older.length, MESSAGE_PAGE_SIZE));

    const authorIds = [...new Set(older.map((message) => message.author_id))];
    const messageIds = older.map((message) => message.id);
    const [profileResult, reactionResult] = await Promise.all([
      authorIds.length > 0
        ? database.from("profiles").select("id, first_name, last_name").in("id", authorIds)
        : Promise.resolve({ data: [] }),
      messageIds.length > 0
        ? database.from("communication_reactions").select("id, message_id, user_id, emoji").in("message_id", messageIds)
        : Promise.resolve({ data: [] }),
    ]);
    if (!isCurrentRequest()) return;
    setProfiles((current) => ({
      ...current,
      ...Object.fromEntries(((profileResult.data || []) as ProfileRow[]).map((profile) => [
        profile.id,
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
      ])),
    }));
    setReactions((current) => [...((reactionResult.data || []) as Reaction[]), ...current]);
    requestAnimationFrame(() => {
      if (!isCurrentRequest() || !viewport.isConnected) return;
      viewport.scrollTop = viewport.scrollHeight - previousHeight;
      setLoadingOlderMessages(false);
    });
  }, [channelId, loadingOlderMessages, messageContextKey, toast, visibleHasOlderMessages, visibleMessages]);

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
    if (!accountId || tab !== "team" || !selectedTeamId) {
      setMembers([]);
      setMembersLoadedForTeamId(null);
      setMembersLoadError(null);
      setPendingMentionIds([]);
      return;
    }
    setMembers([]);
    setMembersLoadedForTeamId(null);
    setMembersLoadError(null);
    let cancelled = false;
    const loadMembers = async () => {
      const { data: memberships, error: membershipError } = await database
        .from("team_memberships")
        .select("user_id")
        .eq("team_id", selectedTeamId)
        .eq("status", "ACTIVE");
      if (cancelled) return;
      if (membershipError) {
        setMembersLoadError("Team members could not be checked.");
        return;
      }
      const ids = [...new Set(((memberships || []) as MembershipRow[]).map((membership) => membership.user_id))];
      if (ids.length === 0) {
        setMembers([]);
        setMembersLoadedForTeamId(selectedTeamId);
        return;
      }
      const { data: memberProfiles, error: profilesError } = await database
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      if (cancelled) return;
      if (profilesError) {
        setMembersLoadError("Team members could not be checked.");
        return;
      }
      const loadedMembers = ((memberProfiles || []) as ProfileRow[]).map((profile) => ({
        id: profile.id,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
      })).sort((a: Member, b: Member) => a.name.localeCompare(b.name));
      setMembers(loadedMembers);
      setMembersLoadedForTeamId(selectedTeamId);
      setMembersLoadError(null);
    };
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [accountId, membersReloadToken, selectedTeamId, tab]);

  useEffect(() => {
    if (!targetMessageId || loading) return;
    requestAnimationFrame(() => document.getElementById(`communication-${targetMessageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [loading, messages, targetMessageId]);

  const draftStorageKey = useMemo(
    () => accountId && channelId ? buildChatDraftKey(accountId, channelId) : null,
    [accountId, channelId],
  );
  activeDraftKeyRef.current = draftStorageKey;
  activeComposerFingerprintRef.current = JSON.stringify({
    text: composer,
    replyToId,
    important,
    pendingMentionIds,
    editingId: editing?.id ?? null,
  });

  useEffect(() => {
    sendRequestIdRef.current += 1;
    historyRequestIdRef.current += 1;
    setSending(false);
    setPublishConfirmOpen(false);
    setSettingsOpen(false);
    setModerating(null);
    setModerationReason("");
    setHistoryMessage(null);
    setMessageRevisions([]);
    setHistoryLoading(false);
  }, [messageContextKey]);

  useEffect(() => {
    if (!draftStorageKey || !accountId || !channelId) {
      setHydratedDraftKey(null);
      lastPersistedDraftRef.current = null;
      return;
    }
    const savedDraft = loadChatDraft(draftStorageKey, localStorage);
    const legacyText = takeLegacyChatDraft(accountId, channelId, localStorage);
    const draft: ChatDraft | null = savedDraft ?? (legacyText ? {
      text: legacyText,
      replyMessageId: null,
      important: false,
      mentionedUserIds: [],
    } : null);
    const restoredReplyId = draft?.replyMessageId ?? null;
    setReplyToId(restoredReplyId);
    setReplyAuthorId(null);
    setReplyValidationPending(Boolean(restoredReplyId));
    setReplyValidationFailed(false);
    setEditing(null);
    setImportant(draft?.important ?? false);
    setPendingMentionIds(draft?.mentionedUserIds ?? []);
    setComposer(draft?.text ?? "");
    lastPersistedDraftRef.current = draft ? { key: draftStorageKey, draft } : null;
    setHydratedDraftKey(draftStorageKey);
  }, [accountId, channelId, draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || hydratedDraftKey !== draftStorageKey || editing) return;
    const draft: ChatDraft = {
      text: composer,
      replyMessageId: replyToId,
      important,
      mentionedUserIds: pendingMentionIds,
    };
    const meaningful = Boolean(composer || replyToId || important || pendingMentionIds.length > 0);
    if (meaningful) {
      if (saveChatDraft(draftStorageKey, draft, localStorage)) {
        lastPersistedDraftRef.current = {
          key: draftStorageKey,
          draft: { ...draft, mentionedUserIds: [...draft.mentionedUserIds] },
        };
      }
    } else {
      const previous = lastPersistedDraftRef.current;
      if (previous?.key === draftStorageKey) {
        clearChatDraftIfUnchanged(draftStorageKey, previous.draft, localStorage);
      }
      lastPersistedDraftRef.current = null;
    }
  }, [composer, draftStorageKey, editing, hydratedDraftKey, important, pendingMentionIds, replyToId]);

  const mentionQuery = useMemo(() => {
    if (tab !== "team") return null;
    const match = composer.match(/(?:^|\s)@([^@\n]*)$/);
    return match ? match[1].trim().toLowerCase() : null;
  }, [composer, tab]);
  const mentionSuggestions = mentionQuery === null
    ? []
    : members.filter((member) => member.id !== user?.id && member.name.toLowerCase().includes(mentionQuery)).slice(0, 6);
  const mentionValidationPending = !editing
    && tab === "team"
    && pendingMentionIds.length > 0
    && membersLoadedForTeamId !== selectedTeamId;
  const messagesById = useMemo(
    () => new Map(visibleMessages.map((message) => [message.id, message])),
    [visibleMessages],
  );
  const replyValidationBlocked = Boolean(replyToId && !replyAuthorId)
    || replyValidationPending
    || replyValidationFailed;
  useEffect(() => {
    if (!replyToId) {
      setReplyAuthorId(null);
      setReplyValidationPending(false);
      setReplyValidationFailed(false);
      return;
    }
    const loadedReply = messagesById.get(replyToId);
    if (loadedReply?.channel_id === channelId && !loadedReply.removed_at) {
      setReplyAuthorId(loadedReply.author_id);
      setReplyValidationPending(false);
      setReplyValidationFailed(false);
      return;
    }
    if (loading || loadedMessageContextKey !== messageContextKey || !channelId) return;

    let cancelled = false;
    setReplyValidationPending(true);
    const validateOlderReply = async () => {
      const { data, error } = await database
        .from("communication_messages")
        .select("id, author_id")
        .eq("id", replyToId)
        .eq("channel_id", channelId)
        .is("removed_at", null)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setReplyValidationFailed(true);
      } else if (!data) {
        setReplyToId(null);
        setReplyAuthorId(null);
        setReplyValidationFailed(false);
      } else {
        setReplyAuthorId(data.author_id);
        setReplyValidationFailed(false);
      }
      setReplyValidationPending(false);
    };
    void validateOlderReply();
    return () => {
      cancelled = true;
    };
  }, [channelId, loadedMessageContextKey, loading, messageContextKey, messagesById, replyToId]);

  useEffect(() => {
    if (!selectedTeamId || membersLoadedForTeamId !== selectedTeamId) return;
    const validMemberIds = new Set(members.map((member) => member.id));
    setPendingMentionIds((current) => current.filter((id) => validMemberIds.has(id)));
  }, [members, membersLoadedForTeamId, selectedTeamId]);
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
    setPendingMentionIds((current) => current.includes(member.id) ? current : [...current, member.id]);
  };

  const cancelReply = () => {
    setReplyToId(null);
    setReplyAuthorId(null);
    setReplyValidationPending(false);
    setReplyValidationFailed(false);
  };

  const resetComposer = () => {
    if (editing && draftStorageKey) {
      const draft = loadChatDraft(draftStorageKey, localStorage);
      lastPersistedDraftRef.current = draft ? { key: draftStorageKey, draft } : null;
      setEditing(null);
      setComposer(draft?.text ?? "");
      const restoredReplyId = draft?.replyMessageId ?? null;
      setReplyToId(restoredReplyId);
      setReplyAuthorId(null);
      setReplyValidationPending(Boolean(restoredReplyId));
      setReplyValidationFailed(false);
      setImportant(draft?.important ?? false);
      setPendingMentionIds(draft?.mentionedUserIds ?? []);
      return;
    }
    setComposer("");
    setReplyToId(null);
    setReplyAuthorId(null);
    setReplyValidationPending(false);
    setReplyValidationFailed(false);
    setEditing(null);
    setImportant(false);
    setPendingMentionIds([]);
    const previous = lastPersistedDraftRef.current;
    if (draftStorageKey && previous?.key === draftStorageKey) {
      clearChatDraftIfUnchanged(draftStorageKey, previous.draft, localStorage);
    }
    lastPersistedDraftRef.current = null;
  };

  const resetComposerAfterSend = () => {
    setComposer("");
    setReplyToId(null);
    setReplyAuthorId(null);
    setReplyValidationPending(false);
    setReplyValidationFailed(false);
    setEditing(null);
    setImportant(false);
    setPendingMentionIds([]);
    // The submitted draft has already been compare-cleared. Prevent the blank
    // autosave pass from removing a newer value written by another tab.
    lastPersistedDraftRef.current = null;
  };

  const openEditHistory = async (message: CommunicationMessage) => {
    if (!messageContextKey) return;
    const requestId = ++historyRequestIdRef.current;
    const contextKey = messageContextKey;
    const isCurrentRequest = () => historyRequestIdRef.current === requestId
      && activeMessageContextRef.current === contextKey;
    setHistoryMessage(message);
    setHistoryLoading(true);
    const { data, error } = await database
      .from("communication_message_revisions" as never)
      .select("id, message_id, revision_number, content, edited_by, edited_at")
      .eq("message_id", message.id)
      .order("revision_number", { ascending: false });
    if (!isCurrentRequest()) return;
    if (error) {
      toast({ title: "Edit history not loaded", description: error.message, variant: "destructive" });
      setMessageRevisions([]);
    } else {
      const revisions = (data || []) as unknown as MessageRevision[];
      setMessageRevisions(revisions);
      const editorIds = [...new Set(revisions.map((revision) => revision.edited_by))];
      if (editorIds.length > 0) {
        const { data: editorProfiles } = await database.from("profiles").select("id, first_name, last_name").in("id", editorIds);
        if (!isCurrentRequest()) return;
        setProfiles((current) => ({
          ...current,
          ...Object.fromEntries(((editorProfiles || []) as ProfileRow[]).map((profile) => [
            profile.id,
            [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
          ])),
        }));
      }
    }
    if (isCurrentRequest()) setHistoryLoading(false);
  };

  const sendMessage = async (broadcastConfirmed = false) => {
    if (!accountId || !channelId || !messageContextKey || !draftStorageKey || !composer.trim() || !canPublish || sending || replyValidationBlocked || mentionValidationPending) return;
    if (tab !== "team" && !editing && !broadcastConfirmed) {
      setPublishConfirmOpen(true);
      return;
    }

    const operationId = ++sendRequestIdRef.current;
    const operationContextKey = messageContextKey;
    const operationDraftKey = draftStorageKey;
    const requestedChannelId = channelId;
    const sendingAccountId = accountId;
    const messageText = composer.trim();
    const messageTab = tab;
    const editTarget = editing;
    const replyTargetId = replyToId;
    const messageImportant = important;
    const mentioned = members.filter((member) => pendingMentionIds.includes(member.id) && composer.includes(`@${member.name}`));
    const operationDraft: ChatDraft = {
      text: composer,
      replyMessageId: replyTargetId,
      important: messageImportant,
      mentionedUserIds: [...pendingMentionIds],
    };
    const operationComposerFingerprint = activeComposerFingerprintRef.current;
    const isActiveOperationContext = () => sendRequestIdRef.current === operationId
      && activeMessageContextRef.current === operationContextKey
      && activeDraftKeyRef.current === operationDraftKey;
    const isCurrentOperation = () => isActiveOperationContext()
      && activeComposerFingerprintRef.current === operationComposerFingerprint;

    setSending(true);
    if (editTarget) {
      const { error } = await database
        .from("communication_messages")
        .update({ content: messageText })
        .eq("id", editTarget.id)
        .eq("channel_id", requestedChannelId);
      if (!isActiveOperationContext()) return;
      setSending(false);
      if (error) {
        toast({ title: "Message not updated", description: error.message, variant: "destructive" });
        return;
      }
      if (!isCurrentOperation()) {
        await loadMessages();
        return;
      }
      resetComposer();
      await loadMessages();
      return;
    }

    const { data, error } = await database
      .from("communication_messages")
      .insert({
        channel_id: requestedChannelId,
        message_type: messageTab === "team" ? "CHAT" : "BROADCAST",
        author_id: sendingAccountId,
        content: messageText,
        reply_to_id: messageTab === "team" ? replyTargetId : null,
        is_important: messageTab === "team" ? false : messageImportant,
      })
      .select("id")
      .single();
    if (!error && data?.id && messageTab === "team") {
      if (mentioned.length > 0) {
        await database.from("communication_mentions").insert(
          mentioned.map((member) => ({ message_id: data.id, mentioned_user_id: member.id })),
        );
      }
    }
    if (error) {
      if (isActiveOperationContext()) {
        setSending(false);
        toast({ title: "Message not sent", description: error.message, variant: "destructive" });
      }
      return;
    }

    const operationIsCurrent = isCurrentOperation();
    clearChatDraftIfUnchanged(operationDraftKey, operationDraft, localStorage);
    if (!isActiveOperationContext()) return;
    setSending(false);
    if (!operationIsCurrent) {
      await loadMessages();
      return;
    }
    resetComposerAfterSend();
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
    setReplyToId(null);
    setReplyAuthorId(null);
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
              {visibleUnread[key] > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{visibleUnread[key]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={messagesViewportRef}
            className="h-[52vh] min-h-[360px] space-y-4 overflow-y-auto p-4"
            onScroll={(event) => {
              if (event.currentTarget.scrollTop < 80) void loadOlderMessages();
            }}
          >
            {loadingOlderMessages && <p className="text-center text-xs text-muted-foreground">Loading earlier messages…</p>}
            {!loadingOlderMessages && visibleHasOlderMessages && visibleMessages.length > 0 && (
              <Button variant="ghost" size="sm" className="mx-auto flex" onClick={() => void loadOlderMessages()}>
                Load earlier messages
              </Button>
            )}
            {!channelId ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                <p>{loadError ? "This communication area could not be loaded. Your saved draft has been kept." : `Select a ${tab} to open this communication area.`}</p>
                {loadError && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setChannelReloadToken((current) => current + 1)}>
                    Try again
                  </Button>
                )}
              </div>
            ) : loading ? (
              [1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)
            ) : loadError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                <ShieldAlert className="h-6 w-6 text-destructive" />
                <p>Messages could not be loaded.</p>
                <Button variant="outline" size="sm" onClick={() => void loadMessages()}>Try again</Button>
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                {tab === "team" ? "No team messages yet. Start the conversation." : "No official updates have been published."}
              </div>
            ) : visibleMessages.map((message) => {
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
                        {message.edited_at && (!message.removed_at || canModerate) && (
                          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => void openEditHistory(message)}>
                            Edited · view history
                          </button>
                        )}
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
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setReplyToId(message.id)}>
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
              {(replyToId || editing) && (
                <div className="flex items-start justify-between gap-3 rounded-md bg-muted px-3 py-2 text-xs">
                  <span className="min-w-0 truncate">
                    {editing ? "Editing your message" : `Replying to ${profiles[replyAuthorId || ""] || "Member"}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={editing ? resetComposer : cancelReply}
                    aria-label={editing ? "Cancel editing" : "Cancel reply"}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {replyToId && replyValidationFailed && (
                <p className="text-xs text-destructive">
                  This reply could not be checked. Cancel it, or try again after refreshing.
                </p>
              )}
              {mentionValidationPending && (
                <p className="text-xs text-muted-foreground">
                  Checking the saved mentions before this message can be sent…
                </p>
              )}
              {tab === "team" && membersLoadError && (
                <div className="flex items-center justify-between gap-3 text-xs text-destructive">
                  <span>
                    {membersLoadError} Saved mentions have been kept and will not be sent until the check succeeds.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setMembersReloadToken((current) => current + 1)}
                  >
                    Retry
                  </Button>
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
                <Button className="gap-2" onClick={() => void sendMessage()} disabled={!composer.trim() || sending || replyValidationBlocked || mentionValidationPending}>
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

      <Dialog open={Boolean(historyMessage)} onOpenChange={(open) => !open && setHistoryMessage(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Message edit history</DialogTitle>
            <DialogDescription>Every earlier version is visible to conversation participants.</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-3">
              {historyMessage && (
                <div className="rounded-md border bg-primary/5 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Current version</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{historyMessage.content}</p>
                </div>
              )}
              {messageRevisions.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No earlier versions were recorded for this legacy message.
                </p>
              )}
              {messageRevisions.map((revision) => (
                <div key={revision.id} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Earlier version {revision.revision_number} · edited by {profiles[revision.edited_by] || "Member"} · {new Date(revision.edited_at).toLocaleString("en-AU")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{revision.content}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
