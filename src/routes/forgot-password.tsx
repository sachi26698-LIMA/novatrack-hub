import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Mail, RefreshCw, Send } from "lucide-react";
import { AuthShell, AuthInput, AuthError, AuthSuccess, PrimaryBtn } from "@/components/auth-shell";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — TrackNova" },
      { name: "description", content: "Reset your TrackNova password." },
    ],
  }),
  component: ForgotPasswordPage,
});

/** Maps Supabase error messages to friendly strings */
function mapResetError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit"))
    return "Too many reset emails sent. Please wait a few minutes before requesting another.";
  if (m.includes("user not found") || m.includes("invalid email"))
    return "No account found with that email address.";
  if (m.includes("network") || m.includes("fetch"))
    return "Network error. Check your connection and try again.";
  return message;
}

function ForgotPasswordPage() {
  const [email, setEmail]           = useState("");
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState("");
  const [sent, setSent]             = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) { setError(mapResetError(err.message)); setBusy(false); return; }
    setSent(true);
    setResendCountdown(60);
    setBusy(false);
  }

  async function handleResend() {
    if (resendCountdown > 0 || busy) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) { setError(mapResetError(err.message)); }
    else { setResendCountdown(60); }
    setBusy(false);
  }

  return (
    <AuthShell badge="Password reset" backLink={{ to: "/auth", label: "Back to sign in" }}>
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4 mx-auto"
          style={{ background: "linear-gradient(135deg,rgba(0,229,255,0.12),rgba(139,92,246,0.12))" }}
        >
          <KeyRound className="h-7 w-7 text-[color:var(--neon-cyan)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {sent ? "Check your inbox" : <>Reset <span className="neon-text">password</span></>}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {sent
            ? `Reset link sent to ${email}`
            : "We'll send a secure reset link to your email."}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.div key="form"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <AuthError msg={error} />
            <form onSubmit={handleSubmit} className="space-y-3">
              <AuthInput icon={Mail} type="email" value={email} onChange={setEmail}
                placeholder="your@email.com" autoComplete="email" disabled={busy} />
              <PrimaryBtn type="submit" loading={busy}>
                <Send className="h-4 w-4" /> Send reset link
              </PrimaryBtn>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Remembered it?{" "}
              <Link to="/auth" className="text-[color:var(--neon-cyan)] hover:underline">
                Sign in
              </Link>
            </p>
          </motion.div>
        ) : (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }} className="space-y-4">

            <AuthError msg={error} />

            {/* Success icon */}
            <div className="flex justify-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl"
                style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)" }}>
                <CheckCircle2 className="h-8 w-8" style={{ color: "#2dd4bf" }} />
              </div>
            </div>

            {/* Instructions */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Click the link in your email to set a new password.
                The link expires in <strong className="text-foreground">1 hour</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Check your <strong className="text-foreground">spam / junk folder</strong> if you don't see it.
              </p>
            </div>

            {/* What to expect */}
            <div className="rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="font-medium text-foreground text-[11px]">What happens next</p>
              <p>1. Open the email from <span className="text-foreground">no-reply@supabase.io</span></p>
              <p>2. Click "Reset Password"</p>
              <p>3. You'll be taken to TrackNova to set a new password</p>
            </div>

            {/* Resend */}
            <button type="button" onClick={handleResend}
              disabled={resendCountdown > 0 || busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs transition-all disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: resendCountdown > 0 ? "var(--muted-foreground)" : "var(--foreground)",
              }}>
              {busy
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                : resendCountdown > 0
                  ? <><RefreshCw className="h-3.5 w-3.5" /> Resend in {resendCountdown}s</>
                  : <><RefreshCw className="h-3.5 w-3.5" /> Resend reset link</>}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Wrong email?{" "}
              <button type="button" onClick={() => { setSent(false); setError(""); }}
                className="text-[color:var(--neon-cyan)] hover:underline">
                Change it
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
