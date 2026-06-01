import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Activity, Building2, ChevronRight, CircleDollarSign, ScanLine,
  TrendingUp, Users,
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
import { supabase } from "@/integrations/supabase/client";

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

  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled });
  const { data: payroll = [] } = useQuery({ queryKey: ["payroll"], queryFn: listPayroll, enabled });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance", 500], queryFn: () => listAttendance(500), enabled });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: listInvoices, enabled });
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["activity-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled,
  });

  const displayName = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ")[0]
    : user?.email?.split("@")[0] ?? "there";

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
        <span className="inline-flex items-center gap-1.5 glass rounded-full px-3 py-1 text-xs">
          <Activity className="h-3 w-3 text-[color:var(--neon-cyan)] animate-pulse" />
          Live · auto-refresh
        </span>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k, i) => (
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
