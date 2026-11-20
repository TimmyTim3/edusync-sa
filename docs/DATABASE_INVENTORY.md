# Database Inventory — Phase 0

**Source:** SQL files in `drizzle/migrations/`; live database not queried.

## Migration sequence found
- `0000_edusync_core_schema.sql`
- `0001_edusync_rls_grants_realtime.sql`
- `0002` through `0026` (including timetable, parent linking, lockdown settings, transfers, gate register, front office, indexes, curriculum, mark governance and remaining bundles)
- `0027_principal_stats_and_outbound_dispatch.sql`
- `0027_tighten_feature_flag_and_plan_reads.sql`

## Migration journal discrepancy
`drizzle/migrations/meta/_journal.json` includes `0027_tighten_feature_flag_and_plan_reads` but does not include `0027_principal_stats_and_outbound_dispatch`. Both files use the same numeric prefix. This is a repository migration-history inconsistency, not proof that either migration is absent from the live database.

**Do not rerun, rename, delete or rewrite either migration as a quick fix.** First compare the live schema and migration ledger, then establish a forward-only migration naming convention.

## Confirmed schema features in source
- `attendance_records` has unique `(student_id,date)`.
- `students` has unique `(school_id,admission_no)`.
- `marks` has unique `(assessment_id,student_id)`.
- Numerous tenant tables carry `school_id`.
- RLS is enabled across core tables in migration `0001`.
- Realtime publication membership is configured for several tables.
- Migration `0022` adds composite indexes, including attendance `(school_id,date DESC,status)`, active learner roll, marks, behaviour, homework, parent links, notices and roles.
- Migration `0027_principal_stats_and_outbound_dispatch.sql` adds overlapping/similar index definitions with `IF NOT EXISTS`, a principal stats RPC and an atomic queue-claim function.

## Important integrity questions
1. Does every attendance record's `school_id` match its student's and class's school? The base schema has independent foreign keys, not a composite tenant-consistency FK.
2. Are cutoff/lockdown settings enforced inside database write policies or trusted server operations, not only in the UI?
3. Are unique constraints and indexes actually present in production?
4. Are all `SECURITY DEFINER` functions restricted and using safe search paths?
5. What is the actual migration ledger in the connected Supabase database?

## Safe next step
Request read-only live schema evidence (constraints, indexes, policies, functions, storage buckets and migration ledger). No DDL should be executed during this inventory stage.
