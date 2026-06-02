import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

let _recaptcha: RecaptchaVerifier | null = null;

export function clearRecaptcha(): void {
  if (_recaptcha) {
    try { _recaptcha.clear(); } catch { /* already cleared */ }
    _recaptcha = null;
  }
}

function buildVerifier(auth: Auth, containerId: string): RecaptchaVerifier {
  clearRecaptcha();
  _recaptcha = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => { clearRecaptcha(); },
  });
  return _recaptcha;
}

export async function sendPhoneOTP(
  phoneNumber: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured.");
  const verifier = buildVerifier(auth, containerId);
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyPhoneOTP(
  confirmationResult: ConfirmationResult,
  otp: string,
): Promise<string> {
  const result = await confirmationResult.confirm(otp);
  return result.user.getIdToken();
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}
