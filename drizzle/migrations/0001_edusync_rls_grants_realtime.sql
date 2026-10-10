drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- ===== GRANTS =====
grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;
grant select, insert, update, delete on public.platform_settings to authenticated;
grant select on public.platform_settings to anon;
grant all on public.platform_settings to service_role;
grant select, insert, update, delete on public.plans to authenticated;
grant select on public.plans to anon;
grant all on public.plans to service_role;
grant select, insert, update, delete on public.schools to authenticated;
grant all on public.schools to service_role;
grant select, insert, update, delete on public.feature_flags to authenticated;
grant select on public.feature_flags to anon;
grant all on public.feature_flags to service_role;
grant select, insert, update, delete on public.tenant_feature_overrides to authenticated;
grant all on public.tenant_feature_overrides to service_role;
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
grant select on public.seed_jobs to authenticated;
grant all on public.seed_jobs to service_role;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select, insert, update, delete on public.academic_years to authenticated;
grant all on public.academic_years to service_role;
grant select, insert, update, delete on public.terms to authenticated;
grant all on public.terms to service_role;
grant select, insert, update, delete on public.classes to authenticated;
grant all on public.classes to service_role;
grant select, insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
grant select, insert, update, delete on public.class_subject_teachers to authenticated;
grant all on public.class_subject_teachers to service_role;
grant select, insert, update, delete on public.students to authenticated;
grant all on public.students to service_role;
grant select, insert, update, delete on public.parents to authenticated;
grant all on public.parents to service_role;
grant select, insert, update, delete on public.parent_student to authenticated;
grant all on public.parent_student to service_role;
grant select, insert, update, delete on public.attendance_records to authenticated;
grant all on public.attendance_records to service_role;
grant select, insert, update, delete on public.assessments to authenticated;
grant all on public.assessments to service_role;
grant select, insert, update, delete on public.marks to authenticated;
grant all on public.marks to service_role;
grant select, insert, update, delete on public.behaviour_notes to authenticated;
grant all on public.behaviour_notes to service_role;
grant select, insert, update, delete on public.homework to authenticated;
grant all on public.homework to service_role;
grant select, insert, update, delete on public.homework_completions to authenticated;
grant all on public.homework_completions to service_role;
grant select, insert, update, delete on public.notices to authenticated;
grant all on public.notices to service_role;
grant select, insert, update, delete on public.notice_reads to authenticated;
grant all on public.notice_reads to service_role;
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

-- ===== ENABLE RLS =====
alter table public.platform_admins enable row level security;
alter table public.platform_settings enable row level security;
alter table public.plans enable row level security;
alter table public.schools enable row level security;
alter table public.feature_flags enable row level security;
alter table public.tenant_feature_overrides enable row level security;
alter table public.audit_logs enable row level security;
alter table public.seed_jobs enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subject_teachers enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.parent_student enable row level security;
alter table public.attendance_records enable row level security;
alter table public.assessments enable row level security;
alter table public.marks enable row level security;
alter table public.behaviour_notes enable row level security;
alter table public.homework enable row level security;
alter table public.homework_completions enable row level security;
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

-- ===== PLATFORM POLICIES =====
create policy "self read platform admin" on public.platform_admins for select to authenticated using (public.is_platform_admin());
create policy "read platform settings" on public.platform_settings for select to anon, authenticated using (true);
create policy "admin write platform settings" on public.platform_settings for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "read plans" on public.plans for select to anon, authenticated using (true);
create policy "admin manage plans" on public.plans for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "read flags" on public.feature_flags for select to anon, authenticated using (true);
create policy "admin manage flags" on public.feature_flags for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "read overrides" on public.tenant_feature_overrides for select to authenticated using (public.is_platform_admin() or public.is_school_member(school_id));
create policy "admin manage overrides" on public.tenant_feature_overrides for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "read seed jobs" on public.seed_jobs for select to authenticated using (public.is_platform_admin());
create policy "read audit logs" on public.audit_logs for select to authenticated using (public.is_platform_admin() or (school_id is not null and public.is_school_admin(school_id)));
create policy "insert audit logs" on public.audit_logs for insert to authenticated with check (true);

create policy "read schools" on public.schools for select to authenticated using (public.is_platform_admin() or public.is_school_member(id));
create policy "admin manage schools" on public.schools for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "school admin updates own school" on public.schools for update to authenticated using (public.is_school_admin(id)) with check (public.is_school_admin(id));

-- ===== USERS =====
create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin() or (school_id is not null and public.is_school_staff(school_id)));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "read roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin() or (school_id is not null and public.is_school_admin(school_id)));

-- ===== SCHOOL-SCOPED READABLE BY MEMBERS =====
create policy "members read years" on public.academic_years for select to authenticated using (public.is_platform_admin() or public.is_school_member(school_id));
create policy "staff manage years" on public.academic_years for all to authenticated using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "members read terms" on public.terms for select to authenticated using (public.is_platform_admin() or public.is_school_member(school_id));
create policy "staff manage terms" on public.terms for all to authenticated using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "members read classes" on public.classes for select to authenticated using (public.is_platform_admin() or public.is_school_member(school_id));
create policy "admin manage classes" on public.classes for all to authenticated using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "members read subjects" on public.subjects for select to authenticated using (public.is_platform_admin() or public.is_school_member(school_id));
create policy "admin manage subjects" on public.subjects for all to authenticated using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "members read cst" on public.class_subject_teachers for select to authenticated using (public.is_platform_admin() or public.is_school_member(school_id));
create policy "admin manage cst" on public.class_subject_teachers for all to authenticated using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- ===== STUDENT-SCOPED =====
create policy "read students" on public.students for select to authenticated
  using (public.is_platform_admin() or public.is_school_staff(school_id) or id in (select public.my_student_ids()));
create policy "staff manage students" on public.students for all to authenticated
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create policy "read parents" on public.parents for select to authenticated
  using (public.is_platform_admin() or public.is_school_staff(school_id) or user_id = auth.uid());
create policy "admin manage parents" on public.parents for all to authenticated
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create policy "read parent links" on public.parent_student for select to authenticated
  using (public.is_platform_admin() or public.is_school_staff(school_id) or student_id in (select public.my_student_ids()));
create policy "admin manage links" on public.parent_student for all to authenticated
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create policy "read attendance" on public.attendance_records for select to authenticated
  using (public.can_see_student(student_id, school_id));
create policy "staff write attendance" on public.attendance_records for insert to authenticated with check (public.is_school_staff(school_id));
create policy "staff update attendance" on public.attendance_records for update to authenticated using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));
create policy "staff delete attendance" on public.attendance_records for delete to authenticated using (public.is_school_staff(school_id));

create policy "read assessments" on public.assessments for select to authenticated
  using (public.is_platform_admin() or public.is_school_staff(school_id) or (published and public.is_school_member(school_id)));
create policy "staff manage assessments" on public.assessments for all to authenticated using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));

create policy "read marks" on public.marks for select to authenticated
  using (public.is_school_staff(school_id) or public.is_platform_admin() or (student_id in (select public.my_student_ids())
     and exists (select 1 from public.assessments a where a.id = assessment_id and a.published)));
create policy "staff manage marks" on public.marks for all to authenticated using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));

create policy "read behaviour" on public.behaviour_notes for select to authenticated
  using (public.is_school_staff(school_id) or public.is_platform_admin() or (parent_visible and student_id in (select public.my_student_ids())));
create policy "staff manage behaviour" on public.behaviour_notes for all to authenticated using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));

create policy "read homework" on public.homework for select to authenticated
  using (public.is_platform_admin() or public.is_school_staff(school_id)
     or class_id in (select s.class_id from public.students s where s.id in (select public.my_student_ids())));
create policy "staff manage homework" on public.homework for all to authenticated using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));

create policy "read completions" on public.homework_completions for select to authenticated
  using (public.can_see_student(student_id, school_id));
create policy "write completions" on public.homework_completions for insert to authenticated
  with check (public.can_see_student(student_id, school_id));
create policy "delete completions" on public.homework_completions for delete to authenticated
  using (public.can_see_student(student_id, school_id));

create policy "read notices" on public.notices for select to authenticated
  using (public.is_platform_admin() or public.is_school_member(school_id));
create policy "staff manage notices" on public.notices for all to authenticated using (public.is_school_staff(school_id)) with check (public.is_school_staff(school_id));
create policy "read own notice reads" on public.notice_reads for select to authenticated using (user_id = auth.uid());
create policy "insert own notice reads" on public.notice_reads for insert to authenticated with check (user_id = auth.uid());

create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "staff insert notifications" on public.notifications for insert to authenticated with check (school_id is null or public.is_school_staff(school_id));
create policy "manage own prefs" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== REALTIME =====
alter table public.attendance_records replica identity full;
alter table public.marks replica identity full;
alter table public.behaviour_notes replica identity full;
alter table public.homework replica identity full;
alter table public.notices replica identity full;
alter table public.notifications replica identity full;
alter table public.assessments replica identity full;
alter table public.feature_flags replica identity full;
alter publication supabase_realtime add table public.attendance_records;
alter publication supabase_realtime add table public.marks;
alter publication supabase_realtime add table public.behaviour_notes;
alter publication supabase_realtime add table public.homework;
alter publication supabase_realtime add table public.notices;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.assessments;
alter publication supabase_realtime add table public.feature_flags;
