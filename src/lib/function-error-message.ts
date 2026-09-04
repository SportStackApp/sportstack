export const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body && typeof body === "object" && "error" in body && body.error) {
          return String(body.error);
        }
      } catch {
        // Use the normal Supabase error message if the response body is not JSON.
      }
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
};
