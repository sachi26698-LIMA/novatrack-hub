import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Notification = Tables<"notifications">;
export type LeaveRequest = Tables<"leave_requests">;
export type Shift = Tables<"shifts">;
export type CompanySettings = Tables<"company_settings">;

// Announcement type (new table — gracefully handles missing table)
export interface Announcement {
  id: string;
  owner_id?: string | null;
  title: string;
  content?: string | null;
  category?: string | null;
  pinned?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ---------- NOTIFICATIONS ----------
export async function listNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function pushNotification(input: TablesInsert<"notifications">) {
  const { error } = await supabase.from("notifications").insert(input);
  if (error) throw error;
}

// ---------- ANNOUNCEMENTS ----------
export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await (supabase as any)
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return data ?? [];
}

export async function createAnnouncement(input: {
  owner_id: string;
  title: string;
  content?: string;
  category?: string;
  pinned?: boolean;
}) {
  const { error } = await (supabase as any).from("announcements").insert(input);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await (supabase as any).from("announcements").delete().eq("id", id);
  if (error) throw error;
}

export async function pinAnnouncement(id: string, pinned: boolean) {
  const { error } = await (supabase as any)
    .from("announcements")
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---------- LEAVE ----------
export async function listLeave() {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*, workers(full_name, role)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertLeave(input: TablesInsert<"leave_requests"> | (TablesUpdate<"leave_requests"> & { id?: string })) {
  if ("id" in input && input.id) {
    const { id, ...rest } = input;
    const { error } = await supabase.from("leave_requests").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("leave_requests").insert(input as TablesInsert<"leave_requests">);
    if (error) throw error;
  }
}

export async function reviewLeave(id: string, status: "Approved" | "Rejected", reviewerId: string) {
  const { error } = await supabase
    .from("leave_requests")
    .update({ status, reviewer_id: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLeave(id: string) {
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw error;
}

// ---------- SHIFTS ----------
export async function listShifts(from?: string, to?: string) {
  let q = supabase.from("shifts").select("*, workers(full_name, role)").order("shift_date", { ascending: true });
  if (from) q = q.gte("shift_date", from);
  if (to) q = q.lte("shift_date", to);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertShift(input: TablesInsert<"shifts"> | (TablesUpdate<"shifts"> & { id?: string })) {
  if ("id" in input && input.id) {
    const { id, ...rest } = input;
    const { error } = await supabase.from("shifts").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("shifts").insert(input as TablesInsert<"shifts">);
    if (error) throw error;
  }
}

export async function deleteShift(id: string) {
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) throw error;
}

// ---------- COMPANY SETTINGS ----------
export async function getCompanySettings(ownerId: string) {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCompanySettings(input: TablesInsert<"company_settings">) {
  const { error } = await supabase
    .from("company_settings")
    .upsert(input, { onConflict: "owner_id" });
  if (error) throw error;
}

export async function uploadLogo(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return data.publicUrl;
}

// ---------- PROFILE ----------
export async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId: string, input: {
  full_name?: string; phone?: string; avatar_url?: string; role?: string;
}) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...input, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

/** @deprecated use upsertProfile */
export async function updateProfile(userId: string, input: { full_name?: string; phone?: string; avatar_url?: string; role?: string }) {
  return upsertProfile(userId, input);
}
