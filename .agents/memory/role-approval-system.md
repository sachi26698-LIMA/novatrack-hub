---
name: Role + Approval System
description: Worker/Supervisor/Admin roles with approval workflow. Covers DB, server endpoints, signup flow, routing.
---

## Rule
Worker role = immediate dashboard access. Supervisor/Admin = pending until an Admin approves via PUT /api/admin/approvals/:id.

**Why:** Enterprise compliance — privileged accounts must be human-reviewed before accessing sensitive data.

**How to apply:**
- Signup page sets `role` in Supabase `user_metadata` → server reads `metaRole` from JWT and creates `approval_requests` row on first login.
- `use-session.tsx` fetches `/api/auth/profile` after SIGNED_IN → returns `{ profile, approvalStatus }`.
- `AppShell` redirects to `/pending-approval` when `approvalStatus === "pending"`.

## DB Tables

### `approval_requests`
```
id uuid PK, user_id text, full_name text, email text, phone text,
role_requested text, status text CHECK('pending','approved','rejected'),
reviewed_by text, reviewed_at timestamptz, notes text,
created_at timestamptz, updated_at timestamptz
```

### `profiles` role column
CHECK constraint: `Admin`, `Manager`, `Supervisor`, `Worker`.
`role` defaults to `Worker` on insert; NOT updated on conflict (preserves approved role).

## Server Endpoints
- `GET /api/auth/profile` — returns `{ profile, approvalStatus }` (latest approval_requests status)
- `GET /api/admin/approvals?status=pending` — Admin/Manager only
- `PUT /api/admin/approvals/:id` — body `{ status: 'approved'|'rejected', notes? }` → also updates profiles.role on approve

## Signup Flow
1. User selects role (Worker/Supervisor/Admin) in RoleCard selector
2. `supabase.auth.signUp({ options: { data: { role, full_name, phone } } })`
3. Supabase sends confirmation email → show "verify email" view (role-specific copy)
4. After email click → SIGNED_IN event → `syncAndFetchProfile` → server creates `approval_request` (if role ≠ Worker)
5. AppShell detects `approvalStatus === "pending"` → redirect to `/pending-approval`

## Pending Approval Page (`/src/routes/pending-approval.tsx`)
- Standalone page (NOT wrapped in AppShell — no sidebar)
- Shows role badge, animated clock, account info
- Polls every 45s via `refreshProfile()` from useSession
- Manual "Check status" button
- If `approvalStatus === "approved"` → auto-redirect to `/dashboard`
- If `approvalStatus === "rejected"` → shows rejection state with option to sign up as Worker

## useSession additions
New exports: `role: string | null`, `approvalStatus: ApprovalStatus`, `refreshProfile: () => Promise<void>`
Loading stays true until BOTH user AND profile are fetched (avoids premature redirect flicker).
