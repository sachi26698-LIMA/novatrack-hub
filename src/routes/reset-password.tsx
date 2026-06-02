import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { AuthShell, AuthInput, AuthError, PrimaryBtn } from "@/components/auth-shell";
import { supabase } from "@/integrations/supabase/client";

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
  const [ready, setReady]       = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [showCnf, setShowCnf]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);

  // Supabase puts the recovery token in the URL hash on arrival.
  // `detectSessionInUrl: true` on the client handles it — we just watch for
  // the PASSWORD_RECOVERY event to know the user is ready to update.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also check if already in a recovery session (page reload)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setBusy(false); return; }
    setDone(true); setBusy(false);
    setTimeout(() => navigate({ to: "/auth" }), 2500);
  }

  return (
    <AuthShell badge="Set new password" backLink={{ to: "/auth", label: "Back to sign in" }}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4 mx-auto"
          style={{ background: "linear-gradient(135deg,var(--neon-cyan)18,var(--neon-violet)18)" }}>
          <Lock className="h-7 w-7 text-[color:var(--neon-cyan)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {done ? "Password updated" : <>New <span className="neon-text">password</span></>}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {done ? "Redirecting to sign in…" : "Choose a strong password for your account."}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }} className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mx-auto"
              style={{ background:"rgba(20,184,166,0.12)", border:"1px solid rgba(20,184,166,0.3)" }}>
              <CheckCircle2 className="h-8 w-8" style={{ color:"#2dd4bf" }} />
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Your password has been updated. Taking you to sign in…
            </p>
          </motion.div>
        ) : !ready ? (
          <motion.div key="waiting"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
            className="text-center">
            <p className="text-sm text-muted-foreground">
              Waiting for recovery link… If you arrived here directly, use{" "}
              <button type="button" onClick={() => navigate({ to: "/forgot-password" })}
                className="text-[color:var(--neon-cyan)] hover:underline">Forgot Password</button>{" "}
              to get a valid link.
            </p>
          </motion.div>
        ) : (
          <motion.div key="form"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}>
            <AuthError msg={error} />
            <form onSubmit={handleSubmit} className="space-y-3">
              <AuthInput icon={KeyRound} type={showPwd ? "text" : "password"}
                value={password} onChange={setPassword}
                placeholder="New password (min. 8 chars)" autoComplete="new-password" disabled={busy}
                right={
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <AuthInput icon={ShieldCheck} type={showCnf ? "text" : "password"}
                value={confirm} onChange={setConfirm}
                placeholder="Confirm new password" autoComplete="new-password" disabled={busy}
                right={
                  <button type="button" onClick={() => setShowCnf(v => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showCnf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <PrimaryBtn type="submit" loading={busy} disabled={password.length < 8}>
                <ShieldCheck className="h-4 w-4" /> Update password
              </PrimaryBtn>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
