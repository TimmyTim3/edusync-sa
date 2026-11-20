# Production Readiness — Phase 0 baseline

This is a checklist, not a certification. No production-readiness claim is made yet.

## Must verify before commercial rollout
- [ ] Live schema and migration ledger reconciled.
- [ ] RLS negative tests pass for every tenant-owned table.
- [ ] Service-role call sites independently authorize users and tenant scope.
- [ ] Attendance cutoff/lockdown and class permissions enforced server-side/database-side.
- [ ] Attendance saves are retry-safe and concurrent-write behaviour tested.
- [ ] Medical and learner documents are private with controlled access.
- [ ] Messaging jobs recover after worker crashes and distinguish queued/sent/delivered.
- [ ] Import operations report partial failures and can safely resume.
- [ ] CI runs lint, typecheck, tests and production build.
- [ ] Backups, restore procedure and recovery objectives tested.
- [ ] Monitoring and alerting cover server errors, DB pressure, queue backlog and failed jobs.
- [ ] Load tests establish realistic capacity and bottlenecks.
- [ ] POPIA privacy notices, lawful processing, retention, access and incident response reviewed.
- [ ] Production environment variables and secrets managed outside Git.
- [ ] Rollback and release procedure documented.

## Current judgement
**Not yet verified as production-ready.** This is not a verdict that the software is unusable; it means the evidence needed for a responsible commercial launch is incomplete.
