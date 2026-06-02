import { createMiddleware } from "@tanstack/react-start";

// No-op: Replit Auth uses X-Replit-User-* headers automatically.
// Server routes in server/routes.ts use requireUser(headers) instead.
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => next({}),
);
