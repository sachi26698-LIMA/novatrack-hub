import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
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

function ShiftsPage() {
  const { user } = useSession();
  const qc = useQueryClient();

  const today = new Date();
  const startDefault = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const endDefault = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: startDefault, to: endDefault });

  const { data: rows = [] } = useQuery({
    queryKey: ["shifts", range.from, range.to],
    queryFn: () => listShifts(range.from, range.to),
    enabled: !!user,
  });
  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled: !!user });

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

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    rows.forEach((r: any) => {
      const k = r.shift_date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <AppShell
      eyebrow="Schedule"
      title={<>Shift <span className="neon-text">planner</span></>}
      subtitle="Coordinate every shift across the month with elegant precision."
      actions={
        <button onClick={() => setOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
          <Plus className="h-3.5 w-3.5" /> Add shift
        </button>
      }
    >
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <Field label="From">
            <input type="date" className={inputCls} value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </Field>
          <div className="text-xs text-muted-foreground sm:ml-auto inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> {rows.length} shifts in window
          </div>
        </div>
      </GlassCard>

      {grouped.length === 0 ? (
        <GlassCard className="text-center py-12 text-sm text-muted-foreground">
          No shifts in this window. Click <span className="text-foreground font-medium">Add shift</span> to start planning.
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {grouped.map(([day, list]) => (
            <GlassCard key={day}>
              <div className="flex items-baseline justify-between mb-3">
                <div className="font-semibold">
                  {new Date(day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                </div>
                <div className="text-[11px] text-muted-foreground">{list.length} shifts</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {list.map((s: any) => (
                  <div key={s.id} className="glass rounded-xl p-3 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl grid place-items-center text-xs font-bold"
                      style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))", color: "oklch(0.12 0.04 270)" }}>
                      {(s.workers?.full_name ?? "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.workers?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)} · {s.role || s.workers?.role || "—"}
                      </div>
                      {s.notes && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.notes}</div>}
                    </div>
                    <button onClick={() => { if (confirm("Delete shift?")) del.mutate(s.id); }}
                      className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <ShiftFormModal
        open={open}
        onClose={() => setOpen(false)}
        ownerId={user?.id}
        workers={workers}
        onSubmit={(v) => save.mutate(v)}
        saving={save.isPending}
      />
    </AppShell>
  );
}

function ShiftFormModal({
  open, onClose, ownerId, workers, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; ownerId?: string;
  workers: { id: string; full_name: string; role: string | null }[];
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({
    worker_id: "", shift_date: new Date().toISOString().slice(0, 10),
    start_time: "09:00", end_time: "17:00", role: "", notes: "",
  });
  useEffect(() => {
    if (open) setV((p) => ({ ...p, worker_id: workers[0]?.id ?? "" }));
  }, [open, workers]);

  return (
    <Modal open={open} onClose={onClose} title="Schedule shift">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Not signed in");
          if (!v.worker_id) return toast.error("Pick a worker");
          onSubmit({ owner_id: ownerId, ...v });
        }}
        className="space-y-3"
      >
        <Field label="Worker">
          <select className={inputCls} value={v.worker_id} onChange={(e) => setV({ ...v, worker_id: e.target.value })}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" className={inputCls} value={v.shift_date}
            onChange={(e) => setV({ ...v, shift_date: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" className={inputCls} value={v.start_time}
            onChange={(e) => setV({ ...v, start_time: e.target.value })} /></Field>
          <Field label="End"><input type="time" className={inputCls} value={v.end_time}
            onChange={(e) => setV({ ...v, end_time: e.target.value })} /></Field>
        </div>
        <Field label="Role (optional)">
          <input className={inputCls} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea rows={2} className={inputCls} value={v.notes}
            onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>
            {saving ? "Saving…" : "Save shift"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
