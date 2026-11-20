# Phase 0 — analysis of second live Supabase export

Export timestamp: 2026-11-20T14:27:47Z.

## Priority finding: Master Control attendance permission path

The live function definitions show:

- `can_see_student(_student, _school)` returns true when `is_platform_admin()` is true, or the user is staff for that school, or is linked as a parent.
- `is_platform_admin()` returns true for service_role, or when the email claim in the current JWT matches an email in `public.platform_admins` (case-insensitive).
- The live attendance SELECT policy uses `can_see_student` (from the prior live catalog export).
- The application `platformStats` uses the authenticated request's Supabase client to count seven tables together and throws if any count fails.

Therefore attendance's policy function is not inherently missing a platform-admin branch. The decisive unknown is whether `timmytim691@gmail.com` exists in `platform_admins`, and whether the browser's authenticated JWT actually carries that email. The SQL editor cannot prove the browser JWT claim; the next read-only query checks the allow-list row and exact policies. If the allow-list row exists, we should inspect the actual platformStats error returned by the server and the other six tables' SELECT policies before changing the stats path. Do not switch to service-role counts as a shortcut.

## New high-priority function-permission concern

The live `claim_outbound_messages(uuid, integer)` function is SECURITY DEFINER and its body claims queued messages for the supplied school ID. The body itself does not check the caller's role. The application caller checks a school role and invokes it with the service-role client, but PostgreSQL function EXECUTE grants also need checking. If anon/authenticated can execute it directly, it could expose a privileged queue-claim path. The follow-up SQL checks EXECUTE privileges for anon/authenticated/service_role. No grant changes are proposed until that result is reviewed.

## Other live evidence

- `clear_demo_data()` and `delete_school(uuid)` are SECURITY DEFINER and check `is_platform_admin()` internally.
- `validate_attendance_register()` is SECURITY DEFINER and checks class/register permission unless service_role.
- `audit_admin_attendance_override()` records school-admin attendance overrides and requires a reason.
- Storage object policies returned zero rows. The medical-certificates bucket is public. Public bucket downloads can be served without an object SELECT policy; uploads/updates/deletes remain governed by storage policies and must be reviewed before changing it.
- The live migration ledger contains 28 rows, with latest id 28. The previous output's large character count was the JSON text length, not a migration count.
- Index usage counters show that several duplicate-looking indexes are actually used, while others show zero scans since the statistics reset. Zero scans alone is not proof an index is safe to drop. No index changes are proposed.

## Required next verification

Run `docs/PHASE_0_MASTER_PERMISSION_DIAGNOSIS_READ_ONLY.sql` and export its single result cell as CSV. This checks the admin allow-list row, exact RLS policy definitions, function EXECUTE privileges, storage policy count and migration ledger summary. It is read-only.
