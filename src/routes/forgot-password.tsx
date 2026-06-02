import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CheckCircle2, KeyRound, Mail, Send } from "lucide-react";
import { AuthShell, AuthInput, AuthError, PrimaryBtn } from "@/components/auth-shell";
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

function ForgotPasswordPage() {
  const [email, setEmail]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [sent, setSent]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email."); return; }
    if (!isSupabaseConfigured) { setError("Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); setBusy(false); return; }
    setSent(true); setBusy(false);
  }

  return (
    <AuthShell badge="Password reset" backLink={{ to: "/auth", label: "Back to sign in" }}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4 mx-auto"
          style={{ background: "linear-gradient(135deg,var(--neon-cyan)18,var(--neon-violet)18)" }}>
          <KeyRound className="h-7 w-7 text-[color:var(--neon-cyan)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {sent ? "Check your inbox" : <>Reset <span className="neon-text">password</span></>}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {sent
            ? `A reset link was sent to ${email}`
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
          </motion.div>
        ) : (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }} className="text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mx-auto"
              style={{ background:"rgba(20,184,166,0.12)", border:"1px solid rgba(20,184,166,0.3)" }}>
              <CheckCircle2 className="h-8 w-8" style={{ color:"#2dd4bf" }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Click the link in your email to set a new password. The link expires in <strong className="text-foreground">1 hour</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn't get it? Check spam, or{" "}
              <button type="button" onClick={() => setSent(false)}
                className="text-[color:var(--neon-cyan)] hover:underline">try again</button>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
