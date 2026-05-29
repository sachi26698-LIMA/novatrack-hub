import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — TrackNova" },
      { name: "description", content: "Reset your TrackNova password securely." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await logActivity("password_reset_requested", "auth", { email });
      setSent(true);
      toast.success("Reset link sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 flex items-center justify-between">
        <BrandMark />
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-3">
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
              Password recovery
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reset password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent ? "We've emailed you a secure link to set a new password." : "Enter your email and we'll send a reset link."}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
                <div className="mt-1.5 glass rounded-xl px-3 focus-within:glow-cyan transition flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <input
                    required type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </button>
            </form>
          ) : (
            <div className="text-center">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold glass hover:bg-white/5"
              >
                Back to sign in
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
