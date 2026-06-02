import { createMiddleware } from "@tanstack/react-start";

// No-op: Replit Auth uses X-Replit-User-* headers automatically.
// This stub prevents import errors.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => next({}),
);
