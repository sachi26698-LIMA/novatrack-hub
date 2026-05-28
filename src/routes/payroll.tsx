import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Banknote, Download, FileText, IndianRupee, Receipt, Wallet,
} from "lucide-react";
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — TrackNova" },
      { name: "description", content: "Automated salary, PF, bonuses, deductions and one-click salary-slip PDFs for your entire workforce." },
    ],
  }),
  component: PayrollPage,
});

const monthly = [
  { m: "Jan", p: 84 }, { m: "Feb", p: 86 }, { m: "Mar", p: 92 },
  { m: "Apr", p: 89 }, { m: "May", p: 97 }, { m: "Jun", p: 104 },
  { m: "Jul", p: 109 }, { m: "Aug", p: 115 }, { m: "Sep", p: 122 },
  { m: "Oct", p: 128 }, { m: "Nov", p: 134 }, { m: "Dec", p: 141 },
];

const runs = [
  { id: "PR-2026-05", period: "May 2026", workers: 1284, gross: 14120000, net: 12480000, status: "Paid" },
  { id: "PR-2026-04", period: "Apr 2026", workers: 1262, gross: 13780000, net: 12110000, status: "Paid" },
  { id: "PR-2026-03", period: "Mar 2026", workers: 1240, gross: 13502000, net: 11894000, status: "Paid" },
  { id: "PR-2026-06", period: "Jun 2026", workers: 1284, gross: 14210000, net: 12568000, status: "Pending" },
];

const slips = [
  { name: "Aarav Patel", id: "TN-1042", net: 58400, status: "Paid" },
  { name: "Priya Singh", id: "TN-1058", net: 135200, status: "Paid" },
  { name: "Rahul Mehta", id: "TN-1102", net: 44800, status: "Pending" },
  { name: "Sneha Iyer", id: "TN-1130", net: 82100, status: "Paid" },
  { name: "Arjun Khan", id: "TN-1184", net: 50800, status: "Paid" },
];

function inr(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function PayrollPage() {
  return (
    <AppShell
      eyebrow="Finance"
      title={<>Payroll <span className="neon-text">command</span></>}
      subtitle="Automated salary, PF, bonuses and one-click slip PDFs."
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 glass rounded-xl px-3 py-2 text-xs">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-primary-foreground glow-cyan"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
          >
            <Banknote className="h-3.5 w-3.5" /> Run payroll
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: "Gross payout (MTD)", v: "₹1.41Cr", g: "cyan" as const, i: IndianRupee },
          { l: "Net disbursed", v: "₹1.25Cr", g: "violet" as const, i: Wallet },
          { l: "PF contribution", v: "₹14.8L", g: "pink" as const, i: Receipt },
          { l: "Pending slips", v: "42", g: "cyan" as const, i: FileText },
        ].map((k, i) => (
          <GlassCard key={k.l} glow={k.g} transition={{ delay: i * 0.05 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                <div className="mt-2 text-2xl sm:text-3xl font-bold">{k.v}</div>
              </div>
              <div className="h-10 w-10 rounded-xl grid place-items-center glass">
                <k.i className="h-4 w-4" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard glow="violet">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Payroll trend</div>
            <div className="text-xs text-muted-foreground">Gross payout · ₹ lakhs / month</div>
          </div>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="m" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="p" stroke="oklch(0.85 0.18 200)" strokeWidth={2.5}
                dot={{ r: 3, stroke: "oklch(0.85 0.18 200)", fill: "oklch(0.14 0.03 270)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-5">
            <div className="text-sm font-semibold">Payroll runs</div>
            <div className="text-xs text-muted-foreground">Last 4 cycles</div>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-t border-white/5">
                  <th className="px-5 py-3 font-medium">Run</th>
                  <th className="px-5 py-3 font-medium">Workers</th>
                  <th className="px-5 py-3 font-medium">Gross</th>
                  <th className="px-5 py-3 font-medium">Net</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <div className="font-medium">{r.period}</div>
                      <div className="text-[11px] text-muted-foreground">{r.id}</div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{r.workers.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 font-medium">{inr(r.gross)}</td>
                    <td className="px-5 py-3 font-medium">{inr(r.net)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${r.status === "Paid" ? "text-[color:var(--neon-cyan)]" : "text-[color:var(--neon-pink)]"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard glow="pink">
          <div className="text-sm font-semibold mb-3">Recent slips</div>
          <ul className="space-y-3">
            {slips.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">{s.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{inr(s.net)}</div>
                  <button className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Download className="h-3 w-3" /> PDF
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </AppShell>
  );
}
