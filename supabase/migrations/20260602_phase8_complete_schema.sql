-- TrackNova Phase 8: Complete Schema
-- Paste into Supabase SQL Editor and click Run.
-- Safe to re-run at any time (fully idempotent).

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMs (all idempotent)
DO $$ BEGIN CREATE TYPE public.app_role          AS ENUM ('Admin','Manager','Supervisor','Worker');             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.worker_status     AS ENUM ('Active','OnLeave','Inactive');                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.attendance_status AS ENUM ('CheckedIn','CheckedOut');                           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_status    AS ENUM ('Planning','Active','OnHold','Completed','Cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payroll_status    AS ENUM ('Draft','Approved','Paid');                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.leave_status      AS ENUM ('Pending','Approved','Rejected','Cancelled');        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.leave_type        AS ENUM ('Annual','Sick','Unpaid','Casual','Other');          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.invoice_status    AS ENUM ('Draft','Sent','Paid','Overdue','Cancelled');        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. touch_updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;

-- 3. user_roles table (must exist BEFORE has_role function)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 4. has_role() function (user_roles now exists)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;

-- user_roles RLS policies
DROP POLICY IF EXISTS "Roles: view own"          ON public.user_roles;
DROP POLICY IF EXISTS "Roles: admins view all"   ON public.user_roles;
DROP POLICY IF EXISTS "Roles: admins manage all" ON public.user_roles;
DROP POLICY IF EXISTS "Roles: owner read own"    ON public.user_roles;
DROP POLICY IF EXISTS "Roles: admin read all"    ON public.user_roles;
DROP POLICY IF EXISTS "Roles: admin manage all"  ON public.user_roles;
CREATE POLICY "Roles: owner read own"   ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Roles: admin read all"   ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Roles: admin manage all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

-- 5. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  phone      text,
  avatar_url text,
  role       text NOT NULL DEFAULT 'Worker' CHECK (role IN ('Admin','Manager','Supervisor','Worker')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Worker'
  CHECK (role IN ('Admin','Manager','Supervisor','Worker'));
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles: select own"       ON public.profiles;
DROP POLICY IF EXISTS "Profiles: update own"       ON public.profiles;
DROP POLICY IF EXISTS "Profiles: insert own"       ON public.profiles;
DROP POLICY IF EXISTS "Profiles: owner read own"   ON public.profiles;
DROP POLICY IF EXISTS "Profiles: owner update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admin read all"   ON public.profiles;
DROP POLICY IF EXISTS "Profiles: service insert"   ON public.profiles;
CREATE POLICY "Profiles: owner read own"   ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Profiles: owner update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles: service insert"   ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles: admin read all"   ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Admin'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_touch' AND tgrelid = 'public.profiles'::regclass) THEN
    CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- 6. handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'Worker'),
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone      = COALESCE(EXCLUDED.phone,     profiles.phone),
    role       = COALESCE(EXCLUDED.role,      profiles.role),
    updated_at = now();
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'Worker')::public.app_role, now())
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  action     text NOT NULL,
  category   text NOT NULL DEFAULT 'general',
  details    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Logs: insert own or anonymous" ON public.activity_logs;
DROP POLICY IF EXISTS "Logs: select own"              ON public.activity_logs;
DROP POLICY IF EXISTS "Logs: admins select all"       ON public.activity_logs;
DROP POLICY IF EXISTS "Logs: owner read own"          ON public.activity_logs;
DROP POLICY IF EXISTS "Logs: owner insert"            ON public.activity_logs;
DROP POLICY IF EXISTS "Logs: admin read all"          ON public.activity_logs;
CREATE POLICY "Logs: owner insert"   ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Logs: owner read own" ON public.activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Logs: admin read all" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Admin'));
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id    ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category   ON public.activity_logs(category);

-- 8. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  title      text NOT NULL,
  message    text,
  type       text NOT NULL DEFAULT 'info',
  link       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DROP POLICY IF EXISTS "Notif: select own"      ON public.notifications;
DROP POLICY IF EXISTS "Notif: insert any auth" ON public.notifications;
DROP POLICY IF EXISTS "Notif: update own"      ON public.notifications;
DROP POLICY IF EXISTS "Notif: delete own"      ON public.notifications;
DROP POLICY IF EXISTS "Notifs: owner all"      ON public.notifications;
CREATE POLICY "Notifs: owner all" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. workers
CREATE TABLE IF NOT EXISTS public.workers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL,
  full_name      text NOT NULL,
  email          text,
  phone          text,
  role           text,
  department     text,
  hourly_rate    numeric(10,2) NOT NULL DEFAULT 0,
  monthly_salary numeric(12,2) NOT NULL DEFAULT 0,
  avatar_url     text,
  status         public.worker_status NOT NULL DEFAULT 'Active',
  joined_at      date NOT NULL DEFAULT CURRENT_DATE,
  qr_code        text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workers: owner select" ON public.workers;
DROP POLICY IF EXISTS "Workers: owner insert" ON public.workers;
DROP POLICY IF EXISTS "Workers: owner update" ON public.workers;
DROP POLICY IF EXISTS "Workers: owner delete" ON public.workers;
CREATE POLICY "Workers: owner select" ON public.workers FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Workers: owner insert" ON public.workers FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Workers: owner update" ON public.workers FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Workers: owner delete" ON public.workers FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workers_updated' AND tgrelid = 'public.workers'::regclass) THEN
    CREATE TRIGGER trg_workers_updated BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_workers_owner ON public.workers(owner_id);

-- 10. projects
CREATE TABLE IF NOT EXISTS public.projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL,
  name        text NOT NULL,
  client      text,
  description text,
  status      public.project_status NOT NULL DEFAULT 'Planning',
  budget      numeric(14,2) NOT NULL DEFAULT 0,
  spent       numeric(14,2) NOT NULL DEFAULT 0,
  progress    int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date  date,
  end_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Projects: owner select" ON public.projects;
DROP POLICY IF EXISTS "Projects: owner insert" ON public.projects;
DROP POLICY IF EXISTS "Projects: owner update" ON public.projects;
DROP POLICY IF EXISTS "Projects: owner delete" ON public.projects;
CREATE POLICY "Projects: owner select" ON public.projects FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Projects: owner insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Projects: owner update" ON public.projects FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Projects: owner delete" ON public.projects FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_updated' AND tgrelid = 'public.projects'::regclass) THEN
    CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);

-- 11. project_assignments
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  worker_id  uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  owner_id   uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, worker_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assignments TO authenticated;
GRANT ALL ON public.project_assignments TO service_role;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PA: owner all" ON public.project_assignments;
CREATE POLICY "PA: owner all" ON public.project_assignments FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (owner_id = auth.uid());

-- 12. attendance_records
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL,
  worker_id  uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  check_in   timestamptz NOT NULL DEFAULT now(),
  check_out  timestamptz,
  status     public.attendance_status NOT NULL DEFAULT 'CheckedIn',
  hours      numeric(6,2),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Att: owner all" ON public.attendance_records;
CREATE POLICY "Att: owner all" ON public.attendance_records FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_att_owner_worker ON public.attendance_records(owner_id, worker_id, check_in DESC);

-- 13. attendance_corrections
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_id       uuid REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  worker_id           uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  requested_check_in  timestamptz,
  requested_check_out timestamptz,
  reason              text NOT NULL,
  status              text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_corrections TO authenticated;
GRANT ALL ON public.attendance_corrections TO service_role;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "corrections_owner_all"       ON public.attendance_corrections;
DROP POLICY IF EXISTS "Corrections: owner insert"   ON public.attendance_corrections;
DROP POLICY IF EXISTS "Corrections: owner read"     ON public.attendance_corrections;
DROP POLICY IF EXISTS "Corrections: manager review" ON public.attendance_corrections;
CREATE POLICY "Corrections: owner insert"   ON public.attendance_corrections FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Corrections: owner read"     ON public.attendance_corrections FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "Corrections: manager review" ON public.attendance_corrections FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'Manager'));
CREATE INDEX IF NOT EXISTS idx_corrections_owner  ON public.attendance_corrections(owner_id);
CREATE INDEX IF NOT EXISTS idx_corrections_worker ON public.attendance_corrections(worker_id);

-- 14. payroll_records
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL,
  worker_id    uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  base_amount  numeric(12,2) NOT NULL DEFAULT 0,
  bonus        numeric(12,2) NOT NULL DEFAULT 0,
  deductions   numeric(12,2) NOT NULL DEFAULT 0,
  net_amount   numeric(12,2) NOT NULL DEFAULT 0,
  hours_worked numeric(8,2)  NOT NULL DEFAULT 0,
  status       public.payroll_status NOT NULL DEFAULT 'Draft',
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_records TO authenticated;
GRANT ALL ON public.payroll_records TO service_role;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pay: owner all" ON public.payroll_records;
CREATE POLICY "Pay: owner all" ON public.payroll_records FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (owner_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payroll_updated' AND tgrelid = 'public.payroll_records'::regclass) THEN
    CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_payroll_owner_worker ON public.payroll_records(owner_id, worker_id);

-- 15. leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL,
  worker_id   uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  leave_type  public.leave_type NOT NULL DEFAULT 'Annual',
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  reason      text,
  status      public.leave_status NOT NULL DEFAULT 'Pending',
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leave: owner all" ON public.leave_requests;
CREATE POLICY "Leave: owner all" ON public.leave_requests FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (owner_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'touch_leave' AND tgrelid = 'public.leave_requests'::regclass) THEN
    CREATE TRIGGER touch_leave BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_leave_owner  ON public.leave_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_leave_worker ON public.leave_requests(worker_id);

-- 16. shifts
CREATE TABLE IF NOT EXISTS public.shifts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL,
  worker_id  uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time   time NOT NULL,
  role       text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shifts: owner all" ON public.shifts;
CREATE POLICY "Shifts: owner all" ON public.shifts FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (owner_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'touch_shifts' AND tgrelid = 'public.shifts'::regclass) THEN
    CREATE TRIGGER touch_shifts BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_shifts_owner       ON public.shifts(owner_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date        ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_worker_date ON public.shifts(worker_id, shift_date);

-- 17. tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  worker_id    uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'Todo'   CHECK (status IN ('Todo','InProgress','Done','Blocked')),
  priority     text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Urgent')),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_owner_all"  ON public.tasks;
DROP POLICY IF EXISTS "Tasks: owner all" ON public.tasks;
CREATE POLICY "Tasks: owner all" ON public.tasks FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (auth.uid() = owner_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tasks_updated_at' AND tgrelid = 'public.tasks'::regclass) THEN
    CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_tasks_owner   ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_worker  ON public.tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON public.tasks(status);

-- 18. company_settings
CREATE TABLE IF NOT EXISTS public.company_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL UNIQUE,
  company_name text NOT NULL DEFAULT 'My Company',
  logo_url     text,
  address      text,
  email        text,
  phone        text,
  currency     text NOT NULL DEFAULT 'USD',
  theme        text NOT NULL DEFAULT 'dark',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Co: owner all" ON public.company_settings;
CREATE POLICY "Co: owner all" ON public.company_settings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'touch_co' AND tgrelid = 'public.company_settings'::regclass) THEN
    CREATE TRIGGER touch_co BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- 19. clients
CREATE TABLE IF NOT EXISTS public.clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL,
  name       text NOT NULL,
  email      text,
  company    text,
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients: owner all" ON public.clients;
CREATE POLICY "Clients: owner all" ON public.clients FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (owner_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'clients_touch' AND tgrelid = 'public.clients'::regclass) THEN
    CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_clients_owner ON public.clients(owner_id);

-- 20. invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL,
  client_id      uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id     uuid,
  invoice_number text NOT NULL,
  issue_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date       date,
  status         public.invoice_status NOT NULL DEFAULT 'Draft',
  subtotal       numeric NOT NULL DEFAULT 0,
  tax_rate       numeric NOT NULL DEFAULT 0,
  tax_amount     numeric NOT NULL DEFAULT 0,
  total          numeric NOT NULL DEFAULT 0,
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, invoice_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoices: owner all" ON public.invoices;
CREATE POLICY "Invoices: owner all" ON public.invoices FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (owner_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'invoices_touch' AND tgrelid = 'public.invoices'::regclass) THEN
    CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_invoices_owner ON public.invoices(owner_id);

-- 21. invoice_items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL,
  description text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL DEFAULT 0,
  amount      numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "InvItems: owner all" ON public.invoice_items;
CREATE POLICY "InvItems: owner all" ON public.invoice_items FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- 22. Storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Logos public read"  ON storage.objects;
DROP POLICY IF EXISTS "Logos owner write"  ON storage.objects;
DROP POLICY IF EXISTS "Logos owner update" ON storage.objects;
DROP POLICY IF EXISTS "Logos owner delete" ON storage.objects;
CREATE POLICY "Logos public read"  ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Logos owner write"  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Logos owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Logos owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

SELECT 'TrackNova Phase 8 schema migration complete' AS result;
