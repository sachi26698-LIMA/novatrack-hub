---
name: Auth onConflict fix
description: user_roles upsert must use onConflict "user_id,role" — the composite unique constraint, not just "user_id"
---

The `user_roles` table has a unique constraint on `(user_id, role)` — a user can have multiple roles.
Using `onConflict: "user_id"` causes the upsert to fail silently because Postgres cannot find a matching single-column unique constraint.

**Why:** Schema was designed for multi-role support. The correct target for upsert deduplication is the composite key.

**How to apply:** Every place that calls `.upsert(..., { onConflict: ... })` on `user_roles` must use `onConflict: "user_id,role"`.
Affected files: `src/routes/auth.tsx`, `src/hooks/use-role.tsx`.
