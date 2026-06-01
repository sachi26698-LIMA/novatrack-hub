import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export type AppRole = "Admin" | "Manager" | "Supervisor" | "Worker";

const VALID_ROLES: AppRole[] = ["Admin", "Manager", "Supervisor", "Worker"];

export function useRole() {
  const { user, loading: sessionLoading } = useSession();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user?.id) {
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function resolveRole() {
      // 1. Try user_roles table (source of truth)
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });

      if (cancelled || !mounted.current) return;

      const roles = (data ?? []).map((r) => r.role as AppRole);
      let resolved: AppRole | null =
        roles.find((r) => r === "Admin") ?? roles[0] ?? null;

      // 2. Fallback: user_metadata set during signup
      if (!resolved) {
        const metaRole = user!.user_metadata?.role as AppRole | undefined;
        if (metaRole && VALID_ROLES.includes(metaRole)) {
          resolved = metaRole;
          // Persist into user_roles — FIX: correct onConflict target
          void supabase.from("user_roles").upsert(
            { user_id: user!.id, role: metaRole },
            { onConflict: "user_id,role" },
          );
        }
      }

      // 3. Default to Worker if still nothing
      if (!resolved) resolved = "Worker";

      setRole(resolved);
      setLoading(false);
    }

    resolveRole();
    return () => { cancelled = true; };
  }, [user?.id, sessionLoading]);

  return {
    role,
    loading: loading || sessionLoading,
    isAdmin: role === "Admin",
    isManager: role === "Manager" || role === "Admin",
    isSupervisor: role === "Supervisor" || role === "Manager" || role === "Admin",
    isWorker: role === "Worker",
  };
}
