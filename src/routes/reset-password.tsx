import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — TrackNova" },
      { name: "description", content: "Set a new password for your TrackNova account." },
    ],
  }),
  component: ResetPasswordPage,
});

type PageState = "loading" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      } else if (event === "SIGNED_IN" && session) {
        // Email-confirm redirect may land here — check if there's a recovery token
        const hash = window.location.hash;
        if (hash.includes("type=recovery")) {
          setPageState("ready");
        }
      }
    });

    // Also check for existing session (edge case: user already has session and token is in URL)
    supabase.auth.getSession().then(({ data }) => {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token")) {
        // Let the onAuthStateChange handle it — just don't show "invalid" prematurely
        setPageState("loading");
      } else if (data.session) {
        // No recovery token — maybe they navigated here by mistake
        setPageState("invalid");
      } else {
        // No session and no token — show invalid state after a short delay
        const t = setTimeout(() => setPageState("invalid"), 3000);
        return () => clearTimeout(t);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8)    return toast.error("Password must be at least 8 characters");
    if (password !== confirm)    return toast.error("Passwords don't match");
    if (!/[A-Z]/.test(password)) return toast.error("Include at least one uppercase letter");
    if (!/[0-9]/.test(password)) return toast.error("Include at least one number");

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await logActivity("password_reset_completed", "auth");
      setPageState("done");
      toast.success("Password updated successfully!");
      setTimeout(() => navigate({ to: "/dashboard" }), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <BrandMark />
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-3">
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" /> Set a new password
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New password</h1>
          </div>

          {/* Loading state */}
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-[color:var(--neon-cyan)]" />
              <p className="text-sm text-muted-foreground">Verifying recovery link…</p>
            </div>
          )}

          {/* Invalid / expired state */}
          {pageState === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="h-14 w-14 rounded-full grid place-items-center"
                   style={{ background: "oklch(1 0 0 / 0.05)", border: "1px solid oklch(1 0 0 / 0.1)" }}>
                <AlertTriangle className="h-7 w-7 text-[color:var(--neon-pink)]" />
              </div>
              <div>
                <p className="font-semibold">Link expired or invalid</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Password reset links expire after 1 hour. Request a new one.
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-sm font-semibold text-primary-foreground"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
              >
                Request new link
              </Link>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
                Back to sign in
              </Link>
            </div>
          )}

          {/* Success state */}
          {pageState === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="h-14 w-14 rounded-full grid place-items-center"
                   style={{ background: "oklch(0.78 0.18 200 / 0.15)", border: "1px solid oklch(0.78 0.18 200 / 0.4)" }}>
                <CheckCircle2 className="h-7 w-7 text-[color:var(--neon-cyan)]" />
              </div>
              <div>
                <p className="font-semibold text-lg">Password updated!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Redirecting you to the dashboard…
                </p>
              </div>
            </div>
          )}

          {/* Ready — show form */}
          {pageState === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground -mt-2 mb-4">
                Choose a strong password of at least 8 characters with a number and uppercase letter.
              </p>

              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">New password</label>
                <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    required
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent py-3 text-sm outline-none flex-1"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition shrink-0" tabIndex={-1}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm password</label>
                <div className={`mt-1.5 glass rounded-xl px-3 transition flex items-center gap-2 ${
                  confirm && confirm !== password
                    ? "border border-[color:var(--neon-pink)]/60"
                    : "focus-within:glow-cyan"
                }`}>
                  <CheckCircle2 className={`h-4 w-4 shrink-0 transition ${
                    confirm && confirm === password
                      ? "text-[color:var(--neon-cyan)]"
                      : "text-muted-foreground"
                  }`} />
                  <input
                    required
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-transparent py-3 text-sm outline-none flex-1"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition shrink-0" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <p className="text-[11px] text-[color:var(--neon-pink)] mt-1">Passwords don't match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !password || password !== confirm}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60 transition"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {submitting ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
