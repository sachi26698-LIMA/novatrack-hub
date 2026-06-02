// Firebase — lazy initializer to avoid SSR errors when env vars are absent.

let _app: import("firebase/app").FirebaseApp | null = null;
let _auth: import("firebase/auth").Auth | null = null;

function getConfig() {
  return {
    apiKey:            import.meta.env?.VITE_FIREBASE_API_KEY            as string,
    authDomain:        import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN        as string,
    projectId:         import.meta.env?.VITE_FIREBASE_PROJECT_ID         as string,
    storageBucket:     import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET     as string,
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId:             import.meta.env?.VITE_FIREBASE_APP_ID             as string,
  };
}

export function isFirebaseConfigured(): boolean {
  if (typeof window === "undefined") return false;
  const cfg = getConfig();
  return !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}

export async function getFirebaseApp(): Promise<import("firebase/app").FirebaseApp | null> {
  if (!isFirebaseConfigured()) return null;
  if (_app) return _app;
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  _app = getApps().length > 0 ? getApp() : initializeApp(getConfig());
  return _app;
}

export async function getFirebaseAuth(): Promise<import("firebase/auth").Auth | null> {
  if (!isFirebaseConfigured()) return null;
  if (_auth) return _auth;
  const app = await getFirebaseApp();
  if (!app) return null;
  const { getAuth } = await import("firebase/auth");
  _auth = getAuth(app);
  return _auth;
}
