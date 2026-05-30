import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock, QrCode, ScanLine, Timer, UserCheck, UserX, Camera, StopCircle,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Modal, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { checkInByQr, listAttendance, listWorkers } from "@/lib/queries";
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
  const qc = useQueryClient();
  const { data: records = [] } = useQuery({
    queryKey: ["attendance"], queryFn: () => listAttendance(200), enabled: !!user,
    refetchInterval: 8000,
  });
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"], queryFn: listWorkers, enabled: !!user,
  });

  const [scanOpen, setScanOpen] = useState(false);

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

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = records.filter((r) => new Date(r.check_in) >= today);

  const present = new Set(todays.filter((r) => r.status === "CheckedIn").map((r) => r.worker_id)).size;
  const out = todays.filter((r) => r.status === "CheckedOut").length;
  const totalHrs = todays.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const absent = Math.max(0, workers.filter((w) => w.status === "Active").length - present - out);

  // 7-day chart
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

  return (
    <AppShell
      eyebrow="Today"
      title={<>Smart <span className="neon-text">attendance</span></>}
      subtitle="QR check-in/out · live logs · weekly analytics."
      actions={
        <button onClick={() => setScanOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
          <ScanLine className="h-3.5 w-3.5" /> Scan QR
        </button>
      }
    >
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
              <Bar dataKey="present" fill="oklch(0.78 0.18 200)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="out" fill="oklch(0.7 0.26 295)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-5">
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
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 50).map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 font-medium">
                    {(r as any).workers?.full_name ?? "—"}
                    <div className="text-[11px] text-muted-foreground">{(r as any).workers?.role ?? ""}</div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(r.check_in).toLocaleString()}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.check_out ? new Date(r.check_out).toLocaleString() : "—"}</td>
                  <td className="px-5 py-3">{r.hours ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${
                      r.status === "CheckedIn" ? "text-[color:var(--neon-cyan)]" : "text-muted-foreground"
                    }`}>{r.status}</span>
                  </td>
                </motion.tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground border-t border-white/5">
                  No check-ins yet. Scan a worker QR to record attendance.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <ScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        workers={workers.map((w) => ({ id: w.id, name: w.full_name, qr: w.qr_code }))}
        onResult={(qr) => scan.mutate(qr)}
      />
    </AppShell>
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
    setErr("");
    try {
      const el = document.getElementById("qr-cam");
      if (!el) return;
      const s = new Html5Qrcode("qr-cam");
      scannerRef.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { onResult(decoded); stop(); onClose(); },
        () => {},
      );
      setRunning(true);
    } catch (e: any) {
      setErr(e?.message ?? "Camera unavailable");
    }
  }

  async function stop() {
    const s = scannerRef.current;
    if (s) {
      try { await s.stop(); await s.clear(); } catch {/* noop */}
      scannerRef.current = null;
    }
    setRunning(false);
  }

  return (
    <Modal
      open={open}
      onClose={() => { stop(); onClose(); }}
      title="Scan attendance"
    >
      <div className="flex glass rounded-xl p-1 mb-3">
        {(["manual", "camera"] as const).map((t) => (
          <button key={t}
            onClick={() => { setTab(t); if (t !== "camera") stop(); }}
            className={`flex-1 text-xs py-1.5 rounded-lg capitalize ${tab === t ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "camera" ? (
        <div className="space-y-3">
          <div id="qr-cam" className="rounded-xl overflow-hidden bg-black/60 aspect-square grid place-items-center text-xs text-muted-foreground">
            {!running && "Camera off"}
          </div>
          {err && <div className="text-xs text-[color:var(--neon-pink)]">{err}</div>}
          {!running ? (
            <button onClick={start} className={`${primaryBtn} w-full`} style={primaryBtnStyle}>
              <Camera className="h-3.5 w-3.5" /> Start camera
            </button>
          ) : (
            <button onClick={stop} className="w-full glass rounded-xl py-2 text-xs inline-flex items-center justify-center gap-1">
              <StopCircle className="h-3.5 w-3.5" /> Stop
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Pick a worker or paste a QR code value.</p>
          <select
            className="w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none"
            value=""
            onChange={(e) => { if (e.target.value) { onResult(e.target.value); onClose(); } }}
          >
            <option value="">Select worker…</option>
            {workers.map((w) => <option key={w.id} value={w.qr}>{w.name}</option>)}
          </select>
          <div className="text-[10px] text-center text-muted-foreground">— or —</div>
          <div className="flex gap-2">
            <input className="flex-1 glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none"
              value={manual} onChange={(e) => setManual(e.target.value)}
              placeholder="Paste QR code value…" />
            <button
              disabled={!manual}
              onClick={() => { onResult(manual.trim()); onClose(); }}
              className={primaryBtn} style={primaryBtnStyle}
            >
              <QrCode className="h-3.5 w-3.5" /> Submit
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
