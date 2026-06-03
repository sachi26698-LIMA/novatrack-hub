import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Info, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { BrandMark } from "@/components/brand";

// ── Shared layout ─────────────────────────────────────────────────────────────
interface AuthShellProps {
  children: ReactNode;
  badge?: string;
  backLink?: { to: string; label: string };
}
export function AuthShell({
  children,
  badge = "Enterprise security",
  backLink,
}: AuthShellProps) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 flex items-center justify-between">
          <BrandMark />
          {backLink && (
            <Link
              to={backLink.to as "/"}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLink.label}
            </Link>
          )}
        </div>
        <div className="mx-auto max-w-[440px] px-4 sm:px-6 pt-6 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong neon-border rounded-3xl p-7 sm:p-9 glow-violet"
          >
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground border border-white/8">
                <Sparkles className="h-3 w-3 text-[color:var(--neon-cyan)]" />
                {badge}
              </span>
            </div>
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable input ─────────────────────────────────────────────────────────────
interface AuthInputProps {
  icon: React.ElementType;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  autoComplete?: string;
  right?: ReactNode;
  onFocus?: () => void;
}
export function AuthInput({
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
  right,
}: AuthInputProps) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className="w-full rounded-xl py-3 pl-11 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground/50 disabled:opacity-50"
        style={{
          background: "rgba(255,255,255,0.055)",
          border: "1px solid rgba(255,255,255,0.11)",
          color: "var(--foreground)",
        }}
        onFocus={(e) => {
          e.target.style.border = "1px solid rgba(0,229,255,0.45)";
          e.target.style.boxShadow = "0 0 0 3px rgba(0,229,255,0.08)";
        }}
        onBlur={(e) => {
          e.target.style.border = "1px solid rgba(255,255,255,0.11)";
          e.target.style.boxShadow = "none";
        }}
      />
      {right && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">{right}</div>
      )}
    </div>
  );
}

// ── Error banner (red) ────────────────────────────────────────────────────────
export function AuthError({ msg }: { msg: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          key="err"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs overflow-hidden"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.28)",
            color: "#f87171",
          }}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>{msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Warning banner (amber) ─────────────────────────────────────────────────────
export function AuthWarning({ msg }: { msg: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          key="warn"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs overflow-hidden"
          style={{
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.28)",
            color: "#fbbf24",
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>{msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Info banner (blue) ─────────────────────────────────────────────────────────
export function AuthInfo({ msg }: { msg: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          key="info"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs overflow-hidden"
          style={{
            background: "rgba(0,229,255,0.07)",
            border: "1px solid rgba(0,229,255,0.22)",
            color: "#67e8f9",
          }}
        >
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>{msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Success banner (green) ────────────────────────────────────────────────────
export function AuthSuccess({ msg }: { msg: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          key="success"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs overflow-hidden"
          style={{
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.28)",
            color: "#4ade80",
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>{msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Primary gradient button ───────────────────────────────────────────────────
interface PrimaryBtnProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
}
export function PrimaryBtn({
  children,
  onClick,
  type = "button",
  disabled,
  loading,
}: PrimaryBtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-primary-foreground transition-all duration-200 disabled:opacity-50 hover:opacity-90 active:scale-[0.98]"
      style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))" }}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : children}
    </button>
  );
}

// ── Ghost / outline button ─────────────────────────────────────────────────────
export function GhostBtn({
  children,
  onClick,
  type = "button",
  disabled,
}: PrimaryBtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2.5 rounded-xl py-2.5 px-5 text-sm font-medium transition-all duration-200 disabled:opacity-50 hover:bg-white/[0.06] active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.11)",
        color: "var(--foreground)",
      }}
    >
      {children}
    </button>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

// ── Google logo SVG ────────────────────────────────────────────────────────────
export function GoogleLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
