import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL ?? "") as string;
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY ?? "") as string;

export const isSupabaseConfigured =
  !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("https://"));

// Only instantiate the real client in the browser — Supabase Realtime uses
// WebSocket which throws on Node.js 20 (no native WebSocket support in SSR).
function makeClient() {
  if (typeof window === "undefined") return null;
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "tracknova_auth",
    },
  });
}

// Safe no-op proxy used server-side or when keys are missing
const noopProxy = new Proxy({} as never, {
  get(_t, prop) {
    if (prop === "then") return undefined;
    const noop: unknown = new Proxy(
      (() => Promise.resolve({ data: null, error: null })) as unknown as object,
      { get: () => noop, apply: () => Promise.resolve({ data: null, error: null }) }
    );
    return noop;
  },
}) as ReturnType<typeof createClient>;

export const supabase = makeClient() ?? noopProxy;
