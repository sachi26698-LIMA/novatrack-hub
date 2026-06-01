---
name: Auth reset redirect
description: Password reset email must redirect to /reset-password, not /dashboard
---

`supabase.auth.resetPasswordForEmail` accepts a `redirectTo` URL that is embedded in the reset email link.
If that URL points to `/dashboard`, the user clicks the email, Supabase parses the recovery token, and lands on the dashboard — but the `updateUser({ password })` call is never made so the password is never changed.

**Why:** The `/reset-password` route listens for the `PASSWORD_RECOVERY` auth event and shows the new-password form. Any other route ignores that event.

**How to apply:** Always pass `redirectTo: window.location.origin + "/reset-password"` in `resetPasswordForEmail` calls.
The `/forgot-password` route is the dedicated standalone page for initiating the reset flow.
