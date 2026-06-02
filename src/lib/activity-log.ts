export type ActivityCategory = "auth" | "data" | "general";

export async function logActivity(
  action: string,
  category: ActivityCategory = "general",
  details: Record<string, unknown> = {},
) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        category,
        details,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    });
  } catch (err) {
    console.warn("[activity-log] failed", err);
  }
}
