import { useEffect, useRef, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { getAuthToken } from "@/lib/auth-token";

export type AppRole = "Admin" | "Manager" | "Supervisor" | "Worker";

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

    (async () => {
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch("/api/role", { headers });
        const { role: fetchedRole } = (await r.json()) as { role: AppRole };
        if (cancelled || !mounted.current) return;
        setRole(fetchedRole ?? "Worker");
      } catch {
        if (cancelled || !mounted.current) return;
        setRole("Worker");
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    })();

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
