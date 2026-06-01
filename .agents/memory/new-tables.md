---
name: New Supabase tables
description: tasks and attendance_corrections tables do not exist in Supabase by default — require SQL migration
---

# New Tables Requiring Migration

Both `tasks` and `attendance_corrections` are NOT in the original Supabase schema.

**Migration file:** `supabase/migrations/20260601_upgrade.sql`

User must run this in Supabase SQL Editor: https://supabase.com/dashboard/project/<id>/sql/new

**Why:** Cannot create Supabase tables via JS client (only data operations). Cannot use Replit's executeSql (hits Replit Postgres, not Supabase). Only path is user running DDL in Supabase dashboard or via management API.

**How to apply:** All queries in `src/lib/queries-tasks.ts` catch PostgreSQL error code `42P01` (relation does not exist) and return empty arrays gracefully. The tasks page shows a setup banner when `isError` is true. Correction/task creation toasts a clear message if table missing.
