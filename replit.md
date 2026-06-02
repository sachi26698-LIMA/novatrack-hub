# TrackNova — Enterprise Workforce OS

A full-featured enterprise workforce management platform built with TanStack Start + React + Replit PostgreSQL.

## Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS v4, Framer Motion
- **Auth**: Replit Auth (X-Replit-User-* headers via `/__replauthuser`)
- **Database**: Replit PostgreSQL (via `DATABASE_URL` env var, `pg` driver)
- **Server routes**: Custom API handlers in `server/routes.ts`, mounted in `src/server.ts`
- **AI**: OpenAI GPT-4o-mini for AI Insights (requires `OPENAI_API_KEY`)
- **Build**: Vite 7 + TanStack Start plugin

## Running the App

```bash
npm run dev
```

The app runs on port 5000.

## Environment Variables

Set in Replit Secrets (automatically provisioned):

| Variable | Description |
|---|---|
| `DATABASE_URL` | Replit PostgreSQL connection string (auto-provisioned) |
| `PGHOST` | PostgreSQL host (auto-provisioned) |
| `PGPORT` | PostgreSQL port (auto-provisioned) |
| `PGUSER` | PostgreSQL user (auto-provisioned) |
| `PGPASSWORD` | PostgreSQL password (auto-provisioned) |
| `PGDATABASE` | PostgreSQL database name (auto-provisioned) |
| `OPENAI_API_KEY` | Optional — enables AI Insights feature |

## Features

- **Workers** — profiles, QR badges, departments, hourly/salary rates
- **Attendance** — QR check-in/out, manual entry, corrections
- **Payroll** — records, bonuses, deductions, PDF slips
- **Projects** — tracking, assignments, budget
- **Tasks** — Kanban-style with priority/status
- **Leave** — requests, approvals
- **Shifts** — scheduling
- **Clients & Invoices** — billing with line items, tax
- **AI Insights** — workforce briefing via OpenAI
- **Reports** — export to XLSX/PDF
- **Activity Log** — audit trail
- **Settings** — company profile, logo, currency

## User Preferences

- Dark neon theme by default
- Auth via Replit Auth — users click "Sign in with Replit" on `/auth`
- All data stored in Replit PostgreSQL, accessed server-side only
