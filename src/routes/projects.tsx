import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Building2, CalendarClock, HardHat, ImagePlus, Layers, Plus, Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — TrackNova" },
      { name: "description", content: "Track project progress, assign workers, manage materials and deadlines across every site." },
    ],
  }),
  component: ProjectsPage,
});

type Status = "On track" | "At risk" | "Final QA" | "Planning";

const projects: {
  name: string; client: string; lead: string; progress: number;
  status: Status; workers: number; deadline: string; materials: number; budget: string;
  accent: string;
}[] = [
  { name: "Skyline Tower – Block A", client: "Aurora Realty", lead: "R. Mehta", progress: 78, status: "On track", workers: 142, deadline: "Aug 12", materials: 87, budget: "₹28.4Cr", accent: "var(--neon-cyan)" },
  { name: "Metro Depot Phase 2", client: "City Transit", lead: "S. Iyer", progress: 54, status: "On track", workers: 96, deadline: "Oct 04", materials: 64, budget: "₹41.2Cr", accent: "var(--neon-violet)" },
  { name: "Riverside Mall Fitout", client: "Riverside Group", lead: "A. Khan", progress: 32, status: "At risk", workers: 58, deadline: "Jul 22", materials: 38, budget: "₹14.8Cr", accent: "var(--neon-pink)" },
  { name: "Eastview Apartments", client: "Eastview LLP", lead: "P. Singh", progress: 91, status: "Final QA", workers: 22, deadline: "Jun 18", materials: 96, budget: "₹19.6Cr", accent: "var(--neon-cyan)" },
  { name: "Greenline IT Park", client: "Greenline Devs", lead: "M. Joshi", progress: 12, status: "Planning", workers: 18, deadline: "Mar 2027", materials: 4, budget: "₹62.0Cr", accent: "var(--neon-violet)" },
  { name: "Coastal Highway Bridge", client: "NHAI", lead: "D. Shah", progress: 67, status: "On track", workers: 204, deadline: "Sep 09", materials: 71, budget: "₹84.3Cr", accent: "var(--neon-pink)" },
];

const statusColor: Record<Status, string> = {
  "On track": "text-[color:var(--neon-cyan)]",
  "At risk": "text-[color:var(--neon-pink)]",
  "Final QA": "text-[color:var(--neon-violet)]",
  "Planning": "text-muted-foreground",
};

function ProjectsPage() {
  return (
    <AppShell
      eyebrow="Portfolio"
      title={<>Project <span className="neon-text">tracking</span></>}
      subtitle="Live progress, materials, photos and deadlines across every site."
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 glass rounded-xl px-3 py-2 text-xs">
            <ImagePlus className="h-3.5 w-3.5" /> Upload photos
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-primary-foreground glow-violet"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
          >
            <Plus className="h-3.5 w-3.5" /> New project
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { l: "Ongoing", v: "37", g: "cyan" as const, i: Building2 },
          { l: "Workers deployed", v: "812", g: "violet" as const, i: HardHat },
          { l: "Materials in transit", v: "146", g: "pink" as const, i: Layers },
          { l: "Avg. completion", v: "62%", g: "cyan" as const, i: CalendarClock },
        ].map((k, i) => (
          <GlassCard key={k.l} glow={k.g} transition={{ delay: i * 0.05 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                <div className="mt-2 text-2xl sm:text-3xl font-bold">{k.v}</div>
              </div>
              <div className="h-10 w-10 rounded-xl grid place-items-center glass">
                <k.i className="h-4 w-4" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p, i) => (
          <GlassCard key={p.name} transition={{ delay: i * 0.05 }}>
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: `linear-gradient(90deg, ${p.accent}, transparent)` }}
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">{p.client} · lead {p.lead}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full glass shrink-0 ${statusColor[p.status]}`}>
                {p.status}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{p.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${p.accent}, var(--neon-violet))` }}
                  initial={{ width: 0 }} animate={{ width: `${p.progress}%` }} transition={{ duration: 1.1 }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat icon={HardHat} label="Workers" value={String(p.workers)} />
              <Stat icon={Wrench} label="Materials" value={`${p.materials}%`} />
              <Stat icon={CalendarClock} label="Deadline" value={p.deadline} />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-semibold">{p.budget}</span>
            </div>
          </GlassCard>
        ))}
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="glass rounded-xl py-2.5">
      <Icon className="h-3.5 w-3.5 mx-auto text-[color:var(--neon-cyan)]" />
      <div className="mt-1 text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
