---
name: Supabase + Firebase auth
description: Full premium auth system — Google OAuth + Email/Password via Supabase, Phone OTP via Firebase. Key architectural decisions and gotchas.
---

## Rule
The Supabase client MUST be created inside a `typeof window !== "undefined"` guard. Supabase Realtime uses WebSocket, which throws on Node.js 20 (no native WebSocket) when instantiated at SSR module-evaluation time.

**Why:** `vite dev` evaluates `src/integrations/supabase/client.ts` on the server for SSR; `createClient()` immediately sets up a RealtimeClient with WebSocket → crash on Node < 22.

**How to apply:** `makeClient()` function checks `typeof window === "undefined"` → returns `null` → falls back to no-op Proxy. See `src/integrations/supabase/client.ts`.

## Phone OTP → Supabase session
Firebase verifies the phone number; a synthetic Supabase email+password account is created from the phone:
- email: `{digitsOnly}@phone.tracknova.app`
- password: `pn_{digitsOnly}_tn1`

Try `signInWithPassword` first; if 400 → `signUp` → `signInWithPassword`.

## Auth pages
- `/auth` — Login: Google OAuth + Email/Password + Phone OTP (state machine: main → phone → otp)
- `/signup` — Sign Up: Email form + Google + Phone OTP + password strength meter
- `/forgot-password` — Supabase `resetPasswordForEmail` with redirectTo `/reset-password`
- `/reset-password` — watches `PASSWORD_RECOVERY` event; calls `supabase.auth.updateUser({ password })`

## Shared components
`src/components/auth-shell.tsx` exports: `AuthShell`, `AuthInput`, `AuthError`, `PrimaryBtn`, `GhostBtn`, `AuthDivider`, `GoogleLogo`

## Server-side JWT validation
`requireUser()` in `server/routes.ts` checks `Authorization: Bearer <token>` first via `GET {SUPABASE_URL}/auth/v1/user` with `apikey: VITE_SUPABASE_ANON_KEY`. Falls back to Replit `x-replit-user-id` headers. Uses `process.env.VITE_SUPABASE_URL` (VITE_ vars accessible server-side in Vite SSR).

## Profile sync
Every sign-in fires `syncProfile(token)` → `POST /api/auth/session` with Bearer token → server upserts `profiles` row (id, full_name, email). `profiles` table has `email text` column (added via migration).

## Required owner config
- Supabase dashboard → Auth → Providers → Google: enable + add Client ID/Secret
- Firebase console → Auth → Phone sign-in method: enable
- Supabase dashboard → Auth → URL Configuration: add `https://<replit-domain>/auth` to redirect URLs
- Firebase console → Auth → Authorized domains: add Replit domain
