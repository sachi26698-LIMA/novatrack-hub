import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface ReplitUser {
  id: string;
  name: string;
  profileImage: string | null;
  phoneNumber?: string | null;
}

function toAppUser(user: User): ReplitUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name:
      (meta.full_name as string) ??
      (meta.name as string) ??
      user.email ??
      user.phone ??
      user.id,
    profileImage:
      (meta.avatar_url as string) ??
      (meta.picture as string) ??
      null,
    phoneNumber: user.phone ?? null,
  };
}

/** Upsert profile row in Replit PostgreSQL via API after sign-in */
async function syncProfile(token: string): Promise<void> {
  try {
    await fetch("/api/auth/session", {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
}

export function useSession() {
  const [user, setUser] = useState<ReplitUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Fall back to Replit header-based auth
      fetch("/api/auth/session", { credentials: "include" })
        .then((r) => r.json())
        .then((d: { user: ReplitUser | null }) => {
          setUser(d.user ?? null);
        })
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
      return;
    }

    // Load existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      const s = data?.session ?? null;
      setSession(s);
      setUser(s?.user ? toAppUser(s.user) : null);
      setLoading(false);
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setUser(s?.user ? toAppUser(s.user) : null);
      setLoading(false);

      // Sync profile row after sign-in
      if (event === "SIGNED_IN" && s?.access_token) {
        await syncProfile(s.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      await fetch("/api/auth/logout", { method: "POST" });
    }
    setUser(null);
    setSession(null);
  }, []);

  return { user, session, loading, logout };
}
