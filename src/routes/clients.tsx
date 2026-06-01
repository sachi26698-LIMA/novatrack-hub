import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Building2, Mail, Phone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { listClients, upsertClient, deleteClient, type Client } from "@/lib/queries-billing";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients — TrackNova" },
      { name: "description", content: "Manage your client list and billing contacts." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled: !!user });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const save = useMutation({
    mutationFn: upsertClient,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
      await logActivity(editing ? "client_updated" : "client_created", "data");
      toast.success("Client saved");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: deleteClient,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
      await logActivity("client_deleted", "data");
      toast.success("Client deleted");
    },
  });

  return (
    <AppShell
      eyebrow="Billing"
      title={<>Your <span className="neon-text">clients</span></>}
      subtitle="People and companies you invoice."
      actions={
        <button onClick={() => { setEditing(null); setOpen(true); }} className={primaryBtn} style={primaryBtnStyle}>
          <Plus className="h-3.5 w-3.5" /> New client
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {rows.length === 0 ? (
          <GlassCard><div className="text-sm text-muted-foreground text-center py-6">No clients yet.</div></GlassCard>
        ) : rows.map((c) => (
          <GlassCard key={c.id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{c.name}</div>
                {c.company && <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3" />{c.company}</div>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditing(c); setOpen(true); }} className="glass rounded-lg p-1.5 hover:bg-white/5"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => { if (confirm("Delete client?")) del.mutate(c.id); }} className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {c.email && <div className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" />{c.email}</div>}
              {c.phone && <div className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</div>}
              {c.address && <div className="line-clamp-2">{c.address}</div>}
            </div>
          </GlassCard>
        ))}
      </div>

      <ClientModal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        ownerId={user?.id}
        editing={editing}
        onSubmit={(v) => save.mutate(v)}
        saving={save.isPending}
      />
    </AppShell>
  );
}

function ClientModal({
  open, onClose, ownerId, editing, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; ownerId?: string;
  editing: Client | null;
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({ name: "", email: "", company: "", phone: "", address: "", notes: "" });
  useEffect(() => {
    if (open) setV({
      name: editing?.name ?? "",
      email: editing?.email ?? "",
      company: editing?.company ?? "",
      phone: editing?.phone ?? "",
      address: editing?.address ?? "",
      notes: editing?.notes ?? "",
    });
  }, [open, editing]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit client" : "New client"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Not signed in");
          if (!v.name) return toast.error("Name required");
          onSubmit(editing ? { id: editing.id, ...v } : { owner_id: ownerId, ...v });
        }}
        className="space-y-3"
      >
        <Field label="Name"><input className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company"><input className={inputCls} value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        </div>
        <Field label="Phone"><input className={inputCls} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
        <Field label="Billing address"><textarea rows={2} className={inputCls} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
        <Field label="Notes"><textarea rows={2} className={inputCls} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>{saving ? "Saving…" : "Save client"}</button>
        </div>
      </form>
    </Modal>
  );
}
