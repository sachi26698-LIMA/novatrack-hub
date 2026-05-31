
-- ENUMS
CREATE TYPE public.leave_status AS ENUM ('Pending','Approved','Rejected','Cancelled');
CREATE TYPE public.leave_type AS ENUM ('Annual','Sick','Unpaid','Casual','Other');

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notif: select own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Notif: insert any auth" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Notif: update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Notif: delete own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- LEAVE REQUESTS
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL DEFAULT 'Annual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'Pending',
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leave: owner all" ON public.leave_requests FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(),'Admin'))
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER touch_leave BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SHIFTS
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  role text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shifts: owner all" ON public.shifts FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(),'Admin'))
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER touch_shifts BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- COMPANY SETTINGS
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL DEFAULT 'My Company',
  logo_url text,
  address text,
  email text,
  phone text,
  currency text NOT NULL DEFAULT 'USD',
  theme text NOT NULL DEFAULT 'dark',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Co: owner all" ON public.company_settings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER touch_co BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- STORAGE bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos','logos', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Logos owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Logos owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Logos owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
