import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ─── Environment ────────────────────────────────────────────────────────────
// import.meta.env is available in both Vite client builds AND Vite SSR builds.
// process.env is the fallback for plain Node.js (non-Vite) contexts.
const SUPABASE_URL: string =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  (typeof process !== 'undefined'
    ? (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '')
    : '');

const SUPABASE_KEY: string =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (typeof process !== 'undefined'
    ? (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
       process.env.SUPABASE_PUBLISHABLE_KEY ??
       '')
    : '');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY env vars.');
}

// ─── SSR-safe lazy client ────────────────────────────────────────────────────
// Supabase's RealtimeClient constructor calls getWebSocketConstructor() which
// throws on Node.js 20 (no native WebSocket).  We avoid this by:
//   • On the server  → return a no-op proxy (auth + DB calls are never made SSR)
//   • On the browser → create the real client once, lazily on first access
//
// All app code that calls `supabase.*` runs inside React components / effects,
// which only execute in the browser — so the proxy is transparent in practice.

type Supa = SupabaseClient<Database>;

const isServer = typeof window === 'undefined';

let _client: Supa | null = null;

function getClient(): Supa {
  if (isServer) {
    // Return a proxy that logs a warning and returns safe defaults for every call.
    // In practice no component code reaches here because effects are browser-only.
    return new Proxy({} as Supa, {
      get(_, prop) {
        if (prop === 'then') return undefined; // not a Promise
        // Return a chainable no-op so code like supabase.from('x').select() doesn't throw
        const noop: unknown = new Proxy(
          (() => Promise.resolve({ data: null, error: null })) as unknown as object,
          {
            get: () => noop,
            apply: () => Promise.resolve({ data: null, error: null }),
          },
        );
        return noop;
      },
    });
  }

  if (!_client) {
    _client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _client;
}

export const supabase: Supa = new Proxy({} as Supa, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
