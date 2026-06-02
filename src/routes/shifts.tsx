import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Kanban, LayoutList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { listShifts, upsertShift, deleteShift } from "@/lib/queries-extra";
import { listWorkers } from "@/lib/queries";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/shifts")({
  head: () => ({
    meta: [
      { title: "Shift Schedule — TrackNova" },
      { name: "description", content: "Plan, assign and visualize team shifts in a glass-clean calendar." },
    ],
  }),
  component: ShiftsPage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WORKER_COLORS = [
  "oklch(0.78 0.18 200)", "oklch(0.7 0.26 295)", "oklch(0.75 0.25 5)",
  "oklch(0.78 0.2 60)", "oklch(0.7 0.2 145)", "oklch(0.8 0.15 30)", "oklch(0.72 0.22 330)",
];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function ShiftsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const today = new Date();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [weekStart, setWeekStart] = useState(() => getMonday(today));

  const weekFrom = useMemo(() => toISO(weekStart), [weekStart]);
  const weekTo = useMemo(() => toISO(addDays(weekStart, 6)), [weekStart]);

  const [listRange, setListRange] = useState({
    from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
    to: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10),
  });

  const queryRange = view === "calendar" ? { from: weekFrom, to: weekTo } : listRange;

  const { data: rows = [] } = useQuery({
    queryKey: ["shifts", queryRange.from, queryRange.to],
    queryFn: () => listShifts(queryRange.from, queryRange.to),
    enabled: !!user,
  });
  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled: !!user });

  const workerColor = useMemo(() => {
    const m = new Map<string, string>();
    workers.forEach((w, i) => m.set(w.id, WORKER_COLORS[i % WORKER_COLORS.length]));
    return m;
  }, [workers]);

  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: upsertShift,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["shifts"] });
      await logActivity("shift_created", "data");
      toast.success("Shift saved");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: deleteShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekMap = useMemo(() => {
    const m = new Map<string, any[]>();
    weekDays.forEach((d) => m.set(toISO(d), []));
    rows.forEach((r: any) => { if (m.has(r.shift_date)) m.get(r.shift_date)!.push(r); });
    return m;
  }, [rows, weekDays]);

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    rows.forEach((r: any) => { if (!m.has(r.shift_date)) m.set(r.shift_date, []); m.get(r.shift_date)!.push(r); });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  function goToday() { setWeekStart(getMonday(new Date())); }

  return (
    <AppShell
      eyebrow="Schedule"
      title={<>Shift <span className="neon-text">planner</span></>}
      subtitle="Weekly calendar and list view — color-coded by worker."
      actions={
        <div className="flex items-center gap-2">
          <div className="glass rounded-xl p-1 flex items-center gap-0.5">
            <button onClick={() => setView("calendar")} title="Calendar view"
              className={`p-1.5 rounded-lg transition ${view === "calendar" ? "bg-white/10" : "text-muted-foreground hover:text-foreground"}`}>
              <Kanban className="h-4 w-4" />
            </button>
            <button onClick={() => setView("list")} title="List view"
              className={`p-1.5 rounded-lg transition ${view === "list" ? "bg-white/10" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
            <Plus className="h-3.5 w-3.5" /> Add shift
          </button>
        </div>
      }
    >
      {view === "calendar" ? (
        <>
          {/* Week nav */}
          <GlassCard className="p-3 flex items-center justify-between">
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="glass rounded-xl p-2 hover:bg-white/5">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-semibold">
                {weekDays[0].toLocaleDateString("en", { month: "short", day: "numeric" })} —{" "}
                {weekDays[6].toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <button onClick={goToday} className="text-[11px] text-[color:var(--neon-cyan)] hover:underline mt-0.5">
                Jump to this week
              </button>
            </div>
            <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="glass rounded-xl p-2 hover:bg-white/5">
              <ChevronRight className="h-4 w-4" />
            </button>
          </GlassCard>

          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-2 min-w-0">
            {weekDays.map((day, i) => {
              const iso = toISO(day);
              const dayShifts = weekMap.get(iso) ?? [];
              const isToday = iso === toISO(today);
              return (
                <div key={iso}
                  className={`rounded-2xl border overflow-hidden min-h-[180px] ${
                    isToday ? "border-[color:var(--neon-cyan)]/40 bg-[color:var(--neon-cyan)]/[0.04]" : "border-white/8 bg-white/[0.02]"
                  }`}
                >
                  <div className={`px-1.5 py-2 text-center border-b border-white/5 ${isToday ? "text-[color:var(--neon-cyan)]" : "text-muted-foreground"}`}>
                    <div className="text-[9px] uppercase tracking-wider">{DAYS[i]}</div>
                    <div className="text-base font-bold mt-0.5">{day.getDate()}</div>
                    {dayShifts.length > 0 && (
                      <div className="text-[9px] opacity-60">{dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}</div>
                    )}
                  </div>
                  <div className="p-1 space-y-1">
                    {dayShifts.length === 0 && (
                      <div className="py-6 text-center text-[9px] text-muted-foreground/30">—</div>
                    )}
                    {dayShifts.map((s: any) => {
                      const color = workerColor.get(s.worker_id) ?? WORKER_COLORS[0];
                      const initials = (s.workers?.full_name ?? "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("");
                      return (
                        <div key={s.id}
                          className="rounded-lg px-1.5 py-1 text-[9px] group flex items-start gap-1"
                          style={{ background: `${color}20`, borderLeft: `2px solid ${color}` }}>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate leading-tight" style={{ color }}>{initials}</div>
                            <div className="text-muted-foreground/70 leading-tight">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</div>
                          </div>
                          <button onClick={() => { if (confirm("Delete?")) del.mutate(s.id); }}
                            className="opacity-0 group-hover:opacity-100 text-[color:var(--neon-pink)] shrink-0 mt-0.5">
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          {workers.length > 0 && (
            <GlassCard className="p-3">
              <div className="flex flex-wrap gap-3">
                {workers.slice(0, 10).map((w) => {
                  const color = workerColor.get(w.id) ?? WORKER_COLORS[0];
                  return (
                    <div key={w.id} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-muted-foreground">{w.full_name}</span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}
        </>
      ) : (
        <>
          <GlassCard className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <Field label="From"><input type="date" className={inputCls} value={listRange.from}
                onChange={(e) => setListRange({ ...listRange, from: e.target.value })} /></Field>
              <Field label="To"><input type="date" className={inputCls} value={listRange.to}
                onChange={(e) => setListRange({ ...listRange, to: e.target.value })} /></Field>
              <div className="text-xs text-muted-foreground sm:ml-auto inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> {rows.length} shifts
              </div>
            </div>
          </GlassCard>

          {grouped.length === 0 ? (
            <GlassCard className="text-center py-12 text-sm text-muted-foreground">
              No shifts in this window. Click <span className="font-medium text-foreground">Add shift</span> to start.
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {grouped.map(([day, list]) => (
                <GlassCard key={day}>
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="font-semibold">{new Date(day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
                    <div className="text-[11px] text-muted-foreground">{list.length} shift{list.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {list.map((s: any) => {
                      const color = workerColor.get(s.worker_id) ?? WORKER_COLORS[0];
                      return (
                        <div key={s.id} className="glass rounded-xl p-3 flex items-start gap-3">
                          <div className="h-9 w-9 rounded-xl grid place-items-center text-xs font-bold shrink-0"
                            style={{ background: `${color}30`, color }}>
                            {(s.workers?.full_name ?? "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{s.workers?.full_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)} · {s.role || "—"}</div>
                            {s.notes && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.notes}</div>}
                          </div>
                          <button onClick={() => { if (confirm("Delete?")) del.mutate(s.id); }}
                            className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      <ShiftFormModal open={open} onClose={() => setOpen(false)} ownerId={user?.id}
        workers={workers} onSubmit={(v) => save.mutate(v)} saving={save.isPending} />
    </AppShell>
  );
}

function ShiftFormModal({ open, onClose, ownerId, workers, onSubmit, saving }: {
  open: boolean; onClose: () => void; ownerId?: string;
  workers: { id: string; full_name: string; role: string | null }[];
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({ worker_id: "", shift_date: new Date().toISOString().slice(0, 10), start_time: "09:00", end_time: "17:00", role: "", notes: "" });
  useEffect(() => { if (open) setV((p) => ({ ...p, worker_id: workers[0]?.id ?? "" })); }, [open, workers]);
  return (
    <Modal open={open} onClose={onClose} title="Schedule shift">
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!ownerId) return toast.error("Not signed in");
        if (!v.worker_id) return toast.error("Pick a worker");
        onSubmit({ owner_id: ownerId, ...v });
      }} className="space-y-3">
        <Field label="Worker">
          <select className={inputCls} value={v.worker_id} onChange={(e) => setV({ ...v, worker_id: e.target.value })}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className={inputCls} value={v.shift_date} onChange={(e) => setV({ ...v, shift_date: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" className={inputCls} value={v.start_time} onChange={(e) => setV({ ...v, start_time: e.target.value })} /></Field>
          <Field label="End"><input type="time" className={inputCls} value={v.end_time} onChange={(e) => setV({ ...v, end_time: e.target.value })} /></Field>
        </div>
        <Field label="Role"><input className={inputCls} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} /></Field>
        <Field label="Notes"><textarea rows={2} className={inputCls} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>{saving ? "Saving…" : "Save shift"}</button>
        </div>
      </form>
    </Modal>
  );
}
