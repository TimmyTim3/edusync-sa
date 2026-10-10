CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select coalesce(auth.role(),'') = 'service_role' or exists (
    select 1 from public.platform_admins pa
    where lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
$$;
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_att_student_date ON public.attendance_records(student_id, date desc);
CREATE INDEX IF NOT EXISTS idx_att_school_date ON public.attendance_records(school_id, date);
CREATE INDEX IF NOT EXISTS idx_marks_student ON public.marks(student_id);
CREATE INDEX IF NOT EXISTS idx_beh_student ON public.behaviour_notes(student_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_hw_class ON public.homework(class_id, due_date);
CREATE INDEX IF NOT EXISTS idx_ps_parent ON public.parent_student(parent_id);
CREATE INDEX IF NOT EXISTS idx_ps_student ON public.parent_student(student_id);
CREATE INDEX IF NOT EXISTS idx_parents_user ON public.parents(user_id);
CREATE INDEX IF NOT EXISTS idx_cst_teacher ON public.class_subject_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_assess_class ON public.assessments(class_id);