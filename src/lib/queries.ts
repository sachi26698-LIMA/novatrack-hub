export type Worker = {
  id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
  hourly_rate: number;
  monthly_salary: number;
  avatar_url: string | null;
  status: string;
  joined_at: string;
  qr_code?: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  client: string | null;
  description: string | null;
  status: string;
  budget: number;
  spent: number;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  id: string;
  owner_id: string;
  worker_id: string;
  check_in: string;
  check_out: string | null;
  hours: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  workers?: { full_name: string; role: string | null } | null;
};

export type Payroll = {
  id: string;
  owner_id: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  base_amount: number;
  bonus: number;
  deductions: number;
  net_amount: number;
  hours_worked: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  workers?: { full_name: string; role: string | null; hourly_rate?: number } | null;
};

import { getAuthToken } from "./auth-token";

async function apiFetch(path: string, options?: RequestInit) {
  const token = await getAuthToken();
  const merged: RequestInit = { credentials: "include", ...options };
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

// ---------- WORKERS ----------
export async function listWorkers(): Promise<Worker[]> {
  return apiFetch("/api/workers");
}

export async function upsertWorker(input: Partial<Worker> & { id?: string }) {
  if (input.id) {
    await apiFetch(`/api/workers/${input.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } else {
    await apiFetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}

export async function deleteWorker(id: string) {
  await apiFetch(`/api/workers/${id}`, { method: "DELETE" });
}

// ---------- PROJECTS ----------
export async function listProjects(): Promise<Project[]> {
  return apiFetch("/api/projects");
}

export async function upsertProject(input: Partial<Project> & { id?: string }) {
  if (input.id) {
    await apiFetch(`/api/projects/${input.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } else {
    await apiFetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}

export async function deleteProject(id: string) {
  await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
}

// ---------- ATTENDANCE ----------
export async function listAttendance(limit = 200): Promise<Attendance[]> {
  return apiFetch(`/api/attendance?limit=${limit}`);
}

export async function checkInByQr(qr: string) {
  return apiFetch("/api/attendance/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qr }),
  });
}

export async function createAttendance(input: {
  worker_id: string;
  check_in?: string;
  check_out?: string | null;
  hours?: number | null;
  status?: string;
  notes?: string | null;
}) {
  return apiFetch("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateAttendance(id: string, patch: { check_out?: string; status?: string; hours?: number }) {
  await apiFetch(`/api/attendance/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

// ---------- PAYROLL ----------
export async function listPayroll(): Promise<Payroll[]> {
  return apiFetch("/api/payroll");
}

export async function createPayroll(input: {
  worker_id: string;
  period_start: string;
  period_end: string;
  base_amount: number;
  bonus?: number;
  deductions?: number;
  net_amount: number;
  hours_worked?: number;
  status?: string;
}): Promise<Payroll> {
  return apiFetch("/api/payroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function markPayrollPaid(id: string) {
  await apiFetch(`/api/payroll/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Paid" }),
  });
}

export async function deletePayroll(id: string) {
  await apiFetch(`/api/payroll/${id}`, { method: "DELETE" });
}

export async function hoursForPeriod(workerId: string, start: string, end: string): Promise<number> {
  const data = await apiFetch(`/api/attendance/hours?worker_id=${encodeURIComponent(workerId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  return data.total ?? 0;
}
