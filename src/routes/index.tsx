import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight, BarChart3, Bot, Building2, CheckCircle2, Clock,
  Fingerprint, Globe2, LineChart, ScanLine, Shield, Sparkles, Users, Wallet,
} from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrackNova — 3D Enterprise Company Management OS" },
      { name: "description", content: "TrackNova is a premium futuristic platform to run your entire company: workers, attendance, payroll, projects, revenue and AI-driven analytics in one neon dashboard." },
      { property: "og:title", content: "TrackNova — Enterprise OS" },
      { property: "og:description", content: "All-in-one 3D enterprise dashboard for workers, payroll, attendance, projects and revenue." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Users, title: "Worker Management", desc: "Profiles, documents, departments, performance — all in one place.", glow: "cyan" as const },
  { icon: ScanLine, title: "Smart Attendance", desc: "QR + GPS check-in, shifts, overtime and late marks tracked live.", glow: "violet" as const },
  { icon: Wallet, title: "Payroll & Salary", desc: "Auto salary, PF, bonuses, deductions and one-click slip PDFs.", glow: "pink" as const },
  { icon: Building2, title: "Project Tracking", desc: "Assign workers, upload site photos, track materials & deadlines.", glow: "cyan" as const },
  { icon: LineChart, title: "Revenue & Expenses", desc: "Daily, monthly, yearly P&L with GST-ready exports.", glow: "violet" as const },
  { icon: Bot, title: "AI Predictions", desc: "Revenue forecasts, anomaly alerts and natural-language search.", glow: "pink" as const },
];

const stats = [
  { value: "₹4.8Cr", label: "Tracked monthly revenue" },
  { value: "12K+", label: "Workers managed" },
  { value: "99.99%", label: "Uptime SLA" },
  { value: "47", label: "Countries served" },
];

function Landing() {
  return (
    <div className="min-h-screen text-foreground">
      <AnimatedBackground />

      {/* Nav */}
      <header className="sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <div className="glass rounded-2xl px-4 sm:px-5 py-3 flex items-center justify-between">
            <BrandMark />
            <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition">Features</a>
              <a href="#modules" className="hover:text-foreground transition">Modules</a>
              <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/auth" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">
                Sign in
              </Link>
              <Link
                to="/dashboard"
                className="group relative inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
              >
                Launch app
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-10 sm:pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />
            New · AI Revenue Prediction Engine v2
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
            Run your entire company
            <br />
            from one <span className="neon-text">3D command center</span>.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            TrackNova unifies workers, attendance, payroll, projects and revenue into a single futuristic
            enterprise OS — with live analytics, AI forecasts and zero spreadsheets.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground glow-cyan"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
            >
              Open live dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl glass px-6 py-3 text-sm font-semibold hover:bg-white/5 transition"
            >
              <Fingerprint className="h-4 w-4" />
              Sign in with OTP
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                className="glass rounded-2xl p-4"
              >
                <div className="text-xl sm:text-2xl font-bold neon-text">{s.value}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Floating 3D dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 8 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformPerspective: 1400, transformStyle: "preserve-3d" }}
          className="mt-16 sm:mt-24 mx-auto max-w-5xl"
        >
          <div className="glass-strong neon-border rounded-3xl p-3 sm:p-4 glow-violet">
            <div className="rounded-2xl bg-background/60 p-4 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--neon-pink)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--neon-cyan)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--neon-violet)]" />
                </div>
                <div className="text-xs text-muted-foreground">tracknova.app/dashboard</div>
                <div className="text-xs text-muted-foreground hidden sm:block">v2.4 · live</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { l: "Revenue (MTD)", v: "₹84.2L", c: "var(--neon-cyan)" },
                  { l: "Active workers", v: "1,284", c: "var(--neon-violet)" },
                  { l: "On-site projects", v: "37", c: "var(--neon-pink)" },
                ].map((k) => (
                  <div key={k.l} className="glass rounded-xl p-4">
                    <div className="text-xs text-muted-foreground">{k.l}</div>
                    <div className="mt-1 text-2xl font-bold" style={{ color: k.c as string }}>{k.v}</div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full"
                        style={{ background: k.c as string }}
                        initial={{ width: 0 }} animate={{ width: "78%" }} transition={{ duration: 1.4, delay: 0.6 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-12 gap-3">
                <div className="col-span-12 lg:col-span-8 glass rounded-xl p-4 h-44 relative overflow-hidden">
                  <div className="text-xs text-muted-foreground mb-2">Revenue trend</div>
                  <svg viewBox="0 0 400 120" className="w-full h-full">
                    <defs>
                      <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      d="M0,90 C40,60 70,80 110,55 C150,30 190,70 230,45 C270,20 310,50 360,30 L400,25 L400,120 L0,120 Z"
                      fill="url(#g1)"
                      initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 2, delay: 0.4 }}
                    />
                    <motion.path
                      d="M0,90 C40,60 70,80 110,55 C150,30 190,70 230,45 C270,20 310,50 360,30 L400,25"
                      stroke="oklch(0.85 0.18 200)" strokeWidth="2" fill="none"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 0.4 }}
                    />
                  </svg>
                </div>
                <div className="col-span-12 lg:col-span-4 glass rounded-xl p-4 h-44">
                  <div className="text-xs text-muted-foreground mb-3">Attendance today</div>
                  <div className="relative mx-auto h-28 w-28">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" stroke="oklch(1 0 0 / 0.08)" strokeWidth="10" fill="none" />
                      <motion.circle
                        cx="50" cy="50" r="42" stroke="url(#ring)" strokeWidth="10" fill="none" strokeLinecap="round"
                        initial={{ strokeDasharray: "0 264" }} animate={{ strokeDasharray: "220 264" }}
                        transition={{ duration: 1.6, delay: 0.5 }}
                      />
                      <defs>
                        <linearGradient id="ring" x1="0" x2="1">
                          <stop offset="0%" stopColor="oklch(0.78 0.18 200)" />
                          <stop offset="100%" stopColor="oklch(0.7 0.26 295)" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-center">
                      <div>
                        <div className="text-xl font-bold">83%</div>
                        <div className="text-[10px] text-muted-foreground">present</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features grid */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs uppercase tracking-[0.25em] text-[color:var(--neon-cyan)] mb-3">Platform</div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Every module your enterprise needs.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Eleven deeply integrated modules. One neon command center. Zero spreadsheets.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((f, i) => (
            <GlassCard key={f.title} glow={f.glow} transition={{ delay: i * 0.06, duration: 0.5 }}>
              <div
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl mb-4"
                style={{
                  background: "linear-gradient(135deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.02))",
                  border: "1px solid oklch(1 0 0 / 0.12)",
                }}
              >
                <f.icon className="h-5 w-5 text-[color:var(--neon-cyan)]" />
              </div>
              <div className="text-lg font-semibold">{f.title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Modules strip */}
      <section id="modules" className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div className="glass-strong rounded-3xl p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight">
                Built for <span className="neon-text">admins, managers, supervisors</span> and workers.
              </h3>
              <p className="mt-3 text-muted-foreground">
                Role-based dashboards, granular permissions, activity logs and end-to-end encryption — secure
                by default for every team in your org.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Phone OTP + Email + SSO authentication",
                  "QR & GPS attendance with offline sync",
                  "Auto payroll, PF, GST & salary slip PDFs",
                  "AI forecasting and natural-language search",
                  "Real-time WhatsApp & email notifications",
                ].map((l) => (
                  <li key={l} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-[color:var(--neon-cyan)] shrink-0" />
                    <span className="text-muted-foreground">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { i: Shield, t: "Bank-grade security" },
                { i: Clock, t: "Real-time sync" },
                { i: BarChart3, t: "Deep analytics" },
                { i: Globe2, t: "Multi-language" },
              ].map((b) => (
                <div key={b.t} className="glass rounded-2xl p-5 hover:glow-violet transition">
                  <b.i className="h-6 w-6 text-[color:var(--neon-violet)]" />
                  <div className="mt-3 font-medium">{b.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="mx-auto max-w-5xl px-4 sm:px-6 py-20 text-center">
        <div className="glass-strong neon-border glow-cyan rounded-3xl p-10 sm:p-14">
          <h3 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Ready to <span className="neon-text">launch TrackNova?</span>
          </h3>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Spin up your enterprise OS in under 60 seconds. No credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
            >
              Enter dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-xl glass px-6 py-3 text-sm font-semibold">
              Create account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 mt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <BrandMark size={26} />
          <div>© {new Date().getFullYear()} TrackNova Systems. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
