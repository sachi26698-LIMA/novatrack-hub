import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Phone,
  Sparkles,
  LogIn,
} from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { useSession } from "@/hooks/use-session";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import {
  sendPhoneOTP,
  verifyPhoneOTP,
  clearRecaptcha,
} from "@/lib/firebase-phone-auth";
import { isFirebaseConfigured } from "@/lib/firebase";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to TrackNova." },
    ],
  }),
  component: AuthPage,
});

type Step = "initial" | "otp";

// Derive a deterministic Supabase credential from a phone number.
// Firebase already verified the phone — we just need a stable Supabase identity.
function phoneToEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.tracknova.app`;
}
function phoneToPass(phone: string) {
  return `pn_${phone.replace(/\D/g, "")}_tn1`;
}

async function createSupabasePhoneSession(phone: string): Promise<void> {
  const email = phoneToEmail(phone);
  const password = phoneToPass(phone);

  // Try sign-in first; if no account, sign up then sign in
  const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
  if (!siErr) return;

  const { error: suErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { phone, source: "phone_otp" },
      emailRedirectTo: undefined,
    },
  });
  if (suErr) throw new Error(suErr.message);

  // Sign in after sign-up
  const { error: si2Err } = await supabase.auth.signInWithPassword({ email, password });
  if (si2Err) throw new Error(si2Err.message);
}

function AuthPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("initial");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const cleanedUp = useRef(false);

  // Redirect after successful login
  useEffect(() => {
    if (!loading && user) {
      let dest = "/dashboard";
      try {
        const saved = localStorage.getItem("tk_redirect");
        if (saved && saved !== "/auth" && saved !== "/") {
          localStorage.removeItem("tk_redirect");
          dest = saved;
        }
      } catch {}
      navigate({ to: dest as "/" });
    }
  }, [loading, user, navigate]);

  // Clean up reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      if (!cleanedUp.current) {
        cleanedUp.current = true;
        clearRecaptcha();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen relative grid place-items-center">
        <AnimatedBackground />
        <Loader2 className="h-8 w-8 animate-spin text-[color:var(--neon-cyan)]" />
      </div>
    );
  }

  if (user) return null;

  // ── Google OAuth ───────────────────────────────────────────────────────────
  async function handleGoogle() {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw new Error(error.message);
      // Page will redirect — no state update needed
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  // ── Send OTP ───────────────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setError("Enter a phone number."); return; }

    const formatted = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
    if (formatted.replace(/\D/g, "").length < 7) {
      setError("Enter a valid international phone number (e.g. +1 555 000 1234).");
      return;
    }

    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured. Add VITE_FIREBASE_* secrets.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await sendPhoneOTP(formatted, "recaptcha-container");
      setPhone(formatted);
      setStep("otp");
      setOtpSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send OTP.");
      clearRecaptcha();
    } finally {
      setBusy(false);
    }
  }

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || otp.length < 4) { setError("Enter the 6-digit code."); return; }

    setBusy(true);
    setError("");
    try {
      const verifiedPhone = await verifyPhoneOTP(otp);
      // Create Supabase session from verified phone
      await createSupabasePhoneSession(verifiedPhone || phone);
      // useSession onAuthStateChange will pick up the new session automatically
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "OTP verification failed.");
    } finally {
      setBusy(false);
    }
  }

  // ── Back to initial step ───────────────────────────────────────────────────
  function handleBack() {
    setStep("initial");
    setOtp("");
    setOtpSent(false);
    setError("");
    clearRecaptcha();
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      {/* Invisible reCAPTCHA mount-point */}
      <div id="recaptcha-container" />

      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between">
          <BrandMark />
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-10 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
          {/* Brand header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
              Secure sign-in
            </div>

            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan)22, var(--neon-violet)22)" }}
            >
              <LogIn className="h-7 w-7 text-[color:var(--neon-cyan)]" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Welcome to <span className="neon-text">TrackNova</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === "initial" ? "Sign in to access your workspace." : `Enter the code sent to ${phone}`}
            </p>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-xl p-3 mb-4 text-xs"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ── Step: initial ── */}
            {step === "initial" && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                {/* Google button */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={busy || !isSupabaseConfigured}
                  className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-5 text-sm font-semibold border transition-all duration-200 disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "var(--foreground)",
                  }}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
                </div>

                {/* Phone OTP form */}
                <form onSubmit={handleSendOtp} className="space-y-3">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 000 1234"
                      className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "var(--foreground)",
                      }}
                      disabled={busy}
                      autoComplete="tel"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !isFirebaseConfigured()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground transition disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                    Continue with Phone
                  </button>
                </form>

                {/* Config warnings */}
                {!isSupabaseConfigured && (
                  <p className="text-center text-xs" style={{ color: "rgba(251,191,36,0.8)" }}>
                    ⚠ Supabase keys missing — Google login disabled
                  </p>
                )}
                {!isFirebaseConfigured() && (
                  <p className="text-center text-xs" style={{ color: "rgba(251,191,36,0.8)" }}>
                    ⚠ Firebase keys missing — Phone OTP disabled
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Step: OTP entry ── */}
            {step === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {otpSent && (
                  <div
                    className="flex items-center gap-2 rounded-xl p-3 text-xs"
                    style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)", color: "#2dd4bf" }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    OTP sent to {phone}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className="w-full rounded-xl py-3 px-4 text-center text-lg font-mono tracking-[0.4em] outline-none transition"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "var(--foreground)",
                    }}
                    disabled={busy}
                    autoFocus
                    autoComplete="one-time-code"
                  />
                  <button
                    type="submit"
                    disabled={busy || otp.length < 4}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground transition disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Verify Code
                  </button>
                </form>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our Terms &amp; Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
