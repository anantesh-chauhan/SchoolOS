# SchoolOS attendance management

## Existing implementation and upgrade

SchoolOS already had tenant-scoped student and teacher daily records, class-teacher authorization, an academic calendar, basic monthly registers, personal history, HR employee attendance, leave approval, payroll, and communication delivery. The upgrade retains those integrations and adds configurable calculations, explicit `NOT_MARKED` state, draft/submitted registers, session-aware cumulative reports, enrollment history, corrections, locks, audits, employee summaries, notification idempotency, CSV/print exports, and role-specific navigation.

Percentages are calculated from source records as `attendance units / eligible working-day units × 100`. Weekly offs, holidays, vacations, half-working overrides, joining dates, exit dates, and section enrollment dates are applied by the backend service. Stored monthly snapshots are rebuildable and are not the source of truth.

## Schema and migration

Migration: `backend/prisma/migrations/202607220002_attendance_management/migration.sql`

New models: `AttendanceStatusDefinition`, `AttendanceRule`, `AttendanceDailyRegister`, `AttendanceCorrectionRequest`, `AttendanceAuditLog`, `AttendanceLock`, `AttendanceMonthlySnapshot`, `AttendanceNotificationLog`, `SchoolWorkingDay`, and `StudentEnrollmentHistory`.

`StudentAttendance` now stores units, enrollment/leave references, submission/lock metadata, and a revision. `EmployeeAttendance` now stores units, salary impact, approval/leave linkage, and lock metadata. Status columns are text so tenant-configured status codes can be persisted safely. Uniqueness and reporting indexes remain tenant-scoped.

## Permission matrix

| Capability | Owner/Admin | Class teacher | Subject teacher | HR | Student/Parent | Staff/Teacher self |
|---|---:|---:|---:|---:|---:|---:|
| View class attendance | All sections | Assigned section | Taught sections, read-only | No | Linked self/children only | No |
| Mark student attendance | Yes, reason on override | Assigned section | No | No | No | No |
| View/mark employee attendance | Yes | Own view | Own view | Yes | No | Own view |
| Request correction | Yes | Assigned students or own employee record | Assigned students or own record | Employee records | Linked self/children | Own employee record |
| Review corrections | Yes | No | No | Employee attendance | No | No |
| Lock/export/audit | Yes | No | No | Employee scope | No | No |
| Configure rules/statuses | Yes | No | No | No | No | No |

Platform owners do not receive detailed tenant attendance through these endpoints.

## Backend APIs

- `GET /api/attendance/metadata`, `PUT /settings`, `PUT /statuses`
- `GET /students`, `POST /student-register`
- `GET /students/class/:classId/section/:sectionId/month/:month`
- `GET /students/:studentId/profile`
- `GET /employees/month/:month`, `POST /employees`
- `GET|POST /corrections`, `PATCH /corrections/:id`
- `POST /locks`, `POST /locks/:id/unlock`
- `GET /dashboard`, `GET /audit`, `GET /export.csv`
- Existing calendar and personal-history APIs remain compatible.

Every management endpoint derives the school from the authenticated identity, validates referenced records inside that school, and applies role plus assignment checks. Duplicate daily submissions are upserts behind compound unique constraints; duplicate IDs in a bulk request are rejected.

## Frontend routes

- `/attendance` — administration control centre
- `/dashboard/admin/attendance/students` and `/teacher/attendance` — daily student marking
- `/attendance/students/class/:classId/section/:sectionId/month/:month` — independent class-month report
- `/attendance/students/:studentId` — individual overview, history, trend, and calendar
- `/attendance/employees/month/:month` — payroll-ready employee report
- `/attendance/request-correction` — student, parent, teacher, and staff self service
- `/attendance/corrections` — correction review
- `/attendance/settings` — rules and configurable statuses
- `/attendance/audit` — audit history
- Existing student, parent, teacher, HR, and academic-calendar routes remain available.

CSV export is authenticated and includes source records. Monthly pages are print-friendly; the browser print dialog provides PDF output. Excel can import the UTF-8 CSV without conversion.

## Setup and demo data

From `backend`:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run seed:attendance
npm test
```

From `frontend`:

```powershell
npm run build
npm run dev
```

Demo seed logins:

- Admin: `admin@greenvalley.edu.in` / `admin123`
- School owner: `owner@greenvalley.edu.in` / `admin123`
- Class teacher example: `ananya.gvs001@schoolos.com` / `admin123`
- HR manager after `npm run seed:hr`: `naveen.nair.39@green-valley-school.schoolos.test` / `Hr@SchoolOS2026!`
- Students and parents use the generated IDs shown by the existing instant-login/demo-account screen; their seeded password is `admin123`.

Recommended smoke flow: sign in as admin, open Attendance Dashboard, configure rules, mark and submit a section, open its monthly report, inspect a student calendar, submit a correction from a student/parent login, approve it as admin, then review the audit trail. Use HR to inspect employee monthly attendance and payroll impact.

## Assumptions and optional enhancements

- Academic sessions, class-teacher/subject assignments, students, employees, leave, calendar, and communication records remain the authoritative existing modules.
- The school timezone defaults to `Asia/Kolkata`; all stored attendance dates remain normalized UTC date-only values.
- Parent multi-child access uses existing direct linkage plus active `FeeFamilyLink` records.
- Period-wise attendance, biometric ingestion, signed server-rendered PDF pagination, spreadsheet-native XLSX output, and evidence-file upload are optional extensions; daily/monthly attendance, corrections, CSV, and print-to-PDF do not depend on them.
