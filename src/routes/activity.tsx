import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Activity, Filter, Shield, User as UserIcon, Database, LogIn } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useRole } from "@/hooks/use-role";
import { getAuthToken } from "@/lib/auth-token";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity log — TrackNova" },
      { name: "description", content: "Audit trail of authentication and data events across your workspace." },
    ],
  }),
  component: ActivityPage,
});

type LogRow = {
  id: string;
  user_id: string | null;
  action: string;
  category: string;
  details: Record<string, unknown>;
  created_at: string;
};

const CATEGORIES = ["all", "auth", "data", "general"] as const;
type Cat = (typeof CATEGORIES)[number];

function categoryIcon(c: string) {
  if (c === "auth") return LogIn;
  if (c === "data") return Database;
  return Activity;
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ActivityPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<Cat>("all");

  useEffect(() => {
    if (roleLoading) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (cat !== "all") params.set("category", cat);
    getAuthToken().then((token) => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`/api/activity_logs?${params}`, { headers });
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setLogs(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cat, roleLoading]);

  return (
    <AppShell
      eyebrow="Audit & Compliance"
      title="Activity log"
      subtitle={isAdmin ? "Workspace-wide events. Admin view." : "Your recent activity in TrackNova."}
      actions={
        <div className="glass rounded-xl p-1 flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition ${
                cat === c ? "text-foreground bg-white/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Events shown" value={logs.length} icon={Activity} />
        <StatCard label="View scope" value={isAdmin ? "All users" : "You"} icon={isAdmin ? Shield : UserIcon} />
        <StatCard label="Filter" value={cat === "all" ? "Everything" : cat} icon={Filter} />
      </div>

      <div className="glass-strong rounded-2xl p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading events…</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No events yet.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {logs.map((log, i) => {
              const Icon = categoryIcon(log.category);
              return (
                <motion.li
                  key={log.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.3) }}
                  className="py-3 flex items-start gap-3"
                >
                  <div className="h-9 w-9 shrink-0 rounded-xl glass grid place-items-center">
                    <Icon className="h-4 w-4 text-[color:var(--neon-cyan)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{log.action.replace(/_/g, " ")}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md glass text-muted-foreground">
                        {log.category}
                      </span>
                      {isAdmin && log.user_id && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {log.user_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    {Object.keys(log.details ?? {}).length > 0 && (
                      <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(log.details, null, 0)}
                      </pre>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{relTime(log.created_at)}</div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl grid place-items-center"
        style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}>
        <Icon className="h-4 w-4 text-primary-foreground" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-lg font-semibold capitalize">{value}</div>
      </div>
    </div>
  );
}
