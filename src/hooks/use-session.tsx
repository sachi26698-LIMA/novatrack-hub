import { useEffect, useRef, useState } from "react";

export interface ReplitUser {
  id: string;
  name: string;
  profileImage: string | null;
}

export function useSession() {
  const [user, setUser] = useState<ReplitUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(({ user: u }: { user: ReplitUser | null }) => {
        if (!mounted.current) return;
        setUser(u);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current) return;
        setUser(null);
        setLoading(false);
      });
    return () => { mounted.current = false; };
  }, []);

  return { user, loading, session: user ? { user } : null };
}
