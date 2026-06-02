import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, CheckSquare, Clock, Edit3, Flag,
  Kanban, Layers, LayoutList, ListTodo, Plus, Search, Trash2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import {
  createTask, deleteTask, listTasks, markTaskDone, updateTask,
  type Task, type TaskPriority, type TaskStatus,
} from "@/lib/queries-tasks";
import { listWorkers, listProjects } from "@/lib/queries";
import { logActivity } from "@/lib/activity-log";
import { pushNotification } from "@/lib/queries-extra";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — TrackNova" },
      { name: "description", content: "Kanban task board — assign, track and complete team tasks." },
    ],
  }),
  component: TasksPage,
});

const STATUS_OPTS: TaskStatus[] = ["Todo", "InProgress", "Done", "Blocked"];
const PRIORITY_OPTS: TaskPriority[] = ["Urgent", "High", "Medium", "Low"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  Todo: "To Do", InProgress: "In Progress", Done: "Done", Blocked: "Blocked",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  Todo: "text-muted-foreground",
  InProgress: "text-[color:var(--neon-cyan)]",
  Done: "text-[color:var(--neon-violet)]",
  Blocked: "text-[color:var(--neon-pink)]",
};

const STATUS_COL_ACCENT: Record<TaskStatus, string> = {
  Todo: "border-white/8",
  InProgress: "border-[color:var(--neon-cyan)]/25",
  Done: "border-[color:var(--neon-violet)]/25",
  Blocked: "border-[color:var(--neon-pink)]/25",
};

const STATUS_HEADER_COLOR: Record<TaskStatus, string> = {
  Todo: "text-muted-foreground",
  InProgress: "text-[color:var(--neon-cyan)]",
  Done: "text-[color:var(--neon-violet)]",
  Blocked: "text-[color:var(--neon-pink)]",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Urgent: "bg-[color:var(--neon-pink)]/15 text-[color:var(--neon-pink)]",
  High: "bg-orange-500/15 text-orange-400",
  Medium: "bg-[color:var(--neon-cyan)]/10 text-[color:var(--neon-cyan)]",
  Low: "bg-white/5 text-muted-foreground",
};

const STATUS_ICONS: Record<TaskStatus, React.FC<{ className?: string }>> = {
  Todo: ListTodo, InProgress: Clock, Done: CheckCircle2, Blocked: XCircle,
};

function TasksPage() {
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: tasks = [], isError } = useQuery({
    queryKey: ["tasks"], queryFn: listTasks, enabled: !!user,
  });
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"], queryFn: listWorkers, enabled: !!user,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"], queryFn: listProjects, enabled: !!user,
  });

  const [q, setQ] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "All">("All");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const inv = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const create = useMutation({
    mutationFn: createTask,
    onSuccess: async (_, vars) => {
      await inv();
      await logActivity("task_created", "data");
      if (vars.worker_id && user) {
        pushNotification({
          user_id: user.id,
          title: "New task assigned",
          message: `"${vars.title}" was assigned`,
          type: "task",
        }).catch(() => {});
      }
      toast.success("Task created");
      setOpen(false);
    },
    onError: (e: Error) => {
      if (e.message.includes("42P01") || e.message.includes("does not exist"))
        toast.error("Run supabase/migrations/20260601_upgrade.sql in Supabase first.", { duration: 8000 });
      else toast.error(e.message);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateTask>[1] }) => updateTask(id, patch),
    onSuccess: async () => { await inv(); toast.success("Task updated"); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTask(id, { status }),
    onSuccess: () => inv(),
  });

  const done = useMutation({
    mutationFn: markTaskDone,
    onSuccess: async () => { await inv(); await logActivity("task_completed", "data"); toast.success("Marked done"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => { await inv(); await logActivity("task_deleted", "data"); toast.success("Task removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();

  const filtered = useMemo(() => tasks.filter((t) => {
    if (priorityFilter !== "All" && t.priority !== priorityFilter) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase()) &&
      !(t.workers?.full_name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tasks, priorityFilter, q]);

  const stats = [
    { l: "Total", v: tasks.length, g: "cyan" as const, i: CheckSquare },
    { l: "To do", v: tasks.filter((t) => t.status === "Todo").length, g: "cyan" as const, i: ListTodo },
    { l: "In progress", v: tasks.filter((t) => t.status === "InProgress").length, g: "violet" as const, i: Clock },
    { l: "Done", v: tasks.filter((t) => t.status === "Done").length, g: "violet" as const, i: CheckCircle2 },
    { l: "Overdue", v: tasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status !== "Done").length, g: "pink" as const, i: AlertCircle },
  ];

  return (
    <AppShell
      eyebrow="Work"
      title={<>Task <span className="neon-text">command</span></>}
      subtitle="Drag tasks between columns to update status — or switch to list view."
      actions={
        <div className="flex items-center gap-2">
          <div className="glass rounded-xl p-1 flex items-center gap-0.5">
            <button onClick={() => setView("kanban")} title="Kanban"
              className={`p-1.5 rounded-lg transition ${view === "kanban" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Kanban className="h-4 w-4" />
            </button>
            <button onClick={() => setView("list")} title="List"
              className={`p-1.5 rounded-lg transition ${view === "list" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
            <Plus className="h-3.5 w-3.5" /> New task
          </button>
        </div>
      }
    >
      {isError && (
        <div className="glass rounded-2xl px-5 py-4 flex items-start gap-3 border border-[color:var(--neon-pink)]/30">
          <AlertCircle className="h-5 w-5 text-[color:var(--neon-pink)] shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Database setup required</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Run <code className="font-mono">supabase/migrations/20260601_upgrade.sql</code> in Supabase SQL editor.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((k, i) => (
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

      <GlassCard className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input className="w-full glass rounded-xl pl-8 pr-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
            placeholder="Search tasks or workers…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="glass rounded-xl px-3 py-2 text-xs bg-transparent outline-none text-muted-foreground"
          value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "All")}>
          <option value="All">All priorities</option>
          {PRIORITY_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</div>
      </GlassCard>

      <AnimatePresence mode="wait">
        {view === "kanban" ? (
          <motion.div key="kanban" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <KanbanBoard tasks={filtered} now={now}
              onStatusChange={(id, s) => changeStatus.mutate({ id, status: s })}
              onEdit={setEditing}
              onDelete={(id) => { if (confirm("Delete this task?")) del.mutate(id); }}
              onMarkDone={(id) => done.mutate(id)} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ListView tasks={filtered} now={now}
              onEdit={setEditing}
              onDelete={(id) => { if (confirm("Delete this task?")) del.mutate(id); }}
              onMarkDone={(id) => done.mutate(id)} />
          </motion.div>
        )}
      </AnimatePresence>

      <TaskModal open={open} onClose={() => setOpen(false)} workers={workers} projects={projects}
        ownerId={user?.id} onSubmit={(v) => create.mutate(v)} saving={create.isPending} />
      {editing && (
        <TaskModal open={!!editing} onClose={() => setEditing(null)} initial={editing}
          workers={workers} projects={projects} ownerId={user?.id}
          onSubmit={(v) => update.mutate({ id: editing.id, patch: v })} saving={update.isPending} />
      )}
    </AppShell>
  );
}

function KanbanBoard({ tasks, now, onStatusChange, onEdit, onDelete, onMarkDone }: {
  tasks: Task[]; now: Date;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onEdit: (t: Task) => void; onDelete: (id: string) => void; onMarkDone: (id: string) => void;
}) {
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {STATUS_OPTS.map((col) => {
        const Icon = STATUS_ICONS[col];
        const colTasks = tasks.filter((t) => t.status === col);
        return (
          <div key={col}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId.current) onStatusChange(dragId.current, col);
              dragId.current = null; setDragOver(null);
            }}
            className={`min-h-52 rounded-2xl border transition-all ${
              dragOver === col ? "bg-white/[0.07] border-white/20 scale-[1.01]" : `bg-white/[0.02] ${STATUS_COL_ACCENT[col]}`
            }`}
          >
            <div className="px-3 py-3 flex items-center justify-between border-b border-white/5">
              <div className={`flex items-center gap-2 text-xs font-semibold ${STATUS_HEADER_COLOR[col]}`}>
                <Icon className="h-3.5 w-3.5" /> {STATUS_LABEL[col]}
              </div>
              <span className="text-[10px] glass rounded-full px-2 py-0.5 text-muted-foreground">{colTasks.length}</span>
            </div>
            <div className="p-2 space-y-2">
              {colTasks.length === 0 && (
                <div className="py-10 text-center text-[10px] text-muted-foreground/40">Drop tasks here</div>
              )}
              {colTasks.map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < now && task.status !== "Done";
                return (
                  <div key={task.id} draggable
                    onDragStart={() => { dragId.current = task.id; }}
                    onDragEnd={() => { dragId.current = null; setDragOver(null); }}
                    className="glass rounded-xl p-3 cursor-grab active:cursor-grabbing hover:bg-white/[0.06] transition group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-xs font-medium leading-snug flex-1 ${task.status === "Done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </span>
                      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <div className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{task.description}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.workers && (
                        <span className="text-[10px] glass rounded-full px-2 py-0.5 text-muted-foreground">{task.workers.full_name}</span>
                      )}
                      {task.due_date && (
                        <span className={`text-[10px] glass rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${isOverdue ? "text-[color:var(--neon-pink)]" : "text-muted-foreground"}`}>
                          <Flag className="h-2.5 w-2.5" />
                          {new Date(task.due_date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                      {task.status !== "Done" && (
                        <button onClick={() => onMarkDone(task.id)} title="Mark done"
                          className="glass rounded-lg p-1 hover:bg-white/10 text-[color:var(--neon-violet)]">
                          <CheckCircle2 className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => onEdit(task)} title="Edit" className="glass rounded-lg p-1 hover:bg-white/10">
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button onClick={() => onDelete(task.id)} title="Delete"
                        className="glass rounded-lg p-1 hover:bg-white/10 text-[color:var(--neon-pink)]">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ tasks, now, onEdit, onDelete, onMarkDone }: {
  tasks: Task[]; now: Date;
  onEdit: (t: Task) => void; onDelete: (id: string) => void; onMarkDone: (id: string) => void;
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="divide-y divide-white/5">
        {tasks.map((task, i) => {
          const Icon = STATUS_ICONS[task.status];
          const isOverdue = task.due_date && new Date(task.due_date) < now && task.status !== "Done";
          return (
            <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="px-5 py-4 flex items-start gap-4 hover:bg-white/[0.03] group">
              <button onClick={() => { if (task.status !== "Done") onMarkDone(task.id); }}
                className={`mt-0.5 shrink-0 ${STATUS_COLORS[task.status]} hover:opacity-80 transition`}>
                <Icon className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${task.status === "Done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full glass ${STATUS_COLORS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
                </div>
                {task.description && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{task.description}</div>}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {task.workers && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Layers className="h-3 w-3" />{task.workers.full_name}</span>}
                  {task.projects && <span className="text-[11px] text-muted-foreground">{task.projects.name}</span>}
                  {task.due_date && (
                    <span className={`text-[11px] inline-flex items-center gap-1 ${isOverdue ? "text-[color:var(--neon-pink)]" : "text-muted-foreground"}`}>
                      <Flag className="h-3 w-3" />{isOverdue ? "Overdue · " : "Due · "}
                      {new Date(task.due_date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => onEdit(task)} className="glass rounded-lg p-1.5 hover:bg-white/5"><Edit3 className="h-3.5 w-3.5" /></button>
                <button onClick={() => onDelete(task.id)} className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </motion.div>
          );
        })}
        {tasks.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">No tasks match your filters.</div>
        )}
      </div>
    </GlassCard>
  );
}

function TaskModal({ open, onClose, initial, workers, projects, ownerId, onSubmit, saving }: {
  open: boolean; onClose: () => void; initial?: Task | null;
  workers: any[]; projects: any[]; ownerId?: string;
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({
    title: initial?.title ?? "", description: initial?.description ?? "",
    worker_id: initial?.worker_id ?? "", project_id: initial?.project_id ?? "",
    status: (initial?.status ?? "Todo") as TaskStatus,
    priority: (initial?.priority ?? "Medium") as TaskPriority,
    due_date: initial?.due_date ?? "",
  });

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit task" : "New task"}>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!ownerId) return toast.error("Not signed in");
        if (!v.title.trim()) return toast.error("Title required");
        onSubmit({ owner_id: ownerId, title: v.title.trim(), description: v.description || null,
          worker_id: v.worker_id || null, project_id: v.project_id || null,
          status: v.status, priority: v.priority, due_date: v.due_date || null });
      }} className="space-y-3">
        <Field label="Title"><input className={inputCls} required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="What needs to be done?" /></Field>
        <Field label="Description"><textarea className={inputCls} rows={2} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Optional details…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assign to worker">
            <select className={inputCls} value={v.worker_id} onChange={(e) => setV({ ...v, worker_id: e.target.value })}>
              <option value="">Unassigned</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select className={inputCls} value={v.project_id} onChange={(e) => setV({ ...v, project_id: e.target.value })}>
              <option value="">None</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select className={inputCls} value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as TaskPriority })}>
              {PRIORITY_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as TaskStatus })}>
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Due date"><input type="date" className={inputCls} value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} /></Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>{saving ? "Saving…" : initial ? "Save changes" : "Create task"}</button>
        </div>
      </form>
    </Modal>
  );
}
