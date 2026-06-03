import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Building2, CheckCircle2, ChevronRight, CircleDollarSign, RefreshCw,
  ScanLine, Star, TrendingUp, Users,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { useSession } from "@/hooks/use-session";
import { listWorkers, listProjects, listAttendance, listPayroll } from "@/lib/queries";
import { listInvoices } from "@/lib/queries-billing";
import { listTasks } from "@/lib/queries-tasks";
import { getAuthToken } from "@/lib/auth-token";
export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TrackNova" },
      { name: "description", content: "Live enterprise dashboard with revenue, workers, attendance and project analytics." },
    ],
  }),
  component: Dashboard,
});

const chartTooltip = {
  background: "oklch(0.19 0.035 270 / 0.95)",
  border: "1px solid oklch(1 0 0 / 0.12)",
  borderRadius: 12, fontSize: 12,
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt(n: number) {
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function Dashboard() {
  const { user } = useSession();
  const enabled = !!user;
  const qc = useQueryClient();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [flashKey, setFlashKey] = useState(0);

  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled });
  const { data: payroll = [] } = useQuery({ queryKey: ["payroll"], queryFn: listPayroll, enabled });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance", 500], queryFn: () => listAttendance(500), enabled });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: listInvoices, enabled });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks, enabled });
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["activity-recent"],
    queryFn: async () => {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/activity_logs?limit=5", { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["attendance", 500] });
      qc.invalidateQueries({ queryKey: ["activity-recent"] });
      setLastRefreshed(new Date());
      setFlashKey((n) => n + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [enabled, qc]);

  const displayName = (user?.name ?? "there").split(" ")[0];

  const activeWorkers = useMemo(() => workers.filter((w) => w.status === "Active").length, [workers]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = useMemo(
    () => attendance.filter((a) => a.check_in?.slice(0, 10) === todayStr),
    [attendance, todayStr],
  );
  const attendancePct = workers.length > 0 ? Math.round((todayAttendance.length / workers.length) * 100) : 0;

  const ongoingProjects = useMemo(
    () => projects.filter((p) => p.status !== "Completed" && p.status !== "Cancelled"),
    [projects],
  );
  const atRiskProjects = useMemo(
    () => ongoingProjects.filter((p) => p.status === "OnHold" || (typeof p.progress === "number" && p.progress < 30)),
    [ongoingProjects],
  );

  const thisMonth = new Date().toISOString().slice(0, 7);
  const mtdRevenue = useMemo(
    () => invoices
      .filter((inv) => inv.issue_date?.slice(0, 7) === thisMonth)
      .reduce((s, inv) => s + Number(inv.total ?? 0), 0),
    [invoices, thisMonth],
  );

  const revenueChart = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      return d.toISOString().slice(0, 7);
    });
    return months.map((m) => {
      const revenue = invoices.filter((inv) => inv.issue_date?.slice(0, 7) === m)
        .reduce((s, inv) => s + Number(inv.total ?? 0), 0);
      const expense = payroll.filter((p) => p.period_end?.slice(0, 7) === m)
        .reduce((s, p) => s + Number(p.net_amount ?? 0), 0);
      return { m: m.slice(2), revenue: Math.round(revenue / 1000), expense: Math.round(expense / 1000) };
    });
  }, [invoices, payroll]);

  const weeklyAttendance = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Map<string, number>();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    attendance.forEach((a) => {
      const day = a.check_in?.slice(0, 10);
      if (day && last7.includes(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
    });
    const total = workers.length || 1;
    return last7.map((date) => ({
      d: days[new Date(date).getDay()],
      v: Math.round(((counts.get(date) ?? 0) / total) * 100),
    }));
  }, [attendance, workers]);

  const projectMix = useMemo(() => {
    const m = new Map<string, number>();
    projects.forEach((p) => m.set(p.status, (m.get(p.status) ?? 0) + 1));
    const palette = [
      "oklch(0.78 0.18 200)", "oklch(0.7 0.26 295)", "oklch(0.75 0.25 5)",
      "oklch(0.78 0.2 60)", "oklch(0.7 0.2 145)",
    ];
    return Array.from(m.entries()).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, [projects]);

  const topProjects = useMemo(() => projects.slice(0, 4), [projects]);

  // 28-day attendance heatmap
  const heatmap28 = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (27 - i));
      const iso = d.toISOString().slice(0, 10);
      const count = attendance.filter((a) => a.check_in?.slice(0, 10) === iso).length;
      const pct = workers.length > 0 ? count / workers.length : 0;
      return { iso, count, pct, dow: (d.getDay() + 6) % 7, day: d.getDate() };
    });
  }, [attendance, workers]);

  // Top performers: workers with most attendance days in last 30 days
  const topPerformers = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const m = new Map<string, { worker: (typeof workers)[0]; days: number }>();
    attendance.forEach((a) => {
      if (!a.worker_id || a.check_in?.slice(0, 10)! < cutoffStr) return;
      if (!m.has(a.worker_id)) {
        const w = workers.find((x) => x.id === a.worker_id);
        if (w) m.set(a.worker_id, { worker: w, days: 0 });
      }
      if (m.has(a.worker_id)) m.get(a.worker_id)!.days++;
    });
    return Array.from(m.values()).sort((a, b) => b.days - a.days).slice(0, 5);
  }, [attendance, workers]);

  // Task completion stats
  const taskStats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter((t) => t.status === "Done").length,
    inProgress: tasks.filter((t) => t.status === "InProgress").length,
    blocked: tasks.filter((t) => t.status === "Blocked").length,
    pct: tasks.length > 0 ? Math.round((tasks.filter((t) => t.status === "Done").length / tasks.length) * 100) : 0,
  }), [tasks]);

  const kpis = [
    {
      l: "Revenue (MTD)", v: mtdRevenue > 0 ? fmt(mtdRevenue) : "—",
      d: `${invoices.filter((i) => i.issue_date?.slice(0, 7) === thisMonth).length} invoices`,
      g: "cyan" as const, i: CircleDollarSign,
    },
    {
      l: "Active workers", v: activeWorkers > 0 ? activeWorkers.toLocaleString() : workers.length > 0 ? "0" : "—",
      d: `${workers.length} total`,
      g: "violet" as const, i: Users,
    },
    {
      l: "Attendance today", v: workers.length > 0 ? `${attendancePct}%` : "—",
      d: `${todayAttendance.length} present`,
      g: "pink" as const, i: ScanLine,
    },
    {
      l: "Ongoing projects", v: ongoingProjects.length > 0 ? ongoingProjects.length.toString() : projects.length > 0 ? "0" : "—",
      d: atRiskProjects.length > 0 ? `${atRiskProjects.length} at risk` : "All on track",
      g: "cyan" as const, i: Building2,
    },
  ];

  return (
    <AppShell
      eyebrow="Overview"
      title={<>{greeting()}, <span className="neon-text">{displayName}</span></>}
      subtitle="Here's what's happening across your company today."
      actions={
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            <motion.span
              key={flashKey}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-[color:var(--neon-cyan)]"
            >
              <RefreshCw className="h-3 w-3" />
              {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </motion.span>
          </AnimatePresence>
          <span className="inline-flex items-center gap-1.5 glass rounded-full px-3 py-1 text-xs">
            <Activity className="h-3 w-3 text-[color:var(--neon-cyan)] animate-pulse" />
            Live · realtime
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k, i) => (
          <GlassCard key={k.l} glow={k.g} transition={{ delay: i * 0.05, duration: 0.5 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${k.l}-${k.v}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.25 }}
                    className="mt-2 text-2xl sm:text-3xl font-bold"
                  >
                    {k.v}
                  </motion.div>
                </AnimatePresence>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2 p-5" glow="violet">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Revenue vs Expense</div>
              <div className="text-xs text-muted-foreground">Trailing 12 months · ₹ thousands</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Legend dot="cyan" label="Revenue" />
              <Legend dot="violet" label="Payroll" />
            </div>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChart} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
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
                <Tooltip contentStyle={chartTooltip} />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.85 0.18 200)" strokeWidth={2} fill="url(#rev)" />
                <Area type="monotone" dataKey="expense" stroke="oklch(0.75 0.26 295)" strokeWidth={2} fill="url(#exp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {invoices.length === 0 && payroll.length === 0 && (
            <div className="text-xs text-center text-muted-foreground mt-2">Add invoices and payroll records to populate this chart.</div>
          )}
        </GlassCard>

        <GlassCard glow="pink">
          <div className="text-sm font-semibold">Project status</div>
          <div className="text-xs text-muted-foreground">All portfolios</div>
          {projects.length === 0 ? (
            <div className="py-12 text-xs text-center text-muted-foreground">No projects yet.</div>
          ) : (
            <>
              <div className="h-56 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={projectMix} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none">
                      {projectMix.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltip} />
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
            </>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2" glow="cyan">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Weekly attendance</div>
              <div className="text-xs text-muted-foreground">% workers present per day (last 7 days)</div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAttendance} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="bar" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.85 0.18 200)" />
                    <stop offset="100%" stopColor="oklch(0.7 0.26 295)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="d" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={chartTooltip} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} formatter={(v: number) => [`${v}%`, "Present"]} />
                <Bar dataKey="v" fill="url(#bar)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="text-sm font-semibold mb-3">Live activity</div>
          {activityLogs.length === 0 ? (
            <div className="py-8 text-xs text-center text-muted-foreground">No activity yet.</div>
          ) : (
            <ul className="space-y-3">
              {activityLogs.map((a: any, i: number) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3"
                >
                  <div className="h-2 w-2 mt-2 rounded-full bg-[color:var(--neon-cyan)] animate-pulse" />
                  <div className="flex-1 text-sm min-w-0">
                    <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span>
                    {a.category && (
                      <span className="ml-1.5 text-[10px] uppercase glass px-1 py-0.5 rounded text-muted-foreground">{a.category}</span>
                    )}
                    <div className="text-[11px] text-muted-foreground">{relTime(a.created_at)}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* New row: attendance heatmap + top performers + task stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 28-day attendance heatmap */}
        <GlassCard glow="cyan">
          <div className="text-sm font-semibold mb-0.5">Attendance heatmap</div>
          <div className="text-xs text-muted-foreground mb-4">Last 28 days · intensity = % present</div>
          <div className="grid grid-cols-7 gap-1">
            {["M","T","W","T","F","S","S"].map((d, i) => (
              <div key={i} className="text-[9px] text-center text-muted-foreground/50 uppercase pb-1">{d}</div>
            ))}
            {Array.from({ length: heatmap28[0]?.dow ?? 0 }).map((_, i) => <div key={`pre-${i}`} />)}
            {heatmap28.map((d) => (
              <motion.div key={d.iso}
                title={`${d.iso} · ${d.count} present (${Math.round(d.pct * 100)}%)`}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
                className="aspect-square rounded-sm"
                style={{
                  background: d.pct > 0
                    ? `oklch(0.78 0.18 200 / ${0.15 + d.pct * 0.85})`
                    : "oklch(1 0 0 / 0.05)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[color:var(--neon-cyan)]" /> High
              <span className="h-2 w-2 rounded-sm bg-white/8 ml-2" /> Low
            </span>
            <span>{heatmap28.filter((d) => d.count > 0).length}/28 active days</span>
          </div>
        </GlassCard>

        {/* Top performers */}
        <GlassCard glow="violet">
          <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
            <Star className="h-4 w-4 text-[color:var(--neon-violet)]" /> Top performers
          </div>
          <div className="text-xs text-muted-foreground mb-4">Most attendance days (last 30 days)</div>
          {topPerformers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No attendance data yet.</div>
          ) : (
            <div className="space-y-3">
              {topPerformers.map(({ worker, days }, i) => {
                const maxDays = topPerformers[0].days || 1;
                const pct = (days / maxDays) * 100;
                const initials = worker.full_name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "?";
                const MEDAL = ["🥇", "🥈", "🥉"];
                return (
                  <div key={worker.id} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl grid place-items-center text-xs font-bold shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))", color: "oklch(0.1 0.03 270)" }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">{worker.full_name}</span>
                        <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                          {MEDAL[i] ?? `#${i + 1}`} {days}d
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet))" }}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Task completion */}
        <GlassCard glow="pink">
          <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--neon-pink)]" /> Task completion
          </div>
          <div className="text-xs text-muted-foreground mb-4">All time · across all workers</div>
          {taskStats.total === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No tasks yet. <Link to="/tasks" className="text-[color:var(--neon-cyan)] hover:underline">Add one →</Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold neon-text">{taskStats.pct}%</div>
                <div className="text-xs text-muted-foreground mt-1">completion rate</div>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-4">
                <motion.div className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet), var(--neon-pink))" }}
                  initial={{ width: 0 }} animate={{ width: `${taskStats.pct}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { l: "Done", v: taskStats.done, c: "var(--neon-violet)" },
                  { l: "In Progress", v: taskStats.inProgress, c: "var(--neon-cyan)" },
                  { l: "Blocked", v: taskStats.blocked, c: "var(--neon-pink)" },
                  { l: "Total", v: taskStats.total, c: "oklch(0.72 0.03 260)" },
                ].map((s) => (
                  <div key={s.l} className="glass rounded-xl p-2 text-center">
                    <div className="font-bold text-lg" style={{ color: s.c }}>{s.v}</div>
                    <div className="text-muted-foreground text-[10px]">{s.l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Ongoing projects</div>
            <div className="text-xs text-muted-foreground">{topProjects.length} most recent</div>
          </div>
          <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {topProjects.length === 0 ? (
          <div className="px-5 pb-6 text-xs text-muted-foreground">No projects yet. <Link to="/projects" className="text-[color:var(--neon-cyan)] hover:underline">Add one →</Link></div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-t border-white/5">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.map((p) => (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03] transition">
                    <td className="px-5 py-4 font-medium max-w-[200px] truncate">{p.name}</td>
                    <td className="px-5 py-4 text-muted-foreground max-w-[120px] truncate">{p.client ?? "—"}</td>
                    <td className="px-5 py-4 w-1/3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet))" }}
                            initial={{ width: 0 }} animate={{ width: `${p.progress ?? 0}%` }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{p.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full glass ${
                        p.status === "OnHold" || p.status === "Cancelled"
                          ? "text-[color:var(--neon-pink)]"
                          : p.status === "Completed"
                          ? "text-[color:var(--neon-violet)]"
                          : "text-[color:var(--neon-cyan)]"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </AppShell>
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
