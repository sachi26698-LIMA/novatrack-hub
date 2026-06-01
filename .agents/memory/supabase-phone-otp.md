---
name: Supabase Phone OTP
description: Real Supabase phone auth flow — requires Twilio config in Supabase project
---

# Supabase Phone OTP

Uses `supabase.auth.signInWithOtp({ phone })` and `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.

**Why:** Original was mock (showed OTP in toast). Now tries real Supabase phone auth first.

**How to apply:** If Twilio is not configured in the Supabase project, the API returns an error like "SMS provider is not configured". The `friendlyError()` function in auth.tsx maps this to a user-friendly message telling them to use email instead.

Country codes: 15 common codes in `COUNTRY_CODES` array; builds full phone as `${countryCode.code}${digits}`.
