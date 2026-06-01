// Lovable OAuth is not available on Replit.
// Google sign-in has been removed; use email/password auth instead.

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: string, _opts?: unknown) => {
      return { error: new Error("OAuth sign-in is not available in this environment. Please use email and password.") };
    },
  },
};
