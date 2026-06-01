import { supabase } from "@/integrations/supabase/client";

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
  owner_id: string;
  project_id?: string | null;
  worker_id?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
};

// Table might not exist yet — return empty array gracefully
function isMissingTable(code: string) {
  return code === "42P01" || code === "PGRST116" || code === "PGRST204";
}

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks" as any)
    .select("*, workers(full_name, role), projects(name)")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.code ?? "")) return [];
    throw error;
  }
  return (data ?? []) as Task[];
}

export async function createTask(input: TaskInsert): Promise<void> {
  const { error } = await supabase.from("tasks" as any).insert(input);
  if (error) throw error;
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<TaskInsert, "owner_id"> & { status?: TaskStatus; completed_at?: string | null }>,
): Promise<void> {
  const { error } = await supabase.from("tasks" as any).update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function markTaskDone(id: string): Promise<void> {
  const { error } = await supabase
    .from("tasks" as any)
    .update({ status: "Done", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Attendance corrections
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

export async function listCorrections(): Promise<AttendanceCorrection[]> {
  const { data, error } = await supabase
    .from("attendance_corrections" as any)
    .select("*, workers(full_name)")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.code ?? "")) return [];
    throw error;
  }
  return (data ?? []) as AttendanceCorrection[];
}

export async function createCorrection(input: {
  owner_id: string;
  attendance_id?: string | null;
  worker_id: string;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.from("attendance_corrections" as any).insert(input);
  if (error) throw error;
}

export async function reviewCorrection(
  id: string,
  status: "Approved" | "Rejected",
): Promise<void> {
  const { error } = await supabase
    .from("attendance_corrections" as any)
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Manual attendance entry
export async function createManualAttendance(input: {
  owner_id: string;
  worker_id: string;
  check_in: string;
  check_out?: string | null;
  hours?: number | null;
  status: "CheckedIn" | "CheckedOut";
}): Promise<void> {
  const { error } = await supabase.from("attendance_records").insert({
    owner_id: input.owner_id,
    worker_id: input.worker_id,
    check_in: input.check_in,
    check_out: input.check_out ?? null,
    hours: input.hours ?? null,
    status: input.status,
  });
  if (error) throw error;
}
