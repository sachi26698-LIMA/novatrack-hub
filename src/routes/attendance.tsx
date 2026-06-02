import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Camera, CheckCircle2, Clock, Edit3, Plus, ScanLine, StopCircle,
  Timer, UserCheck, UserX, XCircle,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { checkInByQr, listAttendance, listWorkers } from "@/lib/queries";
import {
  createCorrection, createManualAttendance, listCorrections, reviewCorrection,
  type AttendanceCorrection,
} from "@/lib/queries-tasks";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — TrackNova" },
      { name: "description", content: "QR-based check-in/out, daily logs and analytics for your workforce." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { user } = useSession();
  const { isManager } = useRole();
  const qc = useQueryClient();

  const { data: records = [] } = useQuery({
    queryKey: ["attendance"], queryFn: () => listAttendance(200), enabled: !!user,
    refetchInterval: 8000,
  });
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"], queryFn: listWorkers, enabled: !!user,
  });
  const { data: corrections = [] } = useQuery({
    queryKey: ["corrections"], queryFn: listCorrections, enabled: !!user,
  });

  const [scanOpen, setScanOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState<{ attendanceId?: string } | null>(null);
  const [tab, setTab] = useState<"records" | "corrections">("records");

  const scan = useMutation({
    mutationFn: (qr: string) => {
      if (!user) throw new Error("Not signed in");
      return checkInByQr(qr, user.id);
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["attendance"] });
      await logActivity(r.mode === "in" ? "checked_in" : "checked_out", "data", { worker: r.worker });
      toast.success(`${r.worker} checked ${r.mode === "in" ? "in" : `out · ${r.hours}h`}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addManual = useMutation({
    mutationFn: createManualAttendance,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["attendance"] });
      await logActivity("manual_attendance", "data");
      toast.success("Attendance record added");
      setManualOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCorrection = useMutation({
    mutationFn: createCorrection,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["corrections"] });
      toast.success("Correction request submitted");
      setCorrectionOpen(null);
    },
    onError: (e: Error) => {
      if (e.message.includes("does not exist") || e.message.includes("42P01")) {
        toast.error("Run the SQL migration in Supabase to enable corrections.", { duration: 8000 });
      } else toast.error(e.message);
    },
  });

  const reviewCorr = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Rejected" }) =>
      reviewCorrection(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["corrections"] });
      toast.success("Correction reviewed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = records.filter((r) => new Date(r.check_in) >= today);

  const present = new Set(todays.filter((r) => r.status === "CheckedIn").map((r) => r.worker_id)).size;
  const out = todays.filter((r) => r.status === "CheckedOut").length;
  const totalHrs = todays.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const absent = Math.max(0, workers.filter((w) => w.status === "Active").length - present - out);

  const week = useMemo(() => {
    const days: { d: string; present: number; out: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - i);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const r = records.filter((x) => {
        const d = new Date(x.check_in); return d >= start && d < end;
      });
      days.push({
        d: start.toLocaleDateString("en", { weekday: "short" }),
        present: new Set(r.map((x) => x.worker_id)).size,
        out: r.filter((x) => x.status === "CheckedOut").length,
      });
    }
    return days;
  }, [records]);

  const pendingCorrections = corrections.filter((c) => c.status === "Pending").length;

  return (
    <AppShell
      eyebrow="Today"
      title={<>Smart <span className="neon-text">attendance</span></>}
      subtitle="QR check-in/out · live logs · weekly analytics."
      actions={
        <div className="flex items-center gap-2">
          {isManager && (
            <button onClick={() => setManualOpen(true)}
              className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-white/5 transition">
              <Plus className="h-3.5 w-3.5" /> Manual entry
            </button>
          )}
          <button onClick={() => setScanOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
            <ScanLine className="h-3.5 w-3.5" /> Scan QR
          </button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: "Present now", v: present, g: "cyan" as const, i: UserCheck },
          { l: "Checked out today", v: out, g: "violet" as const, i: Clock },
          { l: "Absent (active)", v: absent, g: "pink" as const, i: UserX },
          { l: "Total hours today", v: totalHrs.toFixed(1), g: "cyan" as const, i: Timer },
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

      {/* Chart */}
      <GlassCard glow="cyan">
        <div className="text-sm font-semibold">Last 7 days</div>
        <div className="text-xs text-muted-foreground mb-3">Unique check-ins · completed shifts</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={week} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.72 0.03 260)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.19 0.035 270 / 0.95)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
              <Bar dataKey="present" fill="oklch(0.78 0.18 200)" radius={[8, 8, 0, 0]} name="Check-ins" />
              <Bar dataKey="out" fill="oklch(0.7 0.26 295)" radius={[8, 8, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Tabs: Records / Corrections */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="flex items-center gap-1 p-5 border-b border-white/5">
          {(["records", "corrections"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition relative ${
                tab === t ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t === "records" ? "Records" : "Corrections"}
              {t === "corrections" && pendingCorrections > 0 && (
                <span className="ml-1.5 text-[9px] bg-[color:var(--neon-pink)] text-white rounded-full px-1.5 py-0.5 font-bold">
                  {pendingCorrections}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "records" && (
          <>
            <div className="px-5 py-3">
              <div className="text-sm font-semibold">Recent activity</div>
              <div className="text-xs text-muted-foreground">Last {Math.min(records.length, 50)} events</div>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-t border-white/5">
                    <th className="px-5 py-3 font-medium">Worker</th>
                    <th className="px-5 py-3 font-medium">Check-in</th>
                    <th className="px-5 py-3 font-medium">Check-out</th>
                    <th className="px-5 py-3 font-medium">Hours</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 50).map((r, i) => (
                    <motion.tr key={r.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-t border-white/5 hover:bg-white/[0.03] group">
                      <td className="px-5 py-3 font-medium">
                        {r.workers?.full_name ?? "—"}
                        <div className="text-[11px] text-muted-foreground">{r.workers?.role ?? ""}</div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(r.check_in).toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.check_out ? new Date(r.check_out).toLocaleString() : "—"}</td>
                      <td className="px-5 py-3">{r.hours ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${
                          r.status === "CheckedIn" ? "text-[color:var(--neon-cyan)]" : "text-muted-foreground"
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => setCorrectionOpen({ attendanceId: r.id })}
                            title="Request correction"
                            className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-cyan)]">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground border-t border-white/5">
                      No check-ins yet. Scan a worker QR to record attendance.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "corrections" && (
          <>
            <div className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Correction requests</div>
                <div className="text-xs text-muted-foreground">{corrections.length} total · {pendingCorrections} pending</div>
              </div>
              <button onClick={() => setCorrectionOpen({})}
                className="glass rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-white/5">
                <Plus className="h-3.5 w-3.5" /> Request
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {corrections.map((c, i) => (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-5 py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{c.workers?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.reason}</div>
                    {c.requested_check_in && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        In: {new Date(c.requested_check_in).toLocaleString()}
                        {c.requested_check_out && ` · Out: ${new Date(c.requested_check_out).toLocaleString()}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${
                      c.status === "Approved" ? "text-[color:var(--neon-cyan)]"
                      : c.status === "Rejected" ? "text-[color:var(--neon-pink)]"
                      : "text-muted-foreground"
                    }`}>{c.status}</span>
                    {isManager && c.status === "Pending" && (
                      <>
                        <button onClick={() => reviewCorr.mutate({ id: c.id, status: "Approved" })}
                          className="glass rounded-lg p-1 hover:bg-white/5 text-[color:var(--neon-cyan)]">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => reviewCorr.mutate({ id: c.id, status: "Rejected" })}
                          className="glass rounded-lg p-1 hover:bg-white/5 text-[color:var(--neon-pink)]">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              {corrections.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No correction requests yet.
                </div>
              )}
            </div>
          </>
        )}
      </GlassCard>

      {/* QR Scanner modal */}
      <ScannerModal
        open={scanOpen} onClose={() => setScanOpen(false)}
        workers={workers.map((w) => ({ id: w.id, name: w.full_name, qr: w.qr_code }))}
        onResult={(qr) => scan.mutate(qr)}
      />

      {/* Manual entry modal */}
      <ManualEntryModal
        open={manualOpen} onClose={() => setManualOpen(false)}
        workers={workers} ownerId={user?.id}
        onSubmit={(v) => addManual.mutate(v)}
        saving={addManual.isPending}
      />

      {/* Correction request modal */}
      {correctionOpen !== null && (
        <CorrectionModal
          open onClose={() => setCorrectionOpen(null)}
          workers={workers} ownerId={user?.id}
          attendanceId={correctionOpen.attendanceId}
          onSubmit={(v) => addCorrection.mutate(v)}
          saving={addCorrection.isPending}
        />
      )}
    </AppShell>
  );
}

// ---- Modals ----

function ManualEntryModal({
  open, onClose, workers, ownerId, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; workers: any[]; ownerId?: string;
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({
    worker_id: "",
    date: today,
    check_in_time: "09:00",
    check_out_time: "",
  });

  const checkInISO = v.date && v.check_in_time ? `${v.date}T${v.check_in_time}:00` : null;
  const checkOutISO = v.date && v.check_out_time ? `${v.date}T${v.check_out_time}:00` : null;
  const hours = checkInISO && checkOutISO
    ? Math.max(0, (new Date(checkOutISO).getTime() - new Date(checkInISO).getTime()) / 3.6e6)
    : null;

  return (
    <Modal open={open} onClose={onClose} title="Manual attendance entry">
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!ownerId) return toast.error("Not signed in");
        if (!v.worker_id) return toast.error("Select a worker");
        if (!checkInISO) return toast.error("Enter check-in time");
        onSubmit({
          owner_id: ownerId,
          worker_id: v.worker_id,
          check_in: checkInISO,
          check_out: checkOutISO,
          hours: hours ? +hours.toFixed(2) : null,
          status: checkOutISO ? "CheckedOut" : "CheckedIn",
        });
      }} className="space-y-3">
        <Field label="Worker">
          <select className={inputCls} value={v.worker_id} onChange={(e) => setV({ ...v, worker_id: e.target.value })}>
            <option value="">Select worker…</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" className={inputCls} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in time">
            <input type="time" className={inputCls} value={v.check_in_time}
              onChange={(e) => setV({ ...v, check_in_time: e.target.value })} />
          </Field>
          <Field label="Check-out time (optional)">
            <input type="time" className={inputCls} value={v.check_out_time}
              onChange={(e) => setV({ ...v, check_out_time: e.target.value })} />
          </Field>
        </div>
        {hours !== null && hours > 0 && (
          <div className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground">
            Duration: <span className="text-foreground font-medium">{hours.toFixed(2)} hours</span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>
            {saving ? "Saving…" : "Add record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CorrectionModal({
  open, onClose, workers, ownerId, attendanceId, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; workers: any[]; ownerId?: string;
  attendanceId?: string; onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({
    worker_id: "",
    reason: "",
    check_in: "",
    check_out: "",
  });

  return (
    <Modal open={open} onClose={onClose} title="Request attendance correction">
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!ownerId) return toast.error("Not signed in");
        if (!v.worker_id) return toast.error("Select a worker");
        if (!v.reason.trim()) return toast.error("Reason is required");
        onSubmit({
          owner_id: ownerId,
          worker_id: v.worker_id,
          attendance_id: attendanceId ?? null,
          reason: v.reason.trim(),
          requested_check_in: v.check_in || null,
          requested_check_out: v.check_out || null,
        });
      }} className="space-y-3">
        <div className="flex items-start gap-2 glass rounded-xl px-3 py-2">
          <AlertCircle className="h-4 w-4 text-[color:var(--neon-cyan)] shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">Submit a correction request. A manager will review and approve it.</p>
        </div>
        <Field label="Worker">
          <select className={inputCls} value={v.worker_id} onChange={(e) => setV({ ...v, worker_id: e.target.value })}>
            <option value="">Select worker…</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </Field>
        <Field label="Reason for correction">
          <textarea className={inputCls} rows={2} required value={v.reason}
            onChange={(e) => setV({ ...v, reason: e.target.value })}
            placeholder="Explain why the correction is needed…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Correct check-in (optional)">
            <input type="datetime-local" className={inputCls} value={v.check_in}
              onChange={(e) => setV({ ...v, check_in: e.target.value })} />
          </Field>
          <Field label="Correct check-out (optional)">
            <input type="datetime-local" className={inputCls} value={v.check_out}
              onChange={(e) => setV({ ...v, check_out: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>
            {saving ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ScannerModal({
  open, onClose, onResult, workers,
}: {
  open: boolean; onClose: () => void;
  onResult: (qr: string) => void;
  workers: { id: string; name: string; qr: string }[];
}) {
  const [tab, setTab] = useState<"camera" | "manual">("manual");
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function start() {
    if (running || scannerRef.current) return;
    setErr("");
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (text) => {
          onResult(text);
          stop();
          onClose();
        },
        () => { },
      );
      setRunning(true);
    } catch {
      setErr("Could not access camera. Try selecting a worker manually.");
    }
  }

  async function stop() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { }
      scannerRef.current = null;
    }
    setRunning(false);
  }

  useEffect(() => {
    if (tab === "camera" && open) start();
    else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, open]);

  return (
    <Modal open={open} onClose={() => { stop(); onClose(); }} title="QR check-in">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl glass mb-4">
        {(["manual", "camera"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition ${
              tab === t ? "bg-white/10 text-foreground" : "text-muted-foreground"
            }`}>
            {t === "camera" ? <Camera className="h-3.5 w-3.5" /> : null}
            {t === "manual" ? "Select worker" : "Camera scan"}
          </button>
        ))}
      </div>

      {tab === "manual" ? (
        <div className="space-y-2">
          {workers.map((w) => (
            <button key={w.id} onClick={() => { onResult(w.qr); onClose(); }}
              disabled={!w.qr}
              className="w-full glass rounded-xl px-3 py-2.5 text-left hover:bg-white/5 transition flex items-center justify-between disabled:opacity-40">
              <span className="text-sm font-medium">{w.name}</span>
              <UserCheck className="h-4 w-4 text-[color:var(--neon-cyan)]" />
            </button>
          ))}
          {workers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No workers found. Add workers first.</p>
          )}
        </div>
      ) : (
        <div>
          {err && (
            <div className="glass rounded-xl p-3 text-xs text-[color:var(--neon-pink)] mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />{err}
            </div>
          )}
          <div id="qr-reader" className="rounded-xl overflow-hidden w-full" />
          {running && (
            <button onClick={stop}
              className="mt-3 w-full glass rounded-xl py-2 text-xs flex items-center justify-center gap-1.5">
              <StopCircle className="h-3.5 w-3.5" /> Stop camera
            </button>
          )}
        </div>
      )}

      {/* Manual QR code input */}
      <div className="mt-4 border-t border-white/5 pt-4">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Or enter QR code manually</label>
        <div className="mt-1.5 flex gap-2">
          <input className="flex-1 glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
            placeholder="Paste or type QR value…"
            value={manual} onChange={(e) => setManual(e.target.value)} />
          <button onClick={() => { if (manual.trim()) { onResult(manual.trim()); onClose(); } }}
            disabled={!manual.trim()}
            className={`${primaryBtn} disabled:opacity-40 shrink-0`} style={primaryBtnStyle}>
            Submit
          </button>
        </div>
      </div>
    </Modal>
  );
}
