import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logError";

// Checks if this user has a "pending_signups" row waiting for them
// (saved during signup, before they confirmed their email). If so:
//   1. Copy their first/last name into their real profile.
//   2. Create a "requests" row for the association/club/team they
//      chose at signup, so an admin can review and approve it.
//   3. Delete the pending_signups row so this never runs twice.
//
// Safe to call every time someone logs in - if there's no pending
// row, it does nothing.
export async function applyPendingSignup(userId: string) {
  // 1. Look for a pending signup for this user
  const { data: pending, error: fetchError } = await supabase
    .from("pending_signups" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    await logError({
      context: "applyPendingSignup - fetch",
      message: "Failed to check for pending signup",
      error: fetchError,
    });
    return;
  }

  // Nothing pending - nothing to do
  if (!pending) return;

  const pendingData = pending as any;

  // 2. Copy first/last name into the real profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      first_name: pendingData.first_name,
      last_name: pendingData.last_name,
    })
    .eq("id", userId);

  if (profileError) {
    await logError({
      context: "applyPendingSignup - update profile",
      message: "Failed to copy pending signup name into profile",
      error: profileError,
    });
  }

  // 3. Create a request for whichever level they signed up at
  //    (association only, club only, or team). We only create a
  //    request if they actually selected something at signup.
  if (pendingData.association_id) {
    const { error: requestError } = await supabase
      .from("requests" as any)
      .insert({
        request_type: "PLAYER_REQUEST",
        requester_id: userId,
        target_user_id: userId,
        association_id: pendingData.association_id,
        club_id: pendingData.club_id,
        team_id: pendingData.team_id,
        membership_type: "PRIMARY",
        status: "PENDING",
      });

    if (requestError) {
      await logError({
        context: "applyPendingSignup - create request",
        message: "Failed to create membership request from pending signup",
        error: requestError,
      });
    }
  }

  // 4. Clean up - delete the pending row so this never runs again
  const { error: deleteError } = await supabase
    .from("pending_signups" as any)
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    await logError({
      context: "applyPendingSignup - cleanup",
      message: "Failed to delete pending signup row after applying it",
      error: deleteError,
    });
  }
}
