import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = HTMLMotionProps<"div"> & { glow?: "cyan" | "violet" | "pink" | "none" };

export function GlassCard({ className, glow = "none", children, ...rest }: Props) {
  const glowCls =
    glow === "cyan" ? "glow-cyan" : glow === "violet" ? "glow-violet" : glow === "pink" ? "glow-pink" : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={cn("glass rounded-2xl p-5 relative overflow-hidden", glowCls, className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
