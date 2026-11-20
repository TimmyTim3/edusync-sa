# Security Audit — Phase 0 static findings

**Scope:** Source and migration review only; no penetration test or live RLS test performed.

## Positive controls found
- Server functions commonly use `requireSupabaseAuth`, which validates bearer tokens with Supabase `getClaims`.
- RLS is enabled on core tables in migration `0001`.
- School-scoped membership/staff/admin helper policies are used throughout the policy set.
- Service-role client is explicitly server-side and documented as bypassing RLS.
- Outbound queue claim RPC is revoked from PUBLIC, authenticated and anon, and granted to service_role in the inspected migration.

## High-priority verification items
1. **Service-role authorization:** Review every `supabaseAdmin` call site. RLS does not protect these operations.
2. **Tenant consistency:** Test School A users against School B learner, attendance, parent, marks, behaviour, files and messaging IDs.
3. **Attendance writes:** Current base policies allow school staff to insert/update/delete based on `is_school_staff(school_id)`. Confirm class-level permissions and lockdown enforcement are applied elsewhere.
4. **Parent child claim:** `claimMyChild` uses privileged lookups and links a learner using admission number, surname and DOB. Review proof-of-identity strength, rate limiting, enumeration resistance and account-linking rules.
5. **Medical documents:** Parent absence flow uses `getPublicUrl` for a medical certificate in inspected source. Confirm bucket privacy and replace public access with short-lived signed access if the bucket is private-sensitive.
6. **Environment hygiene:** `.env` is tracked. Inspected keys were project ID, URL and publishable keys; no service-role key was present in that file snapshot. Remove local environment files from version control safely and rotate any secret if one is ever found.
7. **Role management:** Review staff creation and parent claim flows for privilege escalation, stale role assignments and deactivation/session revocation.
8. **Audit integrity:** Review who can write audit rows and ensure security-sensitive events are written by trusted server-side operations.

## Required security tests
- Unauthenticated requests to every server function.
- School A attempting School B read/write across every tenant table.
- Parent attempting to claim an unrelated learner and enumerate admission numbers.
- Teacher attempting to edit a class outside their assignment.
- Deactivated staff reusing an existing session.
- Signed-out/expired-token and role-change behaviour.
- Storage access to another learner's medical document.

No policy should be loosened to make a failing test pass. Any correction must preserve least privilege.
