import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import type { ConfirmationResult } from "firebase/auth";

let _confirmationResult: ConfirmationResult | null = null;
let _recaptchaVerifier: import("firebase/auth").RecaptchaVerifier | null = null;

export function clearRecaptcha(): void {
  if (_recaptchaVerifier) {
    try { _recaptchaVerifier.clear(); } catch {}
    _recaptchaVerifier = null;
  }
  _confirmationResult = null;
}

async function ensureRecaptcha(containerId: string) {
  if (_recaptchaVerifier) return _recaptchaVerifier;
  const auth = await getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth not configured.");
  const { RecaptchaVerifier } = await import("firebase/auth");
  _recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => { clearRecaptcha(); },
  });
  return _recaptchaVerifier;
}

export async function sendPhoneOTP(
  phone: string,
  containerId = "recaptcha-container"
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add VITE_FIREBASE_* secrets.");
  }
  const auth = await getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth failed to initialise.");
  const verifier = await ensureRecaptcha(containerId);
  const { signInWithPhoneNumber } = await import("firebase/auth");
  _confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
}

export async function verifyPhoneOTP(otp: string): Promise<string> {
  if (!_confirmationResult) throw new Error("No active OTP session. Please send OTP first.");
  const result = await _confirmationResult.confirm(otp);
  return result.user.phoneNumber ?? "";
}

export async function signOutFirebase(): Promise<void> {
  const auth = await getFirebaseAuth();
  if (!auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}
