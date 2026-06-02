// Firebase Phone Auth is not used in this Replit deployment.
// Authentication is handled via Replit Auth.
// This stub prevents import errors.

export function initRecaptcha(_containerId: string): never {
  throw new Error("Firebase Phone Auth is not available. Use Replit Auth.");
}

export async function sendPhoneOTP(
  _phoneNumber: string,
  _containerId: string,
): Promise<never> {
  throw new Error("Firebase Phone Auth is not available. Use Replit Auth.");
}

export async function verifyOTPAndLinkSupabase(
  _confirmationResult: unknown,
  _otp: string,
  _phoneNumber: string,
): Promise<void> {
  throw new Error("Firebase Phone Auth is not available. Use Replit Auth.");
}

export async function signOutFirebase(): Promise<void> {
  // no-op
}
