import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Building2, CalendarClock, CalendarDays, Cog, FileText,
  Home, LineChart as LineIcon, ScanLine, Search, Sparkles, UserSquare2,
  Users, Wallet, X, ArrowRight, User as UserIcon, FolderKanban,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Worker, Project } from "@/lib/queries";
import type { Client } from "@/lib/queries-billing";

const NAV_ITEMS = [
  { icon: Home,         label: "Overview",    to: "/dashboard",  group: "Navigate" },
  { icon: Users,        label: "Workers",     to: "/workers",    group: "Navigate" },
  { icon: ScanLine,     label: "Attendance",  to: "/attendance", group: "Navigate" },
  { icon: CalendarDays, label: "Leave",       to: "/leave",      group: "Navigate" },
  { icon: CalendarClock,label: "Shifts",      to: "/shifts",     group: "Navigate" },
  { icon: Wallet,       label: "Payroll",     to: "/payroll",    group: "Navigate" },
  { icon: Building2,    label: "Projects",    to: "/projects",   group: "Navigate" },
  { icon: UserSquare2,  label: "Clients",     to: "/clients",    group: "Navigate" },
  { icon: FileText,     label: "Invoices",    to: "/invoices",   group: "Navigate" },
  { icon: Sparkles,     label: "AI Insights", to: "/insights",   group: "Navigate" },
  { icon: LineIcon,     label: "Reports",     to: "/reports",    group: "Navigate" },
  { icon: Activity,     label: "Activity log",to: "/activity",   group: "Navigate" },
  { icon: Cog,          label: "Settings",    to: "/settings",   group: "Navigate" },
] as const;

type Result = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  group: string;
  to: string;
  badge?: string;
};

function useCommandResults(query: string): Result[] {
  const qc = useQueryClient();

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const results: Result[] = [];

    const navMatches = NAV_ITEMS.filter(
      (n) => !q || n.label.toLowerCase().includes(q),
    );
    navMatches.forEach((n) =>
      results.push({ id: `nav-${n.to}`, icon: n.icon, label: n.label, group: "Navigate", to: n.to }),
    );

    if (q) {
      const workers = (qc.getQueryData<Worker[]>(["workers"]) ?? []).filter((w) =>
        w.full_name?.toLowerCase().includes(q) ||
        w.role?.toLowerCase().includes(q) ||
        w.department?.toLowerCase().includes(q),
      ).slice(0, 5);
      workers.forEach((w) =>
        results.push({
          id: `worker-${w.id}`,
          icon: UserIcon,
          label: w.full_name,
          sublabel: [w.role, w.department].filter(Boolean).join(" · "),
          group: "Workers",
          to: "/workers",
          badge: w.status,
        }),
      );

      const projects = (qc.getQueryData<Project[]>(["projects"]) ?? []).filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.client?.toLowerCase().includes(q),
      ).slice(0, 5);
      projects.forEach((p) =>
        results.push({
          id: `project-${p.id}`,
          icon: FolderKanban,
          label: p.name,
          sublabel: p.client ?? undefined,
          group: "Projects",
          to: "/projects",
          badge: p.status,
        }),
      );

      const clients = (qc.getQueryData<Client[]>(["clients"]) ?? []).filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q),
      ).slice(0, 4);
      clients.forEach((c) =>
        results.push({
          id: `client-${c.id}`,
          icon: UserSquare2,
          label: c.name,
          sublabel: c.company ?? c.email ?? undefined,
          group: "Clients",
          to: "/clients",
        }),
      );
    }

    return results;
  }, [query, qc]);
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useCommandResults(query);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(to: string) {
    navigate({ to: to as any });
    onClose();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      go(results[active].to);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, Result[]>();
    results.forEach((r) => {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    });
    return map;
  }, [results]);

  let globalIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-xl glass-strong neon-border rounded-2xl overflow-hidden shadow-2xl"
            style={{ boxShadow: "0 0 60px oklch(0.78 0.18 200 / 0.15), 0 25px 50px -12px oklch(0 0 0 / 0.5)" }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search pages, workers, projects…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {query && (
                <button onClick={() => setQuery("")} className="p-0.5 rounded glass hover:bg-white/10 transition">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              <kbd
                onClick={onClose}
                className="hidden sm:inline text-[10px] text-muted-foreground border border-white/10 rounded px-1.5 py-0.5 cursor-pointer hover:bg-white/5"
              >
                esc
              </kbd>
            </div>

            <ul
              ref={listRef}
              className="max-h-[min(480px,60vh)] overflow-y-auto overscroll-contain py-2"
            >
              {results.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No results for <span className="text-foreground">"{query}"</span>
                </li>
              )}

              {Array.from(groups.entries()).map(([group, items]) => (
                <li key={group}>
                  <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium">
                    {group}
                  </div>
                  <ul>
                    {items.map((item) => {
                      const idx = globalIdx++;
                      const isActive = idx === active;
                      return (
                        <li key={item.id}>
                          <button
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => go(item.to)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                              isActive ? "bg-white/8 text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className={`h-8 w-8 shrink-0 rounded-xl grid place-items-center transition-colors ${
                              isActive
                                ? "text-[color:var(--neon-cyan)]"
                                : ""
                            }`}
                              style={isActive ? { background: "oklch(0.78 0.18 200 / 0.12)" } : { background: "oklch(1 0 0 / 0.05)" }}
                            >
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className={`font-medium truncate ${isActive ? "text-foreground" : ""}`}>{item.label}</div>
                              {item.sublabel && (
                                <div className="text-[11px] text-muted-foreground truncate">{item.sublabel}</div>
                              )}
                            </div>
                            {item.badge && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded glass text-muted-foreground shrink-0">
                                {item.badge}
                              </span>
                            )}
                            {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--neon-cyan)]" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="border-t border-white/8 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/50">
              <span className="inline-flex items-center gap-1"><kbd className="border border-white/10 rounded px-1">↑↓</kbd> navigate</span>
              <span className="inline-flex items-center gap-1"><kbd className="border border-white/10 rounded px-1">↵</kbd> open</span>
              <span className="inline-flex items-center gap-1"><kbd className="border border-white/10 rounded px-1">esc</kbd> close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
