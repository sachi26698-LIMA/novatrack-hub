# Phase 4 — Intelligence, Billing & Hardening

Phase 1–3 already shipped: auth (email + Google + phone OTP UI + forgot password), workers/attendance/payroll/projects, notifications, leave, shifts, advanced reports, settings & branding, activity log, roles. Phase 4 builds the layer on top.

## Scope (4 tracks, shipped in order)

### 1. AI Insights & Forecasting
- New route `/insights` with Lovable AI Gateway (`google/gemini-2.5-flash`) — no API key needed.
- Server function `generateInsights` that pulls workers + attendance + payroll + projects, sends a structured prompt, returns:
  - Payroll forecast (next month projection)
  - Attendance anomalies (workers with sudden drops)
  - Attrition risk list
  - Executive summary paragraph
- Streamed response into a glass card with copy-to-clipboard + "Export PDF brief".

### 2. Client Portal & Invoicing
- New tables: `clients`, `invoices`, `invoice_items` (with RLS scoped to `owner_id`).
- `/clients` — CRUD for clients (name, email, company, billing address).
- `/invoices` — create invoice tied to a project, line items, auto-calc totals + tax, status (Draft/Sent/Paid/Overdue).
- PDF invoice generator (`jsPDF`) with company logo from settings.
- "Mark as paid" + payment date tracking.

### 3. Mobile Worker Self-Service View
- New route `/me` — worker-facing dashboard (resolves by matching `auth.user.email` to `workers.email`).
- Shows: own attendance log, upcoming shifts, leave balance, recent payslips (download PDF), submit leave request.
- Mobile-first layout, no admin chrome.
- Add a "Worker view" link in app shell visible only to non-admin/non-manager users.

### 4. Audit, Compliance & 2FA
- Enable Supabase TOTP MFA in settings page (enroll/verify/disable).
- Activity log: add export-to-CSV button (admin only).
- Add GDPR-style "Export my data" (zip JSON of all user-owned rows) and "Delete account" server functions.
- Tighten activity logging: cover invoice events, client edits, MFA changes.

## Database migration (single migration)

```text
clients(owner_id, name, email, company, address, phone, notes)
invoices(owner_id, client_id, project_id?, invoice_number, issue_date,
         due_date, status, subtotal, tax_rate, tax_amount, total,
         paid_at, notes)
invoice_items(invoice_id, description, quantity, unit_price, amount)
```
- RLS: owner-scoped + admin-bypass via `has_role`.
- GRANTs to `authenticated` + `service_role`.
- Auto-increment invoice number per owner via trigger.

## Technical notes
- AI calls go through `createServerFn` + `LOVABLE_API_KEY` (already set).
- Reuse existing `Modal`, `GlassCard`, `primaryBtn` patterns.
- Reuse `src/lib/pdf.ts` (extend with `generateInvoicePDF`, `generateInsightsBriefPDF`).
- Reuse `src/lib/xlsx-export.ts` for activity log CSV.
- Navigation: add Insights, Clients, Invoices to sidebar; "My view" link conditional on role.

## Out of scope (defer)
- Real payment processing (Stripe) — only status tracking.
- Email sending of invoices — download only for now.
- Worker login as separate auth role — workers use existing auth, matched by email.

Estimated 4 sub-phases; I'll ship them sequentially in one continuous build, surfacing the migration first for your approval.