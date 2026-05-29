import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, Sparkles } from "lucide-react";
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

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically
    // and emits a PASSWORD_RECOVERY event. We just wait for a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await logActivity("password_reset_completed", "auth");
      toast.success("Password updated");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
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
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-3">
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" /> Set a new password
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {ready ? "Choose a strong password you haven't used before." : "Verifying recovery link…"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">New password</label>
              <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input required type="password" minLength={6} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none" placeholder="••••••••" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm password</label>
              <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <input required type="password" minLength={6} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none" placeholder="••••••••" />
              </div>
            </div>
            <button
              type="submit" disabled={loading || !ready}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
