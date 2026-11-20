# EduSync System Architecture — Phase 0 baseline

**Audit baseline:** 2026-11-20  
**Source branch:** `main`  
**Baseline commit:** `2c72f3d98c1a372bfa02254e291ab18ee4d263f4`  
**Scope:** Static repository inspection. This document does not claim live Supabase or production verification.

## Confirmed stack
- TanStack Start, React 19, TypeScript and Vite.
- Supabase PostgreSQL, Auth, Row Level Security, Realtime and Storage.
- TanStack Query for client query caching.
- Drizzle SQL migration files under `drizzle/migrations/`.
- Vercel deployment is part of the project workflow (deployment state not verified in this audit).

## Request and data paths
- Browser Supabase client is used for user-scoped requests subject to RLS.
- TanStack Start server functions use `requireSupabaseAuth`, which validates the bearer token using Supabase `getClaims` and provides an authenticated Supabase client.
- `src/integrations/supabase/client.server.ts` creates a service-role client. Its own comments correctly state that it bypasses RLS and is server-only. Every call site must therefore perform explicit authorization and tenant checks.
- Realtime subscriptions are created in `src/lib/realtime.ts`; current implementation invalidates the entire React Query cache on each subscribed database event.

## Major data domains found in migrations
Platform/schools/plans/feature flags; profiles and roles; academic years/terms/classes/subjects; learners and parents; attendance; assessments and marks; behaviour; homework; notices and notifications; timetable/session attendance; front-office/gate register; textbook inventory; curriculum and governance; outbound messaging.

## Architectural risks to track
1. Service-role use must be reviewed function-by-function because it bypasses RLS.
2. Tenant isolation depends on both RLS and correct school scoping in privileged server functions.
3. Realtime global invalidation can amplify query load.
4. Attendance currently has a learner/date uniqueness constraint but no confirmed atomic register-submission workflow in the inspected teacher UI.
5. Deployment, live schema, backups, secrets configuration and production telemetry are not observable from this repository snapshot.

## Verification boundary
A static source review cannot prove live database policies, indexes, extensions, storage bucket privacy, secrets, deployment environment values, backup retention, query plans or production capacity. These require authenticated environment access or operator-provided evidence.
