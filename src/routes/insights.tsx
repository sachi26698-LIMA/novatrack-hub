import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import { listWorkers, listAttendance, listPayroll, listProjects } from "@/lib/queries";
import { generateInsights } from "@/lib/ai.functions";
import { getCompanySettings } from "@/lib/queries-extra";
import { downloadInsightsBrief } from "@/lib/pdf";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — TrackNova" },
      { name: "description", content: "AI-powered workforce briefings, payroll forecasts, attrition risk and recommendations." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { user } = useSession();
  const fn = useServerFn(generateInsights);
  const [text, setText] = useState<string>("");

  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: listWorkers, enabled: !!user });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => listAttendance(200), enabled: !!user });
  const { data: payroll = [] } = useQuery({ queryKey: ["payroll"], queryFn: listPayroll, enabled: !!user });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled: !!user });
  const { data: company } = useQuery({
    queryKey: ["company", user?.id],
    queryFn: () => getCompanySettings(user!.id),
    enabled: !!user,
  });

  const run = useMutation({
    mutationFn: async () => {
      const res = await fn({
        data: {
          workers: workers.slice(0, 100),
          attendance: attendance.slice(0, 200),
          payroll: payroll.slice(0, 100),
          projects: projects.slice(0, 50),
          currency: company?.currency ?? "USD",
        },
      });
      if (!res.ok) throw new Error(res.error);
      return res.text;
    },
    onSuccess: async (t) => {
      setText(t);
      await logActivity("insights_generated", "data");
      toast.success("Briefing generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      eyebrow="Intelligence"
      title={<>AI <span className="neon-text">insights</span></>}
      subtitle="Forecasts, anomalies and risk signals powered by Lovable AI."
      actions={
        <button onClick={() => run.mutate()} disabled={run.isPending} className={primaryBtn} style={primaryBtnStyle}>
          {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {run.isPending ? "Analyzing…" : "Generate briefing"}
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: "Workers", v: workers.length, c: "var(--neon-cyan)" },
          { l: "Attendance rows", v: attendance.length, c: "var(--neon-violet)" },
          { l: "Payroll runs", v: payroll.length, c: "var(--neon-pink)" },
          { l: "Projects", v: projects.length, c: "var(--neon-cyan)" },
        ].map((s, i) => (
          <GlassCard key={s.l} transition={{ delay: i * 0.05 }}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-bold" style={{ color: s.c }}>{s.v}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        {!text && !run.isPending && (
          <div className="text-center py-12">
            <Sparkles className="h-10 w-10 mx-auto text-[color:var(--neon-cyan)] opacity-60" />
            <p className="mt-3 text-sm text-muted-foreground">Click <strong>Generate briefing</strong> to analyze your live workforce data.</p>
          </div>
        )}
        {run.isPending && (
          <div className="text-center py-12">
            <Loader2 className="h-10 w-10 mx-auto text-[color:var(--neon-cyan)] animate-spin" />
            <p className="mt-3 text-sm text-muted-foreground">AI is analyzing {workers.length} workers & {attendance.length} attendance rows…</p>
          </div>
        )}
        {text && (
          <>
            <div className="flex items-center justify-end gap-2 mb-3">
              <button
                onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}
                className="glass rounded-lg px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
              <button
                onClick={() => downloadInsightsBrief("Executive Briefing", text)}
                className="glass rounded-lg px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5"
              >
                <Download className="h-3 w-3" /> PDF
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">{text}</pre>
          </>
        )}
      </GlassCard>
    </AppShell>
  );
}
