import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  MvpTallyAudienceMember,
  MvpTallyBuilderData,
  MvpTallyCommentarySnapshot,
  MvpTallyPresentationRecord,
  MvpTallySpeed,
  MvpTallyTheme,
} from "./types";
import { deduplicateAudience } from "./logic";

// RPC snapshots are JSON, so this small boundary narrows them into the shared tally interfaces below.
const client = supabase as unknown as SupabaseClient;

const unwrap = <T>(data: unknown, error: { message: string } | null): T => {
  if (error) throw error;
  return data as T;
};

export async function getMvpTallyBuilderData(teamId: string, sessionIds?: string[]) {
  const { data, error } = await client.rpc("get_mvp_tally_builder_data", {
    p_team_id: teamId,
    p_session_ids: sessionIds?.length ? sessionIds : null,
  });
  const builderData = unwrap<MvpTallyBuilderData>(data, error);
  return { ...builderData, audience: deduplicateAudience(builderData.audience) };
}

export async function listMvpTallyPresentations(teamId?: string) {
  let query = client.from("mvp_tally_presentations").select("*").order("created_at", { ascending: false });
  if (teamId) query = query.eq("team_id", teamId);
  const { data, error } = await query;
  return unwrap<MvpTallyPresentationRecord[]>(data || [], error);
}

export async function getMvpTallyPresentation(id: string) {
  const { data, error } = await client.from("mvp_tally_presentations").select("*").eq("id", id).maybeSingle();
  return unwrap<MvpTallyPresentationRecord | null>(data, error);
}

export async function getMvpTallyDraftDetails(id: string) {
  const [sessions, recipients] = await Promise.all([
    client.from("mvp_tally_sessions").select("session_id, display_order").eq("presentation_id", id).order("display_order"),
    client.from("mvp_tally_recipients").select("profile_id, audience_group").eq("presentation_id", id),
  ]);
  if (sessions.error) throw sessions.error;
  if (recipients.error) throw recipients.error;
  return {
    sessionIds: ((sessions.data || []) as Array<{ session_id: string }>).map((item) => item.session_id),
    recipients: (recipients.data || []) as Array<{ profile_id: string; audience_group: MvpTallyAudienceMember["group"] }>,
  };
}

export async function saveMvpTallyDraft(input: {
  id: string | null;
  teamId: string;
  title: string;
  subtitle: string;
  theme: MvpTallyTheme;
  speed: MvpTallySpeed;
  sessionIds: string[];
  audience: MvpTallyAudienceMember[];
  replacesPresentationId: string | null;
}) {
  const recipients = deduplicateAudience(input.audience)
    .filter((person) => person.selected)
    .map((person) => ({ profileId: person.profileId, group: person.group }));
  const { data, error } = await client.rpc("save_mvp_tally_draft", {
    p_presentation_id: input.id,
    p_team_id: input.teamId,
    p_title: input.title,
    p_subtitle: input.subtitle,
    p_theme: input.theme,
    p_playback_speed: input.speed,
    p_session_ids: input.sessionIds,
    p_recipients: recipients,
    p_replaces_presentation_id: input.replacesPresentationId,
  });
  return unwrap<string>(data, error);
}

export async function previewMvpTally(id: string) {
  const { data, error } = await client.rpc("preview_mvp_tally", { p_presentation_id: id });
  return unwrap<{
    cards: MvpTallyPresentationRecord["card_snapshot"];
    results: MvpTallyPresentationRecord["result_snapshot"];
    sourceFingerprint: string;
  }>(data, error);
}

export async function saveMvpTallyCommentary(
  id: string,
  sourceFingerprint: string,
  commentary: MvpTallyCommentarySnapshot,
) {
  const { error } = await client.rpc("save_mvp_tally_commentary", {
    p_presentation_id: id,
    p_source_fingerprint: sourceFingerprint,
    p_commentary: commentary,
  });
  if (error) throw error;
}

export async function uploadMvpTallyLogo(teamId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${teamId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from("mvp-tally-assets").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = client.storage.from("mvp-tally-assets").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function removeMvpTallyLogo(path: string) {
  const { error } = await client.storage.from("mvp-tally-assets").remove([path]);
  if (error) throw error;
}

export async function publishMvpTally(id: string) {
  const { data, error } = await client.rpc("publish_mvp_tally", {
    p_presentation_id: id,
  });
  return unwrap<"PUBLISHED">(data, error);
}

export async function withdrawMvpTally(id: string, reason: string) {
  const { error } = await client.rpc("withdraw_mvp_tally", {
    p_presentation_id: id,
    p_reason: reason,
  });
  if (error) throw error;
}
