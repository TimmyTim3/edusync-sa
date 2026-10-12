CREATE TABLE public.timetable_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'exam',
  title text NOT NULL,
  grade text,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL DEFAULT '08:30',
  end_time time NOT NULL DEFAULT '11:30',
  venue text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_sessions TO authenticated;
GRANT ALL ON public.timetable_sessions TO service_role;
ALTER TABLE public.timetable_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read sessions" ON public.timetable_sessions FOR SELECT TO authenticated USING (public.is_school_member(school_id) OR public.is_platform_admin());
CREATE POLICY "staff manage sessions" ON public.timetable_sessions FOR ALL TO authenticated USING (public.is_school_staff(school_id)) WITH CHECK (public.is_school_staff(school_id));
CREATE INDEX ON public.timetable_sessions (school_id, date);

CREATE TABLE public.session_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.timetable_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_attendance TO authenticated;
GRANT ALL ON public.session_attendance TO service_role;
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own or staff" ON public.session_attendance FOR SELECT TO authenticated USING (public.is_school_staff(school_id) OR public.can_see_student(student_id, school_id));
CREATE POLICY "staff mark sessions" ON public.session_attendance FOR ALL TO authenticated USING (public.is_school_staff(school_id)) WITH CHECK (public.is_school_staff(school_id));