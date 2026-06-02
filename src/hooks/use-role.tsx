import { useEffect, useRef, useState } from "react";
import { useSession } from "@/hooks/use-session";

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

    fetch("/api/role")
      .then((r) => r.json())
      .then(({ role: r }: { role: AppRole }) => {
        if (cancelled || !mounted.current) return;
        setRole(r ?? "Worker");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled || !mounted.current) return;
        setRole("Worker");
        setLoading(false);
      });

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
