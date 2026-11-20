# Phase 0 — confirmed source-level security findings

**Baseline:** `main` commit `2c72f3d98c1a372bfa02254e291ab18ee4d263f4`.  
**Important:** findings below are from repository source and migration inspection; live Supabase configuration still requires the read-only SQL report.

## P0 — Master password reset endpoint lacked authentication (patched on audit branch)
In `src/lib/master.functions.ts`, `unlockMaster` had no `requireSupabaseAuth` middleware, accepted a hard-coded password, and reset a fixed user UUID using the service-role client. The visible `/master-login` route uses Supabase password sign-in and does not call this helper. The branch patch now requires an authenticated request, checks the configured platform-admin email, changes only the authenticated user's password, removes the hard-coded password and fixed user UUID, and requires a 12–200 character password. Validate build/typecheck and confirm no hidden caller before merge.

## P1 — Attendance lockdown is currently presentation/settings logic, not proven write enforcement
`AttendanceLockdown.tsx` stores cutoff, auto-lock and past-day settings. The core RLS policies in migration `0001` permit school staff to insert/update/delete attendance based on school-level staff membership. The inspected migrations do not show an attendance write trigger/policy enforcing those settings. Principal override UI writes directly to `attendance_records` and invalidates an audit-ledger query, but the shown handler does not itself insert an `attendance_override` audit row. Treat database/server enforcement and audit evidence as missing until complete live policy/trigger review confirms otherwise.

## P1 — Parent absence reporting can partially commit
`reportAbsence` performs a prior-record check, uploads a certificate, inserts attendance, then inserts an absence report and audit record as separate requests. Concurrent requests can race and a later insert can fail after an earlier step succeeds. Convert to a single transactional server-side operation with idempotency only after confirming full schema and desired parent workflow.

## P1 — Medical certificate URL privacy
The parent absence flow calls `getPublicUrl` for the `medical-certificates` bucket. Public URL generation does not itself prove the bucket is public, but it is incompatible with the intended private-document design if public access is enabled. Verify live bucket privacy and storage policies; then use short-lived signed URLs for authorised staff/parents.

## P1 — Privileged import endpoints
Learner, attendance-history and behaviour-history imports use the service-role client. Their shared guard currently restricts to one configured platform-admin email, which is restrictive but does not provide school-admin self-service. Every call remains privileged and must be tested against cross-school IDs. Import batches are chunked, but multiple chunks and parent-link operations are not atomic; partial success can occur.

## P1 — Messaging worker recovery and delivery ambiguity
The queue claim function uses `FOR UPDATE SKIP LOCKED` and changes jobs from queued to processing. No lease/claim expiry or processing recovery was found in the inspected queue schema/function. Provider calls can succeed while persistence fails, making delivery outcome ambiguous; the current implementation marks a provider success as sent, not delivered. Retry policy and duplicate suppression need provider-aware design.

## P2 — Realtime query storm risk
`src/lib/realtime.ts` invalidates all React Query queries for every event on seven tables. Replace with tenant-scoped, table-to-query-key invalidation, debounce event bursts and test reconnect behaviour.

## P2 — CI baseline
The first workflow run found 4,312 ESLint errors (mostly Prettier formatting violations) and 19 warnings across the existing codebase. This is a pre-existing repository-wide lint baseline; no application source files were modified for the workflow introduction. The split workflow now runs unit tests, TypeScript and production build independently: those three checks passed on run `44740065739`; lint remains failing and must be cleaned in controlled, file-scoped batches rather than auto-formatting the whole app.

## Migration and indexing findings
- Composite indexes exist in migrations `0022` and `0027_principal_stats_and_outbound_dispatch`; do not duplicate them.
- Principal stats RPC checks the caller's role for the supplied school before returning data.
- Two files use prefix `0027`; the journal includes only `0027_tighten_feature_flag_and_plan_reads`. This is a migration-history inconsistency, not proof of missing live objects.
- Demo purge migrations intentionally contain destructive functions. Do not execute these as ordinary migrations or during audit.


## Master login history — clarification (verified from Git commit history)

This section supersedes any wording that could imply the audit patch changed the live Master Control login flow.

- **2026-11-20 09:46:23 UTC — Lovable commit `4d2fb057`:** introduced the `unlockMaster` helper and changed `master-login.tsx` to call it before signing in. The helper checked a hard-coded passphrase and used the service-role client to set the fixed platform-admin account password.
- **2026-11-20 09:57:19 UTC — Lovable commit `a62e8d3`:** reverted the login page to direct Supabase password sign-in using `timmytim691@gmail.com`; it removed the `unlockMaster` import/call. This was explicitly titled "sign in directly so master login works on Vercel".
- **2026-11-20 11:04:49 UTC — commit `ac9afd2`:** retained direct sign-in and added exit-flow/password-visibility improvements.
- **2026-11-20 13:00:41 UTC — audit branch commit `c7aecf0`:** changed only the now-unreferenced `unlockMaster` helper. It did not modify `src/routes/master-login.tsx`, the email used by the login page, the direct Supabase sign-in call, the local gate key, or platform statistics.

**Current route behaviour:** the Master Login page submits the entered password directly to Supabase Auth for `timmytim691@gmail.com`. The platform stats function remains separate and uses the authenticated Supabase client after checking that the signed-in email is the configured platform administrator.

**Safety decision:** do not merge the `unlockMaster` helper patch until its intended future use is decided. It is not part of the current login route. The patch does not alter the current route, but it changes an unused helper's contract; leave it isolated on the audit branch pending full Phase 0 review.
