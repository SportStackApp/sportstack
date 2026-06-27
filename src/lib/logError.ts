import { supabase } from "@/integrations/supabase/client";

// Shape of the info we pass when logging an error
interface LogErrorParams {
  context: string;        // where it happened, e.g. "Signup"
  message: string;        // short human-readable message
  error?: unknown;        // the raw error object (optional)
}

// Reusable error logger. Call this anywhere an error occurs.
// It logs to the browser console AND saves to the error_logs table.
export async function logError({ context, message, error }: LogErrorParams) {
  // 1. Always log to the browser console for debugging
  console.error(`[${context}] ${message}`, error);

  // 2. Build a details object with as much technical info as we can capture
  const details = {
    raw: error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error,
  };

  // 3. Try to find out who the user is (may be null during signup)
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  // 4. Write the error to the database. We deliberately do NOT throw if this
  //    fails - logging must never crash the app.
  try {
    await supabase.from("error_logs").insert({
      user_id: userId,
      context,
      message,
      details,
      page_url: typeof window !== "undefined" ? window.location.href : null,
    });
  } catch (logErr) {
    // If even the logging fails, just print it - don't break the app
    console.error("[logError] Failed to write error to database:", logErr);
  }
}
