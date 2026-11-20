# Performance Baseline — Phase 0

## Existing optimisation found
- Migration `0022_guardrail_composite_indexes.sql` creates composite indexes for common school/date/status and tenant query paths.
- Migration `0027_principal_stats_and_outbound_dispatch.sql` creates additional indexes and `get_principal_dashboard_stats(uuid)`.
- The principal dashboard aggregate computes counts and a bounded recent notices list in PostgreSQL.
- Teacher import handlers chunk selected writes in batches of up to 500 rows.
- Learner and history imports accept up to 5,000 input rows.

## Known source-level risk
`src/lib/realtime.ts` subscribes to seven tables and calls `queryClient.invalidateQueries()` without a query key for every event. This can invalidate unrelated tenant queries and cause avoidable request bursts. This is a confirmed implementation pattern; production impact still needs measurement.

## Not verified
- Live index presence/use and query plans.
- Supabase pooler configuration and connection limits.
- Database CPU, memory, IOPS, locks and slow-query logs.
- Concurrent user/write capacity.
- Vercel function duration/concurrency and region.
- CDN/cache configuration and browser memory.
- Performance under Monday-morning attendance load.

## Benchmark plan
Use synthetic non-production data and staged concurrency (e.g. 25, 100, 250 concurrent sessions, then higher only after safe results). Include attendance register reads, batched saves, parent reads and principal aggregate calls. Measure p50/p95/p99 latency, error rate, DB CPU, locks, connection saturation and duplicate/lost writes. Do not state a capacity target until measured.
