import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, FileText, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, Modal, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import {
  listInvoices, createInvoice, setInvoiceStatus, deleteInvoice, nextInvoiceNumber,
  getInvoiceWithItems, type Invoice,
} from "@/lib/queries-billing";
import { listClients } from "@/lib/queries-billing";
import { listProjects } from "@/lib/queries";
import { getCompanySettings } from "@/lib/queries-extra";
import { downloadInvoice } from "@/lib/pdf";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — TrackNova" },
      { name: "description", content: "Create, track, and export invoices for your clients." },
    ],
  }),
  component: InvoicesPage,
});

const STATUS_COLORS: Record<string, string> = {
  Draft: "text-muted-foreground",
  Sent: "text-[color:var(--neon-violet)]",
  Paid: "text-[color:var(--neon-cyan)]",
  Overdue: "text-[color:var(--neon-pink)]",
  Cancelled: "text-muted-foreground line-through",
};

function InvoicesPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["invoices"], queryFn: listInvoices, enabled: !!user });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled: !!user });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled: !!user });
  const { data: company } = useQuery({
    queryKey: ["company", user?.id],
    queryFn: () => getCompanySettings(user!.id),
    enabled: !!user,
  });
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: createInvoice,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      await logActivity("invoice_created", "data");
      toast.success("Invoice created");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Invoice["status"] }) => setInvoiceStatus(id, status),
    onSuccess: async (_, v) => {
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      await logActivity(`invoice_${v.status.toLowerCase()}`, "data");
      toast.success(`Marked ${v.status}`);
    },
  });

  const del = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  async function exportPdf(id: string) {
    if (!company) return toast.error("Set company settings first");
    const { invoice, items } = await getInvoiceWithItems(id);
    const c = invoice.clients;
    downloadInvoice({
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      company: {
        name: company.company_name,
        address: company.address,
        email: company.email,
        phone: company.phone,
        logoUrl: company.logo_url,
        currency: company.currency,
      },
      client: { name: c?.name ?? "", company: c?.company, email: c?.email, address: c?.address },
      items: items.map((i) => ({
        description: i.description, quantity: Number(i.quantity),
        unit_price: Number(i.unit_price), amount: Number(i.amount),
      })),
      subtotal: Number(invoice.subtotal),
      taxRate: Number(invoice.tax_rate),
      taxAmount: Number(invoice.tax_amount),
      total: Number(invoice.total),
      notes: invoice.notes,
    });
  }

  const stats = useMemo(() => {
    const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.total), 0);
    return [
      { l: "Total", v: rows.length, c: "var(--neon-cyan)" },
      { l: "Outstanding", v: (sum("Sent") + sum("Overdue")).toFixed(0), c: "var(--neon-pink)" },
      { l: "Paid", v: sum("Paid").toFixed(0), c: "var(--neon-violet)" },
      { l: "Drafts", v: rows.filter((r) => r.status === "Draft").length, c: "var(--neon-cyan)" },
    ];
  }, [rows]);

  const currency = company?.currency ?? "USD";

  return (
    <AppShell
      eyebrow="Billing"
      title={<>Invoices <span className="neon-text">& payments</span></>}
      subtitle="Track every invoice from draft to paid."
      actions={
        <button onClick={() => setOpen(true)} disabled={clients.length === 0} className={primaryBtn} style={primaryBtnStyle}>
          <Plus className="h-3.5 w-3.5" /> New invoice
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

      {clients.length === 0 && (
        <GlassCard><div className="text-sm text-muted-foreground text-center py-4">Add a client first to create invoices.</div></GlassCard>
      )}

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Issue</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3 text-right">Total</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No invoices yet.</td></tr>
              ) : rows.map((r: any) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.invoice_number}</td>
                  <td className="py-2.5 pr-3 font-medium">{r.clients?.name ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{r.issue_date}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{r.due_date ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold">{currency} {Number(r.total).toFixed(2)}</td>
                  <td className={`py-2.5 pr-3 ${STATUS_COLORS[r.status]}`}>{r.status}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => exportPdf(r.id)} className="glass rounded-lg p-1.5 hover:bg-white/5" title="Download PDF">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      {r.status !== "Paid" && (
                        <button onClick={() => setStatus.mutate({ id: r.id, status: "Paid" })}
                          className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-cyan)]" title="Mark paid">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {r.status === "Draft" && (
                        <button onClick={() => setStatus.mutate({ id: r.id, status: "Sent" })}
                          className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-violet)]" title="Mark sent">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {r.status !== "Cancelled" && r.status !== "Paid" && (
                        <button onClick={() => setStatus.mutate({ id: r.id, status: "Cancelled" })}
                          className="glass rounded-lg p-1.5 hover:bg-white/5 text-muted-foreground" title="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => { if (confirm("Delete invoice?")) del.mutate(r.id); }}
                        className="glass rounded-lg p-1.5 hover:bg-white/5 text-[color:var(--neon-pink)]">
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

      <InvoiceModal
        open={open}
        onClose={() => setOpen(false)}
        ownerId={user?.id}
        clients={clients}
        projects={projects}
        currency={currency}
        onSubmit={(v) => create.mutate(v)}
        saving={create.isPending}
      />
    </AppShell>
  );
}

function InvoiceModal({
  open, onClose, ownerId, clients, projects, currency, onSubmit, saving,
}: {
  open: boolean; onClose: () => void; ownerId?: string;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  currency: string;
  onSubmit: (v: any) => void; saving: boolean;
}) {
  const [v, setV] = useState({
    client_id: "", project_id: "", invoice_number: "",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: "", tax_rate: 0, notes: "",
  });
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);

  useEffect(() => {
    if (open && ownerId) {
      nextInvoiceNumber(ownerId).then((n) =>
        setV((s) => ({ ...s, client_id: clients[0]?.id ?? "", invoice_number: n }))
      );
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    }
  }, [open, ownerId, clients]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmount = +(subtotal * (v.tax_rate / 100)).toFixed(2);
  const total = +(subtotal + taxAmount).toFixed(2);

  return (
    <Modal open={open} onClose={onClose} title="New invoice" maxWidth="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Not signed in");
          if (!v.client_id) return toast.error("Pick a client");
          if (items.some((i) => !i.description)) return toast.error("Item descriptions required");
          onSubmit({
            owner_id: ownerId,
            client_id: v.client_id,
            project_id: v.project_id || null,
            invoice_number: v.invoice_number,
            issue_date: v.issue_date,
            due_date: v.due_date || null,
            tax_rate: Number(v.tax_rate),
            notes: v.notes || null,
            items,
          });
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client">
            <select className={inputCls} value={v.client_id} onChange={(e) => setV({ ...v, client_id: e.target.value })}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Project (optional)">
            <select className={inputCls} value={v.project_id} onChange={(e) => setV({ ...v, project_id: e.target.value })}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Invoice #"><input className={inputCls} value={v.invoice_number} onChange={(e) => setV({ ...v, invoice_number: e.target.value })} /></Field>
          <Field label="Issue date"><input type="date" className={inputCls} value={v.issue_date} onChange={(e) => setV({ ...v, issue_date: e.target.value })} /></Field>
          <Field label="Due date"><input type="date" className={inputCls} value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} /></Field>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Line items</div>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <input placeholder="Description" className={`${inputCls} col-span-6`} value={it.description}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
              <input type="number" min="0" step="0.01" placeholder="Qty" className={`${inputCls} col-span-2`} value={it.quantity}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
              <input type="number" min="0" step="0.01" placeholder="Unit price" className={`${inputCls} col-span-3`} value={it.unit_price}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) } : x))} />
              <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))}
                className="glass rounded-lg col-span-1 grid place-items-center hover:bg-white/5 text-[color:var(--neon-pink)]" disabled={items.length === 1}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0 }])}
            className="glass rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
            <Plus className="h-3 w-3" /> Add line
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tax rate (%)">
            <input type="number" min="0" step="0.01" className={inputCls} value={v.tax_rate}
              onChange={(e) => setV({ ...v, tax_rate: Number(e.target.value) })} />
          </Field>
          <div className="glass rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{currency} {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{currency} {taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-[color:var(--neon-cyan)] pt-1 border-t border-white/5"><span>Total</span><span>{currency} {total.toFixed(2)}</span></div>
          </div>
        </div>

        <Field label="Notes"><textarea rows={2} className={inputCls} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-xl px-3 py-2 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtn} style={primaryBtnStyle}>{saving ? "Creating…" : "Create invoice"}</button>
        </div>
      </form>
    </Modal>
  );
}
