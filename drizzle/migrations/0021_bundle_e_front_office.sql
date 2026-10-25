ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'clerk';

CREATE OR REPLACE FUNCTION public.is_front_office(_school uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.school_id = _school AND ur.role::text IN ('clerk','school_admin'));
END $$;

CREATE POLICY "front office read students" ON public.students FOR SELECT TO authenticated USING (public.is_front_office(school_id));
CREATE POLICY "front office read classes" ON public.classes FOR SELECT TO authenticated USING (public.is_front_office(school_id));
CREATE POLICY "front office manage parents" ON public.parents FOR ALL TO authenticated USING (public.is_front_office(school_id)) WITH CHECK (public.is_front_office(school_id));
CREATE POLICY "front office manage links" ON public.parent_student FOR ALL TO authenticated USING (public.is_front_office(school_id)) WITH CHECK (public.is_front_office(school_id));
CREATE POLICY "front office read gate" ON public.gate_logs FOR SELECT TO authenticated USING (public.is_front_office(school_id));
CREATE POLICY "front office log gate" ON public.gate_logs FOR INSERT TO authenticated WITH CHECK (public.is_front_office(school_id) AND logged_by = auth.uid());
CREATE POLICY "front office read notices" ON public.notices FOR SELECT TO authenticated USING (public.is_front_office(school_id));

CREATE TABLE public.absence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  absence_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  reported_by text,
  channel text NOT NULL DEFAULT 'phone',
  logged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX absence_reports_school_date ON public.absence_reports (school_id, absence_date DESC);
GRANT SELECT, INSERT ON public.absence_reports TO authenticated;
GRANT ALL ON public.absence_reports TO service_role;
ALTER TABLE public.absence_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read absence reports" ON public.absence_reports FOR SELECT TO authenticated USING (public.is_school_staff(school_id) OR public.is_front_office(school_id) OR public.is_platform_admin());
CREATE POLICY "front office log absence" ON public.absence_reports FOR INSERT TO authenticated WITH CHECK ((public.is_front_office(school_id) OR public.is_school_staff(school_id)) AND logged_by = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.absence_reports;