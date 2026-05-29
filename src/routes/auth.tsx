import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to TrackNova with email, phone OTP, or Google. Role-based access for Admin, Manager, Supervisor and Worker." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Channel = "email" | "phone";
type Role = "Admin" | "Manager" | "Supervisor" | "Worker";

const RESEND_SECONDS = 30;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [channel, setChannel] = useState<Channel>("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("Worker");

  // Phone OTP state (mock for now)
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (event === "SIGNED_IN") {
          // Fire-and-forget — never block the listener
          void logActivity("signed_in", "auth", { provider: session.user.app_metadata?.provider });
        }
        navigate({ to: "/dashboard" });
      }
    });
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
    timerRef.current = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
  }

  function validatePhone(p: string) {
    return /^\+?[0-9\s\-()]{8,18}$/.test(p.trim());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (channel === "phone") return; // phone uses its own buttons
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) throw new Error("Please enter your full name");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim(), role },
          },
        });
        if (error) throw error;
        await logActivity("signup_email", "auth", { role });
        toast.success("Account created. Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      await logActivity("auth_error", "auth", { mode, channel, message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        toast.error(result.error instanceof Error ? result.error.message : "Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  }

  // ---- Mock Phone OTP flow ----
  async function handleSendOtp() {
    if (!validatePhone(phone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      // Simulate network latency. Real Twilio integration plugs in here.
      await new Promise((r) => setTimeout(r, 700));
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setMockOtp(code);
      setOtpSent(true);
      setOtp("");
      startResendTimer();
      await logActivity("otp_requested", "auth", { phone });
      toast.success(`OTP sent (demo): ${code}`, { duration: 8000 });
    } catch {
      toast.error("Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      if (otp !== mockOtp) {
        await logActivity("otp_failed", "auth", { phone });
        throw new Error("Invalid OTP. Please try again.");
      }
      await logActivity("otp_verified_mock", "auth", { phone });
      toast.success("Phone verified (demo mode)");
      toast.message("Connect Twilio to enable real sign-in by phone.", { duration: 6000 });
      // Reset state — real flow would now create/sign-in the user via Supabase Phone Auth.
      setOtpSent(false);
      setMockOtp(null);
      setOtp("");
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
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
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
              {mode === "signin" ? "Sign in to your workspace." : "Create your TrackNova account."}
            </p>
          </div>

          {/* Sign in / Sign up tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-4">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m} type="button" onClick={() => setMode(m)}
                className={`relative rounded-lg py-2 text-sm font-medium transition ${mode === m ? "text-primary-foreground" : "text-muted-foreground"}`}
              >
                {mode === m && (
                  <motion.div layoutId="auth-pill" className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }} />
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
                  channel === c ? "text-foreground bg-white/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "email" ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                {c === "email" ? "Email" : "Phone OTP"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {channel === "email" ? (
              <motion.form
                key={`email-${mode}`} onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }} className="space-y-4"
              >
                {mode === "signup" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Full name</label>
                    <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition">
                      <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
                  <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Password</label>
                    {mode === "signin" && (
                      <Link to="/forgot-password" className="text-xs text-[color:var(--neon-cyan)] hover:underline">
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition">
                    <input required type="password" minLength={6} value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                      className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60" />
                  </div>
                </div>

                {mode === "signup" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Continue as</label>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {(["Admin", "Manager", "Supervisor", "Worker"] as Role[]).map((r) => (
                        <button type="button" key={r} onClick={() => setRole(r)}
                          className={`rounded-lg py-2 text-xs font-medium transition border ${
                            role === r
                              ? "border-[color:var(--neon-cyan)] text-foreground bg-white/5"
                              : "border-white/10 text-muted-foreground hover:text-foreground"
                          }`}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </motion.form>
            ) : (
              <motion.div
                key={otpSent ? "otp-verify" : "otp-request"}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }} className="space-y-4"
              >
                {!otpSent ? (
                  <>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Phone number</label>
                      <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="tel" inputMode="tel" value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 555 123 4567"
                          className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Demo mode — OTP is shown on screen. Connect Twilio to send real SMS.
                      </p>
                    </div>
                    <button type="button" onClick={handleSendOtp} disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Send OTP
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        We sent a 6-digit code to <span className="text-foreground font-medium">{phone}</span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Enter OTP</label>
                      <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        <input
                          inputMode="numeric" pattern="[0-9]*" maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="123456"
                          className="w-full bg-transparent py-3 text-center text-xl tracking-[0.5em] outline-none placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={loading || otp.length !== 6}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Verify & continue
                    </button>
                    <div className="flex items-center justify-between text-xs">
                      <button type="button" onClick={() => { setOtpSent(false); setOtp(""); setMockOtp(null); }}
                        className="text-muted-foreground hover:text-foreground">
                        Change number
                      </button>
                      <button type="button" disabled={resendIn > 0 || loading} onClick={handleSendOtp}
                        className="text-[color:var(--neon-cyan)] disabled:text-muted-foreground hover:underline disabled:no-underline">
                        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full h-px bg-white/10" /></div>
            <div className="relative flex justify-center"><span className="bg-background/0 px-2 text-[10px] uppercase tracking-widest text-muted-foreground">or</span></div>
          </div>

          <button type="button" onClick={handleGoogle} disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold glass hover:bg-white/5 transition disabled:opacity-60">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v3.2h5.4c-.2 1.4-1.6 4.2-5.4 4.2-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 4 14.6 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c6.9 0 9.4-4.8 9.4-7.3 0-.5 0-.9-.1-1.3H12z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center justify-center text-xs text-muted-foreground pt-4">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />
              End-to-end encrypted
            </span>
          </div>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
