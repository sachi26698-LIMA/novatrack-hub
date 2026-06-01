import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, Building2, CalendarClock, CalendarDays, ChevronRight, Cog, FileText, Home, LogOut,
  LineChart as LineIcon, Menu, ScanLine, Search, Sparkles, UserSquare2, Users, Wallet, X,
} from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark, Logo } from "@/components/brand";
import { NotificationBell } from "@/components/notification-bell";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-log";

const NAV = [
  { i: Home, l: "Overview", to: "/dashboard" },
  { i: Users, l: "Workers", to: "/workers" },
  { i: ScanLine, l: "Attendance", to: "/attendance" },
  { i: CalendarDays, l: "Leave", to: "/leave" },
  { i: CalendarClock, l: "Shifts", to: "/shifts" },
  { i: Wallet, l: "Payroll", to: "/payroll" },
  { i: Building2, l: "Projects", to: "/projects" },
  { i: UserSquare2, l: "Clients", to: "/clients" },
  { i: FileText, l: "Invoices", to: "/invoices" },
  { i: Sparkles, l: "AI Insights", to: "/insights" },
  { i: LineIcon, l: "Reports", to: "/reports" },
  { i: Activity, l: "Activity", to: "/activity" },
  { i: Cog, l: "Settings", to: "/settings" },
] as const;

export function AppShell({
  title,
  eyebrow,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function handleLogout() {
    await logActivity("signed_out", "auth");
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen relative grid place-items-center">
        <AnimatedBackground />
        <div className="text-sm text-muted-foreground animate-pulse">Loading workspace…</div>
      </div>
    );
  }


  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col p-4 z-30">
        <div className="glass-strong rounded-2xl flex-1 p-4 flex flex-col">
          <BrandMark />
          <nav className="mt-6 space-y-1">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.to) && (n.to !== "/dashboard" || pathname === "/dashboard");
              return (
                <Link
                  key={n.l}
                  to={n.to}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "text-foreground bg-white/5 neon-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <n.i className="h-4 w-4" />
                  <span>{n.l}</span>
                  {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-[color:var(--neon-cyan)]" />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto glass rounded-xl p-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[color:var(--neon-cyan)]" />
              <span className="font-medium">AI Insights</span>
            </div>
            <p className="mt-1 text-muted-foreground">Ask AI anything about your data.</p>
          </div>
        </div>
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.aside
            initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
            className="absolute left-0 top-0 bottom-0 w-72 p-4"
          >
            <div className="glass-strong rounded-2xl h-full p-4 flex flex-col">
              <div className="flex items-center justify-between">
                <BrandMark />
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg glass">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-6 space-y-1">
                {NAV.map((n) => (
                  <Link
                    key={n.l}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
                  >
                    <n.i className="h-4 w-4" />
                    {n.l}
                  </Link>
                ))}
              </nav>
            </div>
          </motion.aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 p-4">
          <div className="glass rounded-2xl px-3 sm:px-4 py-2.5 flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg glass" onClick={() => setOpen(true)}>
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-1.5 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="hidden sm:inline text-[10px] text-muted-foreground border border-white/10 rounded px-1.5 py-0.5">⌘K</kbd>
            </div>
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 glass rounded-xl px-2.5 py-1.5">
              <div className="h-7 w-7 rounded-full grid place-items-center text-xs font-bold uppercase"
                   style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}>
                {(user.email ?? "U").charAt(0)}
              </div>
              <div className="text-xs leading-tight max-w-[140px] truncate">
                <div className="font-medium truncate">{user.user_metadata?.full_name || user.email?.split("@")[0]}</div>
                <div className="text-muted-foreground truncate">{user.email}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-xl glass hover:bg-white/5 transition" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
            <div className="sm:hidden"><Logo size={32} /></div>
          </div>
        </header>

        <main className="p-4 sm:p-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
          >
            <div>
              {eyebrow && <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--neon-cyan)]">{eyebrow}</div>}
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </motion.div>
          {children}
        </main>
      </div>
    </div>
  );
}
