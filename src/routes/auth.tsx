import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Loader2, Phone, Shield, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { useSession } from "@/hooks/use-session";
import { sendPhoneOTP, verifyPhoneOTP, clearRecaptcha } from "@/lib/firebase-phone-auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to TrackNova with your phone number." },
    ],
  }),
  component: AuthPage,
});

type Step = "phone" | "otp";

function AuthPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [step, setStep]           = useState<Step>("phone");
  const [phone, setPhone]         = useState("+");
  const [otp, setOtp]             = useState("");
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resendSecs, setResendSecs] = useState(0);
  const confirmRef                = useRef<ConfirmationResult | null>(null);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearRecaptcha();
    };
  }, []);

  function startCountdown() {
    setResendSecs(30);
    timerRef.current = setInterval(() => {
      setResendSecs((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured. Please set VITE_FIREBASE_* environment variables.");
      return;
    }
    const cleaned = phone.trim();
    if (!/^\+\d{7,15}$/.test(cleaned)) {
      setError("Enter a valid phone number with country code (e.g. +12025551234)");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await sendPhoneOTP(cleaned, "recaptcha-container");
      confirmRef.current = result;
      setStep("otp");
      startCountdown();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send code";
      setError(
        msg.includes("invalid-phone-number") ? "Invalid phone number format." :
        msg.includes("too-many-requests")    ? "Too many attempts. Please wait and try again." :
        msg.includes("quota-exceeded")       ? "SMS quota exceeded. Try again later." :
        msg
      );
      clearRecaptcha();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmRef.current) { setError("Session expired. Please resend the code."); return; }
    if (otp.length !== 6) { setError("Enter the 6-digit code."); return; }
    setError(null);
    setBusy(true);
    try {
      await verifyPhoneOTP(confirmRef.current, otp);
      // onAuthStateChanged in use-session picks up the new user automatically
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      setError(
        msg.includes("invalid-verification-code") ? "Incorrect code. Please try again." :
        msg.includes("code-expired")              ? "Code expired. Please request a new one." :
        msg.includes("session-expired")           ? "Session expired. Please resend the code." :
        msg
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendSecs > 0 || busy) return;
    setOtp("");
    setError(null);
    setBusy(true);
    try {
      const result = await sendPhoneOTP(phone.trim(), "recaptcha-container");
      confirmRef.current = result;
      startCountdown();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to resend code");
      clearRecaptcha();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen relative grid place-items-center">
        <AnimatedBackground />
        <Loader2 className="h-8 w-8 animate-spin text-[color:var(--neon-cyan)]" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      <div id="recaptcha-container" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between">
          <BrandMark />
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-10 pb-16">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
          <div className="flex flex-col items-center text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
              {step === "phone" ? "Secure phone verification" : "Enter your code"}
            </div>

            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan)22, var(--neon-violet)22)" }}>
              {step === "phone"
                ? <Phone className="h-7 w-7 text-[color:var(--neon-cyan)]" />
                : <Shield className="h-7 w-7 text-[color:var(--neon-violet)]" />
              }
            </div>

            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {step === "phone"
                ? <>Welcome to <span className="neon-text">TrackNova</span></>
                : "Verify your number"
              }
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === "phone"
                ? "Enter your phone number to receive a verification code."
                : <>Code sent to <span className="text-foreground font-medium">{phone}</span></>
              }
            </p>
          </div>

          {step === "phone" ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoFocus
                  autoComplete="tel"
                  placeholder="+12025551234"
                  value={phone}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPhone(v.startsWith("+") ? v : "+" + v.replace(/^\+*/, ""));
                    setError(null);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-mono focus:outline-none focus:border-[color:var(--neon-cyan)] focus:ring-1 focus:ring-[color:var(--neon-cyan)] transition placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Include country code (e.g. +1 for US)</p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || phone.length < 8}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {busy ? "Sending…" : "Send Verification Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-2xl font-mono tracking-[0.5em] text-center focus:outline-none focus:border-[color:var(--neon-violet)] focus:ring-1 focus:ring-[color:var(--neon-violet)] transition placeholder:text-muted-foreground placeholder:tracking-normal"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, var(--neon-violet), var(--neon-cyan))" }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {busy ? "Verifying…" : "Verify Code"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtp(""); setError(null); clearRecaptcha(); }}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  ← Change number
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendSecs > 0 || busy}
                  className="text-[color:var(--neon-cyan)] disabled:text-muted-foreground disabled:cursor-not-allowed hover:opacity-80 transition font-medium"
                >
                  {resendSecs > 0 ? `Resend in ${resendSecs}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our Terms &amp; Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
