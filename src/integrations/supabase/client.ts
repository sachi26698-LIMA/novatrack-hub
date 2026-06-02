import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL ?? "") as string;
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY ?? "") as string;

export const isSupabaseConfigured =
  !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("https://"));

// Real client when configured; safe no-op proxy when keys are missing (SSR / not yet set)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "tracknova_auth",
      },
    })
  : (new Proxy({} as never, {
      get(_t, prop) {
        if (prop === "then") return undefined;
        const noop: unknown = new Proxy(
          (() => Promise.resolve({ data: null, error: null })) as unknown as object,
          { get: () => noop, apply: () => Promise.resolve({ data: null, error: null }) }
        );
        return noop;
      },
    }) as ReturnType<typeof createClient>);
