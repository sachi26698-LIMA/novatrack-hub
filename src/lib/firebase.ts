import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

let _auth: Auth | null = null;
let _tried = false;

export function getFirebaseAuth(): Auth | null {
  if (_tried) return _auth;
  _tried = true;
  if (!isFirebaseConfigured()) return null;
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    _auth = getAuth(app);
  } catch (e) {
    console.warn("[TrackNova] Firebase init failed:", e);
    _auth = null;
  }
  return _auth;
}
