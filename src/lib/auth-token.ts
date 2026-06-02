import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current Supabase JWT access token, or null if not signed in.
 * Used by apiFetch to send Authorization: Bearer headers to the API server.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Legacy compat — no-op in the Supabase flow
export function setTokenRefresher(_fn: () => Promise<string | null>): void {}
