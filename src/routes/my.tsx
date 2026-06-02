import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  CalendarClock, CalendarDays, CheckSquare, Clock, CreditCard, ScanLine,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { useSession } from "@/hooks/use-session";
import { listWorkers, listAttendance, listPayroll } from "@/lib/queries";
import { listLeave, listShifts } from "@/lib/queries-extra";
import { listTasks } from "@/lib/queries-tasks";
export const Route = createFileRoute("/my")({
  head: () => ({
    meta: [
      { title: "My Workspace — TrackNova" },
      { name: "description", content: "Personal dashboard — your attendance, tasks, payroll and shifts." },
    ],
  }),
  component: MyPage,
});

const STATUS_DOT: Record<string, string> = {
  Todo: "bg-muted-foreground",
  InProgress: "bg-[color:var(--neon-cyan)]",
  Done: "bg-[color:var(--neon-violet)]",
  Blocked: "bg-[color:var(--neon-pink)]",
};
const STATUS_LABEL: Record<string, string> = {
  Todo: "To Do", InProgress: "In Progress", Done: "Done", Blocked: "Blocked",
};
const LEAVE_STATUS_COLOR: Record<string, string> = {
  Pending: "text-[color:var(--neon-violet)]",
  Approved: "text-[color:var(--neon-cyan)]",
  Rejected: "text-[color:var(--neon-pink)]",
};

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function MyPage() {
  const { user } = useSession();
  const enabled = !!user;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance", 200], queryFn: () => listAttendance(200), enabled });
  const { data: payroll = [] } = useQuery({ queryKey: ["payroll"], queryFn: listPayroll, enabled });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: listTasks, enabled });
  const { data: leave = [] } = useQuery({ queryKey: ["leave"], queryFn: listLeave, enabled });
  const { data: profile } = useQuery({
    queryKey: ["profile-me", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${user!.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled,
  });

  const shiftFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString().slice(0, 10);
  const shiftTo = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60).toISOString().slice(0, 10);
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", shiftFrom, shiftTo], queryFn: () => listShifts(shiftFrom, shiftTo), enabled,
  });

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "You";
  const initials = displayName.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();

  // Try to match a worker record
  const myWorker = useMemo(() => {
    const name = (profile?.full_name || user?.user_metadata?.full_name || "").toLowerCase();
    const email = (user?.email || "").toLowerCase();
    return workers.find((w) =>
      w.full_name?.toLowerCase() === name ||
      (w as any).email?.toLowerCase() === email
    ) ?? null;
  }, [workers, user, profile]);

  const myAttendance = useMemo(() =>
    myWorker ? attendance.filter((a) => (a as any).worker_id === myWorker.id) : attendance.slice(0, 30),
    [attendance, myWorker]);

  const myPayroll = useMemo(() =>
    myWorker ? payroll.filter((p) => (p as any).worker_id === myWorker.id).slice(0, 12) : [],
    [payroll, myWorker]);

  const myTasks = useMemo(() =>
    myWorker ? tasks.filter((t) => t.worker_id === myWorker.id) : tasks.slice(0, 8),
    [tasks, myWorker]);

  const myLeave = useMemo(() =>
    myWorker ? leave.filter((l) => (l as any).worker_id === myWorker.id) : [],
    [leave, myWorker]);

  const myShifts = useMemo(() =>
    myWorker ? shifts.filter((s) => (s as any).worker_id === myWorker.id && s.shift_date >= todayStr) : [],
    [shifts, myWorker, todayStr]);

  // 28-day attendance heatmap
  const heatmap = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (27 - i));
    const iso = d.toISOString().slice(0, 10);
    return { iso, present: myAttendance.some((a) => a.check_in?.slice(0, 10) === iso), dow: (d.getDay() + 6) % 7 };
  }), [myAttendance]);

  const presentDays = heatmap.filter((d) => d.present).length;
  const openTasks = myTasks.filter((t) => t.status !== "Done").length;
  const totalNet = myPayroll.reduce((s, p) => s + Number((p as any).net_amount ?? 0), 0);

  const kpis = [
    { l: "Present (28d)", v: `${presentDays}/28`, g: "cyan" as const, i: ScanLine },
    { l: "Open tasks", v: openTasks.toString(), g: "violet" as const, i: CheckSquare },
    { l: "Leave on file", v: myLeave.length.toString(), g: "pink" as const, i: CalendarDays },
    { l: "Total net pay", v: myPayroll.length > 0 ? inr(totalNet) : "—", g: "cyan" as const, i: CreditCard },
  ];

  return (
    <AppShell
      eyebrow="Personal"
      title={<>My <span className="neon-text">workspace</span></>}
      subtitle={`Welcome back, ${displayName}. Your personal overview.`}
    >
      {/* Profile */}
      <GlassCard glow="violet">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl grid place-items-center text-lg font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))", color: "oklch(0.1 0.03 270)" }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold">{displayName}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
            {myWorker && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs glass rounded-full px-2 py-0.5 text-[color:var(--neon-cyan)]">{myWorker.role || "Worker"}</span>
                {myWorker.department && <span className="text-xs glass rounded-full px-2 py-0.5 text-muted-foreground">{myWorker.department}</span>}
              </div>
            )}
          </div>
          {myWorker && (
            <div className="text-right shrink-0">
              <div className="text-[11px] text-muted-foreground">Monthly salary</div>
              <div className="text-xl font-bold neon-text">{inr(Number((myWorker as any).monthly_salary ?? 0))}</div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <GlassCard key={k.l} glow={k.g} transition={{ delay: i * 0.05 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                <div className="mt-2 text-2xl font-bold">{k.v}</div>
              </div>
              <div className="h-9 w-9 rounded-xl grid place-items-center glass shrink-0"><k.i className="h-4 w-4" /></div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heatmap */}
        <GlassCard glow="cyan">
          <div className="text-sm font-semibold mb-0.5">Attendance heatmap</div>
          <div className="text-xs text-muted-foreground mb-4">Last 28 days</div>
          <div className="grid grid-cols-7 gap-1.5">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} className="text-[9px] text-center text-muted-foreground/50 uppercase pb-1">{d}</div>
            ))}
            {/* Fill in empty cells for the start-of-week alignment */}
            {Array.from({ length: heatmap[0]?.dow ?? 0 }).map((_, i) => <div key={`pre-${i}`} />)}
            {heatmap.map((d) => (
              <motion.div key={d.iso}
                title={`${d.iso} · ${d.present ? "Present" : "Absent"}`}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.005 }}
                className="aspect-square rounded-md"
                style={{
                  background: d.present
                    ? "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))"
                    : "oklch(1 0 0 / 0.05)",
                  opacity: d.present ? 1 : 0.35,
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "var(--neon-cyan)" }} /> Present
            </span>
            <span className="font-medium">{presentDays}/28 days</span>
          </div>
        </GlassCard>

        {/* Upcoming shifts */}
        <GlassCard>
          <div className="text-sm font-semibold mb-1 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[color:var(--neon-violet)]" /> Upcoming shifts
          </div>
          {myShifts.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">No upcoming shifts scheduled.</div>
          ) : (
            <div className="space-y-2 mt-3">
              {myShifts.slice(0, 5).map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">
                      {new Date(s.shift_date + "T12:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</div>
                  </div>
                  <span className="text-xs glass rounded-full px-2 py-0.5 text-muted-foreground">{(s as any).role || "Shift"}</span>
                </motion.div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My tasks */}
        <GlassCard>
          <div className="text-sm font-semibold mb-1 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[color:var(--neon-cyan)]" /> My tasks
          </div>
          {myTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No tasks assigned yet.</div>
          ) : (
            <div className="divide-y divide-white/5 mt-2">
              {myTasks.slice(0, 6).map((t) => (
                <div key={t.id} className="py-2.5 flex items-center gap-3">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? "bg-muted-foreground"}`} />
                  <span className={`text-sm flex-1 min-w-0 truncate ${t.status === "Done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{STATUS_LABEL[t.status] ?? t.status}</span>
                  {t.due_date && (
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {new Date(t.due_date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* My leave */}
        <GlassCard>
          <div className="text-sm font-semibold mb-1 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[color:var(--neon-pink)]" /> My leave
          </div>
          {myLeave.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No leave requests on file.</div>
          ) : (
            <div className="divide-y divide-white/5 mt-2">
              {myLeave.slice(0, 5).map((l: any) => (
                <div key={l.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium">{l.leave_type}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.start_date).toLocaleDateString("en", { month: "short", day: "numeric" })} → {new Date(l.end_date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 glass rounded-full ${LEAVE_STATUS_COLOR[l.status] ?? "text-muted-foreground"}`}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Payroll history */}
      {myPayroll.length > 0 && (
        <GlassCard>
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[color:var(--neon-cyan)]" /> Payroll history
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="pb-2 pr-4">Period</th>
                  <th className="pb-2 pr-4">Base</th>
                  <th className="pb-2 pr-4">Bonus</th>
                  <th className="pb-2 pr-4">Deductions</th>
                  <th className="pb-2 pr-4">Net</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {myPayroll.map((p: any) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="py-2.5 pr-4 text-xs">{p.period_start?.slice(0, 7)}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{inr(p.base_amount ?? 0)}</td>
                    <td className="py-2.5 pr-4 text-xs text-[color:var(--neon-cyan)]">+{inr(p.bonus ?? 0)}</td>
                    <td className="py-2.5 pr-4 text-xs text-[color:var(--neon-pink)]">-{inr(p.deductions ?? 0)}</td>
                    <td className="py-2.5 pr-4 text-xs font-semibold">{inr(p.net_amount ?? 0)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${p.status === "Paid" ? "text-[color:var(--neon-cyan)]" : "text-muted-foreground"}`}>
                        {p.status ?? "Draft"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </AppShell>
  );
}
