import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  type ConfirmationResult,
  type Auth,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { supabase } from "@/integrations/supabase/client";

let recaptchaVerifier: RecaptchaVerifier | null = null;

function buildSupabaseCredentials(firebaseUid: string) {
  return {
    email:    `fb_${firebaseUid.slice(0, 20)}@tracknova.auth`,
    password: `fbpw_${firebaseUid}`,
  };
}

function requireAuth(): Auth {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured. Add your VITE_FIREBASE_* environment variables.");
  return auth;
}

export function initRecaptcha(containerId: string): RecaptchaVerifier {
  const auth = requireAuth();
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* ignore */ }
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => { recaptchaVerifier = null; },
  });
  return recaptchaVerifier;
}

export async function sendPhoneOTP(
  phoneNumber: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const auth    = requireAuth();
  const verifier = initRecaptcha(containerId);
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyOTPAndLinkSupabase(
  confirmationResult: ConfirmationResult,
  otp: string,
  phoneNumber: string,
): Promise<void> {
  const credential  = await confirmationResult.confirm(otp);
  const firebaseUid = credential.user.uid;
  const { email, password } = buildSupabaseCredentials(firebaseUid);

  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (!signInErr) return;

  const { error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        firebase_uid: firebaseUid,
        phone: phoneNumber,
        full_name: phoneNumber,
      },
    },
  });
  if (signUpErr) throw new Error(signUpErr.message);

  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(loginErr.message);
}

export async function signOutFirebase(): Promise<void> {
  try {
    recaptchaVerifier?.clear();
    recaptchaVerifier = null;
  } catch { /* ignore */ }
  const auth = getFirebaseAuth();
  if (auth) await fbSignOut(auth);
}
