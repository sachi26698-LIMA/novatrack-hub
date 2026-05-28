import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <motion.div
      whileHover={{ rotate: 8, scale: 1.05 }}
      className="relative flex items-center justify-center rounded-xl glass-strong neon-border"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-1 rounded-lg"
        style={{ background: "conic-gradient(from 90deg, var(--neon-cyan), var(--neon-violet), var(--neon-pink), var(--neon-cyan))" }}
      />
      <div className="absolute inset-[5px] rounded-md bg-background/80 backdrop-blur" />
      <span className="relative font-bold neon-text" style={{ fontSize: size * 0.45 }}>T</span>
    </motion.div>
  );
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <Logo size={size} />
      <div className="flex flex-col leading-none">
        <span className="font-bold tracking-tight text-base sm:text-lg">
          Track<span className="neon-text">Nova</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Enterprise OS</span>
      </div>
    </Link>
  );
}
