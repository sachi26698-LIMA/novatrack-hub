import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrackNova" },
      { name: "description", content: "Sign in to TrackNova." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen relative grid place-items-center">
        <AnimatedBackground />
        <Loader2 className="h-8 w-8 animate-spin text-[color:var(--neon-cyan)]" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between">
          <BrandMark />
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-10 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong neon-border rounded-3xl p-6 sm:p-8 glow-violet"
        >
          <div className="flex flex-col items-center text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
              <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
              Secure sign-in
            </div>

            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan)22, var(--neon-violet)22)" }}
            >
              <LogIn className="h-7 w-7 text-[color:var(--neon-cyan)]" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Welcome to <span className="neon-text">TrackNova</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to access your workspace.
            </p>
          </div>

          <a
            href="/api/auth/login"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground transition"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
          >
            <LogIn className="h-4 w-4" />
            Log in
          </a>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our Terms &amp; Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
