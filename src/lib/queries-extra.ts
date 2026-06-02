export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type LeaveRequest = {
  id: string;
  owner_id: string;
  worker_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  workers?: { full_name: string; role: string | null } | null;
};

export type Shift = {
  id: string;
  owner_id: string;
  worker_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  workers?: { full_name: string; role: string | null } | null;
};

export type CompanySettings = {
  id: string;
  owner_id: string;
  company_name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
  theme: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

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

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------- NOTIFICATIONS ----------
export async function listNotifications(): Promise<Notification[]> {
  return apiFetch("/api/notifications");
}

export async function markNotificationRead(id: string) {
  await apiFetch(`/api/notifications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function markAllNotificationsRead() {
  await apiFetch("/api/notifications/read-all", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function pushNotification(input: { user_id: string; title: string; message?: string | null; type?: string; link?: string | null }) {
  await apiFetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ---------- ANNOUNCEMENTS ----------
export async function listAnnouncements(): Promise<Announcement[]> {
  return apiFetch("/api/announcements");
}

export async function createAnnouncement(input: {
  title: string;
  content?: string;
  category?: string;
  pinned?: boolean;
}) {
  await apiFetch("/api/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteAnnouncement(id: string) {
  await apiFetch(`/api/announcements/${id}`, { method: "DELETE" });
}

export async function pinAnnouncement(id: string, pinned: boolean) {
  await apiFetch(`/api/announcements/${id}/pin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned }),
  });
}

// ---------- LEAVE ----------
export async function listLeave(): Promise<LeaveRequest[]> {
  return apiFetch("/api/leave");
}

export async function upsertLeave(input: Partial<LeaveRequest> & { id?: string }) {
  await apiFetch("/api/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function reviewLeave(id: string, status: "Approved" | "Rejected") {
  await apiFetch(`/api/leave/${id}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteLeave(id: string) {
  await apiFetch(`/api/leave/${id}`, { method: "DELETE" });
}

// ---------- SHIFTS ----------
export async function listShifts(from?: string, to?: string): Promise<Shift[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch(`/api/shifts${params.toString() ? "?" + params.toString() : ""}`);
}

export async function upsertShift(input: Partial<Shift> & { id?: string }) {
  await apiFetch("/api/shifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteShift(id: string) {
  await apiFetch(`/api/shifts/${id}`, { method: "DELETE" });
}

// ---------- COMPANY SETTINGS ----------
export async function getCompanySettings(): Promise<CompanySettings | null> {
  return apiFetch("/api/company");
}

export async function saveCompanySettings(input: Partial<CompanySettings>) {
  await apiFetch("/api/company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function uploadLogo(_userId: string, file: File): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- PROFILE ----------
export async function getProfile(): Promise<{
  id: string; full_name: string | null; phone: string | null; avatar_url: string | null; role: string | null;
} | null> {
  return apiFetch("/api/profile");
}

export async function upsertProfile(_userId: string, input: {
  full_name?: string; phone?: string; avatar_url?: string; role?: string;
}) {
  await apiFetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateProfile(userId: string, input: { full_name?: string; phone?: string; avatar_url?: string; role?: string }) {
  return upsertProfile(userId, input);
}
