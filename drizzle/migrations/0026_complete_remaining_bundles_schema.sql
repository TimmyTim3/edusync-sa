-- ============================================================
-- COMPLETE DATABASE BUILD for all remaining bundles
-- Bundle L: Textbook & campus asset management
-- Bundle L: Learner special accommodations & concessions
-- Bundle K: Outbound notification gateway & dispatch queue
-- Bundle J: Attendance lockdown settings
-- Additive only: no existing tables or data are touched.
-- ============================================================

-- ---------- Textbook titles (catalogue) ----------
CREATE TABLE public.textbook_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  isbn text,
  title text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id),
  grade text,
  publisher text,
  total_copies integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_textbook_titles_school ON public.textbook_titles (school_id);
CREATE INDEX idx_textbook_titles_subject_grade ON public.textbook_titles (subject_id, grade);

-- ---------- Individual copies / barcodes ----------
CREATE TABLE public.textbook_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.textbook_titles(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','issued','lost','written_off')),
  condition text NOT NULL DEFAULT 'new' CHECK (condition IN ('new','good','fair','damaged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, barcode)
);
CREATE INDEX idx_textbook_copies_school ON public.textbook_copies (school_id);
CREATE INDEX idx_textbook_copies_title ON public.textbook_copies (title_id);

-- ---------- Checkout / return ledger ----------
CREATE TABLE public.textbook_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  copy_id uuid NOT NULL REFERENCES public.textbook_copies(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id),
  teacher_profile_id uuid REFERENCES public.profiles(id),
  issued_on date NOT NULL,
  due_on date NOT NULL,
  returned_on date,
  return_condition text CHECK (return_condition IN ('new','good','fair','damaged')),
  fee numeric NOT NULL DEFAULT 0,
  fee_paid boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT textbook_issues_holder_required CHECK (student_id IS NOT NULL OR teacher_profile_id IS NOT NULL),
  CONSTRAINT textbook_issues_dates_valid CHECK (due_on >= issued_on)
);
CREATE INDEX idx_textbook_issues_school ON public.textbook_issues (school_id);
CREATE INDEX idx_textbook_issues_copy ON public.textbook_issues (copy_id);
CREATE INDEX idx_textbook_issues_student ON public.textbook_issues (student_id);
CREATE INDEX idx_textbook_issues_overdue ON public.textbook_issues (school_id, due_on) WHERE returned_on IS NULL;

-- ---------- Learner special accommodations (DBE concessions) ----------
CREATE TABLE public.learner_accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  accommodation text NOT NULL CHECK (accommodation IN ('extra_time','scribe','reader','separate_venue','enlarged_print','computer','medical_concession')),
  dbe_reference text,
  valid_from date NOT NULL,
  valid_to date,
  medical_notes text,
  attachment_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','withdrawn')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_learner_accommodations_school ON public.learner_accommodations (school_id);
CREATE INDEX idx_learner_accommodations_student ON public.learner_accommodations (student_id);

-- ---------- Pre-approved message templates (SMS / WhatsApp / email) ----------
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp','email')),
  purpose text NOT NULL,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_templates_school ON public.notification_templates (school_id);

-- ---------- Outbound message dispatch queue ----------
CREATE TABLE public.outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp','email')),
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  user_id uuid,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','cancelled')),
  provider_message_id text,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbound_messages_school ON public.outbound_messages (school_id);
CREATE INDEX idx_outbound_messages_dispatch ON public.outbound_messages (status, scheduled_at);
CREATE INDEX idx_outbound_messages_student ON public.outbound_messages (student_id);

-- ---------- Attendance lockdown settings (one row per school) ----------
CREATE TABLE public.attendance_lock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  register_cutoff_time time NOT NULL DEFAULT '09:30',
  auto_lock_after_submission boolean NOT NULL DEFAULT true,
  lock_past_days integer NOT NULL DEFAULT 1,
  principal_override_required boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- ---------- Grants (Data API access) ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_titles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_copies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_issues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learner_accommodations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_lock_settings TO authenticated;
GRANT ALL ON public.textbook_titles TO service_role;
GRANT ALL ON public.textbook_copies TO service_role;
GRANT ALL ON public.textbook_issues TO service_role;
GRANT ALL ON public.learner_accommodations TO service_role;
GRANT ALL ON public.notification_templates TO service_role;
GRANT ALL ON public.outbound_messages TO service_role;
GRANT ALL ON public.attendance_lock_settings TO service_role;

-- ---------- RLS ----------
ALTER TABLE public.textbook_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textbook_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textbook_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_lock_settings ENABLE ROW LEVEL SECURITY;

-- ---------- Textbook titles policies ----------
CREATE POLICY "staff read textbook titles" ON public.textbook_titles FOR SELECT TO authenticated USING (public.is_school_staff(school_id) OR public.is_front_office(school_id));
CREATE POLICY "admins manage textbook titles" ON public.textbook_titles FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ---------- Textbook copies policies ----------
CREATE POLICY "staff read textbook copies" ON public.textbook_copies FOR SELECT TO authenticated USING (public.is_school_staff(school_id) OR public.is_front_office(school_id));
CREATE POLICY "admins manage textbook copies" ON public.textbook_copies FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ---------- Textbook issues policies ----------
CREATE POLICY "staff read textbook issues" ON public.textbook_issues FOR SELECT TO authenticated USING (public.is_school_staff(school_id) OR public.is_front_office(school_id));
CREATE POLICY "staff issue textbooks" ON public.textbook_issues FOR INSERT TO authenticated WITH CHECK (public.is_school_staff(school_id));
CREATE POLICY "staff update textbook issues" ON public.textbook_issues FOR UPDATE TO authenticated USING (public.is_school_staff(school_id)) WITH CHECK (public.is_school_staff(school_id));
CREATE POLICY "admins delete textbook issues" ON public.textbook_issues FOR DELETE TO authenticated USING (public.is_school_admin(school_id));

-- ---------- Accommodation policies ----------
CREATE POLICY "staff read accommodations" ON public.learner_accommodations FOR SELECT TO authenticated USING (public.is_school_staff(school_id) OR public.is_front_office(school_id));
CREATE POLICY "admins manage accommodations" ON public.learner_accommodations FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ---------- Template policies ----------
CREATE POLICY "staff read notification templates" ON public.notification_templates FOR SELECT TO authenticated USING (public.is_school_staff(school_id));
CREATE POLICY "admins manage notification templates" ON public.notification_templates FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- ---------- Outbound message policies ----------
CREATE POLICY "staff read outbound messages" ON public.outbound_messages FOR SELECT TO authenticated USING (public.is_school_staff(school_id));
CREATE POLICY "staff queue outbound messages" ON public.outbound_messages FOR INSERT TO authenticated WITH CHECK (public.is_school_staff(school_id));
CREATE POLICY "admins update outbound messages" ON public.outbound_messages FOR UPDATE TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
CREATE POLICY "admins delete outbound messages" ON public.outbound_messages FOR DELETE TO authenticated USING (public.is_school_admin(school_id));

-- ---------- Lockdown settings policies ----------
CREATE POLICY "staff read attendance lock settings" ON public.attendance_lock_settings FOR SELECT TO authenticated USING (public.is_school_staff(school_id) OR public.is_front_office(school_id));
CREATE POLICY "admins manage attendance lock settings" ON public.attendance_lock_settings FOR ALL TO authenticated USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));
