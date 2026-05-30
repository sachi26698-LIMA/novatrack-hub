import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Worker = Tables<"workers">;
export type Project = Tables<"projects">;
export type Attendance = Tables<"attendance_records">;
export type Payroll = Tables<"payroll_records">;

// ---------- WORKERS ----------
export async function listWorkers() {
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertWorker(input: TablesInsert<"workers"> | (TablesUpdate<"workers"> & { id?: string })) {
  if ("id" in input && input.id) {
    const { id, ...rest } = input;
    const { error } = await supabase.from("workers").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("workers").insert(input as TablesInsert<"workers">);
    if (error) throw error;
  }
}

export async function deleteWorker(id: string) {
  const { error } = await supabase.from("workers").delete().eq("id", id);
  if (error) throw error;
}

// ---------- PROJECTS ----------
export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertProject(input: TablesInsert<"projects"> | (TablesUpdate<"projects"> & { id?: string })) {
  if ("id" in input && input.id) {
    const { id, ...rest } = input;
    const { error } = await supabase.from("projects").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("projects").insert(input as TablesInsert<"projects">);
    if (error) throw error;
  }
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ---------- ATTENDANCE ----------
export async function listAttendance(limit = 200) {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*, workers(full_name, role)")
    .order("check_in", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function checkInByQr(qr: string, ownerId: string) {
  const { data: worker, error: werr } = await supabase
    .from("workers")
    .select("id, full_name")
    .eq("qr_code", qr)
    .maybeSingle();
  if (werr) throw werr;
  if (!worker) throw new Error("QR not recognised");

  // Look for an open check-in for this worker
  const { data: open } = await supabase
    .from("attendance_records")
    .select("id, check_in")
    .eq("worker_id", worker.id)
    .eq("status", "CheckedIn")
    .maybeSingle();

  if (open) {
    const now = new Date();
    const hours = +(
      (now.getTime() - new Date(open.check_in).getTime()) / 36e5
    ).toFixed(2);
    const { error } = await supabase
      .from("attendance_records")
      .update({ check_out: now.toISOString(), status: "CheckedOut", hours })
      .eq("id", open.id);
    if (error) throw error;
    return { worker: worker.full_name, mode: "out" as const, hours };
  }
  const { error } = await supabase.from("attendance_records").insert({
    worker_id: worker.id,
    owner_id: ownerId,
    status: "CheckedIn",
  });
  if (error) throw error;
  return { worker: worker.full_name, mode: "in" as const };
}

// ---------- PAYROLL ----------
export async function listPayroll() {
  const { data, error } = await supabase
    .from("payroll_records")
    .select("*, workers(full_name, role)")
    .order("period_end", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPayroll(input: TablesInsert<"payroll_records">) {
  const { data, error } = await supabase
    .from("payroll_records")
    .insert(input)
    .select("*, workers(full_name, role, hourly_rate)")
    .single();
  if (error) throw error;
  return data;
}

export async function markPayrollPaid(id: string) {
  const { error } = await supabase
    .from("payroll_records")
    .update({ status: "Paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePayroll(id: string) {
  const { error } = await supabase.from("payroll_records").delete().eq("id", id);
  if (error) throw error;
}

export async function hoursForPeriod(workerId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("hours")
    .eq("worker_id", workerId)
    .gte("check_in", start)
    .lte("check_in", end + "T23:59:59");
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + Number(r.hours ?? 0), 0);
}
