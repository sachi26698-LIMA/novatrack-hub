export type TaskStatus = "Todo" | "InProgress" | "Done" | "Blocked";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export type Task = {
  id: string;
  owner_id: string;
  project_id: string | null;
  worker_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  workers?: { full_name: string; role: string | null } | null;
  projects?: { name: string } | null;
};

export type TaskInsert = {
  project_id?: string | null;
  worker_id?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
};

export type AttendanceCorrection = {
  id: string;
  owner_id: string;
  attendance_id: string | null;
  worker_id: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  reviewed_at: string | null;
  created_at: string;
  workers?: { full_name: string } | null;
};

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listTasks(): Promise<Task[]> {
  return apiFetch("/api/tasks");
}

export async function createTask(input: TaskInsert): Promise<void> {
  await apiFetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInsert & { status?: TaskStatus; completed_at?: string | null }>,
): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
}

export async function markTaskDone(id: string): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Done", completed_at: new Date().toISOString() }),
  });
}

// ─── Attendance Corrections ──────────────────────────────────────────────────
export async function listCorrections(): Promise<AttendanceCorrection[]> {
  return apiFetch("/api/corrections");
}

export async function createCorrection(input: {
  attendance_id?: string | null;
  worker_id: string;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
}): Promise<void> {
  await apiFetch("/api/corrections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function reviewCorrection(id: string, status: "Approved" | "Rejected"): Promise<void> {
  await apiFetch(`/api/corrections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function createManualAttendance(input: {
  worker_id: string;
  check_in: string;
  check_out?: string | null;
  hours?: number | null;
  status: "CheckedIn" | "CheckedOut";
}): Promise<void> {
  await apiFetch("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
