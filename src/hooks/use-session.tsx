import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface ReplitUser {
  id: string;
  name: string;
  profileImage: string | null;
  phoneNumber?: string | null;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | null;

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
      (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
    phoneNumber: user.phone ?? null,
  };
}

/** Sync profile row in Replit PostgreSQL and return role + approval status */
async function syncAndFetchProfile(
  token: string
): Promise<{ role: string; approvalStatus: ApprovalStatus }> {
  try {
    // Sync profile
    await fetch("/api/auth/session", {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    // Fetch role + approval status
    const r = await fetch("/api/auth/profile", {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const d = (await r.json()) as {
        profile?: { role?: string };
        approvalStatus?: string | null;
      };
      return {
        role: d.profile?.role ?? "Worker",
        approvalStatus: (d.approvalStatus ?? null) as ApprovalStatus,
      };
    }
  } catch {}
  return { role: "Worker", approvalStatus: null };
}

export function useSession() {
  const [user, setUser]                   = useState<ReplitUser | null>(null);
  const [session, setSession]             = useState<Session | null>(null);
  const [loading, setLoading]             = useState(true);
  const [role, setRole]                   = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      fetch("/api/auth/session", { credentials: "include" })
        .then((r) => r.json())
        .then((d: { user: ReplitUser | null }) => {
          setUser(d.user ?? null);
          setRole("Admin"); // Replit auth users are admins
        })
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
      return;
    }

    // ── Initial session load ──────────────────────────────────────────────
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data?.session ?? null;
      setSession(s);
      setUser(s?.user ? toAppUser(s.user) : null);
      if (s?.access_token) {
        const { role: r, approvalStatus: as_ } = await syncAndFetchProfile(s.access_token);
        setRole(r);
        setApprovalStatus(as_);
      }
      setLoading(false);
    });

    // ── Auth state changes ────────────────────────────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setUser(s?.user ? toAppUser(s.user) : null);

      if (event === "SIGNED_IN" && s?.access_token) {
        const { role: r, approvalStatus: as_ } = await syncAndFetchProfile(s.access_token);
        setRole(r);
        setApprovalStatus(as_);
      }
      if (event === "SIGNED_OUT") {
        setRole(null);
        setApprovalStatus(null);
      }
      setLoading(false);
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
    setRole(null);
    setApprovalStatus(null);
  }, []);

  /** Re-fetch role + approval status (call after admin approves) */
  const refreshProfile = useCallback(async () => {
    const s = (await supabase.auth.getSession()).data.session;
    if (!s?.access_token) return;
    const { role: r, approvalStatus: as_ } = await syncAndFetchProfile(s.access_token);
    setRole(r);
    setApprovalStatus(as_);
  }, []);

  return { user, session, loading, logout, role, approvalStatus, refreshProfile };
}
