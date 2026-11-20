-- EduSync Phase 0 follow-up — READ ONLY
-- Run in Supabase SQL Editor. SELECT/catalog inspection only; no data or schema changes.

select jsonb_pretty(jsonb_build_object(
  'checked_at', now(),
  'storage_object_policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', schemaname, 'table', tablename, 'policy', policyname,
      'command', cmd, 'roles', roles, 'using', qual, 'with_check', with_check
    ) order by policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  ),
  'storage_bucket_policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'public', public,
      'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types
    ) order by id), '[]'::jsonb)
    from storage.buckets
  ),
  'important_function_definitions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'owner', pg_get_userbyid(p.proowner),
      'settings', p.proconfig,
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_platform_admin', 'can_see_student', 'can_manage_attendance_row',
        'get_principal_dashboard_stats', 'claim_outbound_messages',
        'validate_attendance_register', 'audit_admin_attendance_override',
        'clear_demo_data', 'delete_school'
      )
  ),
  'relevant_table_grants', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'grantee', grantee, 'table_schema', table_schema,
      'table_name', table_name, 'privilege', privilege_type
    ) order by table_name, grantee, privilege_type), '[]'::jsonb)
    from information_schema.role_table_grants
    where table_schema in ('public', 'storage')
      and table_name in (
        'schools', 'students', 'parents', 'attendance_records',
        'marks', 'notices', 'profiles', 'objects'
      )
  ),
  'migration_history', (
    select case
      when to_regclass('drizzle.__drizzle_migrations') is null then 'ledger_not_found'
      else (
        select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)::text
        from drizzle.__drizzle_migrations m
      )
    end
  ),
  'index_usage', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', relname, 'index', indexrelname,
      'scans', idx_scan, 'tuples_read', idx_tup_read, 'tuples_fetched', idx_tup_fetch
    ) order by relname, indexrelname), '[]'::jsonb)
    from pg_stat_user_indexes
    where schemaname = 'public'
      and relname in (
        'attendance_records', 'students', 'behaviour_notes',
        'homework', 'marks', 'parent_student', 'parents', 'user_roles'
      )
  )
)) as edusync_phase0_followup;
