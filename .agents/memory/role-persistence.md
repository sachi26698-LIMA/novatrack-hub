---
name: Role persistence strategy
description: Role reads user_roles table, falls back to user_metadata.role, auto-upserts on first login
---

# Role Persistence

`use-role.tsx` resolution order:
1. Query `user_roles` table for the user's role (prefers "Admin" if multiple)
2. If empty, read `user.user_metadata.role` (set during signup in auth.tsx)
3. Auto-upsert that metadata role into `user_roles` (fire-and-forget, no await)

**Why:** New users who sign up via email don't get a user_roles row immediately (no trigger). The metadata fallback ensures role works instantly on first login, then persists for future reads.

**How to apply:** `src/hooks/use-role.tsx` — the upsert uses `onConflict: "user_id"` so re-running is safe. Also in auth.tsx `onAuthStateChange`, on SIGNED_IN event we upsert `user_metadata.role` into user_roles.
