
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_category ON public.activity_logs(category);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logs: insert own or anonymous"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Logs: select own"
ON public.activity_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Logs: admins select all"
ON public.activity_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'Admin'::public.app_role));
