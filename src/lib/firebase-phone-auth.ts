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

/** Maps Firebase auth error codes to human-readable messages */
export function mapFirebaseError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/operation-not-allowed":
      return "Phone sign-in is not enabled on this project. Please use email or Google to sign in, or contact your administrator to enable Phone Authentication in Firebase Console → Authentication → Sign-in method.";
    case "auth/invalid-phone-number":
      return "Invalid phone number format. Include your country code — e.g. +91 98765 43210 or +1 555 000 1234.";
    case "auth/too-many-requests":
      return "Too many SMS requests. Please wait a few minutes before trying again.";
    case "auth/code-expired":
      return "The OTP code has expired. Please request a new one.";
    case "auth/invalid-verification-code":
      return "Incorrect code. Check the SMS and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection and try again.";
    case "auth/captcha-check-failed":
    case "auth/invalid-app-credential":
      return "reCAPTCHA verification failed. Refresh the page and try again.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded for today. Try again tomorrow or use email/Google instead.";
    case "auth/app-not-authorized":
      return "This domain is not authorised for phone sign-in. Add it to Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/missing-phone-number":
      return "Enter a phone number to continue.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    case "auth/session-expired":
      return "Your session has expired. Please sign in again.";
    default: {
      const msg = (error as Error)?.message ?? "";
      return msg.replace(/^Firebase:\s*/i, "").replace(/\s*\(auth\/[\w-]+\)\.$/, "").trim()
        || "An unexpected error occurred. Please try again.";
    }
  }
}

async function ensureRecaptcha(containerId: string) {
  if (_recaptchaVerifier) return _recaptchaVerifier;
  const auth = await getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth not initialised.");
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
    throw new Error("Firebase is not configured. Add the VITE_FIREBASE_* environment variables.");
  }
  const auth = await getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth failed to initialise. Check your VITE_FIREBASE_* keys.");
  try {
    const verifier = await ensureRecaptcha(containerId);
    const { signInWithPhoneNumber } = await import("firebase/auth");
    _confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
  } catch (err) {
    clearRecaptcha();
    throw new Error(mapFirebaseError(err));
  }
}

export async function verifyPhoneOTP(otp: string): Promise<string> {
  if (!_confirmationResult) throw new Error("No active OTP session. Please send the code first.");
  try {
    const result = await _confirmationResult.confirm(otp);
    return result.user.phoneNumber ?? "";
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function signOutFirebase(): Promise<void> {
  const auth = await getFirebaseAuth();
  if (!auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}
