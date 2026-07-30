# SchoolOS role-based access control

The canonical backend policy is `backend/src/config/permissions.js`. Permissions
describe an operation and carry one or more record scopes. Route middleware
enforces the operation; scope middleware enforces the tenant, assignment, self,
or linked-child boundary. Frontend grants returned by `/auth/me` are for
navigation and presentation only and are never accepted as proof of access.

## Default access matrix

| Area | Platform Owner | School Owner | School Admin | Curriculum Manager | Fee Manager | Teacher | Student | Parent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Schools | Platform lifecycle | Own school manage | Own school view | Basic view | Basic view | — | — | — |
| Users | Own/platform support | School manage | School operational manage | — | — | Self | Self | Self |
| Students | Support mode only | School manage | School manage | School academic view | School fee view | Assigned | Self | Linked child |
| Curriculum | Templates/settings | School manage | Operational manage | School manage | None | Assigned view | Self view | Child view |
| Attendance | Platform analytics only | School oversight | School manage | Trends view | None | Assigned mark/view | Self view | Child view |
| Fees | Platform module analytics | School reports/approval | Limited operations | None | School operations | None | Self limited | Child limited |
| Homework/resources | Support only | School oversight | School manage | School manage | None | Assigned create/manage | Self view | Child view |
| Reports/analytics | Platform | School | Operational | Academic | Financial | Assigned | Self | Child |
| Settings | Platform | School | Limited operational | Academic | Fee | Preferences | Preferences | Preferences |

## Enforcement

- `authMiddleware` rejects revoked/inactive accounts and inactive schools.
- `requirePermission` and `requireAnyPermission` enforce operation grants.
- `requireSchoolAccess` rejects request-supplied cross-tenant identifiers.
- `requireStudentAccess` resolves the student record before authorizing school,
  assigned-teacher, self, or child scope.
- `requireAssignedClass` and `requireAssignedSubject` resolve active teacher
  assignments server-side.
- `/students` and `/attendance` high-risk operations are protected by the new
  permission and record-scope middleware.
- `/auth/me` exposes only flattened permission names. The sidebar filters items
  with these grants, and `PermissionGuard`/`ProtectedRoute` support action and
  route gating.

School-level overrides and audited Platform Owner support sessions are not yet
persisted. Those require new approval/support-session models and a migration;
until then the default matrix is deny-by-default and Platform Owner receives no
routine academic or financial mutation permission.
