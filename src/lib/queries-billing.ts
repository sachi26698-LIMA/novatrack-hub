import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type Invoice = Tables<"invoices"> & {
  clients?: Pick<Client, "name" | "company" | "email" | "phone" | "address"> | null;
};
export type InvoiceItem = Tables<"invoice_items">;

// ---------- CLIENTS ----------
export async function listClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertClient(
  input: TablesInsert<"clients"> | (TablesUpdate<"clients"> & { id?: string }),
) {
  if ("id" in input && input.id) {
    const { id, ...rest } = input;
    const { error } = await supabase.from("clients").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("clients").insert(input as TablesInsert<"clients">);
    if (error) throw error;
  }
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ---------- INVOICES ----------
export async function listInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(name, company, email)")
    .order("issue_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInvoiceWithItems(id: string) {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, clients(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: items, error: ierr } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });
  if (ierr) throw ierr;
  return { invoice, items: items ?? [] };
}

export type NewInvoicePayload = {
  owner_id: string;
  client_id: string;
  project_id?: string | null;
  invoice_number: string;
  issue_date: string;
  due_date?: string | null;
  tax_rate: number;
  notes?: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
};

export async function createInvoice(p: NewInvoicePayload) {
  const subtotal = p.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax_amount = +(subtotal * (p.tax_rate / 100)).toFixed(2);
  const total = +(subtotal + tax_amount).toFixed(2);
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      owner_id: p.owner_id,
      client_id: p.client_id,
      project_id: p.project_id ?? null,
      invoice_number: p.invoice_number,
      issue_date: p.issue_date,
      due_date: p.due_date ?? null,
      tax_rate: p.tax_rate,
      subtotal,
      tax_amount,
      total,
      notes: p.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  const rows = p.items.map((i) => ({
    invoice_id: inv.id,
    owner_id: p.owner_id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    amount: +(i.quantity * i.unit_price).toFixed(2),
  }));
  const { error: ierr } = await supabase.from("invoice_items").insert(rows);
  if (ierr) throw ierr;
  return inv;
}

export async function setInvoiceStatus(id: string, status: Invoice["status"]) {
  const patch: Partial<Invoice> = { status };
  if (status === "Paid") patch.paid_at = new Date().toISOString();
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export async function nextInvoiceNumber(ownerId: string) {
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.invoice_number;
  const m = last?.match(/(\d+)$/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return `INV-${String(n).padStart(4, "0")}`;
}
