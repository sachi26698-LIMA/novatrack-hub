import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Clock, MapPin, QrCode, ScanLine, Timer, UserCheck, UserX } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — TrackNova" },
      { name: "description", content: "Smart QR + GPS attendance, shift management, overtime and late-mark tracking with monthly analytics." },
    ],
  }),
  component: AttendancePage,
});

const week = [
  { d: "Mon", present: 1180, late: 42, absent: 62 },
  { d: "Tue", present: 1130, late: 56, absent: 98 },
  { d: "Wed", present: 1220, late: 31, absent: 33 },
  { d: "Thu", present: 1080, late: 70, absent: 134 },
  { d: "Fri", present: 1156, late: 48, absent: 80 },
  { d: "Sat", present: 1002, late: 60, absent: 222 },
  { d: "Sun", present: 540, late: 18, absent: 726 },
];

const live = [
  { name: "Aarav Patel", site: "Skyline Tower", time: "08:42", mode: "GPS", late: false },
  { name: "Priya Singh", site: "HQ Office", time: "09:01", mode: "QR", late: true },
  { name: "Rahul Mehta", site: "Metro Depot", time: "08:11", mode: "GPS", late: false },
  { name: "Sneha Iyer", site: "Riverside Mall", time: "08:57", mode: "QR", late: false },
  { name: "Arjun Khan", site: "Eastview Apts", time: "09:14", mode: "GPS", late: true },
  { name: "Meera Joshi", site: "HQ Office", time: "08:34", mode: "QR", late: false },
];

function AttendancePage() {
  return (
    <AppShell
      eyebrow="Today"
      title={<>Smart <span className="neon-text">attendance</span></>}
      subtitle="Live QR & GPS check-ins, shifts, overtime and monthly analytics."
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 glass rounded-xl px-3 py-2 text-xs">
            <QrCode className="h-3.5 w-3.5" /> Generate QR
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-primary-foreground glow-violet"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
          >
            <ScanLine className="h-3.5 w-3.5" /> Scan check-in
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: "Present today", v: "1,066", g: "cyan" as const, i: UserCheck },
          { l: "Absent", v: "164", g: "pink" as const, i: UserX },
          { l: "Late marks", v: "54", g: "violet" as const, i: Clock },
          { l: "Overtime hrs", v: "312", g: "cyan" as const, i: Timer },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2" glow="cyan">
          <div className="text-sm font-semibold">This week</div>
          <div className="text-xs text-muted-foreground mb-3">Present · Late · Absent</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="d" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
                <Bar dataKey="present" stackId="a" fill="oklch(0.78 0.18 200)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="late" stackId="a" fill="oklch(0.7 0.26 295)" />
                <Bar dataKey="absent" stackId="a" fill="oklch(0.75 0.25 5)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard glow="violet">
          <div className="text-sm font-semibold mb-3">Shift coverage</div>
          {[
            { shift: "Morning · 06:00–14:00", pct: 92, count: 412 },
            { shift: "General · 09:00–18:00", pct: 88, count: 528 },
            { shift: "Evening · 14:00–22:00", pct: 71, count: 226 },
            { shift: "Night · 22:00–06:00", pct: 64, count: 118 },
          ].map((s, i) => (
            <div key={s.shift} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>{s.shift}</span>
                <span className="text-muted-foreground">{s.count} · {s.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet))" }}
                  initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 1, delay: i * 0.1 }}
                />
              </div>
            </div>
          ))}
        </GlassCard>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-5">
          <div className="text-sm font-semibold">Live check-ins</div>
          <div className="text-xs text-muted-foreground">Streaming · last 15 minutes</div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-t border-white/5">
                <th className="px-5 py-3 font-medium">Worker</th>
                <th className="px-5 py-3 font-medium">Site</th>
                <th className="px-5 py-3 font-medium">Mode</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {live.map((l, i) => (
                <motion.tr
                  key={l.name}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="border-t border-white/5 hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3 font-medium">{l.name}</td>
                  <td className="px-5 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{l.site}</span></td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full glass inline-flex items-center gap-1">
                      {l.mode === "QR" ? <QrCode className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{l.mode}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{l.time}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${l.late ? "text-[color:var(--neon-pink)]" : "text-[color:var(--neon-cyan)]"}`}>
                      {l.late ? "Late" : "On time"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AppShell>
  );
}
