// Firebase Phone Auth is not used in this Replit deployment.
// Replit Auth is used instead. This stub prevents import errors.

export function clearRecaptcha(): void {}

export async function sendPhoneOTP(): Promise<never> {
  throw new Error("Firebase Phone Auth is not configured.");
}

export async function verifyPhoneOTP(): Promise<never> {
  throw new Error("Firebase Phone Auth is not configured.");
}

export async function signOutFirebase(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
