# Feature Inventory — Phase 0

**Baseline:** main @ `2c72f3d98c1a372bfa02254e291ab18ee4d263f4`  
**Status vocabulary:** Present in source ≠ runtime verified.

| Area | Evidence in repository | Initial status | Next verification |
|---|---|---|---|
| Authentication and roles | `src/lib/auth.tsx`, `auth-middleware.ts`, `0001` | Implemented in source | Test role switching, revoked sessions and multi-school users |
| Tenant RLS | `0001_edusync_rls_grants_realtime.sql` | Broad policy set present | Negative cross-school tests on every sensitive table |
| Attendance | `TeacherDashboard.tsx`, `AttendanceLockdown.tsx`, `0000`, `0018` | Core features present | Verify DB-enforced lock/cutoff, class scope, concurrency and audit |
| Attendance uniqueness | `0000`: unique(student_id,date) | Implemented in schema source | Confirm live constraint and school/student consistency |
| Composite indexes | `0022_guardrail_composite_indexes.sql`, additional indexes in `0027_principal_stats_and_outbound_dispatch.sql` | Implemented in migration source | Confirm live indexes and EXPLAIN plans; do not duplicate |
| Principal aggregate | `get_principal_dashboard_stats(uuid)` in `0027_principal_stats_and_outbound_dispatch.sql` | Implemented in migration source | Check function security, results and load |
| Realtime | `src/lib/realtime.ts`, `0001` | Implemented; invalidation is broad | Narrow query keys and test reconnection/event bursts |
| Outbound queue | `messaging.functions.ts`, `0027_principal_stats_and_outbound_dispatch.sql` | SMS/WhatsApp queue path present | Lease recovery, provider idempotency, delivery webhooks, email support |
| Learner/attendance/behaviour imports | `import.functions.ts` | Batch import up to 5,000 present | Dry-run, resumability, partial failures, duplicate policy and authorization |
| Parent self-service | `parent.functions.ts` | Child claim and absence reporting present | Verify proof strength, atomicity, abuse controls and document privacy |
| Staff onboarding | `staff.functions.ts` | Bulk ingest up to 500 present | Existing-account and role mutation edge cases; audit and revocation |
| Tests | Several `*.test.ts` files in `src/lib` | Unit tests exist | Add runnable test script and integration/RLS suites |
| CI | No `.github/workflows` directory found | No workflow found in repository tree | Add lint/typecheck/test/build workflow |
| Environment files | `.env` tracked; `.gitignore` does not ignore it | Configuration hygiene issue | Ignore future env files; remove tracked local config safely |
| File storage | Storage references found in parent flow | Present but privacy uncertain | Inspect all buckets and policies in live Supabase |

## Rules
- Do not reimplement a feature solely because it appears in the risk register.
- Mark a feature "verified" only after source review plus the relevant runtime/integration test.
- Keep a record of the evidence and test date for every verification.
