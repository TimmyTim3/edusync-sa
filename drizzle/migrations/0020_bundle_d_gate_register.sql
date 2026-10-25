CREATE TABLE public.gate_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('late_arrival','early_departure')),
  reason text NOT NULL,
  collected_by text,
  collector_relationship text,
  collector_id_checked boolean NOT NULL DEFAULT false,
  logged_at timestamptz NOT NULL DEFAULT now(),
  logged_by uuid DEFAULT auth.uid()
);
CREATE INDEX gate_logs_school_time ON public.gate_logs(school_id, logged_at DESC);
GRANT SELECT, INSERT ON public.gate_logs TO authenticated;
GRANT ALL ON public.gate_logs TO service_role;
ALTER TABLE public.gate_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read gate logs" ON public.gate_logs FOR SELECT TO authenticated
  USING (public.is_school_staff(school_id) OR public.is_platform_admin() OR student_id IN (SELECT public.my_student_ids()));
CREATE POLICY "staff write gate logs" ON public.gate_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_school_staff(school_id) AND logged_by = auth.uid());

DROP POLICY IF EXISTS "read flags" ON public.feature_flags;
CREATE POLICY "read flags" ON public.feature_flags FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);