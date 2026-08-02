# SchoolOS performance and production-readiness guide

## Scope and baseline

This audit was taken on 2026-08-01 before the first optimization slice. Static inspection found 459 Express route declarations, 466 Prisma `findMany` call sites, 104 TanStack Query call sites, 186 inline array query-key declarations, and 115 React `useEffect` call sites across the two frontends. These counts identify review surface; they are not proof that every call is slow or duplicated. Production latency baselines require representative seeded data and the production connection pool.

Existing strengths retained by this work include the singleton Prisma client, extensive compound indexing, bulk student credential and attendance operations, route-level permissions, JWT refresh queuing, React route splitting, compression, bounded JSON bodies, static-asset cache policies, a dashboard summary endpoint, and graceful Prisma shutdown.

## Prioritized audit

| Priority | Current issue | Affected area | Prior behavior and impact | Security risk | Correction / expected benefit |
| --- | --- | --- | --- | --- | --- |
| P0 | Query keys were often resource-only | Most authenticated frontend pages | Cache entries such as `students`, `attendance-dashboard`, and `analytics` could survive within the same browser cache without explicit tenant/user/role identity | Cross-workspace stale display after role switching | Central tenant + user + role + assignment key factory; logout and switching clear private state |
| P0 | No reusable server cache | Public content and reference reads | Repeated public school lookups queried both schema metadata and the school row | None for public data, but future ad-hoc caching could leak tenants | Provider abstraction, mandatory scoped keys, memory/Redis implementations, fallback and tests |
| P0 | Student page size was not capped | `GET /api/students` | A caller could request a very large limit and receive full student models | Excess personal-data exposure and resource exhaustion | Clamp to 1–100, default 25, narrow DTO, complete pagination metadata |
| P0 | All API responses inherited no-store without a safe override | `/api/public/*` | Browsers and CDNs could not revalidate genuinely public data | Low | Explicit public policy and Express ETag support; authenticated routes remain private/no-store |
| P0 | No request correlation or latency distribution | All backend routes | Slow and duplicate requests could not be measured reliably | Logs could become sensitive if bodies were added | Request IDs, redacted paths, structured completion logs, bounded in-memory P50/P95/P99 metrics |
| P1 | Public frontend made separate school/page/collection calls | Public first load | Repeated school resolution and avoidable round trips | Low | `GET /api/public/:schoolSlug/bootstrap`, limited notices/events, cached source row |
| P1 | Cache invalidation rules were absent | All mutations | Adding caches would otherwise create stale tenant data | Incorrect authorization/data if private caches were stale | Post-success school-scoped invalidation; public publication cache invalidated conservatively |
| P1 | Rate limiting covered only selected security/fee routes | Auth, public, general API | Login and common endpoints lacked a uniform outer limit | Brute-force and noisy-neighbor risk | Auth/public/general tiers; existing specialized limits remain |
| P1 | Incoming request timeout was not explicit | All backend routes | Hung clients/handlers could occupy sockets | Availability | Configurable response timeout with a stable error code |
| P1 | Frequently used student filters lacked matching composite indexes | Student directory/allocation | Tenant filtering could scan more index entries as schools grow | Low | Added `(schoolId,isActive,createdAt)` and `(schoolId,className,section,isActive)` |
| P1 | N+1 patterns in teacher dashboard, homework targets, and communication delivery | Named services/controllers | Query count grew with assignments/recipients/students | Availability and noisy-neighbor risk | Batched chapter/progress aggregates, target validation, recipient resolution, policies, preferences, and creator lookup |
| P1 | Allocation roster was unpaginated | `GET /api/students/allocation/roster` | Full active-school roster was returned | Payload and personal-data scope | Server search/status filters, 1-100 page bounds, counts, cancellation, and UI pager |
| P2 | 186 inline query-key declarations existed | Frontend feature pages | Inconsistent keys risked workspace collisions | Cross-workspace stale data | The QueryClient hash function now injects school, user, role, and assignment scope for every legacy key; named factories remain the preferred readable form |
| P2 | Public CMS frontend does not use TanStack Query | `school-frontend` | Its custom hooks can refetch on remount and do not share the main client | Low | Adopt the bootstrap endpoint and a small public query layer in a follow-up frontend release |

## API-call map by page group

| Page / role | Primary initial calls | Decision |
| --- | --- | --- |
| Platform Owner dashboard | `/dashboard/summary`; widgets/secondary management data when opened | Summary endpoint above the fold; performance endpoint is lazy and Platform Owner only |
| School Owner / Admin dashboard | `/dashboard/summary`, branding; optional widgets | Hybrid: cached frontend summary plus lazy operational widgets |
| Parent dashboard | `/dashboard/summary` | One user-private summary; no full attendance/result lists |
| Staff dashboard | `/dashboard/summary` | One role-scoped summary |
| Teacher / Class Teacher | Teacher dashboard and assignment-specific widgets | Keep assignment endpoints separate; migrate keys before adding server caching |
| Curriculum Manager | Curriculum overview, academic context, optional staffing data | Medium-lived query cache; invalidate after curriculum mutations |
| Fee Manager | Fee dashboard and filtered transaction tables | Summary separate from cursor/page tables; no persistent browser cache |
| HR | HR overview and tab-specific employee/payroll calls | Lazy by active tab; salary/payroll stays private/no-store |
| Student | Student portal summary; module data on navigation | User-private keys and short stale times for submissions/results |
| Public school home | Previously school, page, notices, events separately | Use `/public/:schoolSlug/bootstrap`; gallery/faculty remain lazy and paginated |

Confirmed duplicate-risk patterns include raw resource-only keys shared by multiple pages, branding polling plus remount refetch, dashboard pages using role labels rather than full workspace identity, and service functions that did not accept TanStack cancellation signals. TanStack already deduplicated identical mounted query keys, while the Axios client also coalesced identical concurrent GETs without signals. The new key factory makes the identity boundary explicit; priority communication and analytics requests now pass cancellation signals.

## Cache architecture

Controllers and services use `cache.get`, `set`, `delete`, `deleteByPrefix`, `getOrSet`, or `remember`. `getOrSet` coalesces same-process misses. TTL jitter avoids synchronized expiry. Memory mode is bounded LRU with TTL. Redis mode serializes JSON and falls back to bounded memory on transient errors; errors are logged and do not crash request handling.

Key forms are:

```text
school:{schoolId}:session:{sessionId}:resource:{name}:params:{hash}
school:{schoolId}:user:{userId}:role:{role}:resource:{name}:params:{hash}
public:school:{slug-or-id}:published-version:{version}:resource:{name}:params:{hash}
platform:resource:{name}:params:{hash}
```

Inputs containing cache delimiters are rejected. Parameter hashing is recursively stable. Never introduce a tenant resource through `platformResource`.

### Data classification and TTL matrix

| Category / resource | Frontend stale | Backend TTL | Invalidation |
| --- | ---: | ---: | --- |
| A: branding / school profile | 30 minutes | 1 hour | School or branding update |
| A: classes / sections / subjects | 10 minutes | 30 minutes | Matching structure mutation |
| A: roles / permissions | At most token lifetime; preferably 1 minute | At most 1 minute, user-private | Role, assignment, disable, suspension |
| B: timetable / calendar | 2 minutes | 5 minutes | Publish/update/delete |
| B: homework / resources | 1 minute | 2–5 minutes | Publish/update/submission where summary changes |
| B: public homepage/bootstrap | 5 minutes | 15 minutes | Any public content publication; versioned keys preferred |
| C: attendance | 15 seconds | None or 30 seconds | Every attendance transaction/correction |
| C: fee summary | 30 seconds | At most 1 minute, scoped | Payment/allocation/refund/closing |
| C: dashboard | 30 seconds | None initially | Related domain mutation |
| D: notifications/results/profile/payroll | 10–30 seconds or none | None unless user-private and justified | Immediate; clear on logout/role switch |

The first server-cached resource is public school/bootstrap source data. Authenticated dashboard and transaction caching is deliberately deferred until per-route invalidation tests exist.

### Invalidation

Successful authenticated JSON mutations invalidate the requesting school prefix before the success response is sent and conservatively invalidate public content. This is correctness-first and intentionally coarse. Refine it to resource prefixes only after mutation-specific integration coverage exists. Failed responses do not invalidate. Multi-instance deployments require Redis so invalidation is shared.

## HTTP, PWA, and sensitive-data policy

Authenticated API responses are `Cache-Control: private, no-store`. Public endpoints override this with `public, max-age=60, stale-while-revalidate=300`; Express supplies ETags and handles matching conditional GETs. Hashed frontend assets remain immutable for one year. HTML and service-worker files revalidate. Service workers must not add runtime caching for authenticated API URLs.

Passwords, tokens, security answers, fee detail, results, salary, private notifications, and personal profiles must never use public or persistent caches. Role switch, logout, revoked sessions, and failed refresh clear the entire frontend query cache.

## Production configuration

Required production values are `NODE_ENV=production`, `DATABASE_URL`, a restricted `CORS_ORIGINS`, and access/refresh secrets of at least 32 characters. Supported performance settings:

```text
CACHE_ENABLED=true
CACHE_PROVIDER=redis       # memory for a single instance/local development
REDIS_URL=redis://...
CACHE_DEFAULT_TTL=300
CACHE_MAX_ENTRIES=1000
REQUEST_TIMEOUT_MS=15000
RATE_LIMIT_ENABLED=true
LOG_LEVEL=info
```

Use the Supabase session pooler for persistent Render instances and reserve `DIRECT_URL` for migration tooling. Do not multiply Prisma pool size by more instances than the database limit can support. Readiness is `/health/ready`; liveness is `/health/live`. Cache failure degrades to database/memory behavior, while database failure makes readiness return 503.

## Metrics and targets

Every completed request logs request ID, method, redacted path, status, duration, school/user/role identifiers, and cache state. Requests over 500 ms log at warning level and over 2 seconds at error level. `GET /api/dashboard/performance` is restricted to Platform Owner and returns bounded, process-local request count, error rate, cache rate, P50/P95/P99 latency, uptime, and memory—not school records.

Acceptance targets remain: public cached GET P95 <200 ms, authenticated reference P95 <300 ms, dashboard summary P95 <600 ms, paginated table P95 <500 ms, normal-section bulk attendance P95 <1 s, and >70% cache hit rate for selected reference/public resources. A local warm-cache profile against the shared database (200 requests per route, concurrency 10) measured liveness at P50 14.98 ms / P95 61.24 ms / P99 66.51 ms and public bootstrap at P50 15.82 ms / P95 35.18 ms / P99 75.29 ms, with zero HTTP failures. These measurements validate the harness and current shared-data path; deployment telemetry remains authoritative.

## Verification and benchmark procedure

1. Apply migrations in staging and seed representative small, medium, and large schools. The three performance migrations described below are already applied to the shared database.
2. Warm each cacheable route, then run cold and warm load profiles separately with authenticated identities from two schools and two roles.
3. Record request counts, response bytes, P50/P95/P99, error rate, database CPU/connections, and cache hit rate.
4. Mutate each resource during load and assert the next authorized read is current.
5. Repeat role switching and logout on a shared browser profile; inspect query cache and service-worker storage.
6. Compare the Platform Owner metrics with hosting and PostgreSQL telemetry. Process-local metrics reset on deploy and are not a durable monitoring substitute.

Automated infrastructure coverage verifies tenant/user/role key separation, stable filter hashing, TTL/LRU behavior, stampede coalescing, tenant-prefix invalidation, and HTTP privacy policies. Prisma schema validation and the production frontend build are required release checks. Database integration tests should run against an isolated staging database.

## Troubleshooting, cache clearing, and rollback

- Set `CACHE_ENABLED=false` to bypass all server caching without code changes.
- For one school, delete `school:{schoolId}:*`; for a publication incident, delete `public:school:{identity}:*`. Avoid global flushes on shared Redis.
- Redis errors are emitted as structured `cache_error` events. Repeated errors mean verify URL, TLS, network rules, and connection limits.
- A readiness failure with `database: unavailable` should remove the instance from traffic; inspect pooled `DATABASE_URL` and Supabase connection limits.
- Roll back application code first. The three added indexes are additive and safe to leave in place. If removal is necessary after profiling, drop only the named performance indexes in a controlled migration.
- If public content appears stale, disable caching, clear the public prefix, verify publication invalidation, then restore caching.

## Completion record

The remaining optimization scope is implemented across the route surface through shared controls plus targeted high-risk query changes:

- All legacy and `/api/v1` route aliases inherit request correlation, latency metrics, timeouts, private/public cache policy, tiered rate limiting, mutation invalidation, and query bounds. Page size is capped at 100, search text at 200 characters, date spans at 366 days, and bulk arrays at 500 items.
- Every TanStack Query key is identity-scoped centrally, including legacy inline keys. Dashboard, analytics, communication, and allocation flows also use explicit factories and cancellation signals.
- Student allocation, profile users, galleries, public notices/events/testimonials, role audit, and credential-account reads are bounded or paginated. Credential listing uses narrow projections and no password fields. The profile users query now enforces the requesting school, closing a tenant-isolation gap found during the audit.
- Teacher dashboard, homework targeting, and communication delivery paths batch the identified per-item queries. Fee collection, invoice, and refund workflows were audited and already persist unique idempotency keys within their transactions.
- Public bootstrap keys contain the school's persisted publication version. Relevant successful CMS mutations increment the version transactionally before school/public prefix invalidation.
- Migrations `20260801000000_performance_student_indexes`, `20260801010000_publication_version`, and `20260802000000_student_allocation_sort_index` are applied to the shared database. Verification confirmed `School.publicationVersion` and all three student indexes.
- `EXPLAIN (ANALYZE, BUFFERS)` profiling against the largest shared tenant (264 students) used `Student_schoolId_isActive_createdAt_idx` for recent students (0.250 ms execution) and `Student_schoolId_isActive_className_section_createdAt_idx` for allocation ordering (0.257 ms execution).
- Release verification passed: Prisma schema validation, both production frontend builds, and 133 backend tests (121 passed, 12 database-dependent skips, 0 failed). The benchmark and database checks are repeatable with `npm run benchmark`, `npm run verify:performance-migration`, and `npm run profile:database` from `backend`.

Ongoing production profiling is an operational feedback loop, not unfinished implementation. Use the metrics endpoint and hosting/PostgreSQL telemetry to find workload-specific regressions, and add a cache only when its mutation invalidation is covered. Production dependency audits report zero known vulnerabilities for the backend and both frontends.
