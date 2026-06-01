-- ============================================================
-- TrackNova — Auth Security Upgrade Migration
-- Phase 3: Database Security  |  Phase 4: User Profiles
-- ============================================================

-- ── 1. Add role column to profiles (Phase 4 requirement) ────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Worker'
    CHECK (role IN ('Admin','Manager','Supervisor','Worker'));

-- ── 2. Ensure profiles.updated_at is kept fresh ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'profiles_touch' AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER profiles_touch
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- ── 3. Ensure RLS is ON for profiles ────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies cleanly
DROP POLICY IF EXISTS "Profiles: owner read own"    ON public.profiles;
DROP POLICY IF EXISTS "Profiles: owner update own"  ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admin read all"    ON public.profiles;
DROP POLICY IF EXISTS "Profiles: service insert"    ON public.profiles;

-- Any authenticated user can read their own profile
CREATE POLICY "Profiles: owner read own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update only their own profile
CREATE POLICY "Profiles: owner update own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "Profiles: admin read all" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- Service role (triggers) can insert profiles freely
CREATE POLICY "Profiles: service insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ── 4. Auto-create profile on signup (robust upsert trigger) ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'Worker'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone      = COALESCE(EXCLUDED.phone, profiles.phone),
    role       = COALESCE(EXCLUDED.role, profiles.role),
    updated_at = now();

  -- Also seed user_roles so role lookup is instant after signup
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Worker')::app_role,
    now()
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- (Re)attach trigger — idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. Harden user_roles RLS ─────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Roles: owner read own"    ON public.user_roles;
DROP POLICY IF EXISTS "Roles: admin read all"    ON public.user_roles;
DROP POLICY IF EXISTS "Roles: admin manage all"  ON public.user_roles;

-- Any authenticated user can see their own roles
CREATE POLICY "Roles: owner read own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all roles
CREATE POLICY "Roles: admin read all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- Only Admins can insert/update/delete roles
CREATE POLICY "Roles: admin manage all" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- ── 6. Harden activity_logs RLS ──────────────────────────────────────────────
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Logs: owner read own"  ON public.activity_logs;
DROP POLICY IF EXISTS "Logs: owner insert"    ON public.activity_logs;
DROP POLICY IF EXISTS "Logs: admin read all"  ON public.activity_logs;

CREATE POLICY "Logs: owner read own" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Logs: owner insert" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Logs: admin read all" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- ── 7. Harden notifications RLS ──────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifs: owner all" ON public.notifications;

CREATE POLICY "Notifs: owner all" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 8. Indexes for auth performance ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id   ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_id          ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user   ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications(user_id);
