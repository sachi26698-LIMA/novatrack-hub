import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Bot, FileBarChart2, Sparkles, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { listAttendance, listPayroll, listProjects, listWorkers } from "@/lib/queries";
import { downloadReport } from "@/lib/pdf";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — TrackNova" },
      { name: "description", content: "Real-time analytics on workers, attendance, payroll and projects with PDF export." },
    ],
  }),
  component: ReportsPage,
});

const tooltip = { background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 };

function ReportsPage() {
  const { user } = useSession();
  const enabled = !!user;
  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled });
  const { data: payroll = [] } = useQuery({ queryKey: ["payroll"], queryFn: listPayroll, enabled });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => listAttendance(500), enabled });

  // Monthly net payout
  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    payroll.forEach((p) => {
      const k = p.period_end.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + Number(p.net_amount));
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([k, v]) => ({ m: k.slice(2), v: Math.round(v / 1000) }));
  }, [payroll]);

  // Project status pie
  const statusPie = useMemo(() => {
    const m = new Map<string, number>();
    projects.forEach((p) => m.set(p.status, (m.get(p.status) ?? 0) + 1));
    const palette = ["oklch(0.78 0.18 200)", "oklch(0.7 0.26 295)", "oklch(0.75 0.25 5)", "oklch(0.78 0.2 60)", "oklch(0.7 0.2 145)"];
    return Array.from(m.entries()).map(([name, value], i) => ({ name, value, c: palette[i % palette.length] }));
  }, [projects]);

  // Dept productivity from hours
  const dept = useMemo(() => {
    const hours = new Map<string, number>();
    attendance.forEach((r) => {
      const wid = r.worker_id;
      const w = workers.find((x) => x.id === wid);
      const d = w?.department ?? "Unassigned";
      hours.set(d, (hours.get(d) ?? 0) + Number(r.hours ?? 0));
    });
    return Array.from(hours.entries()).map(([dept, hrs]) => ({ dept, hrs: Math.round(hrs) })).slice(0, 8);
  }, [attendance, workers]);

  const totalPayout = payroll.reduce((s, p) => s + Number(p.net_amount), 0);
  const totalSpend = projects.reduce((s, p) => s + Number(p.spent), 0);
  const totalBudget = projects.reduce((s, p) => s + Number(p.budget), 0);

  function exportPdf() {
    downloadReport("TrackNova Executive Report", [
      {
        heading: "Workforce summary",
        head: ["Metric", "Value"],
        rows: [
          ["Total workers", workers.length],
          ["Active", workers.filter((w) => w.status === "Active").length],
          ["On leave", workers.filter((w) => w.status === "OnLeave").length],
          ["Departments", new Set(workers.map((w) => w.department).filter(Boolean)).size],
        ],
      },
      {
        heading: "Projects",
        head: ["Project", "Status", "Progress", "Budget", "Spent"],
        rows: projects.map((p) => [p.name, p.status, `${p.progress}%`, Number(p.budget).toLocaleString("en-IN"), Number(p.spent).toLocaleString("en-IN")]),
      },
      {
        heading: "Payroll (latest)",
        head: ["Period", "Records", "Net total (INR)"],
        rows: Array.from(
          payroll.reduce<Map<string, { c: number; n: number }>>((m, p) => {
            const k = p.period_end.slice(0, 7);
            const cur = m.get(k) ?? { c: 0, n: 0 };
            cur.c += 1; cur.n += Number(p.net_amount);
            m.set(k, cur); return m;
          }, new Map()).entries(),
        ).map(([k, v]) => [k, v.c, v.n.toLocaleString("en-IN")]),
      },
    ]);
  }

  return (
    <AppShell
      eyebrow="Insights"
      title={<>Reports & <span className="neon-text">analytics</span></>}
      subtitle="Live data from workers, attendance, payroll and projects."
      actions={
        <button onClick={exportPdf} className={primaryBtn} style={primaryBtnStyle}>
          <FileBarChart2 className="h-3.5 w-3.5" /> Export PDF
        </button>
      }
    >
      <GlassCard glow="violet" className="overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs text-[color:var(--neon-cyan)]">
              <Sparkles className="h-3.5 w-3.5" /> AI Forecast
            </div>
            <div className="mt-2 text-lg sm:text-2xl font-bold">
              Total net payout to date <span className="neon-text">₹{(totalPayout / 1e5).toFixed(2)}L</span>,
              project utilisation{" "}
              <span className="text-[color:var(--neon-cyan)] inline-flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {totalBudget ? Math.round((totalSpend / totalBudget) * 100) : 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Drawn from {projects.length} projects and {payroll.length} payroll records.</p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl glass px-3 py-2 text-xs whitespace-nowrap">
            <Bot className="h-3.5 w-3.5" /> Ask AI
          </button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2" glow="cyan">
          <div className="text-sm font-semibold">Payroll trend</div>
          <div className="text-xs text-muted-foreground mb-3">Net payout · ₹ thousands per month</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="m" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip} />
                <Area type="monotone" dataKey="v" stroke="oklch(0.85 0.18 200)" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {monthly.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No payroll data yet.</div>}
        </GlassCard>

        <GlassCard glow="pink">
          <div className="text-sm font-semibold">Projects by status</div>
          <div className="text-xs text-muted-foreground">Live distribution</div>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" innerRadius={44} outerRadius={78} paddingAngle={3} stroke="none">
                  {statusPie.map((p) => <Cell key={p.name} fill={p.c} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {statusPie.map((e) => (
              <div key={e.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: e.c }} />
                <span className="text-muted-foreground">{e.name}</span>
                <span className="ml-auto font-medium">{e.value}</span>
              </div>
            ))}
          </div>
          {statusPie.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">No projects yet.</div>}
        </GlassCard>
      </div>

      <GlassCard glow="violet">
        <div className="text-sm font-semibold">Department hours</div>
        <div className="text-xs text-muted-foreground mb-3">Total logged hours by department</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dept} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="dept" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltip} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
              <Bar dataKey="hrs" fill="oklch(0.78 0.18 200)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {dept.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No attendance recorded yet.</div>}
      </GlassCard>
    </AppShell>
  );
}
