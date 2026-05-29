import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export type AppRole = "Admin" | "Manager" | "Supervisor" | "Worker";

export function useRole() {
  const { user, loading: sessionLoading } = useSession();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user?.id) {
      setRole(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        // Prefer Admin if user has multiple roles
        const roles = (data ?? []).map((r) => r.role as AppRole);
        const resolved =
          roles.find((r) => r === "Admin") ??
          roles[0] ??
          null;
        setRole(resolved);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, sessionLoading]);

  return {
    role,
    loading: loading || sessionLoading,
    isAdmin: role === "Admin",
    isManager: role === "Manager" || role === "Admin",
  };
}
