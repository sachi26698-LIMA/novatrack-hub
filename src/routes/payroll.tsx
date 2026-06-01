import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Banknote, CheckCircle2, Download, FileText, IndianRupee, Layers, Loader2, Receipt,
  Trash2, Users, Wallet,
} from "lucide-react";
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import {
  createPayroll, deletePayroll, hoursForPeriod, listPayroll, listWorkers, markPayrollPaid,
} from "@/lib/queries";
import { downloadPayslip } from "@/lib/pdf";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — TrackNova" },
      { name: "description", content: "Run payroll, calculate from attendance and export PDF salary slips." },
    ],
  }),
  component: PayrollPage,
});

function inr(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function PayrollPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: payroll = [] } = useQuery({
    queryKey: ["payroll"], queryFn: listPayroll, enabled: !!user,
  });
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"], queryFn: listWorkers, enabled: !!user,
  });
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const create = useMutation({
    mutationFn: createPayroll,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["payroll"] });
      await logActivity("payroll_created", "data");
      toast.success("Payroll record created");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pay = useMutation({
    mutationFn: markPayrollPaid,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["payroll"] }); toast.success("Marked as paid"); },
  });
  const del = useMutation({
    mutationFn: deletePayroll,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["payroll"] }); toast.success("Removed"); },
  });

  const totals = useMemo(() => {
    const gross = payroll.reduce((s, p) => s + Number(p.base_amount) + Number(p.bonus), 0);
    const net = payroll.reduce((s, p) => s + Number(p.net_amount), 0);
    const pending = payroll.filter((p) => p.status !== "Paid").length;
    const ded = payroll.reduce((s, p) => s + Number(p.deductions), 0);
    return { gross, net, pending, ded };
  }, [payroll]);

  const trend = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payroll) {
      const k = p.period_end.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + Number(p.net_amount));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([m, v]) => ({ m: m.slice(2), v: Math.round(v / 1000) }));
  }, [payroll]);

  return (
    <AppShell
      eyebrow="Finance"
      title={<>Payroll <span className="neon-text">command</span></>}
      subtitle="Compute salaries from attendance and export PDF slips."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-white/5 transition"
          >
            <Users className="h-3.5 w-3.5" /> Bulk run
          </button>
          <button onClick={() => setOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
            <Banknote className="h-3.5 w-3.5" /> Run payroll
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: "Gross (all)", v: inr(totals.gross), g: "cyan" as const, i: IndianRupee },
          { l: "Net disbursed", v: inr(totals.net), g: "violet" as const, i: Wallet },
          { l: "Deductions", v: inr(totals.ded), g: "pink" as const, i: Receipt },
          { l: "Pending slips", v: String(totals.pending), g: "cyan" as const, i: FileText },
        ].map((k, i) => (
          <GlassCard key={k.l} glow={k.g} transition={{ delay: i * 0.05 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                <div className="mt-2 text-2xl sm:text-3xl font-bold">{k.v}</div>
              </div>
              <div className="h-10 w-10 rounded-xl grid place-items-center glass"><k.i className="h-4 w-4" /></div>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard glow="violet">
        <div className="text-sm font-semibold">Payroll trend</div>
        <div className="text-xs text-muted-foreground mb-3">Net payout · ₹ thousands per month</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="m" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="v" stroke="oklch(0.85 0.18 200)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-5">
          <div className="text-sm font-semibold">Payroll records</div>
          <div className="text-xs text-muted-foreground">{payroll.length} entries</div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-t border-white/5">
                <th className="px-5 py-3 font-medium">Worker</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Hours</th>
                <th className="px-5 py-3 font-medium">Net</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payroll.map((p) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 font-medium">
                    {(p as any).workers?.full_name ?? "—"}
                    <div className="text-[11px] text-muted-foreground">{(p as any).workers?.role ?? ""}</div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{p.period_start} → {p.period_end}</td>
                  <td className="px-5 py-3">{p.hours_worked}</td>
                  <td className="px-5 py-3 font-semibold">{inr(Number(p.net_amount))}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${
                      p.status === "Paid" ? "text-[color:var(--neon-cyan)]"
                      : p.status === "Approved" ? "text-[color:var(--neon-violet)]"
                      : "text-[color:var(--neon-pink)]"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button title="PDF slip"
                        onClick={() => downloadPayslip({
                          id: p.id,
                          workerName: (p as any).workers?.full_name ?? "Worker",
                          workerRole: (p as any).workers?.role,
                          periodStart: p.period_start, periodEnd: p.period_end,
                          baseAmount: Number(p.base_amount), bonus: Number(p.bonus),
                          deductions: Number(p.deductions), netAmount: Number(p.net_amount),
                          hoursWorked: Number(p.hours_worked), status: p.status,
                        })}
                        className="glass rounded-lg p-1.5 hover:bg-white/5"><Download className="h-3.5 w-3.5" /></button>
                      {p.status !== "Paid" && (
                        <button title="Mark paid" onClick={() => pay.mutate(p.id)}
                          className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-cyan)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button title="Delete"
                        onClick={() => { if (confirm("Delete record?")) del.mutate(p.id); }}
                        className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {payroll.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground border-t border-white/5">
                  No payroll records yet. Click <span className="text-foreground font-medium">Run payroll</span> to create one.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <RunPayrollModal
        open={open} onClose={() => setOpen(false)}
        workers={workers}
        ownerId={user?.id}
        onSubmit={(v) => create.mutate(v)}
        saving={create.isPending}
      />
      <BulkPayrollModal
        open={bulkOpen} onClose={() => setBulkOpen(false)}
        workers={workers}
        ownerId={user?.id}
        existingPayroll={payroll}
      />
    </AppShell>
  );
}

function RunPayrollModal({
  open, onClose, workers, ownerId, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; workers: any[]; ownerId?: string;
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [v, setV] = useState({
    worker_id: "", period_start: firstOfMonth, period_end: lastOfMonth,
    base_amount: 0, bonus: 0, deductions: 0, hours_worked: 0,
  });
  const [autoHours, setAutoHours] = useState(false);

  const worker = workers.find((w) => w.id === v.worker_id);
  const net = v.base_amount + v.bonus - v.deductions;

  async function pullHours() {
    if (!v.worker_id) return;
    setAutoHours(true);
    try {
      const h = await hoursForPeriod(v.worker_id, v.period_start, v.period_end);
      setV((s) => ({ ...s, hours_worked: +h.toFixed(2) }));
      toast.success(`${h.toFixed(2)} hours imported`);
    } finally { setAutoHours(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Run payroll">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Not signed in");
          if (!v.worker_id) return toast.error("Pick a worker");
          onSubmit({ owner_id: ownerId, ...v, net_amount: net });
        }}
        className="space-y-3"
      >
        <Field label="Worker">
          <select className={inputCls} value={v.worker_id}
            onChange={(e) => {
              const id = e.target.value;
              const w = workers.find((x) => x.id === id);
              setV((s) => ({ ...s, worker_id: id, base_amount: w ? Number(w.monthly_salary) : s.base_amount }));
            }}
          >
            <option value="">Select…</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start"><input type="date" className={inputCls} value={v.period_start} onChange={(e) => setV({ ...v, period_start: e.target.value })} /></Field>
          <Field label="Period end"><input type="date" className={inputCls} value={v.period_end} onChange={(e) => setV({ ...v, period_end: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Base salary (₹)"><input type="number" className={inputCls} value={v.base_amount} onChange={(e) => setV({ ...v, base_amount: +e.target.value })} /></Field>
          <Field label="Bonus (₹)"><input type="number" className={inputCls} value={v.bonus} onChange={(e) => setV({ ...v, bonus: +e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deductions (₹)"><input type="number" className={inputCls} value={v.deductions} onChange={(e) => setV({ ...v, deductions: +e.target.value })} /></Field>
          <Field label="Hours worked">
            <div className="flex gap-2">
              <input type="number" step="0.01" className={inputCls} value={v.hours_worked} onChange={(e) => setV({ ...v, hours_worked: +e.target.value })} />
              <button type="button" onClick={pullHours} disabled={!v.worker_id || autoHours}
                className="glass rounded-xl px-2 text-[11px] whitespace-nowrap hover:bg-white/5">
                {autoHours ? "…" : "From attendance"}
              </button>
            </div>
          </Field>
        </div>
        {worker && (
          <div className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground">
            Hourly rate: ₹{Number(worker.hourly_rate)} · suggested from hours:
            <span className="text-foreground font-medium ml-1">
              ₹{(Number(worker.hourly_rate) * v.hours_worked).toLocaleString("en-IN")}
            </span>
          </div>
        )}
        <div className="glass rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Net pay</span>
          <span className="text-lg font-bold neon-text">₹{net.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>
            {saving ? "Saving…" : "Create record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BulkPayrollModal({
  open, onClose, workers, ownerId, existingPayroll,
}: {
  open: boolean; onClose: () => void; workers: any[]; ownerId?: string;
  existingPayroll: any[];
}) {
  const qc = useQueryClient();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [period_start, setPeriodStart] = useState(firstOfMonth);
  const [period_end, setPeriodEnd] = useState(lastOfMonth);
  const [department, setDepartment] = useState("All");
  const [bonus, setBonus] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(workers.map((w) => w.department).filter(Boolean)))],
    [workers],
  );

  const eligible = useMemo(() => {
    const base = workers.filter((w) => w.status === "Active" && (department === "All" || w.department === department));
    const existing = new Set(
      existingPayroll
        .filter((p) => p.period_start === period_start && p.period_end === period_end)
        .map((p) => p.worker_id),
    );
    return base.filter((w) => !existing.has(w.id));
  }, [workers, department, period_start, period_end, existingPayroll]);

  const totalNet = eligible.reduce((s, w) => s + Number(w.monthly_salary ?? 0) + bonus - deductions, 0);

  async function handleRun() {
    if (!ownerId) return toast.error("Not signed in");
    if (eligible.length === 0) return toast.error("No eligible workers for this period");
    if (!confirm(`Create payroll records for ${eligible.length} worker${eligible.length !== 1 ? "s" : ""}?`)) return;

    setRunning(true);
    setProgress({ done: 0, total: eligible.length });
    let errors = 0;

    for (let i = 0; i < eligible.length; i++) {
      const w = eligible[i];
      const base = Number(w.monthly_salary ?? 0);
      try {
        await createPayroll({
          owner_id: ownerId,
          worker_id: w.id,
          period_start,
          period_end,
          base_amount: base,
          bonus,
          deductions,
          hours_worked: 0,
          net_amount: base + bonus - deductions,
        });
      } catch {
        errors++;
      }
      setProgress({ done: i + 1, total: eligible.length });
    }

    await qc.invalidateQueries({ queryKey: ["payroll"] });
    await logActivity("bulk_payroll", "data", { count: eligible.length - errors });
    setRunning(false);
    setProgress(null);
    if (errors === 0) {
      toast.success(`Payroll created for ${eligible.length} worker${eligible.length !== 1 ? "s" : ""}`);
      onClose();
    } else {
      toast.error(`${errors} record${errors !== 1 ? "s" : ""} failed. Others were created.`);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk payroll run">
      <div className="space-y-3">
        <div className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />
          Creates payroll records for all active workers using their monthly salary.
          Workers who already have a record in this period are skipped.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start">
            <input type="date" className={inputCls} value={period_start}
              onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period end">
            <input type="date" className={inputCls} value={period_end}
              onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>

        <Field label="Department">
          <select className={inputCls} value={department}
            onChange={(e) => setDepartment(e.target.value)}>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bonus for all (₹)">
            <input type="number" className={inputCls} value={bonus}
              onChange={(e) => setBonus(+e.target.value)} />
          </Field>
          <Field label="Deductions for all (₹)">
            <input type="number" className={inputCls} value={deductions}
              onChange={(e) => setDeductions(+e.target.value)} />
          </Field>
        </div>

        {/* Preview */}
        <div className="glass rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Eligible workers</span>
            <span className="font-semibold">{eligible.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total net payout</span>
            <span className="font-semibold neon-text">{inr(totalNet)}</span>
          </div>
          {eligible.length > 0 && (
            <div className="pt-1 max-h-28 overflow-y-auto scrollbar-thin space-y-1">
              {eligible.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{w.full_name}</span>
                  <span>{inr(Number(w.monthly_salary ?? 0) + bonus - deductions)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Processing…</span>
              <span>{progress.done}/{progress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(progress.done / progress.total) * 100}%`,
                  background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet))",
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={running}
            className="glass rounded-xl px-3 py-2 text-xs">
            Cancel
          </button>
          <button onClick={handleRun} disabled={running || saving || eligible.length === 0}
            className={`${primaryBtn} disabled:opacity-50`} style={primaryBtnStyle}>
            {running
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
              : <><Users className="h-3.5 w-3.5" /> Run for {eligible.length} worker{eligible.length !== 1 ? "s" : ""}</>
            }
          </button>
        </div>
      </div>
    </Modal>
  );
}
