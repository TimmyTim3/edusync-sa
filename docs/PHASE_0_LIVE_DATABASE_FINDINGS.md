# Phase 0 — live Supabase findings from export (2026-11-20 14:00:08 UTC)

Source: user-provided CSV export of `edusync_read_only_audit`. This is direct live catalog evidence, not an inference from migration files.

## Confirmed live database facts

- PostgreSQL 17.11.
- 45 public tables were returned; **all 45 have RLS enabled**.
- None of those 45 tables has FORCE ROW LEVEL SECURITY enabled. This is not automatically a vulnerability; privileged database owners/service-role access can bypass ordinary RLS. We must review function ownership, grants and service-role server handlers rather than blindly enable FORCE RLS.
- 105 policies were returned for public tables.
- 158 constraints: 45 primary keys, 80 foreign keys, 17 unique constraints, 16 check constraints.
- 133 indexes.
- The Drizzle migration ledger relation `drizzle.__drizzle_migrations` exists. This does not yet prove that every migration file in Git has been recorded/applied; inspect the ledger rows and compare hashes/timestamps.
- Three storage buckets exist. The `medical-certificates` bucket is **public=true**, with a 2 MiB size limit and no MIME allow-list. This is a confirmed privacy concern for sensitive learner/medical documents. Do not change bucket settings until storage object policies, app access paths and existing file usage are understood; the intended fix is private storage plus authorised short-lived signed links.
- Two database export buckets are private.

## Master Control statistics clue

Live SELECT policies permit `is_platform_admin()` for schools, students, parents, marks, notices and profiles. Attendance SELECT instead uses `can_see_student(student_id, school_id)`. The export does not include the body of `can_see_student`, so we cannot yet establish whether the platform administrator is allowed to count all attendance rows. Since `platformStats` counts all seven tables in one Promise.all and throws if any count fails, one denied table can prevent the entire stats response and leave all cards loading. **This is a strong lead, not yet a proven root cause.** The follow-up SQL retrieves the function body. Do not replace the stats query with service-role counts until we confirm the intended platform-admin boundary and function behaviour.

## Confirmed duplicate index definitions

These exact duplicate pairs/groups exist in the live catalog:
- attendance_records: `attendance_records_student_id_date_idx` and `idx_att_student_date`
- behaviour_notes: `behaviour_notes_student_id_created_at_idx`, `idx_beh_student`, `idx_beh_student_created`
- homework: `homework_school_id_class_id_due_date_idx` and `idx_homework_school_class_due`
- marks: `idx_marks_student` and `marks_student_id_idx`
- notices: `idx_notices_school_published` and `notices_school_id_published_at_idx`
- parent_student: three identical student_id indexes and two identical parent_id indexes
- parents: `idx_parents_user` and `parents_user_id_idx`
- students: `idx_students_school_class` and `students_school_id_class_id_idx`
- user_roles: `idx_roles_user` and `user_roles_user_id_idx`

Do not drop these yet. First inspect index usage, constraints, query plans, migration ownership and whether partial/unique semantics differ. Redundant indexes consume disk and slow writes, but removal without evidence can hurt live queries.

## RLS policy evidence worth further review

- `attendance_records` SELECT uses `can_see_student`; INSERT/UPDATE/DELETE use `can_manage_attendance_row`.
- `schools` SELECT includes `is_platform_admin()`.
- `students`, `parents`, `marks`, `notices`, and `profiles` SELECT policies include `is_platform_admin()`.
- `platform_admins` has a self-read policy using `is_platform_admin()`.
- The export contains no policies for `storage.objects` because the first audit query only inspected `public` schema policies. The follow-up query now retrieves storage policies explicitly.

## Next read-only verification

Run `docs/PHASE_0_SUPABASE_FOLLOWUP_READ_ONLY.sql` and provide its CSV. It retrieves:
- storage.objects policies,
- definitions and settings for critical SECURITY DEFINER functions,
- relevant table grants,
- migration ledger rows,
- index usage counters.

No SQL changes are required for this verification.
