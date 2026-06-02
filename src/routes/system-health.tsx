import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Shield,
  Database,
  Key,
  Cpu,
  Flame,
  Layers,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/system-health")({
  head: () => ({
    meta: [{ title: "System Health — TrackNova" }],
  }),
  component: SystemHealth,
});

interface HealthCheck {
  ok: boolean;
  message: string;
}

interface HealthResponse {
  ok: boolean;
  checks: {
    database: HealthCheck;
    auth: HealthCheck;
    env: HealthCheck;
    replitAuth: HealthCheck;
    firebase: HealthCheck;
    supabase: HealthCheck;
    openai: HealthCheck;
  };
  timestamp: string;
}

const CHECK_META: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  database: {
    label: "Database",
    icon: Database,
    description: "Replit PostgreSQL connection",
  },
  auth: {
    label: "Auth Working",
    icon: Shield,
    description: "Current session status",
  },
  env: {
    label: "Environment Variables",
    icon: Key,
    description: "Required secrets present",
  },
  replitAuth: {
    label: "Replit Auth",
    icon: Cpu,
    description: "Header-based authentication system",
  },
  firebase: {
    label: "Firebase",
    icon: Flame,
    description: "Legacy auth (migrated to Replit Auth)",
  },
  supabase: {
    label: "Supabase",
    icon: Layers,
    description: "Legacy DB (migrated to Replit PostgreSQL)",
  },
  openai: {
    label: "AI Insights",
    icon: Sparkles,
    description: "OpenAI API key for AI features",
  },
};

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" /> OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400">
      <XCircle className="h-3.5 w-3.5" /> FAIL
    </span>
  );
}

function CheckRow({
  id,
  check,
  index,
}: {
  id: string;
  check: HealthCheck;
  index: number;
}) {
  const meta = CHECK_META[id] ?? {
    label: id,
    icon: CheckCircle2,
    description: "",
  };
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass flex items-center gap-4 rounded-xl p-4"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          check.ok ? "bg-emerald-500/15" : "bg-red-500/15"
        }`}
      >
        <Icon
          className={`h-5 w-5 ${check.ok ? "text-emerald-400" : "text-red-400"}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {meta.label}
          </span>
          <StatusBadge ok={check.ok} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {check.message}
        </p>
        {meta.description && (
          <p className="text-xs text-muted-foreground/60">{meta.description}</p>
        )}
      </div>
    </motion.div>
  );
}

function SystemHealth() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } =
    useQuery<HealthResponse>({
      queryKey: ["system-health"],
      queryFn: async () => {
        const res = await fetch("/api/system-health", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Health check failed");
        return res.json();
      },
      refetchInterval: 30_000,
    });

  const passCount = data
    ? Object.values(data.checks).filter((c) => c.ok).length
    : 0;
  const totalCount = data ? Object.values(data.checks).length : 0;
  const allOk = data?.ok ?? false;

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isLoading
                  ? "bg-yellow-400"
                  : allOk
                    ? "bg-emerald-400"
                    : "bg-red-400"
              } animate-pulse`}
            />
            {isLoading ? "Checking…" : allOk ? "All systems operational" : "Issues detected"}
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            System{" "}
            <span className="neon-text">Health</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live status of TrackNova's infrastructure and integrations.
          </p>
        </motion.div>

        {/* Summary card */}
        {data && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`glass mb-6 flex items-center justify-between rounded-2xl p-5 ${
              allOk ? "neon-border" : ""
            }`}
          >
            <div>
              <p className="text-sm text-muted-foreground">Checks passing</p>
              <p className="text-4xl font-bold tabular-nums text-foreground">
                {passCount}
                <span className="text-xl text-muted-foreground">
                  /{totalCount}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Last checked</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(data.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </motion.div>
        )}

        {/* Check rows */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {data &&
              Object.entries(data.checks).map(([id, check], i) => (
                <CheckRow key={id} id={id} check={check} index={i} />
              ))}
          </div>
        )}

        {/* Refresh */}
        <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground">
          <span>Auto-refreshes every 30 seconds</span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Report */}
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="glass mt-8 rounded-2xl p-5 text-xs"
          >
            <p className="mb-3 font-semibold uppercase tracking-widest text-muted-foreground">
              Final Report
            </p>
            <div className="space-y-1.5 font-mono text-muted-foreground">
              {Object.entries(data.checks).map(([id, check]) => (
                <div key={id} className="flex items-start gap-2">
                  <span
                    className={
                      check.ok ? "text-emerald-400" : "text-red-400"
                    }
                  >
                    {check.ok ? "✓" : "✗"}
                  </span>
                  <span className="w-32 shrink-0 text-foreground/70">
                    {CHECK_META[id]?.label ?? id}
                  </span>
                  <span>{check.message}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
