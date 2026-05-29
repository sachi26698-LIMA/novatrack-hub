import { supabase } from "@/integrations/supabase/client";

export type ActivityCategory = "auth" | "data" | "general";

export async function logActivity(
  action: string,
  category: ActivityCategory = "general",
  details: Record<string, unknown> = {},
  userId?: string | null,
) {
  try {
    let uid = userId;
    if (uid === undefined) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? null;
    }
    await supabase.from("activity_logs").insert({
      user_id: uid,
      action,
      category,
      details: details as never,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch (err) {
    console.warn("[activity-log] failed", err);
  }
}
