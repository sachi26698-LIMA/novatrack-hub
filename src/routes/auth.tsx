import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ChevronDown, Eye, EyeOff, KeyRound,
  Loader2, Lock, Mail, Phone, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      {
        name: "description",
        content:
          "Sign in to TrackNova with email or phone OTP. Role-based access for Admin, Manager, Supervisor and Worker.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Channel = "email" | "phone";
type Role = "Admin" | "Manager" | "Supervisor" | "Worker";

const RESEND_SECONDS = 60;

const COUNTRY_CODES = [
  { code: "+91",  country: "IN", flag: "🇮🇳" },
  { code: "+1",   country: "US", flag: "🇺🇸" },
  { code: "+44",  country: "GB", flag: "🇬🇧" },
  { code: "+61",  country: "AU", flag: "🇦🇺" },
  { code: "+971", country: "AE", flag: "🇦🇪" },
  { code: "+65",  country: "SG", flag: "🇸🇬" },
  { code: "+60",  country: "MY", flag: "🇲🇾" },
  { code: "+49",  country: "DE", flag: "🇩🇪" },
  { code: "+33",  country: "FR", flag: "🇫🇷" },
  { code: "+81",  country: "JP", flag: "🇯🇵" },
  { code: "+82",  country: "KR", flag: "🇰🇷" },
  { code: "+55",  country: "BR", flag: "🇧🇷" },
  { code: "+52",  country: "MX", flag: "🇲🇽" },
  { code: "+27",  country: "ZA", flag: "🇿🇦" },
  { code: "+234", country: "NG", flag: "🇳🇬" },
];

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak",   color: "var(--neon-pink)" };
  if (score <= 3) return { score, label: "Fair",   color: "#f59e0b" };
  if (score === 4) return { score, label: "Good",   color: "var(--neon-cyan)" };
  return            { score, label: "Strong", color: "var(--neon-violet)" };
}

function friendlyError(msg: string): string {
  if (msg.includes("Invalid login credentials"))  return "Wrong email or password. Please try again.";
  if (msg.includes("Email not confirmed"))         return "Check your inbox — you need to confirm your email first.";
  if (msg.includes("User already registered"))     return "An account with this email already exists. Try signing in.";
  if (msg.includes("Password should be"))          return "Password must be at least 6 characters.";
  if (msg.includes("rate limit"))                  return "Too many attempts. Wait a moment and try again.";
  if (msg.includes("Phone") || msg.includes("phone")) return "Phone sign-in is not enabled. Use email instead.";
  if (msg.includes("SMS") || msg.includes("sms")) return "SMS provider not configured. Use email to sign in.";
  if (msg.includes("network") || msg.includes("fetch")) return "Network error. Check your connection.";
  return msg;
}

// ── Email confirmation banner (shown after signup) ──────────────────────────
const CONFIRM_EMAIL_KEY = "tracknova_pending_confirm";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [channel, setChannel] = useState<Channel>("email");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole]         = useState<Role>("Worker");
  const [rememberMe, setRememberMe] = useState(true);

  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showCodes, setShowCodes]     = useState(false);
  const [phone, setPhone]             = useState("");
  const [otpSent, setOtpSent]         = useState(false);
  const [otp, setOtp]                 = useState("");
  const [resendIn, setResendIn]       = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading]           = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const fullPhone = `${countryCode.code}${phone.replace(/\D/g, "")}`;
  const strength  = mode === "signup" ? passwordStrength(password) : null;

  // Restore pending-confirm state after page reload
  useEffect(() => {
    if (sessionStorage.getItem(CONFIRM_EMAIL_KEY)) {
      setPendingConfirm(true);
      setMode("signin");
    }
  }, []);

  // Redirect if already signed in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          if (event === "SIGNED_IN") {
            sessionStorage.removeItem(CONFIRM_EMAIL_KEY);
            setPendingConfirm(false);
            void logActivity("signed_in", "auth", {
              provider: session.user.app_metadata?.provider,
            });
            // FIX: correct onConflict for (user_id, role) unique constraint
            const metaRole = session.user.user_metadata?.role;
            if (metaRole) {
              await supabase.from("user_roles").upsert(
                { user_id: session.user.id, role: metaRole },
                { onConflict: "user_id,role" },
              );
            }
          }
          navigate({ to: "/dashboard" });
        }
      },
    );
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (resendIn <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [resendIn]);

  function startResendTimer() {
    setResendIn(RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setResendIn((s) => Math.max(0, s - 1)),
      1000,
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (channel === "phone") return;

    // Client-side validation
    if (!email.trim()) return toast.error("Enter your email address");
    if (!email.includes("@")) return toast.error("Enter a valid email address");
    if (password.length < 6)  return toast.error("Password must be at least 6 characters");
    if (mode === "signup" && !fullName.trim()) return toast.error("Enter your full name");

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            // FIX: redirect to reset-password equivalent — for signup this is /dashboard
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim(), role },
          },
        });
        if (error) throw new Error(friendlyError(error.message));

        // If email confirmation is required (identities may be empty)
        const needsConfirm = !data.session;
        if (needsConfirm) {
          sessionStorage.setItem(CONFIRM_EMAIL_KEY, email.trim().toLowerCase());
          setPendingConfirm(true);
          setMode("signin");
          await logActivity("signup_email", "auth", { role, needs_confirm: true });
          toast.success("Account created! Check your inbox to confirm.", { duration: 8000 });
        } else {
          await logActivity("signup_email", "auth", { role, auto_confirmed: true });
          toast.success("Account created! Welcome to TrackNova.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
          // rememberMe is controlled by Supabase's storage — already persists by default
        });
        if (error) throw new Error(friendlyError(error.message));
        toast.success("Welcome back!");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      void logActivity("auth_error", "auth", { mode, channel: "email", message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) return toast.error("Enter your email address first");
    setLoading(true);
    try {
      // FIX: redirect to /reset-password not /dashboard
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (error) throw new Error(friendlyError(error.message));
      void logActivity("password_reset_requested", "auth", { email });
      toast.success("Password reset link sent — check your inbox.", { duration: 8000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return toast.error("Enter a valid phone number");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) {
        const msg = friendlyError(error.message);
        toast.error(msg, { duration: 6000 });
        void logActivity("otp_failed", "auth", { phone: fullPhone, reason: msg });
        return;
      }
      setOtpSent(true);
      setOtp("");
      startResendTimer();
      void logActivity("otp_requested", "auth", { phone: fullPhone });
      toast.success(`Code sent to ${fullPhone}`);
    } catch {
      toast.error("Could not send OTP. Please use email sign-in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: "sms",
      });
      if (error) {
        void logActivity("otp_failed", "auth", { phone: fullPhone });
        throw new Error(friendlyError(error.message));
      }
      void logActivity("otp_verified", "auth", { phone: fullPhone });
      toast.success("Phone verified — signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between">
          <BrandMark />
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-3">
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
              Secure enterprise login
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome to <span className="neon-text">TrackNova</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to your workspace."
                : "Create your TrackNova account."}
            </p>
          </div>

          {/* Email-confirm banner */}
          <AnimatePresence>
            {pendingConfirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 rounded-xl border border-[color:var(--neon-cyan)]/40 bg-[color:var(--neon-cyan)]/10 px-4 py-3 text-sm"
              >
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-[color:var(--neon-cyan)] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-[color:var(--neon-cyan)]">Confirm your email</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      We sent a confirmation link to <strong>{sessionStorage.getItem(CONFIRM_EMAIL_KEY) ?? "your email"}</strong>.
                      Click it, then sign in here.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-4">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setPendingConfirm(false); }}
                className={`relative rounded-lg py-2 text-sm font-medium transition ${
                  mode === m ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === m && (
                  <motion.div
                    layoutId="auth-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative">{m === "signin" ? "Sign in" : "Sign up"}</span>
              </button>
            ))}
          </div>

          {/* Channel toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-5">
            {(["email", "phone"] as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setChannel(c); setOtpSent(false); setOtp(""); }}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition ${
                  channel === c
                    ? "text-foreground bg-white/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "email" ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                {c === "email" ? "Email" : "Phone OTP"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── EMAIL FORM ─────────────────────────────────────────────── */}
            {channel === "email" ? (
              <motion.form
                key={`email-${mode}`}
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Full name — signup only */}
                {mode === "signup" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Full name
                    </label>
                    <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email
                  </label>
                  <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {/* Password with show/hide toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-[color:var(--neon-cyan)] hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      required
                      type={showPw ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition shrink-0"
                      tabIndex={-1}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Password strength indicator — signup only */}
                  {mode === "signup" && password.length > 0 && strength && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{
                              background: i <= strength.score
                                ? strength.color
                                : "oklch(1 0 0 / 0.08)",
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-[11px]" style={{ color: strength.color }}>
                        {strength.label} password
                      </p>
                    </div>
                  )}
                </div>

                {/* Role — signup only */}
                {mode === "signup" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Join as
                    </label>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {(["Admin", "Manager", "Supervisor", "Worker"] as Role[]).map((r) => (
                        <button
                          type="button"
                          key={r}
                          onClick={() => setRole(r)}
                          className={`rounded-lg py-2 text-xs font-medium transition border ${
                            role === r
                              ? "border-[color:var(--neon-cyan)] text-foreground bg-white/5"
                              : "border-white/10 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remember me — signin only */}
                {mode === "signin" && (
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                    <div
                      onClick={() => setRememberMe((v) => !v)}
                      className={`h-4.5 w-4.5 h-[18px] w-[18px] rounded flex-shrink-0 flex items-center justify-center transition border ${
                        rememberMe
                          ? "border-[color:var(--neon-cyan)] bg-[color:var(--neon-cyan)]/20"
                          : "border-white/20 bg-transparent"
                      }`}
                    >
                      {rememberMe && (
                        <svg className="h-3 w-3 text-[color:var(--neon-cyan)]" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-muted-foreground">Remember me</span>
                  </label>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60 transition"
                  style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {loading
                    ? mode === "signin" ? "Signing in…" : "Creating account…"
                    : mode === "signin" ? "Sign in" : "Create account"
                  }
                </button>
              </motion.form>
            ) : (
              /* ── PHONE OTP FORM ────────────────────────────────────────── */
              <motion.div
                key={otpSent ? "otp-verify" : "otp-request"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {!otpSent ? (
                  <>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Phone number
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowCodes((v) => !v)}
                            className="h-full glass rounded-xl px-3 flex items-center gap-1.5 text-sm whitespace-nowrap hover:bg-white/5 transition"
                          >
                            <span>{countryCode.flag}</span>
                            <span>{countryCode.code}</span>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </button>
                          {showCodes && (
                            <div className="absolute top-full left-0 mt-1 z-50 glass rounded-xl overflow-y-auto max-h-52 w-40 shadow-xl">
                              {COUNTRY_CODES.map((c) => (
                                <button
                                  key={c.code + c.country}
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition"
                                  onClick={() => { setCountryCode(c); setShowCodes(false); }}
                                >
                                  <span>{c.flag}</span>
                                  <span className="text-muted-foreground w-10">{c.code}</span>
                                  <span>{c.country}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\-()]/g, ""))}
                            placeholder="99999 00000"
                            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        A one-time code will be sent via SMS.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60 transition"
                      style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {loading ? "Sending…" : "Send OTP"}
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        Code sent to{" "}
                        <span className="text-foreground font-medium">{fullPhone}</span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Enter OTP
                      </label>
                      <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        <input
                          autoFocus
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="123456"
                          className="w-full bg-transparent py-3 text-center text-xl tracking-[0.5em] outline-none placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60 transition"
                      style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {loading ? "Verifying…" : "Verify & sign in"}
                    </button>
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtp(""); }}
                        className="text-muted-foreground hover:text-foreground transition"
                      >
                        Change number
                      </button>
                      <button
                        type="button"
                        disabled={resendIn > 0 || loading}
                        onClick={handleSendOtp}
                        className="text-[color:var(--neon-cyan)] disabled:text-muted-foreground hover:underline disabled:no-underline transition"
                      >
                        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer badge */}
          <div className="flex items-center justify-center text-xs text-muted-foreground pt-5">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />
              End-to-end encrypted · Supabase Auth
            </span>
          </div>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms &amp; Privacy Policy.
        </p>
      </div>
    </div>
  );
}
