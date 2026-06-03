import { getAuthToken } from "./auth-token";

export type ActivityCategory = "auth" | "data" | "general";

export async function logActivity(
  action: string,
  category: ActivityCategory = "general",
  details: Record<string, unknown> = {},
) {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch("/api/activity", {
      method: "POST",
      headers,
      body: JSON.stringify({ action, category, details }),
    });
  } catch (err) {
    console.warn("[activity-log] failed", err);
  }
}
