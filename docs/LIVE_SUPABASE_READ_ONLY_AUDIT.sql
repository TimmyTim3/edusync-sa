-- EduSync live database verification (READ ONLY)
-- Run in Supabase SQL Editor. This script uses SELECT/catalog inspection only.
-- It does not create, alter, delete, update, or insert any data.

select jsonb_pretty(jsonb_build_object(
  'database', current_database(),
  'checked_at', now(),
  'server_version', version(),
  'migration_ledger_table_present', to_regclass('drizzle.__drizzle_migrations') is not null,
  'public_tables_rls', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity
    ) order by c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'indexes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'index', indexname, 'definition', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
    from pg_indexes where schemaname = 'public'
  ),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', con.conname,
      'type', con.contype, 'definition', pg_get_constraintdef(con.oid)
    ) order by c.relname, con.conname), '[]'::jsonb)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'policy', policyname, 'command', cmd,
      'roles', roles, 'using', qual, 'with_check', with_check
    ) order by tablename, policyname), '[]'::jsonb)
    from pg_policies where schemaname = 'public'
  ),
  'security_definer_functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'function', p.proname,
      'identity_arguments', pg_get_function_identity_arguments(p.oid),
      'owner', pg_get_userbyid(p.proowner),
      'search_path_config', p.proconfig
    ) order by p.proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  ),
  'storage_buckets', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types
    ) order by id), '[]'::jsonb)
    from storage.buckets
  ),
  'extensions', (
    select coalesce(jsonb_agg(extname order by extname), '[]'::jsonb)
    from pg_extension
  )
)) as edusync_read_only_audit;
