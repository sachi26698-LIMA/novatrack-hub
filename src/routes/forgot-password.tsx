import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Sparkles } from "lucide-react";
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
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      // FIX: redirect must go to /reset-password so the user sees the reset form
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (error) throw error;
      await logActivity("password_reset_requested", "auth", { email });
      setSent(true);
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
        <Link
          to="/auth"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
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
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
              Password recovery
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reset password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent
                ? "Check your inbox for a secure reset link."
                : "Enter your email and we'll send a reset link."}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
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
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary-foreground glow-cyan disabled:opacity-60 transition"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-16 w-16 rounded-full grid place-items-center"
                   style={{ background: "oklch(0.78 0.18 200 / 0.15)", border: "1px solid oklch(0.78 0.18 200 / 0.4)" }}>
                <CheckCircle2 className="h-8 w-8 text-[color:var(--neon-cyan)]" />
              </div>
              <p className="text-sm text-muted-foreground">
                A secure link was sent to <strong className="text-foreground">{email}</strong>.
                Click it to set a new password. The link expires in 1 hour.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="text-sm text-[color:var(--neon-cyan)] hover:underline"
                >
                  Use a different email
                </button>
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-sm font-semibold glass hover:bg-white/5 transition"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
