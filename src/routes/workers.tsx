import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase, Edit3, Filter, Mail, Phone, Plus, QrCode, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import {
  listWorkers, upsertWorker, deleteWorker, type Worker,
} from "@/lib/queries";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/workers")({
  head: () => ({
    meta: [
      { title: "Workers — TrackNova" },
      { name: "description", content: "Manage workers, departments, salaries and QR badges from a unified command center." },
    ],
  }),
  component: WorkersPage,
});

const FILTERS = ["All", "Active", "OnLeave", "Inactive"] as const;

function WorkersPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers"], queryFn: listWorkers, enabled: !!user,
  });

  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const [editing, setEditing] = useState<Worker | null>(null);
  const [open, setOpen] = useState(false);
  const [qrWorker, setQrWorker] = useState<Worker | null>(null);

  const save = useMutation({
    mutationFn: upsertWorker,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workers"] });
      await logActivity(editing ? "worker_updated" : "worker_created", "data");
      toast.success(editing ? "Worker updated" : "Worker added");
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: deleteWorker,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workers"] });
      await logActivity("worker_deleted", "data");
      toast.success("Worker removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => workers.filter((w) =>
      (f === "All" || w.status === f) &&
      (w.full_name.toLowerCase().includes(q.toLowerCase()) ||
        (w.role ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (w.department ?? "").toLowerCase().includes(q.toLowerCase()))
    ),
    [workers, q, f],
  );

  const stats = [
    { l: "Total", v: workers.length, c: "var(--neon-cyan)" },
    { l: "Active", v: workers.filter((w) => w.status === "Active").length, c: "var(--neon-violet)" },
    { l: "On leave", v: workers.filter((w) => w.status === "OnLeave").length, c: "var(--neon-pink)" },
    { l: "Departments", v: new Set(workers.map((w) => w.department).filter(Boolean)).size, c: "var(--neon-cyan)" },
  ];

  return (
    <AppShell
      eyebrow="Team"
      title={<>Worker <span className="neon-text">management</span></>}
      subtitle="Real-time profiles, salaries, statuses and unique QR badges."
      actions={
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className={primaryBtn}
          style={primaryBtnStyle}
        >
          <Plus className="h-3.5 w-3.5" /> Add worker
        </button>
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
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, role or department…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="flex items-center gap-1 glass rounded-xl p-1 overflow-x-auto">
            {FILTERS.map((x) => (
              <button
                key={x}
                onClick={() => setF(x)}
                className={`relative px-3 py-1.5 text-xs rounded-lg transition shrink-0 ${f === x ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f === x && (
                  <motion.span layoutId="worker-filter" className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }} />
                )}
                <span className="relative inline-flex items-center gap-1"><Filter className="h-3 w-3" />{x}</span>
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <GlassCard className="text-center py-12 text-sm text-muted-foreground">Loading workers…</GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="text-center py-12 text-sm text-muted-foreground">
          No workers yet. Click <span className="text-foreground font-medium">Add worker</span> to begin.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((w, i) => (
            <GlassCard key={w.id} transition={{ delay: i * 0.04 }}>
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl grid place-items-center font-bold text-base"
                  style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))", color: "oklch(0.12 0.04 270)" }}>
                  {w.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{w.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.role || "—"} · {w.department || "—"}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full glass shrink-0 ${
                  w.status === "Active" ? "text-[color:var(--neon-cyan)]"
                  : w.status === "OnLeave" ? "text-[color:var(--neon-pink)]"
                  : "text-muted-foreground"
                }`}>{w.status}</span>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {w.phone && <div className="flex items-center gap-2 truncate"><Phone className="h-3 w-3 shrink-0" /> {w.phone}</div>}
                {w.email && <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" /> {w.email}</div>}
                <div className="flex items-center gap-2"><Briefcase className="h-3 w-3" /> ₹{Number(w.monthly_salary).toLocaleString("en-IN")}/mo · ₹{Number(w.hourly_rate)}/hr</div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => setQrWorker(w)} className="flex-1 glass rounded-xl px-2.5 py-1.5 text-[11px] inline-flex items-center justify-center gap-1 hover:bg-white/5">
                  <QrCode className="h-3 w-3" /> QR badge
                </button>
                <button onClick={() => { setEditing(w); setOpen(true); }} className="glass rounded-xl p-1.5 hover:bg-white/5">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${w.full_name}?`)) del.mutate(w.id);
                  }}
                  className="glass rounded-xl p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <WorkerFormModal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        initial={editing}
        ownerId={user?.id}
        onSubmit={(v) => save.mutate(v)}
        saving={save.isPending}
      />
      <QrModal worker={qrWorker} onClose={() => setQrWorker(null)} />
    </AppShell>
  );
}

function WorkerFormModal({
  open, onClose, initial, ownerId, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; initial: Worker | null;
  ownerId?: string;
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({
    full_name: "", email: "", phone: "", role: "", department: "",
    hourly_rate: 0, monthly_salary: 0, status: "Active" as Worker["status"],
  });

  useEffect(() => {
    if (initial) {
      setV({
        full_name: initial.full_name,
        email: initial.email ?? "",
        phone: initial.phone ?? "",
        role: initial.role ?? "",
        department: initial.department ?? "",
        hourly_rate: Number(initial.hourly_rate),
        monthly_salary: Number(initial.monthly_salary),
        status: initial.status,
      });
    } else if (open) {
      setV({ full_name: "", email: "", phone: "", role: "", department: "", hourly_rate: 0, monthly_salary: 0, status: "Active" });
    }
  }, [initial, open]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit worker" : "Add worker"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Not signed in");
          if (!v.full_name.trim()) return toast.error("Name is required");
          onSubmit(initial ? { id: initial.id, ...v } : { owner_id: ownerId, ...v });
        }}
        className="space-y-3"
      >
        <Field label="Full name">
          <input className={inputCls} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role"><input className={inputCls} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} /></Field>
          <Field label="Department"><input className={inputCls} value={v.department} onChange={(e) => setV({ ...v, department: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hourly rate (₹)">
            <input type="number" min={0} step={1} className={inputCls} value={v.hourly_rate}
              onChange={(e) => setV({ ...v, hourly_rate: +e.target.value })} />
          </Field>
          <Field label="Monthly salary (₹)">
            <input type="number" min={0} step={1} className={inputCls} value={v.monthly_salary}
              onChange={(e) => setV({ ...v, monthly_salary: +e.target.value })} />
          </Field>
        </div>
        <Field label="Status">
          <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Worker["status"] })}>
            <option value="Active">Active</option>
            <option value="OnLeave">On leave</option>
            <option value="Inactive">Inactive</option>
          </select>
        </Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add worker"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function QrModal({ worker, onClose }: { worker: Worker | null; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    if (!worker) return;
    QRCode.toDataURL(worker.qr_code, { width: 320, margin: 1, color: { dark: "#0a0a1a", light: "#ffffff" } })
      .then(setDataUrl);
  }, [worker]);
  return (
    <Modal open={!!worker} onClose={onClose} title="QR badge">
      {worker && (
        <div className="text-center space-y-3">
          <div className="text-sm font-semibold">{worker.full_name}</div>
          <div className="text-xs text-muted-foreground">{worker.role}</div>
          {dataUrl ? (
            <img src={dataUrl} alt="QR" className="mx-auto rounded-xl" />
          ) : (
            <div className="h-64 grid place-items-center text-xs text-muted-foreground">Generating…</div>
          )}
          <div className="font-mono text-[10px] text-muted-foreground break-all">{worker.qr_code}</div>
          {dataUrl && (
            <a href={dataUrl} download={`${worker.full_name}-qr.png`}
              className={primaryBtn} style={primaryBtnStyle}>Download PNG</a>
          )}
        </div>
      )}
    </Modal>
  );
}
