import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, LayoutList, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import {
  listLeave, upsertLeave, reviewLeave, deleteLeave, pushNotification, type LeaveRequest,
} from "@/lib/queries-extra";
import { listWorkers } from "@/lib/queries";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/leave")({
  head: () => ({
    meta: [
      { title: "Leave Requests — TrackNova" },
      { name: "description", content: "Manage leave requests, approvals and time-off for your workforce." },
    ],
  }),
  component: LeavePage,
});

const TYPES = ["Annual", "Sick", "Unpaid", "Casual", "Other"] as const;

const LEAVE_COLORS: Record<string, string> = {
  Annual: "oklch(0.78 0.18 200)",
  Sick: "oklch(0.75 0.25 5)",
  Unpaid: "oklch(0.7 0.2 60)",
  Casual: "oklch(0.7 0.26 295)",
  Other: "oklch(0.7 0.2 145)",
};

function getMonthStart(y: number, m: number) { return new Date(y, m, 1); }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }

function LeavePage() {
  const { user } = useSession();
  const { isAdmin, isManager } = useRole();
  const canReview = isAdmin || isManager;
  const qc = useQueryClient();
  const [view, setView] = useState<"calendar" | "list">("list");

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const { data: rows = [] } = useQuery({ queryKey: ["leave"], queryFn: listLeave, enabled: !!user });
  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled: !!user });
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: upsertLeave,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leave"] });
      await logActivity("leave_requested", "data");
      if (user) await pushNotification({ user_id: user.id, title: "Leave request submitted", type: "leave" });
      toast.success("Leave request submitted");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Rejected" }) => reviewLeave(id, status, user!.id),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: ["leave"] });
      await logActivity(`leave_${vars.status.toLowerCase()}`, "data");
      if (user) await pushNotification({ user_id: user.id, title: `Leave ${vars.status.toLowerCase()}`, type: "leave" });
      toast.success(`Leave ${vars.status.toLowerCase()}`);
    },
  });

  const del = useMutation({
    mutationFn: deleteLeave,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave"] }),
  });

  const stats = [
    { l: "Total", v: rows.length, c: "var(--neon-cyan)" },
    { l: "Pending", v: rows.filter((r) => r.status === "Pending").length, c: "var(--neon-pink)" },
    { l: "Approved", v: rows.filter((r) => r.status === "Approved").length, c: "var(--neon-violet)" },
    { l: "Rejected", v: rows.filter((r) => r.status === "Rejected").length, c: "oklch(0.7 0.15 60)" },
  ];

  // Calendar helpers
  const monthStart = getMonthStart(calYear, calMonth);
  const totalDays = daysInMonth(calYear, calMonth);
  const startDow = (monthStart.getDay() + 6) % 7; // Mon=0
  const calDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  const approvedLeave = useMemo(() => rows.filter((r) => r.status === "Approved"), [rows]);

  function getLeaveForDay(day: number) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return approvedLeave.filter((l) => {
      const s = l.start_date?.slice(0, 10) ?? "";
      const e = l.end_date?.slice(0, 10) ?? "";
      return iso >= s && iso <= e;
    });
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  }

  return (
    <AppShell
      eyebrow="Time off"
      title={<>Leave <span className="neon-text">requests</span></>}
      subtitle="Submit, review, and visualize team leave on the calendar."
      actions={
        <div className="flex items-center gap-2">
          <div className="glass rounded-xl p-1 flex items-center gap-0.5">
            <button onClick={() => setView("calendar")} title="Calendar"
              className={`p-1.5 rounded-lg transition ${view === "calendar" ? "bg-white/10" : "text-muted-foreground hover:text-foreground"}`}>
              <CalendarDays className="h-4 w-4" />
            </button>
            <button onClick={() => setView("list")} title="List"
              className={`p-1.5 rounded-lg transition ${view === "list" ? "bg-white/10" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
            <Plus className="h-3.5 w-3.5" /> New request
          </button>
        </div>
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

      {view === "calendar" ? (
        <GlassCard>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="glass rounded-xl p-2 hover:bg-white/5"><ChevronLeft className="h-4 w-4" /></button>
            <div className="text-sm font-semibold">
              {monthStart.toLocaleDateString("en", { month: "long", year: "numeric" })}
            </div>
            <button onClick={nextMonth} className="glass rounded-xl p-2 hover:bg-white/5"><ChevronRight className="h-4 w-4" /></button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="text-[10px] text-center text-muted-foreground uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDow }).map((_, i) => <div key={`empty-${i}`} />)}
            {calDays.map((day) => {
              const leaves = getLeaveForDay(day);
              const isToday = calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();
              return (
                <div key={day}
                  className={`rounded-xl p-1 min-h-[56px] ${isToday ? "ring-1 ring-[color:var(--neon-cyan)]/40 bg-[color:var(--neon-cyan)]/5" : "hover:bg-white/[0.03]"}`}>
                  <div className={`text-xs font-medium text-right mb-1 ${isToday ? "text-[color:var(--neon-cyan)]" : "text-muted-foreground"}`}>{day}</div>
                  <div className="space-y-0.5">
                    {leaves.slice(0, 3).map((l: any) => {
                      const color = LEAVE_COLORS[l.leave_type] ?? LEAVE_COLORS.Other;
                      return (
                        <div key={l.id} title={`${l.workers?.full_name} · ${l.leave_type}`}
                          className="rounded px-1 py-0.5 text-[8px] font-medium truncate leading-tight"
                          style={{ background: `${color}25`, color, borderLeft: `2px solid ${color}` }}>
                          {l.workers?.full_name?.split(" ")[0] ?? "?"}
                        </div>
                      );
                    })}
                    {leaves.length > 3 && (
                      <div className="text-[8px] text-muted-foreground pl-1">+{leaves.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/5">
            {TYPES.map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: LEAVE_COLORS[t] }} />
                {t}
              </div>
            ))}
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-3">Worker</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No leave requests yet.</td></tr>
                ) : rows.map((r: any) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2.5 pr-3 font-medium">{r.workers?.full_name ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                        background: `${LEAVE_COLORS[r.leave_type] ?? LEAVE_COLORS.Other}20`,
                        color: LEAVE_COLORS[r.leave_type] ?? LEAVE_COLORS.Other,
                      }}>{r.leave_type}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">
                      {new Date(r.start_date).toLocaleDateString("en", { month: "short", day: "numeric" })} →{" "}
                      {new Date(r.end_date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground max-w-[180px] truncate">{r.reason || "—"}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${
                        r.status === "Approved" ? "text-[color:var(--neon-cyan)]" :
                        r.status === "Rejected" ? "text-[color:var(--neon-pink)]" : "text-[color:var(--neon-violet)]"
                      }`}>{r.status}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center justify-end gap-1">
                        {canReview && r.status === "Pending" && (
                          <>
                            <button onClick={() => review.mutate({ id: r.id, status: "Approved" })}
                              className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-cyan)]" title="Approve">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => review.mutate({ id: r.id, status: "Rejected" })}
                              className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]" title="Reject">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => { if (confirm("Delete?")) del.mutate(r.id); }}
                          className="glass rounded-lg p-1.5 hover:bg-white/5 text-muted-foreground">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <LeaveFormModal open={open} onClose={() => setOpen(false)} ownerId={user?.id}
        workers={workers} onSubmit={(v) => save.mutate(v)} saving={save.isPending} />
    </AppShell>
  );
}

function LeaveFormModal({ open, onClose, ownerId, workers, onSubmit, saving }: {
  open: boolean; onClose: () => void; ownerId?: string;
  workers: { id: string; full_name: string }[];
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({ worker_id: "", leave_type: "Annual" as LeaveRequest["leave_type"], start_date: "", end_date: "", reason: "" });
  useEffect(() => {
    if (open) setV({ worker_id: workers[0]?.id ?? "", leave_type: "Annual", start_date: "", end_date: "", reason: "" });
  }, [open, workers]);
  return (
    <Modal open={open} onClose={onClose} title="New leave request">
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!ownerId) return toast.error("Not signed in");
        if (!v.worker_id) return toast.error("Pick a worker");
        if (!v.start_date || !v.end_date) return toast.error("Dates required");
        onSubmit({ owner_id: ownerId, ...v });
      }} className="space-y-3">
        <Field label="Worker">
          <select className={inputCls} value={v.worker_id} onChange={(e) => setV({ ...v, worker_id: e.target.value })}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className={inputCls} value={v.leave_type} onChange={(e) => setV({ ...v, leave_type: e.target.value as LeaveRequest["leave_type"] })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="date" className={inputCls} value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} /></Field>
          <Field label="End"><input type="date" className={inputCls} value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} /></Field>
        </div>
        <Field label="Reason"><textarea rows={3} className={inputCls} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>{saving ? "Submitting…" : "Submit request"}</button>
        </div>
      </form>
    </Modal>
  );
}
