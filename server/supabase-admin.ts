/**
 * Server-side only Supabase Admin client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY — NEVER expose this key to the frontend.
 * This module must only be imported from server/ files.
 *
 * Capabilities (vs anon key):
 *  - Bypass RLS on Supabase-hosted tables
 *  - List / delete / update any auth user
 *  - Send invite emails programmatically
 *  - Admin-level JWT operations
 */

let _adminClient: ReturnType<typeof import("@supabase/supabase-js").createClient> | null = null;

export function getSupabaseAdmin() {
  if (_adminClient) return _adminClient;

  const supabaseUrl     = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null; // graceful degradation — key not yet configured
  }

  // Dynamic import keeps this module out of the browser bundle entirely
  const { createClient } = require("@supabase/supabase-js");
  _adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}

export const isAdminConfigured =
  !!(process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
