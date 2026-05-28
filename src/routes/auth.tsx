import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to TrackNova with phone OTP or email. Role-based access for Admin, Manager, Supervisor and Worker." },
    ],
  }),
  component: AuthPage,
});

type Mode = "phone" | "email";
type Step = "input" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("phone");
  const [step, setStep] = useState<Step>("input");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [role, setRole] = useState<"Admin" | "Manager" | "Supervisor" | "Worker">("Admin");

  function submitInput(e: React.FormEvent) {
    e.preventDefault();
    setStep("otp");
  }

  function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/dashboard" });
  }

  function setDigit(i: number, v: string) {
    const next = [...otp];
    next[i] = v.replace(/\D/g, "").slice(0, 1);
    setOtp(next);
    if (v && i < 5) {
      const el = document.getElementById(`otp-${i + 1}`);
      el?.focus();
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
              {step === "input" ? "Choose how you'd like to continue." : "Enter the 6-digit code we sent you."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === "input" ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-5">
                  {(["phone", "email"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`relative rounded-lg py-2 text-sm font-medium transition ${mode === m ? "text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      {mode === m && (
                        <motion.div
                          layoutId="auth-pill"
                          className="absolute inset-0 rounded-lg"
                          style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <span className="relative flex items-center justify-center gap-1.5">
                        {m === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                        {m === "phone" ? "Phone OTP" : "Email"}
                      </span>
                    </button>
                  ))}
                </div>

                <form onSubmit={submitInput} className="space-y-4">
                  {mode === "phone" ? (
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Phone number</label>
                      <div className="mt-1.5 flex items-center glass rounded-xl px-3 focus-within:glow-cyan transition">
                        <span className="text-sm text-muted-foreground">+91</span>
                        <span className="mx-2 h-5 w-px bg-white/10" />
                        <input
                          required
                          inputMode="numeric"
                          pattern="[0-9]{10}"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="98765 43210"
                          className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Email address</label>
                      <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition">
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
                  )}

                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Continue as</label>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {(["Admin", "Manager", "Supervisor", "Worker"] as const).map((r) => (
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

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan"
                    style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                  >
                    Send OTP <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <button type="button" className="hover:text-foreground">Forgot password?</button>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />
                      End-to-end encrypted
                    </span>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.form
                key="otp"
                onSubmit={verifyOtp}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div className="text-sm text-muted-foreground text-center">
                  Code sent to <span className="text-foreground font-medium">{mode === "phone" ? `+91 ${phone}` : email}</span>
                </div>
                <div className="flex justify-between gap-2">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      value={d}
                      onChange={(e) => setDigit(i, e.target.value)}
                      inputMode="numeric"
                      maxLength={1}
                      className="h-12 w-full text-center text-lg font-semibold glass rounded-xl outline-none focus:glow-cyan transition"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan"
                  style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                >
                  Verify & continue <ArrowRight className="h-4 w-4" />
                </button>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button type="button" onClick={() => setStep("input")} className="inline-flex items-center gap-1 hover:text-foreground">
                    <ArrowLeft className="h-3 w-3" /> Change {mode === "phone" ? "number" : "email"}
                  </button>
                  <button type="button" className="hover:text-foreground">Resend code</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
