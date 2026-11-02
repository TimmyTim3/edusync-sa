ALTER TABLE public.assessments
  ADD COLUMN checked_by uuid,
  ADD COLUMN checked_at timestamptz,
  ADD COLUMN locked_at timestamptz;

COMMENT ON COLUMN public.assessments.checked_by IS 'Principal/HOD who checked (approved) the marks';
COMMENT ON COLUMN public.assessments.checked_at IS 'When the marks were checked by the Principal/HOD';
COMMENT ON COLUMN public.assessments.locked_at IS 'When the assessment was locked; locked marks cannot be changed by teachers';

CREATE OR REPLACE FUNCTION public.prevent_marks_when_locked() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_locked timestamptz;
BEGIN
  SELECT locked_at INTO v_locked FROM public.assessments
    WHERE id = COALESCE(new.assessment_id, old.assessment_id);
  IF v_locked IS NOT NULL THEN
    RAISE EXCEPTION 'This assessment is locked by the Principal/HOD — marks can no longer be changed.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(new, old);
END $$;

CREATE TRIGGER marks_lock_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.marks
FOR EACH ROW EXECUTE FUNCTION public.prevent_marks_when_locked();

CREATE OR REPLACE FUNCTION public.guard_assessment_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.locked_at IS DISTINCT FROM old.locked_at
     OR new.checked_at IS DISTINCT FROM old.checked_at
     OR new.checked_by IS DISTINCT FROM old.checked_by THEN
    IF NOT (public.is_school_admin(new.school_id) OR public.is_platform_admin()) THEN
      RAISE EXCEPTION 'Only the Principal or HOD can check or lock assessments.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    INSERT INTO public.audit_logs (actor_id, school_id, action, details)
    VALUES (auth.uid(), new.school_id,
      CASE
        WHEN new.locked_at IS NOT NULL AND old.locked_at IS NULL THEN 'assessment_locked'
        WHEN new.locked_at IS NULL AND old.locked_at IS NOT NULL THEN 'assessment_unlocked'
        WHEN new.checked_at IS NOT NULL AND old.checked_at IS NULL THEN 'assessment_checked'
        ELSE 'assessment_status_changed'
      END,
      jsonb_build_object('assessment_id', new.id, 'title', new.title,
        'was_locked', old.locked_at, 'now_locked', new.locked_at));
  ELSIF old.locked_at IS NOT NULL AND NOT (public.is_school_admin(new.school_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'This assessment is locked — only the Principal/HOD can change it.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN new;
END $$;

CREATE TRIGGER assessment_lock_guard
BEFORE UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_lock();