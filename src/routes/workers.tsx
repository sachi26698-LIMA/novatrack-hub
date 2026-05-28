import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Briefcase, Filter, Mail, Phone, Plus, Search, ShieldCheck, Star, Upload,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/workers")({
  head: () => ({
    meta: [
      { title: "Workers — TrackNova" },
      { name: "description", content: "Manage workers, departments, documents, salaries and performance from a single neon command center." },
    ],
  }),
  component: WorkersPage,
});

type Worker = {
  id: string; name: string; role: string; dept: string;
  phone: string; email: string; salary: number;
  status: "Active" | "On leave" | "Inactive"; perf: number; joined: string;
  initials: string; color: string;
};

const WORKERS: Worker[] = [
  { id: "TN-1042", name: "Aarav Patel", role: "Site Supervisor", dept: "Civil", phone: "+91 98765 12340", email: "aarav@tracknova.app", salary: 62000, status: "Active", perf: 92, joined: "Mar 2022", initials: "AP", color: "var(--neon-cyan)" },
  { id: "TN-1058", name: "Priya Singh", role: "Project Manager", dept: "PMO", phone: "+91 98765 21879", email: "priya@tracknova.app", salary: 145000, status: "Active", perf: 96, joined: "Jan 2021", initials: "PS", color: "var(--neon-violet)" },
  { id: "TN-1102", name: "Rahul Mehta", role: "Foreman", dept: "Electrical", phone: "+91 99887 11234", email: "rahul@tracknova.app", salary: 48000, status: "On leave", perf: 81, joined: "Aug 2023", initials: "RM", color: "var(--neon-pink)" },
  { id: "TN-1130", name: "Sneha Iyer", role: "QA Engineer", dept: "Quality", phone: "+91 98112 90034", email: "sneha@tracknova.app", salary: 88000, status: "Active", perf: 88, joined: "Nov 2022", initials: "SI", color: "var(--neon-cyan)" },
  { id: "TN-1184", name: "Arjun Khan", role: "Safety Officer", dept: "EHS", phone: "+91 90909 11122", email: "arjun@tracknova.app", salary: 54000, status: "Active", perf: 90, joined: "Feb 2024", initials: "AK", color: "var(--neon-violet)" },
  { id: "TN-1209", name: "Meera Joshi", role: "Architect", dept: "Design", phone: "+91 80808 33445", email: "meera@tracknova.app", salary: 120000, status: "Active", perf: 94, joined: "Jul 2020", initials: "MJ", color: "var(--neon-pink)" },
  { id: "TN-1233", name: "Karan Verma", role: "Welder", dept: "Civil", phone: "+91 70707 55667", email: "karan@tracknova.app", salary: 32000, status: "Inactive", perf: 64, joined: "Apr 2023", initials: "KV", color: "var(--neon-cyan)" },
  { id: "TN-1271", name: "Diya Shah", role: "HR Lead", dept: "People", phone: "+91 99001 22334", email: "diya@tracknova.app", salary: 98000, status: "Active", perf: 91, joined: "Oct 2021", initials: "DS", color: "var(--neon-violet)" },
];

const FILTERS = ["All", "Active", "On leave", "Inactive"] as const;

function WorkersPage() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");

  const filtered = useMemo(
    () => WORKERS.filter((w) =>
      (f === "All" || w.status === f) &&
      (w.name.toLowerCase().includes(q.toLowerCase()) || w.role.toLowerCase().includes(q.toLowerCase()) || w.dept.toLowerCase().includes(q.toLowerCase()))
    ),
    [q, f]
  );

  const stats = [
    { l: "Total workers", v: WORKERS.length, c: "var(--neon-cyan)" },
    { l: "Active", v: WORKERS.filter((w) => w.status === "Active").length, c: "var(--neon-violet)" },
    { l: "On leave", v: WORKERS.filter((w) => w.status === "On leave").length, c: "var(--neon-pink)" },
    { l: "Departments", v: new Set(WORKERS.map((w) => w.dept)).size, c: "var(--neon-cyan)" },
  ];

  return (
    <AppShell
      eyebrow="Team"
      title={<>Worker <span className="neon-text">management</span></>}
      subtitle="Profiles, departments, documents and performance — all in one place."
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 glass rounded-xl px-3 py-2 text-xs">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-primary-foreground glow-cyan"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add worker
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s, i) => (
          <GlassCard key={s.l} transition={{ delay: i * 0.05 }}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-bold" style={{ color: s.c }}>{s.v}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, role or department…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="flex items-center gap-1 glass rounded-xl p-1">
            {FILTERS.map((x) => (
              <button
                key={x}
                onClick={() => setF(x)}
                className={`relative px-3 py-1.5 text-xs rounded-lg transition ${f === x ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f === x && (
                  <motion.span
                    layoutId="worker-filter"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}
                <span className="relative inline-flex items-center gap-1"><Filter className="h-3 w-3" />{x}</span>
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((w, i) => (
          <GlassCard key={w.id} transition={{ delay: i * 0.04 }}>
            <div className="flex items-start gap-3">
              <div
                className="h-12 w-12 rounded-2xl grid place-items-center font-bold text-base"
                style={{ background: `linear-gradient(135deg, ${w.color}, var(--neon-violet))`, color: "oklch(0.12 0.04 270)" }}
              >
                {w.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{w.name}</div>
                <div className="text-xs text-muted-foreground truncate">{w.role} · {w.dept}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{w.id} · joined {w.joined}</div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full glass shrink-0 ${
                  w.status === "Active" ? "text-[color:var(--neon-cyan)]"
                  : w.status === "On leave" ? "text-[color:var(--neon-pink)]"
                  : "text-muted-foreground"
                }`}
              >
                {w.status}
              </span>
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 truncate"><Phone className="h-3 w-3 shrink-0" /> {w.phone}</div>
              <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" /> {w.email}</div>
              <div className="flex items-center gap-2"><Briefcase className="h-3 w-3" /> ₹{w.salary.toLocaleString("en-IN")}/mo</div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Star className="h-3 w-3 text-[color:var(--neon-cyan)]" /> Performance
                </span>
                <span className="font-medium">{w.perf}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet))" }}
                  initial={{ width: 0 }} animate={{ width: `${w.perf}%` }} transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-[color:var(--neon-cyan)]" /> Aadhaar verified
            </div>
          </GlassCard>
        ))}
      </div>

      {filtered.length === 0 && (
        <GlassCard className="text-center py-12 text-sm text-muted-foreground">
          No workers match your search.
        </GlassCard>
      )}
    </AppShell>
  );
}
