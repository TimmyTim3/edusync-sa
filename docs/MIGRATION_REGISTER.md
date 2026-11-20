# Migration Register — Phase 0

| Migration | Journal entry | Notes |
|---|---|---|
| 0000 core schema | Yes | Base tables, enums, constraints |
| 0001 RLS/grants/realtime | Yes | Core grants, policies and publication setup |
| 0002–0026 | Yes | Sequential feature bundles; see files in `drizzle/migrations/` |
| 0027 principal stats/outbound | **No** | File exists; journal does not list it; may have been manually applied |
| 0027 tighten feature/plan reads | Yes | Journal entry present |

## Operating rule
Never rerun an old migration simply because its journal entry is missing. The journal is not the live database. Before a future migration:
1. Read the live migration ledger and schema.
2. Check whether each intended object already exists and whether its definition matches.
3. Create a uniquely numbered forward migration.
4. Make it additive and idempotent where appropriate.
5. Record who applied it, when, and the resulting verification evidence.

## Live status
Unknown — requires read-only Supabase inspection. Prior manual execution reported by project owner is historical context, not current database verification.
