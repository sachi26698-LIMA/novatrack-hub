import { useCallback, useEffect, useState } from "react";

export interface ReplitUser {
  id: string;
  name: string;
  profileImage: string | null;
  phoneNumber?: string | null;
}

export function useSession() {
  const [user, setUser] = useState<ReplitUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { user: ReplitUser | null }) => {
        setUser(data.user ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, loading, session: user ? { user } : null, logout };
}
