import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to TrackNova." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
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
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
            <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
            Authentication
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-3">Use Replit to manage your account</h1>
          <p className="text-sm text-muted-foreground mb-6">
            TrackNova uses Replit authentication. Manage your password through your Replit account settings.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground w-full glow-cyan transition"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
          >
            Back to sign in
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
