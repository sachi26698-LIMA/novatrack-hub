import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import {
  AuthShell, AuthInput, AuthError, AuthSuccess, PrimaryBtn,
} from "@/components/auth-shell";
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

function mapResetError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("same password") || m.includes("different from"))
    return "New password must be different from your current password.";
  if (m.includes("password should be") || m.includes("at least"))
    return "Password must be at least 8 characters.";
  if (m.includes("auth session missing") || m.includes("session"))
    return "Your reset link has expired. Please request a new one from Forgot Password.";
  if (m.includes("token") || m.includes("invalid") || m.includes("expired"))
    return "Reset link is invalid or expired. Request a new one from Forgot Password.";
  if (m.includes("network") || m.includes("fetch"))
    return "Network error. Check your connection and try again.";
  return message;
}

function PasswordStrength({ password }: { password: string }) {
  const s = (() => {
    if (password.length < 6) return 0;
    if (password.length < 8) return 1;
    const checks = [/[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
    const n = checks.filter(Boolean).length;
    return n >= 2 ? 3 : n >= 1 ? 2 : 1;
  })();
  const labels = ["Too short", "Weak", "Fair", "Strong"] as const;
  const colors = ["#6b7280", "#ef4444", "#f59e0b", "#22c55e"] as const;
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= s ? colors[s] : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>
      <span className="text-[10px]" style={{ color: colors[s] }}>{labels[s]}</span>
    </div>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady]       = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [showCnf, setShowCnf]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [done, setDone]         = useState(false);

  // Supabase puts the recovery token in the URL hash.
  // `detectSessionInUrl: true` on the client handles extraction.
  // We watch for PASSWORD_RECOVERY to know the user is authenticated for reset.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
      if (event === "SIGNED_IN") {
        // On page reload after token was already consumed — check for existing session
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) setReady(true);
        });
      }
    });
    // Check on mount (e.g. page hard-reload after token consumed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true); setError(""); setSuccess("");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(mapResetError(err.message)); setBusy(false); return; }
    setSuccess("Password updated successfully!");
    setDone(true);
    setBusy(false);
    setTimeout(() => navigate({ to: "/auth" }), 2500);
  }

  return (
    <AuthShell badge="Set new password" backLink={{ to: "/auth", label: "Back to sign in" }}>
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4 mx-auto"
          style={{ background: "linear-gradient(135deg,rgba(0,229,255,0.12),rgba(139,92,246,0.12))" }}
        >
          <Lock className="h-7 w-7 text-[color:var(--neon-cyan)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {done ? "Password updated" : <>New <span className="neon-text">password</span></>}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {done ? "Redirecting you to sign in…" : "Choose a strong password for your account."}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }} className="text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mx-auto"
              style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)" }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: "#2dd4bf" }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Your password has been updated. Taking you to sign in…
            </p>
          </motion.div>
        ) : !ready ? (
          <motion.div key="waiting"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
            className="text-center space-y-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mx-auto"
              style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <KeyRound className="h-5 w-5" style={{ color: "#fbbf24" }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Waiting for your reset link to be verified…
            </p>
            <p className="text-xs text-muted-foreground">
              If you arrived here directly, use{" "}
              <button type="button" onClick={() => navigate({ to: "/forgot-password" })}
                className="text-[color:var(--neon-cyan)] hover:underline">
                Forgot Password
              </button>{" "}
              to get a valid reset link sent to your email.
            </p>
          </motion.div>
        ) : (
          <motion.div key="form"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}>
            <AuthError   msg={error} />
            <AuthSuccess msg={success} />
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <AuthInput icon={KeyRound} type={showPwd ? "text" : "password"}
                  value={password} onChange={setPassword}
                  placeholder="New password (min. 8 chars)"
                  autoComplete="new-password" disabled={busy}
                  right={
                    <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                {password && <PasswordStrength password={password} />}
              </div>
              <AuthInput icon={ShieldCheck} type={showCnf ? "text" : "password"}
                value={confirm} onChange={setConfirm}
                placeholder="Confirm new password"
                autoComplete="new-password" disabled={busy}
                right={
                  <button type="button" onClick={() => setShowCnf((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showCnf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {confirm && password !== confirm && (
                <p className="text-[11px] text-red-400 -mt-1">Passwords do not match</p>
              )}
              <PrimaryBtn type="submit" loading={busy}
                disabled={password.length < 8 || password !== confirm}>
                <ShieldCheck className="h-4 w-4" /> Update password
              </PrimaryBtn>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
