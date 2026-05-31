import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, Check, Plus, Trash2, X } from "lucide-react";
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

function LeavePage() {
  const { user } = useSession();
  const { isAdmin, isManager } = useRole();
  const canReview = isAdmin || isManager;
  const qc = useQueryClient();

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
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Rejected" }) =>
      reviewLeave(id, status, user!.id),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: ["leave"] });
      await logActivity(`leave_${vars.status.toLowerCase()}`, "data");
      if (user) await pushNotification({
        user_id: user.id,
        title: `Leave ${vars.status.toLowerCase()}`,
        type: "leave",
      });
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
    { l: "Rejected", v: rows.filter((r) => r.status === "Rejected").length, c: "var(--neon-cyan)" },
  ];

  return (
    <AppShell
      eyebrow="Time off"
      title={<>Leave <span className="neon-text">requests</span></>}
      subtitle="Submit, review and track every leave across your team."
      actions={
        <button onClick={() => setOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
          <Plus className="h-3.5 w-3.5" /> New request
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
                  <td className="py-2.5 pr-3 text-muted-foreground">{r.leave_type}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground max-w-[200px] truncate">{r.reason || "—"}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${
                      r.status === "Approved" ? "text-[color:var(--neon-cyan)]" :
                      r.status === "Rejected" ? "text-[color:var(--neon-pink)]" :
                      r.status === "Pending" ? "text-[color:var(--neon-violet)]" : "text-muted-foreground"
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
                      <button onClick={() => { if (confirm("Delete request?")) del.mutate(r.id); }}
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

      <LeaveFormModal
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

function LeaveFormModal({
  open, onClose, ownerId, workers, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; ownerId?: string;
  workers: { id: string; full_name: string }[];
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({
    worker_id: "", leave_type: "Annual" as LeaveRequest["leave_type"],
    start_date: "", end_date: "", reason: "",
  });

  useEffect(() => {
    if (open) setV({ worker_id: workers[0]?.id ?? "", leave_type: "Annual", start_date: "", end_date: "", reason: "" });
  }, [open, workers]);

  return (
    <Modal open={open} onClose={onClose} title="New leave request">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Not signed in");
          if (!v.worker_id) return toast.error("Pick a worker");
          if (!v.start_date || !v.end_date) return toast.error("Dates required");
          onSubmit({ owner_id: ownerId, ...v });
        }}
        className="space-y-3"
      >
        <Field label="Worker">
          <select className={inputCls} value={v.worker_id} onChange={(e) => setV({ ...v, worker_id: e.target.value })}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className={inputCls} value={v.leave_type}
            onChange={(e) => setV({ ...v, leave_type: e.target.value as LeaveRequest["leave_type"] })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="date" className={inputCls} value={v.start_date}
            onChange={(e) => setV({ ...v, start_date: e.target.value })} /></Field>
          <Field label="End"><input type="date" className={inputCls} value={v.end_date}
            onChange={(e) => setV({ ...v, end_date: e.target.value })} /></Field>
        </div>
        <Field label="Reason">
          <textarea rows={3} className={inputCls} value={v.reason}
            onChange={(e) => setV({ ...v, reason: e.target.value })} />
        </Field>
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
