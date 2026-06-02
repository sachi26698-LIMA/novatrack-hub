import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { setTokenRefresher } from "@/lib/auth-token";

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
    const auth = getFirebaseAuth();

    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }

    setTokenRefresher(async () => {
      const u = auth.currentUser;
      if (!u) return null;
      return u.getIdToken();
    });

    const unsubscribe = onAuthStateChanged(auth, (fbUser: User | null) => {
      if (fbUser) {
        setUser({
          id: fbUser.uid,
          name: fbUser.phoneNumber ?? fbUser.displayName ?? fbUser.uid,
          profileImage: fbUser.photoURL,
          phoneNumber: fbUser.phoneNumber,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }, []);

  return { user, loading, session: user ? { user } : null, logout };
}
