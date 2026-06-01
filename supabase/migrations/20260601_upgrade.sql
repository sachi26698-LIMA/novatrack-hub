-- TrackNova Enterprise Upgrade — run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/<your-project>/sql/new

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  worker_id       UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'Todo'
                  CHECK (status IN ('Todo','InProgress','Done','Blocked')),
  priority        TEXT NOT NULL DEFAULT 'Medium'
                  CHECK (priority IN ('Low','Medium','High','Urgent')),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_owner_all" ON public.tasks;
CREATE POLICY "tasks_owner_all" ON public.tasks
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ATTENDANCE CORRECTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_id         UUID REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  worker_id             UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  requested_check_in    TIMESTAMPTZ,
  requested_check_out   TIMESTAMPTZ,
  reason                TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending','Approved','Rejected')),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corrections_owner_all" ON public.attendance_corrections;
CREATE POLICY "corrections_owner_all" ON public.attendance_corrections
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ============================================================
-- MANUAL ATTENDANCE ENTRY (ensure owner_id column exists)
-- ============================================================
-- If your attendance_records table doesn't have owner_id yet, add it:
-- ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
