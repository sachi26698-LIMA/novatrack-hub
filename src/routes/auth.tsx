import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to TrackNova with email or Google. Role-based access for Admin, Manager, Supervisor and Worker." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Role = "Admin" | "Manager" | "Supervisor" | "Worker";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("Worker");
  const [loading, setLoading] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
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

          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-5">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
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
                <span className="relative">{m === "signin" ? "Sign in" : "Sign up"}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {mode === "signup" && (
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Full name</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Password</label>
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
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Continue as</label>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full h-px bg-white/10" /></div>
                <div className="relative flex justify-center"><span className="bg-background/0 px-2 text-[10px] uppercase tracking-widest text-muted-foreground">or</span></div>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold glass hover:bg-white/5 transition disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v3.2h5.4c-.2 1.4-1.6 4.2-5.4 4.2-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 4 14.6 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c6.9 0 9.4-4.8 9.4-7.3 0-.5 0-.9-.1-1.3H12z"/></svg>
                Continue with Google
              </button>

              <div className="flex items-center justify-center text-xs text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />
                  End-to-end encrypted
                </span>
              </div>
            </motion.form>
          </AnimatePresence>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
