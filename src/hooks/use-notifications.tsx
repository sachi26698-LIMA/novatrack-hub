import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { listNotifications } from "@/lib/queries-extra";

export function useNotifications() {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }, 30000);
    return () => clearInterval(interval);
  }, [user, qc]);

  const unread = (query.data ?? []).filter((n) => !n.read_at).length;
  return { ...query, unread };
}
