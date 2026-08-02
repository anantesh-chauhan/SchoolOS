# Attendance accountability workflow

## Existing-module audit

The existing module already provided tenant-scoped daily student records, effective enrollment history, configurable statuses, working-day calculations, Class Teacher authorization, correction requests, locks, audit rows, notifications, exports, and monthly analytics. The accountability upgrade retains these features.

The audit found four material gaps:

1. A submitted daily register could still be changed by the normal upsert path.
2. An approved student correction overwrote the effective row without an immutable session revision or field-level change set.
3. Daily registers did not preserve the assigned Class Teacher separately from the actual marker, marker role, or Admin override reason.
4. School Owner inherited attendance correction and lock privileges instead of being view-only by default.

All current student attendance writes now enter through `attendanceWorkflow.service.js`. Legacy request shapes remain accepted, but the legacy student mutation endpoint delegates to the same service.

## Permission matrix

| Action | Class Teacher | School Admin | School Owner | Subject Teacher | Student/Parent |
|---|---:|---:|---:|---:|---:|
| View assigned section | Yes | All sections | All sections | No marking access | Own/linked attendance |
| Save draft | Assigned section | Any section, reason required | No | No | No |
| Submit | Assigned section | Any section, reason required | No | No | No |
| Edit after submission | No | Correction workflow only | No | No | No |
| View history | Assigned section | Yes | Yes | No | Relevant own records only |
| Correct / cancel / lock | No | Yes | No by default | No | No |
| Export / audit | No | Yes | Yes | No | No |

`schoolId` is always read from the authenticated server identity. Section, academic session, assignment, enrollment and attendance-session queries include that school boundary.

## State machine

```text
NOT_STARTED -> DRAFT -> LOCKED -> CORRECTED
       |          |         `-> CANCELLED
       |          `-> NOT_APPLICABLE
       `-> LOCKED
```

Submission records both `ATTENDANCE_SUBMITTED` (or `ATTENDANCE_MARKED_BY_ADMIN`) and `ATTENDANCE_LOCKED` in the immutable audit log. `SUBMITTED` remains a recognized lifecycle state for migration/import compatibility, while an online submission is locked in the same database transaction.

Drafts have revision 0. The first submission creates immutable revision 1 with a full student snapshot and summary. Each Admin correction creates the next full snapshot plus structured field changes. Full snapshots make reconstruction and operational recovery straightforward; change rows make student history efficient.

## API

Class Teacher and shared view routes:

- `GET /api/v1/attendance/sections/:sectionId/dates/:date`
- `POST /api/v1/attendance/sections/:sectionId/dates/:date/draft`
- `POST /api/v1/attendance/sections/:sectionId/dates/:date/submit`
- `GET /api/v1/attendance/sessions/:attendanceSessionId/history`

School Admin routes:

- `GET /api/v1/admin/attendance/overview?date=YYYY-MM-DD`
- `GET /api/v1/admin/attendance/pending?date=YYYY-MM-DD`
- `GET /api/v1/admin/attendance/sections/:sectionId/dates/:date`
- `POST /api/v1/admin/attendance/sections/:sectionId/dates/:date/submit`
- `POST /api/v1/admin/attendance/sections/:sectionId/dates/:date/not-applicable`
- `POST /api/v1/admin/attendance/sessions/:attendanceSessionId/corrections`
- `GET /api/v1/admin/attendance/sessions/:attendanceSessionId/history`
- `GET /api/v1/admin/attendance/audit-logs`

Admin submission requires `overrideReasonCode`; `OTHER` additionally requires a note. Correction requires both `reasonCode` and `reasonNote`. The backend reads previous values from the database.

Clients should send `expectedRevision` on all follow-up writes. A stale version returns HTTP 409 with a refresh instruction. Identical retry submissions return the existing locked session without creating duplicate revisions.

## Data and transaction guarantees

- Unique register: school, class, section and attendance date.
- Unique student row: school, class, section, student and date.
- Unique revision number per attendance session.
- Submission atomically updates the register and student rows, creates revision/change rows, and appends audit events.
- Correction atomically claims the current register version, updates effective rows, creates a new revision/change set, and appends its audit event.
- Submitted records are never deleted by application routes.
- The global mutation middleware invalidates the tenant's cached dashboard, report, student and section keys after a successful response.

## Operator flow

The Attendance control centre lists every section for a selected date, assigned Class Teacher, contextual teacher-attendance status, register status, actual marker type, submission time and revision. Admin opens a pending row, selects an override reason, completes the register and submits. The record immediately becomes locked.

For a correction, Admin selects **Correct Attendance**, changes only affected students, supplies a reason and confirms. The detail page reloads the effective values and displays the revision timeline with old/new status and remark values. Class Teachers see the same locked message and history but no correction controls.

## Deployment

```powershell
cd backend
npx prisma migrate deploy
npx prisma generate
npm run seed:attendance
npm test

cd ../frontend
npm run build
```

Migration: `backend/prisma/migrations/202608020001_attendance_accountability/migration.sql`.
