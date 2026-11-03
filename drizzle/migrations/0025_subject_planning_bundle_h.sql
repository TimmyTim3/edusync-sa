-- Bundle H: FET elective streams, learner subject allocations, subject change requests

CREATE TABLE public.subject_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  grades text NOT NULL,
  subject_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.learner_subject_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  ended_on date,
  ended_reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX learner_subject_active_unique
  ON public.learner_subject_allocations (student_id, subject_id) WHERE status = 'active';
CREATE INDEX learner_subject_allocations_student_idx
  ON public.learner_subject_allocations (student_id);
CREATE INDEX learner_subject_allocations_school_status_idx
  ON public.learner_subject_allocations (school_id, status);

CREATE TABLE public.subject_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  to_subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  reason text NOT NULL,
  consent_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subject_changes_school_idx ON public.subject_changes (school_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_streams TO authenticated;
GRANT ALL ON public.subject_streams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learner_subject_allocations TO authenticated;
GRANT ALL ON public.learner_subject_allocations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_changes TO authenticated;
GRANT ALL ON public.subject_changes TO service_role;

ALTER TABLE public.subject_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_subject_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and staff read streams"
  ON public.subject_streams FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_school_staff(school_id));
CREATE POLICY "School admins manage streams"
  ON public.subject_streams FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "Staff and linked parents read allocations"
  ON public.learner_subject_allocations FOR SELECT TO authenticated
  USING (public.is_school_staff(school_id) OR public.can_see_student(student_id, school_id));
CREATE POLICY "School admins manage allocations"
  ON public.learner_subject_allocations FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "Staff and linked parents read subject changes"
  ON public.subject_changes FOR SELECT TO authenticated
  USING (public.is_school_staff(school_id) OR public.can_see_student(student_id, school_id));
CREATE POLICY "School admins manage subject changes"
  ON public.subject_changes FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
