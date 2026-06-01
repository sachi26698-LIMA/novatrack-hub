---
name: AuthSync optimization
description: __root.tsx AuthSync must filter auth events — never invalidate on TOKEN_REFRESHED
---

`supabase.auth.onAuthStateChange` fires for every auth event including `TOKEN_REFRESHED`, which happens silently every hour.
If `router.invalidate()` and `queryClient.invalidateQueries()` are called on every event, the entire app re-fetches all data every hour, causing visible flicker and unnecessary Supabase reads.

**Why:** TOKEN_REFRESHED does not change the user identity or permissions — only the access token value changes. No data needs to be reloaded.

**How to apply:** Gate the invalidation behind a set of meaningful events:
```ts
const INVALIDATING_EVENTS = new Set(["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"]);
```
Only call `router.invalidate()` and `queryClient.invalidateQueries()` when the event is in that set.
