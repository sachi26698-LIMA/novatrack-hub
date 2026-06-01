# TrackNova — Enterprise Workforce OS

A full-featured enterprise workforce management platform built with TanStack Start + React + Supabase.

## Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS v4, Framer Motion
- **Auth & Database**: Supabase (email/password, phone OTP)
- **Server functions**: TanStack Start (server functions via `createServerFn`)
- **AI**: OpenAI GPT-4o-mini for AI Insights (requires `OPENAI_API_KEY`)
- **Build**: Vite 7 with `@lovable.dev/vite-tanstack-config`

## Running the App

```bash
npm run dev
```

The app runs on port 5000.

## Environment Variables

Set in `.env` or Replit Secrets:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (public) |
| `SUPABASE_URL` | Supabase project URL (server) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (server) |
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
- Keep Supabase for auth and database — all data lives in Supabase
- Google OAuth removed (not available on Replit); use email/password or phone OTP
