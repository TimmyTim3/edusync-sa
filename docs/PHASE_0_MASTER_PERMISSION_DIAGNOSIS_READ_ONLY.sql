-- EduSync Phase 0 — Master Control permission diagnosis (READ ONLY)
-- Run in Supabase SQL Editor. This query does not change data, policies, grants or schema.

select jsonb_pretty(jsonb_build_object(
  'checked_at', now(),
  'platform_admin_account_match', jsonb_build_object(
    'expected_email', 'timmytim691@gmail.com',
    'matching_rows', (
      select count(*) from public.platform_admins
      where lower(email) = lower('timmytim691@gmail.com')
    ),
    'matching_entries', (
      select coalesce(jsonb_agg(jsonb_build_object('email', email)), '[]'::jsonb)
      from public.platform_admins
      where lower(email) = lower('timmytim691@gmail.com')
    )
  ),
  'attendance_and_admin_policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'policy', policyname, 'command', cmd,
      'roles', roles, 'using', qual, 'with_check', with_check
    ) order by tablename, policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('attendance_records', 'platform_admins', 'schools', 'students', 'parents', 'marks', 'notices', 'profiles')
  ),
  'admin_function_execute_access', jsonb_build_object(
    'is_platform_admin_anon', has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE'),
    'is_platform_admin_authenticated', has_function_privilege('authenticated', 'public.is_platform_admin()', 'EXECUTE'),
    'can_see_student_anon', has_function_privilege('anon', 'public.can_see_student(uuid,uuid)', 'EXECUTE'),
    'can_see_student_authenticated', has_function_privilege('authenticated', 'public.can_see_student(uuid,uuid)', 'EXECUTE'),
    'claim_queue_anon', has_function_privilege('anon', 'public.claim_outbound_messages(uuid,integer)', 'EXECUTE'),
    'claim_queue_authenticated', has_function_privilege('authenticated', 'public.claim_outbound_messages(uuid,integer)', 'EXECUTE'),
    'claim_queue_service_role', has_function_privilege('service_role', 'public.claim_outbound_messages(uuid,integer)', 'EXECUTE'),
    'delete_school_anon', has_function_privilege('anon', 'public.delete_school(uuid)', 'EXECUTE'),
    'delete_school_authenticated', has_function_privilege('authenticated', 'public.delete_school(uuid)', 'EXECUTE'),
    'clear_demo_anon', has_function_privilege('anon', 'public.clear_demo_data()', 'EXECUTE'),
    'clear_demo_authenticated', has_function_privilege('authenticated', 'public.clear_demo_data()', 'EXECUTE')
  ),
  'storage_policy_count', (
    select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  ),
  'medical_bucket', (
    select jsonb_build_object('id', id, 'public', public, 'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types)
    from storage.buckets where id = 'medical-certificates'
  ),
  'migration_ledger', (
    select jsonb_build_object(
      'rows', count(*),
      'last_id', max(id),
      'last_created_at', max(created_at)
    ) from drizzle.__drizzle_migrations
  )
)) as edusync_master_permission_diagnosis;
