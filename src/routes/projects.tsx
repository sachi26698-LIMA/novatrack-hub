import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Building2, CalendarClock, Edit3, HardHat, Layers, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import {
  deleteProject, listProjects, upsertProject, type Project,
} from "@/lib/queries";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — TrackNova" },
      { name: "description", content: "Track every project, budget, progress and deadlines in real time." },
    ],
  }),
  component: ProjectsPage,
});

const STATUS_COLOR: Record<Project["status"], string> = {
  Planning: "text-muted-foreground",
  Active: "text-[color:var(--neon-cyan)]",
  OnHold: "text-[color:var(--neon-pink)]",
  Completed: "text-[color:var(--neon-violet)]",
  Cancelled: "text-[color:var(--neon-pink)]",
};

function ProjectsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"], queryFn: listProjects, enabled: !!user,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const save = useMutation({
    mutationFn: upsertProject,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["projects"] });
      await logActivity(editing ? "project_updated" : "project_created", "data");
      toast.success(editing ? "Project updated" : "Project created");
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: deleteProject,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Removed"); },
  });

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === "Active").length;
    const budget = projects.reduce((s, p) => s + Number(p.budget), 0);
    const spent = projects.reduce((s, p) => s + Number(p.spent), 0);
    const avg = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;
    return { active, budget, spent, avg };
  }, [projects]);

  return (
    <AppShell
      eyebrow="Portfolio"
      title={<>Project <span className="neon-text">tracking</span></>}
      subtitle="Live progress, budgets and deadlines across every engagement."
      actions={
        <button onClick={() => { setEditing(null); setOpen(true); }} className={primaryBtn} style={primaryBtnStyle}>
          <Plus className="h-3.5 w-3.5" /> New project
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: "Active", v: stats.active, i: Building2 },
          { l: "Total budget", v: `₹${(stats.budget / 1e5).toFixed(1)}L`, i: Layers },
          { l: "Spent", v: `₹${(stats.spent / 1e5).toFixed(1)}L`, i: HardHat },
          { l: "Avg progress", v: `${stats.avg}%`, i: CalendarClock },
        ].map((k, i) => (
          <GlassCard key={k.l} transition={{ delay: i * 0.05 }}>
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

      {isLoading ? (
        <GlassCard className="text-center py-12 text-sm text-muted-foreground">Loading…</GlassCard>
      ) : projects.length === 0 ? (
        <GlassCard className="text-center py-12 text-sm text-muted-foreground">
          No projects yet. Click <span className="text-foreground font-medium">New project</span> to add one.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <GlassCard key={p.id} transition={{ delay: i * 0.05 }}>
              <div className="absolute inset-x-0 top-0 h-1"
                style={{ background: "linear-gradient(90deg, var(--neon-cyan), transparent)" }} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.client || "—"}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full glass shrink-0 ${STATUS_COLOR[p.status]}`}>{p.status}</span>
              </div>

              {p.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>}

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{p.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-violet))" }}
                    initial={{ width: 0 }} animate={{ width: `${p.progress}%` }} transition={{ duration: 1 }} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="glass rounded-xl py-2">
                  <div className="text-muted-foreground">Budget</div>
                  <div className="font-semibold">₹{(Number(p.budget) / 1e5).toFixed(1)}L</div>
                </div>
                <div className="glass rounded-xl py-2">
                  <div className="text-muted-foreground">Spent</div>
                  <div className="font-semibold">₹{(Number(p.spent) / 1e5).toFixed(1)}L</div>
                </div>
                <div className="glass rounded-xl py-2">
                  <div className="text-muted-foreground">Deadline</div>
                  <div className="font-semibold">{p.end_date ?? "—"}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 justify-end">
                <button onClick={() => { setEditing(p); setOpen(true); }} className="glass rounded-xl p-1.5 hover:bg-white/5">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }}
                  className="glass rounded-xl p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <ProjectFormModal
        open={open} onClose={() => { setOpen(false); setEditing(null); }}
        initial={editing}
        ownerId={user?.id}
        onSubmit={(v) => save.mutate(v)}
        saving={save.isPending}
      />
    </AppShell>
  );
}

function ProjectFormModal({
  open, onClose, initial, ownerId, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; initial: Project | null;
  ownerId?: string; onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({
    name: "", client: "", description: "",
    status: "Planning" as Project["status"],
    budget: 0, spent: 0, progress: 0,
    start_date: "", end_date: "",
  });
  useEffect(() => {
    if (initial) {
      setV({
        name: initial.name, client: initial.client ?? "",
        description: initial.description ?? "",
        status: initial.status, budget: Number(initial.budget),
        spent: Number(initial.spent), progress: initial.progress,
        start_date: initial.start_date ?? "", end_date: initial.end_date ?? "",
      });
    } else if (open) {
      setV({ name: "", client: "", description: "", status: "Planning", budget: 0, spent: 0, progress: 0, start_date: "", end_date: "" });
    }
  }, [initial, open]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit project" : "New project"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Not signed in");
          if (!v.name.trim()) return toast.error("Name required");
          const payload: any = {
            ...v,
            start_date: v.start_date || null,
            end_date: v.end_date || null,
          };
          onSubmit(initial ? { id: initial.id, ...payload } : { owner_id: ownerId, ...payload });
        }}
        className="space-y-3"
      >
        <Field label="Project name"><input className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></Field>
        <Field label="Client"><input className={inputCls} value={v.client} onChange={(e) => setV({ ...v, client: e.target.value })} /></Field>
        <Field label="Description"><textarea rows={3} className={inputCls} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Project["status"] })}>
              {(["Planning", "Active", "OnHold", "Completed", "Cancelled"] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Progress (%)">
            <input type="number" min={0} max={100} className={inputCls} value={v.progress}
              onChange={(e) => setV({ ...v, progress: Math.max(0, Math.min(100, +e.target.value)) })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget (₹)"><input type="number" className={inputCls} value={v.budget} onChange={(e) => setV({ ...v, budget: +e.target.value })} /></Field>
          <Field label="Spent (₹)"><input type="number" className={inputCls} value={v.spent} onChange={(e) => setV({ ...v, spent: +e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" className={inputCls} value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} /></Field>
          <Field label="End date"><input type="date" className={inputCls} value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>
            {saving ? "Saving…" : initial ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
