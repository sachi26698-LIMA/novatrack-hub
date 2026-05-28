import { createFileRoute } from "@tanstack/react-router";
import { Bot, Download, FileBarChart2, Sparkles, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend as RLegend,
  Pie, PieChart, Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & AI — TrackNova" },
      { name: "description", content: "Advanced analytics, AI revenue forecasts, expense breakdowns and exportable PDF/Excel reports." },
    ],
  }),
  component: ReportsPage,
});

const yearly = [
  { y: "2021", r: 480, e: 320 }, { y: "2022", r: 612, e: 384 },
  { y: "2023", r: 754, e: 462 }, { y: "2024", r: 902, e: 538 },
  { y: "2025", r: 1118, e: 642 }, { y: "2026E", r: 1356, e: 748 },
];

const expense = [
  { name: "Labour", value: 38, c: "oklch(0.78 0.18 200)" },
  { name: "Materials", value: 27, c: "oklch(0.7 0.26 295)" },
  { name: "Equipment", value: 14, c: "oklch(0.75 0.25 5)" },
  { name: "Overheads", value: 11, c: "oklch(0.78 0.2 60)" },
  { name: "Travel", value: 6, c: "oklch(0.7 0.2 145)" },
  { name: "Other", value: 4, c: "oklch(0.6 0.05 260)" },
];

const productivity = [
  { dept: "Civil", current: 88, target: 92 },
  { dept: "Electrical", current: 81, target: 85 },
  { dept: "PMO", current: 94, target: 90 },
  { dept: "Quality", current: 86, target: 88 },
  { dept: "Design", current: 91, target: 90 },
  { dept: "EHS", current: 79, target: 85 },
];

const radar = [
  { skill: "Safety", v: 88 }, { skill: "Quality", v: 92 },
  { skill: "Speed", v: 78 }, { skill: "Cost", v: 84 },
  { skill: "Innovation", v: 70 }, { skill: "Retention", v: 86 },
];

const tooltip = { background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 };

function ReportsPage() {
  return (
    <AppShell
      eyebrow="Insights"
      title={<>Reports & <span className="neon-text">AI analytics</span></>}
      subtitle="Multi-year revenue, productivity radar, expense breakdown and AI forecasts."
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 glass rounded-xl px-3 py-2 text-xs">
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-primary-foreground glow-cyan"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
          >
            <FileBarChart2 className="h-3.5 w-3.5" /> Generate PDF
          </button>
        </>
      }
    >
      {/* AI banner */}
      <GlassCard glow="violet" className="overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs text-[color:var(--neon-cyan)]">
              <Sparkles className="h-3.5 w-3.5" /> AI Forecast Engine v2
            </div>
            <div className="mt-2 text-lg sm:text-2xl font-bold">
              Q4 2026 revenue projected at <span className="neon-text">₹4.12Cr</span>, up{" "}
              <span className="text-[color:var(--neon-cyan)] inline-flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> 14.2%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Driven by 11 active site contracts and a 6.4% bump in average ticket size.
            </p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl glass px-3 py-2 text-xs whitespace-nowrap">
            <Bot className="h-3.5 w-3.5" /> Ask AI assistant
          </button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2" glow="cyan">
          <div className="text-sm font-semibold">Revenue vs Expense — yearly</div>
          <div className="text-xs text-muted-foreground mb-3">₹ in lakhs · 2026 projected</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearly} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="yr" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ye" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.26 295)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="oklch(0.7 0.26 295)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="y" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip} />
                <Area type="monotone" dataKey="r" stroke="oklch(0.85 0.18 200)" fill="url(#yr)" strokeWidth={2} />
                <Area type="monotone" dataKey="e" stroke="oklch(0.75 0.26 295)" fill="url(#ye)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard glow="pink">
          <div className="text-sm font-semibold">Expense breakdown</div>
          <div className="text-xs text-muted-foreground">Share of total spend</div>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expense} dataKey="value" innerRadius={44} outerRadius={78} paddingAngle={3} stroke="none">
                  {expense.map((p) => <Cell key={p.name} fill={p.c} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {expense.map((e) => (
              <div key={e.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: e.c }} />
                <span className="text-muted-foreground">{e.name}</span>
                <span className="ml-auto font-medium">{e.value}%</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2" glow="violet">
          <div className="text-sm font-semibold">Department productivity</div>
          <div className="text-xs text-muted-foreground mb-3">Current vs target index</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivity} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="dept" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
                <RLegend wrapperStyle={{ fontSize: 11, color: "oklch(0.72 0.03 260)" }} />
                <Bar dataKey="current" name="Current" fill="oklch(0.78 0.18 200)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="target" name="Target" fill="oklch(0.7 0.26 295)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard glow="cyan">
          <div className="text-sm font-semibold">Operational health</div>
          <div className="text-xs text-muted-foreground mb-2">6-axis index</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="75%">
                <PolarGrid stroke="oklch(1 0 0 / 0.1)" />
                <PolarAngleAxis dataKey="skill" stroke="oklch(0.72 0.03 260)" fontSize={10} />
                <PolarRadiusAxis stroke="oklch(1 0 0 / 0.1)" tick={false} axisLine={false} />
                <Radar dataKey="v" stroke="oklch(0.85 0.18 200)" fill="oklch(0.78 0.18 200)" fillOpacity={0.3} />
                <Tooltip contentStyle={tooltip} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
