import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ChevronDown, KeyRound, Loader2, Mail, Phone,
  ShieldCheck, Sparkles,
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
          "Sign in to TrackNova with email, phone OTP, or Google. Role-based access for Admin, Manager, Supervisor and Worker.",
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
  { code: "+91", country: "IN", flag: "🇮🇳" },
  { code: "+1",  country: "US", flag: "🇺🇸" },
  { code: "+44", country: "GB", flag: "🇬🇧" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+971",country: "AE", flag: "🇦🇪" },
  { code: "+65", country: "SG", flag: "🇸🇬" },
  { code: "+60", country: "MY", flag: "🇲🇾" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+82", country: "KR", flag: "🇰🇷" },
  { code: "+55", country: "BR", flag: "🇧🇷" },
  { code: "+52", country: "MX", flag: "🇲🇽" },
  { code: "+27", country: "ZA", flag: "🇿🇦" },
  { code: "+234",country: "NG", flag: "🇳🇬" },
];

function friendlyError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Wrong email or password. Please try again.";
  if (msg.includes("Email not confirmed")) return "Please confirm your email first. Check your inbox.";
  if (msg.includes("User already registered")) return "An account with this email already exists. Try signing in.";
  if (msg.includes("Password should be")) return "Password must be at least 6 characters.";
  if (msg.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("Phone") || msg.includes("phone")) return "Phone sign-in is not enabled for this project. Use email instead.";
  if (msg.includes("SMS") || msg.includes("sms")) return "SMS provider is not configured. Use email to sign in.";
  if (msg.includes("network") || msg.includes("fetch")) return "Network error. Please check your connection.";
  return msg;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [channel, setChannel] = useState<Channel>("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("Worker");

  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showCodes, setShowCodes] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(false);

  const fullPhone = `${countryCode.code}${phone.replace(/\D/g, "")}`;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          if (event === "SIGNED_IN") {
            void logActivity("signed_in", "auth", {
              provider: session.user.app_metadata?.provider,
            });
            // Auto-persist role from signup metadata
            const metaRole = session.user.user_metadata?.role;
            if (metaRole) {
              await supabase.from("user_roles").upsert(
                { user_id: session.user.id, role: metaRole },
                { onConflict: "user_id" },
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
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) throw new Error("Please enter your full name");
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim(), role },
          },
        });
        if (error) throw new Error(friendlyError(error.message));
        await logActivity("signup_email", "auth", { role });
        toast.success("Account created! Check your email to confirm.", { duration: 6000 });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(friendlyError(error.message));
        toast.success("Welcome back");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      void logActivity("auth_error", "auth", { mode, channel, message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      toast.error("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) {
        // Fall back to informative message if phone auth isn't configured
        const msg = friendlyError(error.message);
        toast.error(msg, { duration: 6000 });
        void logActivity("otp_failed", "auth", { phone: fullPhone, reason: msg });
        return;
      }
      setOtpSent(true);
      setOtp("");
      startResendTimer();
      void logActivity("otp_requested", "auth", { phone: fullPhone });
      toast.success(`OTP sent to ${fullPhone}`);
    } catch {
      toast.error("Could not send OTP. Please try email sign-in.");
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between">
          <BrandMark />
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
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

          {/* Sign in / Sign up tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-4">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`relative rounded-lg py-2 text-sm font-medium transition ${
                  mode === m ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {mode === m && (
                  <motion.div
                    layoutId="auth-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative">
                  {m === "signin" ? "Sign in" : "Sign up"}
                </span>
              </button>
            ))}
          </div>

          {/* Channel toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-5">
            {(["email", "phone"] as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setChannel(c);
                  setOtpSent(false);
                  setOtp("");
                }}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition ${
                  channel === c
                    ? "text-foreground bg-white/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "email" ? (
                  <Mail className="h-3.5 w-3.5" />
                ) : (
                  <Phone className="h-3.5 w-3.5" />
                )}
                {c === "email" ? "Email" : "Phone OTP"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
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
                {mode === "signup" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Full name
                    </label>
                    <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition">
                      <input
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email
                  </label>
                  <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!email) {
                            toast.error("Enter your email first");
                            return;
                          }
                          const { error } = await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: `${window.location.origin}/dashboard`,
                          });
                          if (error) toast.error(friendlyError(error.message));
                          else toast.success("Password reset email sent");
                        }}
                        className="text-xs text-[color:var(--neon-cyan)] hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition">
                    <input
                      required
                      type="password"
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {mode === "signup" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Continue as
                    </label>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {(["Admin", "Manager", "Supervisor", "Worker"] as Role[]).map(
                        (r) => (
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
                        ),
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
                  }}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </motion.form>
            ) : (
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
                        {/* Country code picker */}
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
                                  onClick={() => {
                                    setCountryCode(c);
                                    setShowCodes(false);
                                  }}
                                >
                                  <span>{c.flag}</span>
                                  <span className="text-muted-foreground w-10">
                                    {c.code}
                                  </span>
                                  <span>{c.country}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Phone input */}
                        <div className="flex-1 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={phone}
                            onChange={(e) =>
                              setPhone(e.target.value.replace(/[^\d\s\-()]/g, ""))
                            }
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
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
                      }}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      Send OTP
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
                          onChange={(e) =>
                            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          placeholder="123456"
                          className="w-full bg-transparent py-3 text-center text-xl tracking-[0.5em] outline-none placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
                      }}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Verify & sign in
                    </button>
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Change number
                      </button>
                      <button
                        type="button"
                        disabled={resendIn > 0 || loading}
                        onClick={handleSendOtp}
                        className="text-[color:var(--neon-cyan)] disabled:text-muted-foreground hover:underline disabled:no-underline"
                      >
                        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-center text-xs text-muted-foreground pt-4">
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
