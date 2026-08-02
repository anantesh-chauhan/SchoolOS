# Role-aware workspace navigation

## Product model

SchoolOS now separates three concepts:

1. **Responsibility** — the active server-authorized role assignment. Multi-role users can change this through the existing audited role-switch endpoint without signing in again.
2. **Workspace** — the type of work the user wants to perform, such as My Teaching, Finance, or Examination.
3. **Tool or record** — the authorized page, action, or entity opened inside that workspace.

Home is a service launcher. On Home, the sidebar lists only the workspaces visible to the current responsibility, favorites, and recent activity. Selecting one opens its first-class `/workspace/:workspaceId` route and replaces the entire navigation surface with a Switch Workspace action plus tools from that workspace only. Cross-workspace favorites, recents, pages, and entity results are excluded while focused. Existing operational pages, APIs, query caches, permissions, role guards, audit events, and tenant scoping remain authoritative.

## Source-of-truth mapping

| Existing feature / routes | Existing access control | Target workspace | Section / perspective |
| --- | --- | --- | --- |
| Teacher dashboard and `/teacher/assignments/**` | Teacher assignment and route guards | My Teaching | Assigned class cards, chapters, students, progress |
| `/teacher/attendance`, student attendance routes | Attendance permissions and assignment checks | My Teaching; Students | Mark attendance; view student history |
| `/homework` | Homework permissions and audience scoping | My Teaching / My Learning | Homework, resources, submissions, moderation |
| Curriculum dashboard/manage | Curriculum role and permissions | Curriculum / Academic | Subjects, books, chapters, resources |
| Weekly slots, timetable builder/audit, calendar | Weekly-slot and calendar permissions | Academic / Curriculum | Timetable and schedule |
| Student management/allocation | Student permissions | Students | Admissions, records, allocation |
| Teacher management and assignments | Staffing permissions | Staff | Teachers, class teachers, workload |
| HR workspace and self service | HR roles | Staff | Attendance, leave, payroll, reports |
| Fee dashboard, collection, structures, operations | Fee permissions | Finance / Fees | Overview, collection, dues, receipts, configuration, reports |
| `/examinations` | Examination roles and route guards | Examination / Results | Schedule, marks, verification, publication, analytics |
| Communication hub, notifications, polls, gallery | Communication and notification permissions | Communication | Notices, messages, feedback and media |
| Student/class/school analytics | Analytics permissions | Analytics | Academic and operational insights |
| Users, roles, credentials, school settings | Administration permissions | Administration | Access, configuration and security |
| Platform schools, settings, fees and issues | Platform Owner routes | Schools / Platform | Tenant operations and oversight |
| Existing browser activity | Current filtered navigation | Home and sidebar | Continue Working and Recent Activity |

The same route can appear in more than one workspace when the intent differs. This does not duplicate a page or backend capability.

## Role workspace matrix

Workspace visibility starts with a role allowlist and then requires at least one existing navigation item that survives the current permission filter.

| Responsibility | Visible workspaces |
| --- | --- |
| Platform Owner | Home, Schools, Analytics, Billing/Finance, Administration |
| School Owner | Home, Academic, Students, Finance, Examination, Communication, Analytics, Staff, Administration |
| Admin | Home, Academic, Students, Finance, Examination, Communication, Analytics, Staff, Administration |
| Curriculum Manager | Home, Curriculum |
| Fee Manager | Home, Finance |
| Exam Coordinator / Controller | Home, Examination |
| Principal | Home, Examination, Analytics |
| Subject Teacher | Home, My Teaching, My Students, Communication; no class attendance or fee records |
| Class Teacher | Home, My Class, Class Fees, Class Results, Communication |
| HR / HR Manager | Home, Staff |
| Staff | Home, Staff, Communication |
| Student | Home, My Learning, My Attendance, My Results, My Fees, Communication |
| Parent | Home, My Child, Homework, Results, Fees, Communication |

### Multi-role behavior

Home combines workspaces from `availableRoles`, deduplicates them by business area, and associates every card with the role assignment that authorizes it. Opening a workspace that belongs to another responsibility calls the existing `switchRole` operation, receives a new active-role token, clears private cached data through the existing auth service, and opens the target. There is one identity and one login session; authorization is never unioned in the browser.

This is deliberately safer than merging permission arrays client-side. The backend continues to authorize every request using one audited active responsibility.

## Permission levels

- **Workspace:** role allowlist plus at least one permission-filtered destination.
- **Section:** workspace tools are derived from `buildDashboardNavigation`, after `filterNavigation` for the active responsibility.
- **Action:** existing page controls, permission helpers, protected routes, and backend authorization remain unchanged.

Teacher responsibilities are deliberately non-unioned. The Subject Teacher responsibility can manage assigned subjects, homework, subject marks, and assigned-student analytics, but cannot mark class attendance or read fee records. The Class Teacher responsibility can mark attendance for its assigned section, view read-only class fee records, send scoped reminders/notifications, and verify class results. It cannot collect, adjust, refund, configure, or update fees.

Stored recent or favorite IDs are resolved against the current workspace/navigation model. Items no longer authorized are therefore not rendered.

## Home information architecture

1. Welcome and global search.
2. Continue Working: the three most recent context-preserving destinations.
3. Favorite Workspaces when the user has pinned any.
4. Choose Your Workspace: consistent cards with icon, short description, optional pending count, and open action.
5. My Work: role-relevant high-frequency actions from the existing authorized menu.
6. Recent Activity: up to ten destinations with relative timestamps.

Cards deliberately contain no charts, filters, or tables. Operational detail remains inside the focused workspace.

## Context preservation

- The last active workspace is stored per user, tenant, and active responsibility.
- Recent entries store the complete path, query string, and hash, while resolving their label and icon against the current authorized navigation.
- Teacher assignment pages already use assignment-scoped URLs and server checks, preserving class, section, and subject without global selectors.
- Attendance accepts class and section query parameters.
- Homework/resource creation accepts assignment and subject parameters and initializes the existing audience form after its authorized context loads.
- Role switching clears private query state through the existing authentication service.

## Global search

On Home, Ctrl/Cmd+K searches:

- Visible workspaces.
- Authorized pages and actions from the current navigation model.
- Recent activity.
- Server-scoped students for Finance/Admin roles.
- Server-scoped teachers for School Owner/Admin.
- Accessible examinations for examination-capable roles.

Inside a selected workspace, both local and server-backed results are restricted to that workspace (for example, Finance cannot return examinations or staff). Recent results are intersected with the active workspace's authorized tool list. Entity requests are debounced and use existing endpoints. Each endpoint applies the current active role and tenant scope. Failed or unauthorized providers contribute no results and do not reveal error data in the palette.

## Common flows

- Attendance: Home → My Teaching → Attendance → assigned section. Three interactions; assignment/query context removes repeated class selection where available.
- Homework: Home → My Teaching → class card → Homework. The assignment is already populated in the existing creation workflow.
- Fee collection: Home → Finance → Collect Fee. Student search uses the existing tenant-scoped fee endpoint.
- Marks: Home → Examination → Marks Entry. Existing examination status and role controls remain intact.
- Admissions: Home → Students → Students / allocation. Existing student lifecycle pages remain canonical.
- Communication: Home → Communication → Communication Hub or Notifications.

## Responsive behavior

- Desktop uses a 280 px workspace sidebar; collapsed mode shows only workspace icons.
- Phones and tablets use the existing full-height overlay drawer with large workspace and tool targets.
- Search becomes a full-width control above page content on small screens.
- Workspace cards move from three columns to two and then one.
- Continue Working and My Work use responsive grids; favorite workspaces scroll horizontally.
- Existing page-level mobile behavior, drawers, sticky actions, and table overflow remain unchanged.

## Component architecture

```text
DashboardLayout
├── Sidebar
│   ├── Workspace switcher
│   ├── Active workspace tools
│   ├── Favorite workspaces
│   └── Recent activity
├── GlobalNavigator
│   ├── Workspace/page/action results
│   ├── Scoped entity providers
│   └── Recent activity
└── Existing page content

WorkspaceHomePage
├── Continue Working
├── Favorite Workspaces
├── Workspace Cards
├── My Work
└── Recent Activity
```

Configuration remains separate from rendering:

- `dashboardNavigation.jsx`: existing role menu and permission filtering.
- `workspaceNavigation.jsx`: role workspace allowlist, classification, labels, and active-path resolution.
- `useNavigationMemory.js`: user/tenant-scoped active history and workspace favorites.
- `globalSearchService.js`: existing endpoint-backed, role-scoped entity providers.

## Migration plan

1. Keep all old routes live and introduce `/workspace/home` as the post-login launcher.
2. Derive workspace sections from the existing filtered navigation instead of moving pages.
3. Measure launcher, search, recent, and workspace usage by existing route telemetry/audit facilities.
4. Add deep links from class cards and other high-frequency records to existing pages with context parameters.
5. Split overloaded pages internally only when user testing shows a task bottleneck; keep request payloads and endpoints unchanged.
6. Add more scoped search providers only when an existing backend endpoint has the correct role and tenant enforcement.
7. Remove legacy long-menu presentation only after every route appears in at least one authorized workspace and role regression tests pass.

## Verification checklist

- Every existing route remains registered and directly loadable.
- Workspace visibility matches the role matrix and permission-filtered destinations.
- Fee Manager cannot see Teaching, Examination, HR, or Administration.
- Curriculum Manager cannot see Finance or HR.
- Teachers see only assignment-backed teaching functionality.
- Student and parent pages remain self/linked-child scoped.
- Multi-role workspace selection performs an audited role switch before navigation.
- Recent activity stores context-bearing URLs and hides entries unavailable to the current responsibility.
- Favorites are user- and tenant-scoped and resolve only visible workspaces.
- Ctrl/Cmd+K, arrows, Enter, and Escape work; entity results come only from scoped APIs.
- No API, database schema, audit, business-logic, permission, or tenant-isolation contract changed.
- Desktop, collapsed desktop, tablet drawer, and 320 px phone layouts remain usable.
