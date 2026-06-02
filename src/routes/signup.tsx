import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound,
  Mail, Phone, ShieldCheck, User, UserPlus,
} from "lucide-react";
import {
  AuthShell, AuthInput, AuthError, AuthDivider,
  GhostBtn, GoogleLogo, PrimaryBtn,
} from "@/components/auth-shell";
import { useSession } from "@/hooks/use-session";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { sendPhoneOTP, verifyPhoneOTP, clearRecaptcha } from "@/lib/firebase-phone-auth";
import { isFirebaseConfigured } from "@/lib/firebase";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — TrackNova" },
      { name: "description", content: "Create your TrackNova account." },
    ],
  }),
  component: SignupPage,
});

type View = "form" | "phone-otp" | "verify-email";

// ── Password strength ─────────────────────────────────────────────────────────
function strength(p: string): 0 | 1 | 2 | 3 {
  if (p.length < 6) return 0;
  if (p.length < 8) return 1;
  const checks = [/[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)];
  const score = checks.filter(Boolean).length;
  return score >= 2 ? 3 : score >= 1 ? 2 : 1;
}
const strengthLabel = ["Too short", "Weak", "Fair", "Strong"] as const;
const strengthColor = ["#6b7280", "#ef4444", "#f59e0b", "#22c55e"] as const;

// ── Phone helpers (same as login) ─────────────────────────────────────────────
function phoneToEmail(phone: string) { return `${phone.replace(/\D/g,"")}@phone.tracknova.app`; }
function phoneToPass(phone: string)  { return `pn_${phone.replace(/\D/g,"")}_tn1`; }
async function supabasePhoneSession(phone: string) {
  const email = phoneToEmail(phone), password = phoneToPass(phone);
  const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
  if (!siErr) return;
  await supabase.auth.signUp({ email, password, options: { data: { phone, source:"phone_otp" } } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

function SignupPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [view, setView]             = useState<View>("form");
  const [fullName, setFullName]     = useState("");
  const [email, setEmail]           = useState("");
  const [phone, setPhone]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [showCnf, setShowCnf]       = useState(false);
  const [terms, setTerms]           = useState(false);
  const [otp, setOtp]               = useState("");
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const rcRef = useRef(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  useEffect(() => () => { if (!rcRef.current) { rcRef.current = true; clearRecaptcha(); } }, []);

  if (loading || user) return null;

  const pwdStrength = strength(password);

  // ── Email sign-up ────────────────────────────────────────────────────────
  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim())          { setError("Enter your full name."); return; }
    if (!email.trim())             { setError("Enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email."); return; }
    if (password.length < 8)       { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)      { setError("Passwords do not match."); return; }
    if (!terms)                    { setError("Accept the terms to continue."); return; }

    setBusy(true); setError("");
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) { setError(error.message); setBusy(false); return; }
    setView("verify-email");
    setBusy(false);
  }

  // ── Google sign-up ───────────────────────────────────────────────────────
  async function handleGoogle() {
    if (!isSupabaseConfigured) { setError("Supabase not configured."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth`, queryParams: { prompt: "select_account" } },
    });
    if (error) { setError(error.message); setBusy(false); }
  }

  // ── Send phone OTP ───────────────────────────────────────────────────────
  async function handleSendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setError("Enter a phone number to verify."); return; }
    const formatted = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g,"")}`;
    if (formatted.replace(/\D/g,"").length < 7) { setError("Enter a valid international number."); return; }
    if (!isFirebaseConfigured()) { setError("Firebase keys not configured."); return; }
    setBusy(true); setError("");
    try {
      await sendPhoneOTP(formatted, "recaptcha-container-signup");
      setPendingPhone(formatted);
      setView("phone-otp");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send OTP."); clearRecaptcha();
    } finally { setBusy(false); }
  }

  // ── Verify phone OTP ─────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) { setError("Enter the 6-digit code."); return; }
    setBusy(true); setError("");
    try {
      const verifiedPhone = await verifyPhoneOTP(otp);
      await supabasePhoneSession(verifiedPhone || pendingPhone);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed."); setBusy(false);
    }
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 28 }),
    center: { opacity: 1, x: 0 },
    exit:  (d: number) => ({ opacity: 0, x: d * -28 }),
  };

  return (
    <AuthShell badge="Create account" backLink={{ to: "/auth", label: "Sign in" }}>
      <div id="recaptcha-container-signup" />

      {/* Heading */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4 mx-auto"
          style={{ background: "linear-gradient(135deg,var(--neon-cyan)18,var(--neon-violet)18)" }}>
          <UserPlus className="h-7 w-7 text-[color:var(--neon-cyan)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {view === "form"         ? <>Join <span className="neon-text">TrackNova</span></> :
           view === "phone-otp"    ? "Verify your phone" :
           "Check your inbox"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {view === "form"         ? "Create your free enterprise account" :
           view === "phone-otp"    ? `Code sent to ${pendingPhone}` :
           `Confirmation link sent to ${email}`}
        </p>
      </div>

      <AnimatePresence mode="wait" custom={1}>
        {/* ── Sign-up form ──────────────────────────────────────────────── */}
        {view === "form" && (
          <motion.div key="form" custom={-1} variants={variants}
            initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <AuthError msg={error} />

            {/* Google */}
            <GhostBtn onClick={handleGoogle} disabled={busy || !isSupabaseConfigured}>
              <GoogleLogo /> Sign up with Google
            </GhostBtn>

            <AuthDivider label="or create with email" />

            <form onSubmit={handleEmailSignup} className="space-y-3">
              <AuthInput icon={User} value={fullName} onChange={setFullName}
                placeholder="Full name" autoComplete="name" disabled={busy} />
              <AuthInput icon={Mail} type="email" value={email} onChange={setEmail}
                placeholder="Work email" autoComplete="email" disabled={busy} />

              {/* Password + strength */}
              <div>
                <AuthInput icon={KeyRound} type={showPwd ? "text" : "password"}
                  value={password} onChange={setPassword}
                  placeholder="Password (min. 8 chars)" autoComplete="new-password" disabled={busy}
                  right={
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                {password && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i <= pwdStrength ? strengthColor[pwdStrength] : "rgba(255,255,255,0.1)" }} />
                      ))}
                    </div>
                    <span className="text-[10px]" style={{ color: strengthColor[pwdStrength] }}>
                      {strengthLabel[pwdStrength]}
                    </span>
                  </div>
                )}
              </div>

              <AuthInput icon={ShieldCheck} type={showCnf ? "text" : "password"}
                value={confirm} onChange={setConfirm}
                placeholder="Confirm password" autoComplete="new-password" disabled={busy}
                right={
                  <button type="button" onClick={() => setShowCnf(v => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showCnf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              {/* Phone (optional, for OTP login later) */}
              {isFirebaseConfigured() && (
                <AuthInput icon={Phone} type="tel" value={phone} onChange={setPhone}
                  placeholder="Phone (optional, for OTP login)" autoComplete="tel" disabled={busy} />
              )}

              {/* Terms */}
              <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none pt-1">
                <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)}
                  className="rounded accent-[color:var(--neon-cyan)] h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  I agree to the{" "}
                  <span className="text-[color:var(--neon-cyan)] hover:underline cursor-pointer">Terms of Service</span>
                  {" "}and{" "}
                  <span className="text-[color:var(--neon-cyan)] hover:underline cursor-pointer">Privacy Policy</span>
                </span>
              </label>

              <PrimaryBtn type="submit" loading={busy} disabled={!terms}>
                <UserPlus className="h-4 w-4" /> Create account
              </PrimaryBtn>
            </form>

            {/* Phone OTP sign-up option */}
            {isFirebaseConfigured() && phone.trim() && (
              <>
                <AuthDivider label="or verify phone now" />
                <GhostBtn onClick={e => handleSendPhoneOtp(e as unknown as React.FormEvent)} disabled={busy}>
                  <Phone className="h-4 w-4" /> Verify with OTP instead
                </GhostBtn>
              </>
            )}

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth" className="text-[color:var(--neon-cyan)] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </motion.div>
        )}

        {/* ── Phone OTP view ─────────────────────────────────────────────── */}
        {view === "phone-otp" && (
          <motion.div key="phone-otp" custom={1} variants={variants}
            initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <AuthError msg={error} />
            <div className="flex items-center gap-2 rounded-xl p-3 mb-3 text-xs"
              style={{ background:"rgba(20,184,166,0.1)", border:"1px solid rgba(20,184,166,0.25)", color:"#2dd4bf" }}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Code sent to {pendingPhone}
            </div>
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
                <ShieldCheck className="h-4 w-4" /> Verify & create account
              </PrimaryBtn>
            </form>
            <button type="button" onClick={() => { setView("form"); setOtp(""); clearRecaptcha(); }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </motion.div>
        )}

        {/* ── Email verification sent ─────────────────────────────────────── */}
        {view === "verify-email" && (
          <motion.div key="verify-email" custom={1} variants={variants}
            initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}
            className="text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mx-auto"
              style={{ background:"rgba(20,184,166,0.12)", border:"1px solid rgba(20,184,166,0.3)" }}>
              <Mail className="h-8 w-8" style={{ color:"#2dd4bf" }} />
            </div>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="text-foreground font-medium">{email}</span>.
              Click the link to activate your account.
            </p>
            <PrimaryBtn onClick={() => navigate({ to: "/auth" })}>
              Back to sign in
            </PrimaryBtn>
            <p className="text-xs text-muted-foreground">
              Didn't receive it? Check your spam folder.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
