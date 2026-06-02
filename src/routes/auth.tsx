import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2,
  LogIn, Mail, Phone, ShieldCheck,
} from "lucide-react";
import {
  AuthShell, AuthInput, AuthError, AuthDivider,
  GhostBtn, GoogleLogo, PrimaryBtn,
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
function phoneToEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.tracknova.app`;
}
function phoneToPass(phone: string) {
  return `pn_${phone.replace(/\D/g, "")}_tn1`;
}
async function supabasePhoneSession(phone: string) {
  const email = phoneToEmail(phone);
  const password = phoneToPass(phone);
  const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
  if (!siErr) return;
  await supabase.auth.signUp({ email, password, options: { data: { phone, source: "phone_otp" } } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

function AuthPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [view, setView]           = useState<View>("main");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [phone, setPhone]         = useState("");
  const [otp, setOtp]             = useState("");
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState("");
  const [otpSent, setOtpSent]     = useState(false);
  const rcRef = useRef(false);

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

  useEffect(() => () => { if (!rcRef.current) { rcRef.current = true; clearRecaptcha(); } }, []);

  if (loading) return (
    <div className="min-h-screen grid place-items-center" style={{ background: "var(--background)" }}>
      <Loader2 className="h-8 w-8 animate-spin text-[color:var(--neon-cyan)]" />
    </div>
  );
  if (user) return null;

  function reset() { setError(""); setBusy(false); }

  // ── Google ────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    if (!isSupabaseConfigured) { setError("Supabase keys not configured."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) { setError(error.message); setBusy(false); }
  }

  // ── Email login ───────────────────────────────────────────────────────────
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email."); return; }
    if (!password)      { setError("Enter your password."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message); setBusy(false); }
  }

  // ── Send OTP ──────────────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const formatted = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
    if (formatted.replace(/\D/g, "").length < 7) { setError("Enter a valid international number, e.g. +1 555 000 1234"); return; }
    if (!isFirebaseConfigured()) { setError("Firebase keys not configured."); return; }
    setBusy(true); setError("");
    try {
      await sendPhoneOTP(formatted, "recaptcha-container-login");
      setPhone(formatted); setView("otp"); setOtpSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send OTP."); clearRecaptcha();
    } finally { setBusy(false); }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) { setError("Enter the 6-digit code."); return; }
    setBusy(true); setError("");
    try {
      const verifiedPhone = await verifyPhoneOTP(otp);
      await supabasePhoneSession(verifiedPhone || phone);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed."); setBusy(false);
    }
  }

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
    center: { opacity: 1, x: 0 },
    exit:  (dir: number) => ({ opacity: 0, x: dir * -28 }),
  };

  return (
    <AuthShell badge="Secure sign-in">
      {/* reCAPTCHA mount point */}
      <div id="recaptcha-container-login" />

      {/* Heading */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4 mx-auto"
          style={{ background: "linear-gradient(135deg,var(--neon-cyan)18,var(--neon-violet)18)" }}>
          <LogIn className="h-7 w-7 text-[color:var(--neon-cyan)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {view === "main" ? <>Welcome <span className="neon-text">back</span></> :
           view === "phone" ? "Phone sign-in" : "Enter your code"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {view === "main"  ? "Sign in to access your workspace" :
           view === "phone" ? "We'll send a one-time code via SMS" :
           `Code sent to ${phone}`}
        </p>
      </div>

      <AnimatePresence mode="wait" custom={view === "otp" ? 1 : -1}>
        {/* ── Main view ─────────────────────────────────────────────────────── */}
        {view === "main" && (
          <motion.div key="main" custom={-1} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <AuthError msg={error} />

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
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {/* Remember Me + Forgot */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="rounded accent-[color:var(--neon-cyan)] h-3.5 w-3.5" />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-xs text-[color:var(--neon-cyan)] hover:underline transition-colors">
                  Forgot password?
                </Link>
              </div>
              <PrimaryBtn type="submit" loading={busy}>
                <LogIn className="h-4 w-4" /> Sign in
              </PrimaryBtn>
            </form>

            <AuthDivider label="or" />

            {/* Phone OTP */}
            <GhostBtn onClick={() => { reset(); setView("phone"); }} disabled={busy || !isFirebaseConfigured()}>
              <Phone className="h-4 w-4" /> Continue with Phone
            </GhostBtn>

            {/* Signup link */}
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-[color:var(--neon-cyan)] hover:underline font-medium">
                Create one free
              </Link>
            </p>
          </motion.div>
        )}

        {/* ── Phone view ────────────────────────────────────────────────────── */}
        {view === "phone" && (
          <motion.div key="phone" custom={1} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <AuthError msg={error} />
            <form onSubmit={handleSendOtp} className="space-y-3">
              <AuthInput icon={Phone} type="tel" value={phone} onChange={setPhone}
                placeholder="+1 555 000 1234" autoComplete="tel" disabled={busy} />
              <PrimaryBtn type="submit" loading={busy}>
                <Phone className="h-4 w-4" /> Send OTP
              </PrimaryBtn>
            </form>
            <button type="button" onClick={() => { reset(); setView("main"); clearRecaptcha(); }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
          </motion.div>
        )}

        {/* ── OTP view ──────────────────────────────────────────────────────── */}
        {view === "otp" && (
          <motion.div key="otp" custom={1} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <AuthError msg={error} />
            {otpSent && (
              <div className="flex items-center gap-2 rounded-xl p-3 mb-3 text-xs"
                style={{ background:"rgba(20,184,166,0.1)", border:"1px solid rgba(20,184,166,0.25)", color:"#2dd4bf" }}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Code sent to {phone}
              </div>
            )}
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                placeholder="• • • • • •" autoFocus autoComplete="one-time-code"
                className="w-full rounded-xl py-4 px-4 text-center text-2xl font-mono tracking-[0.5em] outline-none transition"
                style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"var(--foreground)" }}
                onFocus={e=>{ e.target.style.border="1px solid rgba(0,229,255,0.45)"; e.target.style.boxShadow="0 0 0 3px rgba(0,229,255,0.08)"; }}
                onBlur={e=>{ e.target.style.border="1px solid rgba(255,255,255,0.12)"; e.target.style.boxShadow="none"; }}
              />
              <PrimaryBtn type="submit" loading={busy} disabled={otp.length < 4}>
                <ShieldCheck className="h-4 w-4" /> Verify Code
              </PrimaryBtn>
            </form>
            <button type="button" onClick={() => { reset(); setOtp(""); setView("phone"); clearRecaptcha(); }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Change number
            </button>
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
