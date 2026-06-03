import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Clock, LogOut, Mail, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/pending-approval")({
  head: () => ({
    meta: [{ title: "Pending Approval — TrackNova" }],
  }),
  component: PendingApprovalPage,
});

const roleInfo: Record<string, { label: string; color: string; description: string }> = {
  Supervisor: {
    label: "Supervisor",
    color: "var(--neon-cyan)",
    description: "Supervisor accounts are reviewed by Admins. Once approved, you can access team management tools.",
  },
  Admin: {
    label: "Admin",
    color: "var(--neon-violet)",
    description: "Admin accounts are reviewed by Super Admins. Once approved, you gain full platform access.",
  },
};

function PendingApprovalPage() {
  const { user, role, approvalStatus, logout, refreshProfile } = useSession();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Redirect if already approved or rejected
  useEffect(() => {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (approvalStatus === "approved") { navigate({ to: "/dashboard" }); return; }
  }, [user, approvalStatus, navigate]);

  // Auto-poll every 45 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      await refreshProfile();
      setLastChecked(new Date());
    }, 45_000);
    return () => clearInterval(interval);
  }, [refreshProfile]);

  async function handleManualCheck() {
    setChecking(true);
    await refreshProfile();
    setLastChecked(new Date());
    setChecking(false);
  }

  async function handleLogout() {
    await logout();
    navigate({ to: "/auth" });
  }

  const info = roleInfo[role ?? ""] ?? {
    label: role ?? "Account",
    color: "var(--neon-cyan)",
    description: "Your account is under review. You will be notified once approved.",
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10">
        {/* Header */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 flex items-center justify-between">
          <BrandMark />
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

        {/* Card */}
        <div className="mx-auto max-w-lg px-4 sm:px-6 pt-10 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong neon-border rounded-3xl p-8 sm:p-10"
          >
            {approvalStatus === "rejected" ? (
              /* ── Rejected state ────────────────────────────────────── */
              <div className="text-center space-y-5">
                <div
                  className="inline-flex items-center justify-center h-20 w-20 rounded-3xl mx-auto"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  <XCircle className="h-10 w-10" style={{ color: "#f87171" }} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight mb-2">Application not approved</h1>
                  <p className="text-sm text-muted-foreground">
                    Your request for a <strong className="text-foreground">{info.label}</strong> account
                    was not approved. You can sign up as a Worker for immediate access.
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/signup" })}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground transition"
                    style={{ background: "linear-gradient(135deg,var(--neon-cyan),var(--neon-violet))" }}
                  >
                    Sign up as Worker
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                </div>
              </div>
            ) : (
              /* ── Pending state ─────────────────────────────────────── */
              <div className="text-center space-y-6">
                {/* Animated clock */}
                <div className="relative inline-flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-3xl"
                    style={{
                      background: `conic-gradient(from 0deg, ${info.color}33, transparent 60%)`,
                    }}
                  />
                  <div
                    className="relative inline-flex items-center justify-center h-20 w-20 rounded-3xl"
                    style={{
                      background: `linear-gradient(135deg,${info.color}18,transparent)`,
                      border: `1px solid ${info.color}40`,
                    }}
                  >
                    <Clock className="h-10 w-10" style={{ color: info.color }} />
                  </div>
                </div>

                {/* Text */}
                <div>
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-3"
                    style={{
                      background: `${info.color}18`,
                      border: `1px solid ${info.color}30`,
                      color: info.color,
                    }}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {info.label} Request
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Pending approval
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {info.description}
                  </p>
                </div>

                {/* Account info */}
                <div
                  className="rounded-2xl p-4 text-left space-y-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="text-foreground font-medium">{user?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Role requested:{" "}
                    <span className="font-medium" style={{ color: info.color }}>{info.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Status:{" "}
                    <span className="font-medium text-amber-400">Under Review</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={checking}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
                    {checking ? "Checking…" : "Check status"}
                  </button>

                  {lastChecked && (
                    <p className="text-xs text-muted-foreground text-center">
                      Last checked: {lastChecked.toLocaleTimeString()}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out and return later
                  </button>
                </div>

                <p className="text-xs text-muted-foreground border-t border-white/6 pt-4">
                  An admin will review your request. You'll be able to sign in once approved.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
