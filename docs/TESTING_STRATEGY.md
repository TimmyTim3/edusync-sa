# Testing Strategy — Phase 0

## Current repository evidence
- Unit-test files exist for CAPS marks/subjects, governance, import normalisation, NPPPR, phone normalisation and staff normalisation.
- `package.json` includes Vitest as a development dependency but exposes no `test` script.
- No `.github/workflows` directory was found in the repository tree.
- Available scripts include build, lint and preview; typecheck is not separately exposed.

## Required pipeline
1. Install using the lockfile.
2. Run formatting check (not auto-format on CI).
3. Run ESLint.
4. Run TypeScript typecheck.
5. Run unit tests.
6. Run production build.
7. Run database migration lint/static checks.
8. Run integration tests against isolated Supabase project.
9. Run RLS negative tests with separate tenant identities.
10. Run staged load tests before capacity claims.

## Regression matrix
Attendance changes: teacher register, parent absence report, principal stats, notifications, historical reports.  
Security changes: every affected role and cross-tenant denial.  
Messaging changes: enqueue, claim, provider timeout, worker crash, retry and duplicate suppression.  
Import changes: duplicate rows, malformed rows, partial failure, retry and resume.

## Safety
No destructive production migrations in CI. Integration/load tests use disposable test projects and synthetic records only.
