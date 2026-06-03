import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2,
  LogIn, Mail, Phone, RefreshCw, ShieldCheck,
} from "lucide-react";
import {
  AuthShell, AuthInput, AuthError, AuthWarning, AuthInfo,
  AuthDivider, GhostBtn, GoogleLogo, PrimaryBtn,
} from "@/components/auth-shell";
import { useSession } from "@/hooks/use-session";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { sendPhoneOTP, verifyPhoneOTP, clearRecaptcha } from "@/lib/firebase-phone-auth";
import { isFirebaseConfigured } from "@/lib/firebase";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to your TrackNova workspace." },
    ],
  }),
  component: AuthPage,
});

type View = "main" | "phone" | "otp";

// ── Helpers ──────────────────────────────────────────────────────────────────
function phoneToEmail(phone: string) { return `${phone.replace(/\D/g, "")}@phone.tracknova.app`; }
function phoneToPass(phone: string)  { return `pn_${phone.replace(/\D/g, "")}_tn1`; }

async function supabasePhoneSession(phone: string) {
  const email = phoneToEmail(phone);
  const password = phoneToPass(phone);
  const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
  if (!siErr) return;
  // First-time phone user — create a Supabase account for session management
  await supabase.auth.signUp({ email, password, options: { data: { phone, source: "phone_otp" } } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(mapSupabaseError(error.message, error.code));
}

/** Maps Supabase error messages/codes to user-friendly strings */
function mapSupabaseError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Incorrect email or password. Please check and try again.";
  if (m.includes("email not confirmed") || code === "email_not_confirmed")
    return "Email not verified. Check your inbox for a confirmation link from TrackNova.";
  if (m.includes("too many requests") || code === "over_request_rate_limit")
    return "Too many attempts. Please wait a few minutes before trying again.";
  if (m.includes("user not found"))
    return "No account found with this email address.";
  if (m.includes("missing oauth secret") || m.includes("unsupported provider"))
    return "Google sign-in is not configured yet. Please use email or phone to sign in.";
  if (m.includes("validation_failed"))
    return "Google sign-in is not set up. Please use email or phone instead.";
  if (m.includes("oauth_provider_not_supported"))
    return "This sign-in method is not supported. Try email or phone.";
  if (m.includes("over_email_send_rate_limit"))
    return "Too many emails sent. Please wait before requesting another.";
  if (m.includes("password should be") || m.includes("password must"))
    return "Password must be at least 8 characters.";
  if (m.includes("network") || m.includes("fetch"))
    return "Network error. Check your connection and try again.";
  return message;
}

/** Parse OAuth error params from callback URL (e.g. Supabase redirect errors) */
function extractOAuthError(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const code = params.get("error_code") ?? "";
  const desc = params.get("error_description") ?? params.get("error") ?? "";
  if (!code && !desc) return "";
  // Clean up URL immediately so it doesn't persist on refresh
  window.history.replaceState({}, "", window.location.pathname);
  return mapSupabaseError(desc || code);
}

function AuthPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [view, setView]               = useState<View>("main");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPwd, setShowPwd]         = useState(false);
  const [rememberMe, setRememberMe]   = useState(true);
  const [phone, setPhone]             = useState("");
  const [otp, setOtp]                 = useState("");
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState("");
  const [info, setInfo]               = useState("");
  const [warning, setWarning]         = useState("");
  const [otpSent, setOtpSent]         = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const rcRef = useRef(false);

  // ── Redirect when already signed in ──────────────────────────────────────
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

  // ── Detect OAuth callback errors (e.g. Google OAuth misconfigured) ────────
  useEffect(() => {
    const oauthErr = extractOAuthError();
    if (oauthErr) setError(oauthErr);
  }, []);

  // ── Cleanup reCAPTCHA on unmount ─────────────────────────────────────────
  useEffect(() => () => { if (!rcRef.current) { rcRef.current = true; clearRecaptcha(); } }, []);

  // ── Resend OTP countdown ─────────────────────────────────────────────────
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  if (loading) return (
    <div className="min-h-screen grid place-items-center" style={{ background: "var(--background)" }}>
      <Loader2 className="h-8 w-8 animate-spin text-[color:var(--neon-cyan)]" />
    </div>
  );
  if (user) return null;

  function resetMessages() { setError(""); setInfo(""); setWarning(""); setBusy(false); }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    if (!isSupabaseConfigured) { setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."); return; }
    setBusy(true); resetMessages();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    // If error is returned before redirect (SDK-level check)
    if (error) {
      setError(mapSupabaseError(error.message, error.code));
      setBusy(false);
    }
    // If redirect succeeds, the page will navigate away — no need to clear busy
  }

  // ── Email login ───────────────────────────────────────────────────────────
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim())  { setError("Enter your email address."); return; }
    if (!password)      { setError("Enter your password."); return; }
    if (!isSupabaseConfigured) { setError("Supabase is not configured."); return; }
    setBusy(true); resetMessages();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(mapSupabaseError(error.message, error.code));
      setBusy(false);
    }
    // On success, onAuthStateChange fires → useSession updates → redirect happens automatically
  }

  // ── Send OTP ──────────────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const formatted = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
    if (formatted.replace(/\D/g, "").length < 7) {
      setError("Enter a valid international number — e.g. +91 98765 43210 or +1 555 000 1234.");
      return;
    }
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured. Add VITE_FIREBASE_* secrets to enable phone sign-in.");
      return;
    }
    setBusy(true); resetMessages();
    try {
      await sendPhoneOTP(formatted, "recaptcha-container-login");
      setPhone(formatted);
      setView("otp");
      setOtpSent(true);
      setResendCountdown(60);
      setInfo(`Code sent to ${formatted}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send OTP.");
      clearRecaptcha();
    } finally { setBusy(false); }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async function handleResendOtp() {
    if (resendCountdown > 0 || busy) return;
    setBusy(true); resetMessages();
    clearRecaptcha();
    try {
      await sendPhoneOTP(phone, "recaptcha-container-login");
      setResendCountdown(60);
      setInfo(`New code sent to ${phone}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to resend OTP.");
      clearRecaptcha();
    } finally { setBusy(false); }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) { setError("Enter the 6-digit code from your SMS."); return; }
    setBusy(true); resetMessages();
    try {
      const verifiedPhone = await verifyPhoneOTP(otp);
      await supabasePhoneSession(verifiedPhone || phone);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed. Check the code and try again.");
      setBusy(false);
    }
  }

  const variants = {
    enter:  (dir: number) => ({ opacity: 0, x: dir * 28 }),
    center: { opacity: 1, x: 0 },
    exit:   (dir: number) => ({ opacity: 0, x: dir * -28 }),
  };

  return (
    <AuthShell badge="Secure sign-in">
      <div id="recaptcha-container-login" />

      {/* Heading */}
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4 mx-auto"
          style={{ background: "linear-gradient(135deg,rgba(0,229,255,0.12),rgba(139,92,246,0.12))" }}
        >
          <LogIn className="h-7 w-7 text-[color:var(--neon-cyan)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {view === "main"  ? <>Welcome <span className="neon-text">back</span></> :
           view === "phone" ? "Phone sign-in" :
           "Enter your code"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {view === "main"  ? "Sign in to access your workspace" :
           view === "phone" ? "We'll send a one-time code via SMS" :
           `Code sent to ${phone}`}
        </p>
      </div>

      <AnimatePresence mode="wait" custom={view === "otp" ? 1 : -1}>

        {/* ── Main view ────────────────────────────────────────────────────── */}
        {view === "main" && (
          <motion.div key="main" custom={-1} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <AuthError   msg={error} />
            <AuthWarning msg={warning} />

            {/* Google */}
            <GhostBtn onClick={handleGoogle} disabled={busy || !isSupabaseConfigured}>
              <GoogleLogo /> Continue with Google
            </GhostBtn>

            <AuthDivider label="or sign in with email" />

            {/* Email/password form */}
            <form onSubmit={handleEmail} className="space-y-3">
              <AuthInput icon={Mail} type="email" value={email} onChange={setEmail}
                placeholder="you@company.com" autoComplete="email" disabled={busy} />
              <AuthInput icon={KeyRound} type={showPwd ? "text" : "password"}
                value={password} onChange={setPassword}
                placeholder="Password" autoComplete="current-password" disabled={busy}
                right={
                  <button type="button" onClick={() => setShowPwd((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded accent-[color:var(--neon-cyan)] h-3.5 w-3.5" />
                  Remember me
                </label>
                <Link to="/forgot-password"
                  className="text-xs text-[color:var(--neon-cyan)] hover:underline transition-colors">
                  Forgot password?
                </Link>
              </div>
              <PrimaryBtn type="submit" loading={busy}>
                <LogIn className="h-4 w-4" /> Sign in
              </PrimaryBtn>
            </form>

            <AuthDivider label="or" />

            {/* Phone OTP */}
            <GhostBtn
              onClick={() => { resetMessages(); setView("phone"); }}
              disabled={busy || !isFirebaseConfigured()}
            >
              <Phone className="h-4 w-4" /> Continue with Phone
            </GhostBtn>

            {/* Show hint if Firebase is configured but phone auth may not be enabled */}
            {isFirebaseConfigured() && (
              <p className="text-center text-[10px] text-muted-foreground mt-1.5">
                Phone auth requires Firebase → Authentication → Sign-in method → Phone to be enabled
              </p>
            )}

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-[color:var(--neon-cyan)] hover:underline font-medium">
                Create one free
              </Link>
            </p>
          </motion.div>
        )}

        {/* ── Phone number entry ───────────────────────────────────────────── */}
        {view === "phone" && (
          <motion.div key="phone" custom={1} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <AuthError   msg={error} />
            <AuthWarning msg={warning} />
            <form onSubmit={handleSendOtp} className="space-y-3">
              <AuthInput icon={Phone} type="tel" value={phone} onChange={setPhone}
                placeholder="+91 98765 43210 or +1 555 000 1234"
                autoComplete="tel" disabled={busy} />
              <p className="text-[10px] text-muted-foreground -mt-1">
                Include your country code. Standard SMS rates may apply.
              </p>
              <PrimaryBtn type="submit" loading={busy}>
                <Phone className="h-4 w-4" /> Send OTP
              </PrimaryBtn>
            </form>
            <button type="button"
              onClick={() => { resetMessages(); setView("main"); clearRecaptcha(); }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
          </motion.div>
        )}

        {/* ── OTP verification ─────────────────────────────────────────────── */}
        {view === "otp" && (
          <motion.div key="otp" custom={1} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <AuthError msg={error} />
            <AuthInfo  msg={info} />

            {otpSent && !info && (
              <div className="flex items-center gap-2 rounded-xl p-3 mb-3 text-xs"
                style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)", color: "#2dd4bf" }}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Code sent to {phone}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="• • • • • •" autoFocus autoComplete="one-time-code"
                className="w-full rounded-xl py-4 px-4 text-center text-2xl font-mono tracking-[0.5em] outline-none transition"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--foreground)" }}
                onFocus={(e) => { e.target.style.border = "1px solid rgba(0,229,255,0.45)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,229,255,0.08)"; }}
                onBlur={(e)  => { e.target.style.border = "1px solid rgba(255,255,255,0.12)"; e.target.style.boxShadow = "none"; }}
              />
              <PrimaryBtn type="submit" loading={busy} disabled={otp.length < 4}>
                <ShieldCheck className="h-4 w-4" /> Verify Code
              </PrimaryBtn>
            </form>

            {/* Resend OTP */}
            <div className="mt-3 flex items-center justify-between">
              <button type="button"
                onClick={() => { resetMessages(); setOtp(""); setView("phone"); clearRecaptcha(); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
              </button>
              <button type="button"
                onClick={handleResendOtp}
                disabled={resendCountdown > 0 || busy}
                className="flex items-center gap-1.5 text-xs transition-colors py-2 disabled:opacity-40"
                style={{ color: resendCountdown > 0 ? "var(--muted-foreground)" : "var(--neon-cyan)" }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend OTP"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-5 text-center text-xs text-muted-foreground border-t border-white/6 pt-5">
        By continuing you agree to our{" "}
        <span className="text-[color:var(--neon-cyan)] cursor-pointer hover:underline">Terms</span>
        {" "}&amp;{" "}
        <span className="text-[color:var(--neon-cyan)] cursor-pointer hover:underline">Privacy Policy</span>
      </p>
    </AuthShell>
  );
}
