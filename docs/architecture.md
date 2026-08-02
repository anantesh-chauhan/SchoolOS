# SchoolOS architecture

SchoolOS is a PostgreSQL/Prisma 5.22, Express, and React/Vite application. The backend is multi-tenant: tenant-owned operations receive the active school from the authenticated workspace and keep `schoolId` in their Prisma filters. Authentication is enforced by `authMiddleware`; role and permission checks remain in `requireRole`, `requirePermission`, scope middleware, and domain-specific teacher/parent/student authorization helpers.

## Backend modules

Routes remain the public API composition layer. Existing route paths and middleware order are unchanged. Controllers translate HTTP requests and responses; services own workflows and transaction boundaries.

Large compatibility entry points such as `auth.controller.js`, `student.controller.js`, `timetable.controller.js`, `teacher.controller.js`, `widgets.controller.js`, `fee.service.js`, `feeWorkflow.service.js`, `feeAdvanced.service.js`, and `analytics.service.js` now re-export focused implementations. This lets existing route imports remain stable while implementation files are organized by use case.

When adding a backend feature:

1. Put the route in `backend/src/routes` or the domain under `backend/src/modules`.
2. Keep authentication, permissions, and scope middleware on the route.
3. Pass the authenticated actor and tenant context into the controller/service.
4. Keep transactions inside the service and use the transaction client for every operation in the transaction.
5. Keep tenant filters on reads, writes, nested relations, and authorization lookups.
6. Add tests for the route contract, tenant boundary, role combinations, and sensitive audit writes.

## Frontend features

Route-level lazy imports and route groups live under `frontend/src/routes`. Feature-specific fee components live under `frontend/src/features/fees/components`. Dashboard role navigation lives in `frontend/src/config/navigation`, while `DashboardLayout` remains responsible for layout state and composition. Global styles are split under `frontend/src/styles` and composed by `frontend/src/index.css`.

When adding a frontend feature, keep the route in the appropriate route group, use a route-level page for data/loading/permission composition, and place meaningful feature components, hooks, and API calls in the feature directory. Preserve the authenticated API client, request fields, response handling, and route guards.

## Seeds

`backend/prisma/seed.js` is the explicit orchestrator. It seeds the platform owner, demo foundation, academics, staffing, tenant-isolation scenarios, homework, and communication in dependency order. Domain seed files remain independently callable where package scripts expose them. Reuse returned identifiers, preserve school scoping, and keep existing upsert/idempotency behavior when extending seeds.

