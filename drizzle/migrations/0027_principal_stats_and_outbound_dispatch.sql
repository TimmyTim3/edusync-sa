-- Bundle N/O: principal dashboard aggregate and safe outbound dispatch claims.
-- Additive and tenant-scoped. The service-role claim function is not callable by authenticated clients.

CREATE INDEX IF NOT EXISTS idx_attendance_school_date_status
  ON public.attendance_records (school_id, date, status);
CREATE INDEX IF NOT EXISTS idx_parents_school_user
  ON public.parents (school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_school_role_user
  ON public.user_roles (school_id, role, user_id);
CREATE INDEX IF NOT EXISTS idx_behaviour_school_positive
  ON public.behaviour_notes (school_id, is_positive);
CREATE INDEX IF NOT EXISTS idx_notices_school_published
  ON public.notices (school_id, published_at DESC);

CREATE OR REPLACE FUNCTION public.get_principal_dashboard_stats(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_roll bigint := 0;
  v_day date;
  v_marked bigint := 0;
  v_present bigint := 0;
  v_late bigint := 0;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR p_school_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.school_id = p_school_id
      AND ur.role IN ('school_admin'::public.app_role, 'teacher'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorised for this school' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_roll
  FROM public.students s
  WHERE s.school_id = p_school_id AND s.deleted_at IS NULL;

  -- Use the latest completed day with at least half of the active roll marked.
  SELECT ar.date INTO v_day
  FROM public.attendance_records ar
  JOIN public.students s ON s.id = ar.student_id
  WHERE ar.school_id = p_school_id
    AND ar.date < current_date
    AND s.school_id = p_school_id
    AND s.deleted_at IS NULL
  GROUP BY ar.date
  HAVING count(*) >= greatest(1, ceil(v_roll * 0.5)::bigint)
  ORDER BY ar.date DESC
  LIMIT 1;

  IF v_day IS NULL THEN
    SELECT max(ar.date) INTO v_day
    FROM public.attendance_records ar
    WHERE ar.school_id = p_school_id AND ar.date < current_date;
  END IF;

  IF v_day IS NOT NULL THEN
    SELECT count(*),
           count(*) FILTER (WHERE ar.status IN ('present'::public.attendance_status, 'late'::public.attendance_status)),
           count(*) FILTER (WHERE ar.status = 'late'::public.attendance_status)
      INTO v_marked, v_present, v_late
    FROM public.attendance_records ar
    WHERE ar.school_id = p_school_id AND ar.date = v_day;
  END IF;

  SELECT jsonb_build_object(
    'name', (SELECT sc.name FROM public.schools sc WHERE sc.id = p_school_id),
    'day', coalesce(v_day, current_date),
    'students', v_roll,
    'roll_count', v_roll,
    'parents', (SELECT count(*) FROM public.parents p WHERE p.school_id = p_school_id),
    'active_parents', (SELECT count(*) FROM public.parents p WHERE p.school_id = p_school_id AND p.user_id IS NOT NULL),
    'teachers', (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.school_id = p_school_id AND ur.role = 'teacher'::public.app_role),
    'positive', (SELECT count(*) FROM public.behaviour_notes bn WHERE bn.school_id = p_school_id AND bn.is_positive = true),
    'negative', (SELECT count(*) FROM public.behaviour_notes bn WHERE bn.school_id = p_school_id AND bn.is_positive = false),
    'marked', v_marked,
    'present', v_present,
    'late', v_late,
    'classes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade) ORDER BY c.grade, c.name)
      FROM public.classes c WHERE c.school_id = p_school_id
    ), '[]'::jsonb),
    'absent', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'status', ar.status,
        'students', jsonb_build_object('first_name', s.first_name, 'last_name', s.last_name),
        'classes', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name', c.name) END
      ) ORDER BY ar.status, s.last_name, s.first_name)
      FROM public.attendance_records ar
      JOIN public.students s ON s.id = ar.student_id AND s.school_id = p_school_id
      LEFT JOIN public.classes c ON c.id = ar.class_id AND c.school_id = p_school_id
      WHERE ar.school_id = p_school_id
        AND ar.date = v_day
        AND ar.status IN ('absent'::public.attendance_status, 'excused'::public.attendance_status, 'half_day'::public.attendance_status)
    ), '[]'::jsonb),
    'notices', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'scope', n.scope, 'published_at', n.published_at)
                       ORDER BY n.published_at DESC)
      FROM (
        SELECT id, title, scope, published_at FROM public.notices
        WHERE school_id = p_school_id
        ORDER BY published_at DESC NULLS LAST LIMIT 8
      ) n
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_principal_dashboard_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_principal_dashboard_stats(uuid) TO authenticated;

-- Claim rows atomically so concurrent dispatch requests cannot send the same message twice.
ALTER TABLE public.outbound_messages DROP CONSTRAINT IF EXISTS outbound_messages_status_check;
ALTER TABLE public.outbound_messages
  ADD CONSTRAINT outbound_messages_status_check
  CHECK (status IN ('queued','processing','sent','delivered','failed','cancelled'));

CREATE OR REPLACE FUNCTION public.claim_outbound_messages(p_school_id uuid, p_limit integer DEFAULT 50)
RETURNS SETOF public.outbound_messages
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH picked AS (
    SELECT id
    FROM public.outbound_messages
    WHERE school_id = p_school_id
      AND status = 'queued'
      AND channel IN ('sms', 'whatsapp')
      AND scheduled_at <= now()
    ORDER BY created_at ASC
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 50)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbound_messages m
  SET status = 'processing'
  FROM picked
  WHERE m.id = picked.id
  RETURNING m.*;
$$;

REVOKE ALL ON FUNCTION public.claim_outbound_messages(uuid, integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_outbound_messages(uuid, integer) TO service_role;
