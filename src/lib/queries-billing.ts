export type Client = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  owner_id: string;
  client_id: string;
  project_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: string;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: Pick<Client, "name" | "company" | "email" | "phone" | "address"> | null;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  owner_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
};

import { getAuthToken } from "./auth-token";

async function apiFetch(path: string, options?: RequestInit) {
  const token = await getAuthToken();
  const merged: RequestInit = { ...options };
  if (token) {
    merged.headers = {
      ...(options?.headers as Record<string, string> ?? {}),
      Authorization: `Bearer ${token}`,
    };
  }
  const res = await fetch(path, merged);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------- CLIENTS ----------
export async function listClients(): Promise<Client[]> {
  return apiFetch("/api/clients");
}

export async function upsertClient(input: Partial<Client> & { id?: string }) {
  await apiFetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteClient(id: string) {
  await apiFetch(`/api/clients/${id}`, { method: "DELETE" });
}

// ---------- INVOICES ----------
export async function listInvoices(): Promise<Invoice[]> {
  return apiFetch("/api/invoices");
}

export async function getInvoiceWithItems(id: string): Promise<{ invoice: Invoice; items: InvoiceItem[] }> {
  return apiFetch(`/api/invoices/${id}/items`);
}

export type NewInvoicePayload = {
  client_id: string;
  project_id?: string | null;
  invoice_number: string;
  issue_date: string;
  due_date?: string | null;
  tax_rate: number;
  notes?: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
};

export async function createInvoice(p: NewInvoicePayload): Promise<Invoice> {
  return apiFetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
}

export async function setInvoiceStatus(id: string, status: string) {
  await apiFetch(`/api/invoices/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteInvoice(id: string) {
  await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
}

export async function nextInvoiceNumber(): Promise<string> {
  const data = await apiFetch("/api/invoices/next-number");
  return data.number;
}
