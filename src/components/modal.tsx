import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Modal({
  open, onClose, title, children, maxWidth = "max-w-lg",
}: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; maxWidth?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={`relative w-full ${maxWidth} glass-strong rounded-2xl p-5 max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{title}</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg glass hover:bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputCls =
  "w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-[color:var(--neon-cyan)]";

export const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-primary-foreground glow-cyan disabled:opacity-50";
export const primaryBtnStyle = {
  background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
} as const;
