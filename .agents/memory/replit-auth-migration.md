---
name: Replit Auth migration
description: How Firebase/Supabase auth was replaced with Replit Auth in TrackNova
---

# Replit Auth Migration

Firebase Phone Auth and Supabase Auth have been fully replaced with Replit Auth.

## How it works
- User identity comes from injected HTTP headers: `x-replit-user-id`, `x-replit-user-name`, `x-replit-user-profile-image`
- `server/routes.ts` → `requireUser()` reads these headers; falls back to session cookie validation
- Login flow: `/api/auth/login` → redirects to `https://replit.com/auth_with_repl_site?domain=...`
- `src/hooks/use-session.tsx` polls `/api/auth/session` to get current user
- `src/routes/auth.tsx` shows a "Log in" button that hits `/api/auth/login`

## Stub files (kept to avoid import errors)
- `src/lib/firebase.ts` — no-op stubs, returns null
- `src/lib/firebase-phone-auth.ts` — no-op stubs, throws on use

## Database schema
- All `owner_id` and `user_id` columns are `text` (not uuid) because Replit user IDs are strings

**Why:** Replit Auth uses header injection — no SDK, no tokens, no client-side secrets needed.

**How to apply:** Any new protected route should call `requireUser(req.headers)` server-side. Client uses `useSession()` hook.
