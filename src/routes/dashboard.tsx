import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Activity, Bell, Building2, ChevronRight, CircleDollarSign, Cog, Home,
  LineChart as LineIcon, Menu, ScanLine, Search, Sparkles, TrendingUp, Users, Wallet, X,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark, Logo } from "@/components/brand";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TrackNova" },
      { name: "description", content: "Live 3D enterprise dashboard with revenue, workers, attendance and project analytics." },
    ],
  }),
  component: Dashboard,
});

const revenueData = [
  { m: "Jan", revenue: 42, expense: 28 }, { m: "Feb", revenue: 48, expense: 30 },
  { m: "Mar", revenue: 55, expense: 34 }, { m: "Apr", revenue: 51, expense: 32 },
  { m: "May", revenue: 64, expense: 38 }, { m: "Jun", revenue: 72, expense: 41 },
  { m: "Jul", revenue: 80, expense: 44 }, { m: "Aug", revenue: 88, expense: 48 },
  { m: "Sep", revenue: 95, expense: 52 }, { m: "Oct", revenue: 104, expense: 56 },
  { m: "Nov", revenue: 118, expense: 61 }, { m: "Dec", revenue: 132, expense: 68 },
];

const attendanceData = [
  { d: "Mon", v: 92 }, { d: "Tue", v: 88 }, { d: "Wed", v: 95 },
  { d: "Thu", v: 84 }, { d: "Fri", v: 90 }, { d: "Sat", v: 78 }, { d: "Sun", v: 42 },
];

const projectMix = [
  { name: "Active", value: 24, color: "oklch(0.78 0.18 200)" },
  { name: "Pending", value: 9, color: "oklch(0.7 0.26 295)" },
  { name: "Completed", value: 41, color: "oklch(0.75 0.25 5)" },
  { name: "Delayed", value: 4, color: "oklch(0.78 0.2 60)" },
];

const projects = [
  { name: "Skyline Tower – Block A", lead: "R. Mehta", progress: 78, status: "On track" },
  { name: "Metro Depot Phase 2", lead: "S. Iyer", progress: 54, status: "On track" },
  { name: "Riverside Mall Fitout", lead: "A. Khan", progress: 32, status: "At risk" },
  { name: "Eastview Apartments", lead: "P. Singh", progress: 91, status: "Final QA" },
];

const activity = [
  { who: "Aarav P.", what: "checked in via GPS", when: "2m ago" },
  { who: "Payroll", what: "ran for 1,284 workers", when: "12m ago" },
  { who: "Site 17", what: "uploaded 8 progress photos", when: "27m ago" },
  { who: "AI Forecast", what: "Q4 revenue ↑ 14.2%", when: "1h ago" },
];

const navItems = [
  { i: Home, l: "Overview", active: true },
  { i: Users, l: "Workers" },
  { i: ScanLine, l: "Attendance" },
  { i: Wallet, l: "Payroll" },
  { i: Building2, l: "Projects" },
  { i: CircleDollarSign, l: "Revenue" },
  { i: LineIcon, l: "Reports" },
  { i: Cog, l: "Settings" },
];

function Dashboard() {
  const [sidebar, setSidebar] = useState(false);

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col p-4 z-30">
        <div className="glass-strong rounded-2xl flex-1 p-4 flex flex-col">
          <BrandMark />
          <nav className="mt-6 space-y-1">
            {navItems.map((n) => (
              <button
                key={n.l}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  n.active
                    ? "text-foreground bg-white/5 neon-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <n.i className="h-4 w-4" />
                <span>{n.l}</span>
                {n.active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />}
              </button>
            ))}
          </nav>
          <div className="mt-auto glass rounded-xl p-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[color:var(--neon-cyan)]" />
              <span className="font-medium">AI Forecast ready</span>
            </div>
            <p className="mt-1 text-muted-foreground">Q4 revenue projected +14.2%</p>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebar && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setSidebar(false)} />
          <motion.aside
            initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
            className="absolute left-0 top-0 bottom-0 w-72 p-4"
          >
            <div className="glass-strong rounded-2xl h-full p-4 flex flex-col">
              <div className="flex items-center justify-between">
                <BrandMark />
                <button onClick={() => setSidebar(false)} className="p-2 rounded-lg glass">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-6 space-y-1">
                {navItems.map((n) => (
                  <button
                    key={n.l}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                      n.active ? "text-foreground bg-white/5" : "text-muted-foreground"
                    }`}
                  >
                    <n.i className="h-4 w-4" />
                    {n.l}
                  </button>
                ))}
              </nav>
            </div>
          </motion.aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 p-4">
          <div className="glass rounded-2xl px-3 sm:px-4 py-2.5 flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg glass" onClick={() => setSidebar(true)}>
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-1.5 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search workers, projects, invoices…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="hidden sm:inline text-[10px] text-muted-foreground border border-white/10 rounded px-1.5 py-0.5">⌘K</kbd>
            </div>
            <button className="relative p-2 rounded-xl glass">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--neon-pink)] animate-pulse" />
            </button>
            <Link to="/" className="hidden sm:flex items-center gap-2 glass rounded-xl px-2.5 py-1.5">
              <div className="h-7 w-7 rounded-full grid place-items-center text-xs font-bold"
                   style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}>
                A
              </div>
              <div className="text-xs leading-tight">
                <div className="font-medium">Admin</div>
                <div className="text-muted-foreground">tracknova.app</div>
              </div>
            </Link>
            <div className="sm:hidden"><Logo size={32} /></div>
          </div>
        </header>

        <main className="p-4 sm:p-6 space-y-6">
          {/* Greeting */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--neon-cyan)]">Overview</div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
                Good morning, <span className="neon-text">Aarav</span>
              </h1>
              <p className="text-sm text-muted-foreground">Here's what's happening across your company today.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 glass rounded-full px-3 py-1 text-xs">
                <Activity className="h-3 w-3 text-[color:var(--neon-cyan)] animate-pulse" />
                Live · auto-refresh
              </span>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { l: "Total revenue (MTD)", v: "₹84.2L", d: "+12.4%", g: "cyan" as const, i: CircleDollarSign },
              { l: "Active workers", v: "1,284", d: "+38 this wk", g: "violet" as const, i: Users },
              { l: "Attendance today", v: "83%", d: "1,066 present", g: "pink" as const, i: ScanLine },
              { l: "Ongoing projects", v: "37", d: "4 at risk", g: "cyan" as const, i: Building2 },
            ].map((k, i) => (
              <GlassCard key={k.l} glow={k.g} transition={{ delay: i * 0.05, duration: 0.5 }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                    <div className="mt-2 text-2xl sm:text-3xl font-bold">{k.v}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--neon-cyan)]">
                      <TrendingUp className="h-3 w-3" /> {k.d}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-xl grid place-items-center glass">
                    <k.i className="h-4 w-4" />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard className="lg:col-span-2 p-5" glow="violet">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Revenue vs Expense</div>
                  <div className="text-xs text-muted-foreground">Trailing 12 months</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Legend dot="cyan" label="Revenue" />
                  <Legend dot="violet" label="Expense" />
                </div>
              </div>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="exp" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.7 0.26 295)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="oklch(0.7 0.26 295)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                    <XAxis dataKey="m" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.19 0.035 270 / 0.95)",
                        border: "1px solid oklch(1 0 0 / 0.12)",
                        borderRadius: 12, fontSize: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="oklch(0.85 0.18 200)" strokeWidth={2} fill="url(#rev)" />
                    <Area type="monotone" dataKey="expense" stroke="oklch(0.75 0.26 295)" strokeWidth={2} fill="url(#exp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard glow="pink">
              <div className="text-sm font-semibold">Project status</div>
              <div className="text-xs text-muted-foreground">All portfolios</div>
              <div className="h-56 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={projectMix} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none">
                      {projectMix.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                {projectMix.map((p) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-muted-foreground">{p.name}</span>
                    <span className="ml-auto font-medium">{p.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Attendance + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard className="lg:col-span-2" glow="cyan">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Weekly attendance</div>
                  <div className="text-xs text-muted-foreground">% workers present</div>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bar" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.85 0.18 200)" />
                        <stop offset="100%" stopColor="oklch(0.7 0.26 295)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                    <XAxis dataKey="d" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
                    <Bar dataKey="v" fill="url(#bar)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="text-sm font-semibold mb-3">Live activity</div>
              <ul className="space-y-3">
                {activity.map((a, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <div className="h-2 w-2 mt-2 rounded-full bg-[color:var(--neon-cyan)] animate-pulse-ring" />
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-muted-foreground">{a.what}</span>
                      <div className="text-[11px] text-muted-foreground">{a.when}</div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </GlassCard>
          </div>

          {/* Projects table */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Ongoing projects</div>
                <div className="text-xs text-muted-foreground">Updated 2 min ago</div>
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-t border-white/5">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Lead</th>
                    <th className="px-5 py-3 font-medium">Progress</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.name} className="border-t border-white/5 hover:bg-white/[0.03] transition">
                      <td className="px-5 py-4 font-medium">{p.name}</td>
                      <td className="px-5 py-4 text-muted-foreground">{p.lead}</td>
                      <td className="px-5 py-4 w-1/3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet))" }}
                              initial={{ width: 0 }} animate={{ width: `${p.progress}%` }}
                              transition={{ duration: 1.2, ease: "easeOut" }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full glass ${
                            p.status === "At risk" ? "text-[color:var(--neon-pink)]" : "text-[color:var(--neon-cyan)]"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </main>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: "cyan" | "violet"; label: string }) {
  const c = dot === "cyan" ? "var(--neon-cyan)" : "var(--neon-violet)";
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
      {label}
    </span>
  );
}
