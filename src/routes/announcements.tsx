import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Megaphone, Pin, PinOff, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import {
  listAnnouncements, createAnnouncement, deleteAnnouncement, pinAnnouncement,
  type Announcement,
} from "@/lib/queries-extra";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — TrackNova" },
      { name: "description", content: "Company-wide announcements, updates and broadcasts." },
    ],
  }),
  component: AnnouncementsPage,
});

const CATEGORIES = ["General", "Policy", "HR", "Finance", "Operations", "Celebration"] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_COLORS: Record<Category, string> = {
  General: "bg-white/8 text-muted-foreground",
  Policy: "bg-[color:var(--neon-violet)]/15 text-[color:var(--neon-violet)]",
  HR: "bg-[color:var(--neon-cyan)]/15 text-[color:var(--neon-cyan)]",
  Finance: "bg-orange-500/15 text-orange-400",
  Operations: "bg-blue-500/15 text-blue-400",
  Celebration: "bg-[color:var(--neon-pink)]/15 text-[color:var(--neon-pink)]",
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AnnouncementsPage() {
  const { user } = useSession();
  const { isAdmin, isManager } = useRole();
  const qc = useQueryClient();
  const canPost = isAdmin || isManager;
  const [open, setOpen] = useState(false);
  const [catFilter, setCatFilter] = useState<Category | "All">("All");

  const { data: items = [], isError } = useQuery({
    queryKey: ["announcements"], queryFn: listAnnouncements, enabled: !!user,
  });

  const create = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["announcements"] });
      await logActivity("announcement_created", "data");
      toast.success("Announcement posted");
      setOpen(false);
    },
    onError: (e: Error) => {
      if (e.message.includes("42P01") || e.message.includes("does not exist"))
        toast.error("Run supabase/migrations/20260602_phase2.sql in Supabase first.", { duration: 8000 });
      else toast.error(e.message);
    },
  });

  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => pinAnnouncement(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = catFilter === "All" ? items : items.filter((a) => a.category === catFilter);
  const pinned = filtered.filter((a) => a.pinned);
  const rest = filtered.filter((a) => !a.pinned);

  return (
    <AppShell
      eyebrow="Company"
      title={<>Announce<span className="neon-text">ments</span></>}
      subtitle="Company-wide broadcasts, policy updates and team celebrations."
      actions={canPost ? (
        <button onClick={() => setOpen(true)} className={primaryBtn} style={primaryBtnStyle}>
          <Plus className="h-3.5 w-3.5" /> Post announcement
        </button>
      ) : undefined}
    >
      {isError && (
        <div className="glass rounded-2xl px-5 py-4 flex items-start gap-3 border border-[color:var(--neon-pink)]/30">
          <Megaphone className="h-5 w-5 text-[color:var(--neon-pink)] shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Database setup required</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Run <code className="font-mono">supabase/migrations/20260602_phase2.sql</code> in Supabase SQL editor.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <GlassCard glow="cyan" transition={{ delay: 0 }}>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="mt-2 text-3xl font-bold">{items.length}</div>
        </GlassCard>
        <GlassCard glow="violet" transition={{ delay: 0.05 }}>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pinned</div>
          <div className="mt-2 text-3xl font-bold">{items.filter((a) => a.pinned).length}</div>
        </GlassCard>
        <GlassCard glow="pink" transition={{ delay: 0.1 }}>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">This month</div>
          <div className="mt-2 text-3xl font-bold">
            {items.filter((a) => a.created_at?.slice(0, 7) === new Date().toISOString().slice(0, 7)).length}
          </div>
        </GlassCard>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              catFilter === c ? "bg-white/12 text-foreground" : "glass text-muted-foreground hover:text-foreground"
            }`}>
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 && !isError && (
        <GlassCard className="text-center py-16">
          <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/20 mb-4" />
          <div className="text-sm text-muted-foreground">
            {items.length === 0
              ? canPost ? "No announcements yet. Post the first one!" : "No announcements yet."
              : "No announcements in this category."}
          </div>
        </GlassCard>
      )}

      {pinned.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-[color:var(--neon-cyan)] flex items-center gap-1.5">
            <Pin className="h-3.5 w-3.5" /> Pinned
          </div>
          {pinned.map((a, i) => (
            <ACard key={a.id} ann={a} idx={i} canPost={canPost}
              onPin={() => pin.mutate({ id: a.id, pinned: !a.pinned })}
              onDelete={() => { if (confirm("Delete announcement?")) del.mutate(a.id); }} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-3">
          {pinned.length > 0 && <div className="text-xs uppercase tracking-wider text-muted-foreground">Latest</div>}
          {rest.map((a, i) => (
            <ACard key={a.id} ann={a} idx={i} canPost={canPost}
              onPin={() => pin.mutate({ id: a.id, pinned: !a.pinned })}
              onDelete={() => { if (confirm("Delete announcement?")) del.mutate(a.id); }} />
          ))}
        </div>
      )}

      {canPost && (
        <AnnouncementModal open={open} onClose={() => setOpen(false)} ownerId={user?.id}
          onSubmit={(v) => create.mutate(v)} saving={create.isPending} />
      )}
    </AppShell>
  );
}

function ACard({ ann, idx, canPost, onPin, onDelete }: {
  ann: Announcement; idx: number; canPost: boolean; onPin: () => void; onDelete: () => void;
}) {
  const cat = (ann.category || "General") as Category;
  const catColor = CAT_COLORS[cat] ?? CAT_COLORS.General;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
      <GlassCard className={ann.pinned ? "border border-[color:var(--neon-cyan)]/20" : ""}>
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl grid place-items-center glass shrink-0"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}>
            <Megaphone className="h-4 w-4 text-background" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{ann.title}</h3>
                  {ann.pinned && <Pin className="h-3 w-3 text-[color:var(--neon-cyan)]" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${catColor}`}>
                    <Tag className="h-2.5 w-2.5" /> {ann.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60">{relTime(ann.created_at!)}</span>
                </div>
              </div>
              {canPost && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={onPin} className="glass rounded-lg p-1.5 hover:bg-white/5 text-muted-foreground hover:text-[color:var(--neon-cyan)]" title={ann.pinned ? "Unpin" : "Pin"}>
                    {ann.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={onDelete} className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {ann.content && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function AnnouncementModal({ open, onClose, ownerId, onSubmit, saving }: {
  open: boolean; onClose: () => void; ownerId?: string; onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({ title: "", content: "", category: "General" as Category, pinned: false });
  useEffect(() => { if (open) setV({ title: "", content: "", category: "General", pinned: false }); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Post announcement">
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!ownerId) return toast.error("Not signed in");
        if (!v.title.trim()) return toast.error("Title required");
        onSubmit({ owner_id: ownerId, ...v });
      }} className="space-y-3">
        <Field label="Title">
          <input className={inputCls} required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Announcement title" />
        </Field>
        <Field label="Message">
          <textarea className={inputCls} rows={5} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} placeholder="Write your announcement…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className={inputCls} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Pin this?">
            <div className="flex items-center gap-3 h-10">
              <button type="button" onClick={() => setV({ ...v, pinned: !v.pinned })}
                className={`relative w-10 h-6 rounded-full transition-colors ${v.pinned ? "bg-[color:var(--neon-cyan)]" : "bg-white/10"}`}>
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${v.pinned ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-muted-foreground">{v.pinned ? "Pinned" : "Not pinned"}</span>
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>{saving ? "Posting…" : "Post announcement"}</button>
        </div>
      </form>
    </Modal>
  );
}
