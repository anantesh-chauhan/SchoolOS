# SchoolOS Student Academic Analytics

## Architecture and schema audit

SchoolOS uses an Express 4 ESM backend, Prisma 5 with PostgreSQL, JWT authentication, school-scoped records, role middleware, and a React 18/Vite frontend. The requested brief named React 19, but the active application is React 18.2; analytics follows the installed application rather than forcing a framework upgrade.

Existing models reused by analytics:

- `School`, `AcademicSession`, `Class`, `Section`, `Subject`, `Chapter`, and `ChapterProgress`
- `Student`, `Teacher`, `TeacherAssignment`, and `SectionClassTeacherAssignment`
- `StudentAttendance` and the existing attendance-unit calculation
- `Homework`, `HomeworkAudience`, and `HomeworkSubmission`
- `SectionResource`, `ResourceTarget`, and `ResourceActivity`
- `ChapterPoll`, `StudentChapterVote`, and `ChapterAnalysisSummary`
- `TeacherStudentEvaluation`
- `ChapterAssessment`, `ChapterAssessmentResult`, and `StudentChapterMastery`
- `LearningGap` and the extended `LearningIntervention`
- `AcademicNotification` and `AcademicContentAudit`

Important compatibility findings:

- There is no general examination, grade, or marks model. The current source of assessment truth is `ChapterAssessment` and `ChapterAssessmentResult`. Analytics uses it without inventing exam records. Optional assessment components now support advanced chapter/outcome mapping while simple assessment entry remains valid.
- Student class and section membership is stored as names on `Student`; the analytics repository resolves these to tenant-scoped `Class` and `Section` records.
- Parent linking uses the existing token-linked student and `FeeFamilyLink` relationship.
- Existing homework/resource/schema files contained uncommitted user changes. Analytics is additive and does not replace those changes.
- Finalized school/class academic-health summaries intentionally prefer immutable analytics snapshots. Students without a snapshot are labelled `LIVE_ATTENDANCE_ONLY`; they are never silently assigned a zero score.

## New and modified data

New models:

- `AnalyticsConfiguration`
- `AnalyticsRiskRule`
- `LearningOutcome`
- `AssessmentComponent`
- `StudentAssessmentComponentScore`
- `ResourceEngagementEvent`
- `AnalyticsRecommendation`
- `StudentAnalyticsSnapshot`
- `AnalyticsAuditLog`
- `AnalyticsStatusOverride`

`LearningIntervention` is reused and extended with creator/assignee fields, type, title, priority, outcome, follow-up date, parent visibility, and confidential notes. `InterventionStatus` adds `NO_RESPONSE` and `FOLLOW_UP_REQUIRED`.

The migration is additive and is located at:

`backend/prisma/migrations/202607230900_student_academic_analytics/migration.sql`

It adds no destructive table drops. Historical snapshots and audit references intentionally remain scalar so school-history evidence survives later academic archival.

## Backend design

The analytics module lives in `backend/src/modules/analytics`.

- Controllers only translate HTTP requests and responses.
- Repository queries batch a student's evidence by module and avoid per-chapter queries.
- Calculation engines are pure and independently tested.
- Missing values are `null`, excluded from the weighted score, and cause proportional re-normalization.
- A real score of zero remains a valid measured score.
- Every score returns configured weight, effective weight, raw score, and contribution.
- Risk signals are explainable and correlated signals are category-capped to avoid double counting.
- Attendance/performance and homework/performance text uses association language, never causal claims.
- Live student results use a 60-second in-process cache. Analytics mutations invalidate the related tenant/student prefix.
- Student and parent responses redact internal evaluation fields, confidential intervention content, and risk evidence.
- Resource events use a 30-second dedupe bucket. Duration is accepted only when the client explicitly reports an active tab and is capped at five minutes per event.
- Successful attendance, homework, assessment, curriculum, chapter-feedback, evaluation, and resource mutations invalidate the relevant tenant analytics caches through request-safe response hooks.
- Replacing an existing assessment-component map requires `confirmReplace: true`, reports how many component scores will be removed, and records the old/new maps in the analytics audit log.

## API

All endpoints require JWT authentication and return the common `{ success, message, data, meta }` envelope.

Read:

- `GET /api/analytics/students`
- `GET /api/analytics/students/:studentId`
- `GET /api/analytics/students/:studentId/overview`
- `GET /api/analytics/students/:studentId/subjects`
- `GET /api/analytics/students/:studentId/subjects/:subjectId`
- `GET /api/analytics/students/:studentId/subjects/:subjectId/chapters/:chapterId`
- `GET /api/analytics/students/:studentId/chapters/:chapterId`
- `GET /api/analytics/students/:studentId/trends`
- `GET /api/analytics/students/:studentId/risk`
- `GET /api/analytics/students/:studentId/recommendations`
- `GET /api/analytics/students/:studentId/interventions`
- `GET /api/analytics/classes/:classId`
- `GET /api/analytics/sections/:sectionId`
- `GET /api/analytics/school/overview`
- `GET /api/analytics/configuration`
- `GET /api/analytics/risk-rules`
- `GET /api/analytics/chapters/:chapterId/learning-outcomes`

Write:

- `PATCH /api/analytics/configuration`
- `POST|PATCH /api/analytics/risk-rules[/:id]`
- `POST|PATCH /api/analytics/chapters/:chapterId/learning-outcomes[/:id]`
- `PUT /api/analytics/assessments/:assessmentId/components`
- `PUT /api/analytics/assessments/:assessmentId/component-scores`
- `POST /api/analytics/resources/:resourceId/engagement`
- `POST /api/analytics/interventions`
- `PATCH /api/analytics/interventions/:id`
- `POST /api/analytics/snapshots`
- `POST /api/analytics/status-overrides`

Reports:

- `GET /api/analytics/reports/students/:studentId.pdf`
- `GET /api/analytics/reports/students/:studentId.csv`
- `GET /api/analytics/reports/students/:studentId/subjects/:subjectId.:format`
- `GET /api/analytics/reports/students/:studentId/subjects/:subjectId/chapters/:chapterId.:format`
- `GET /api/analytics/reports/classes/:classId.:format`
- `GET /api/analytics/reports/sections/:sectionId.:format`
- `GET /api/analytics/reports/school.:format`

CSV output neutralizes spreadsheet-formula prefixes. Report responses are private and `no-store`. PDF output uses the existing open-source PDFKit dependency and school identity data.

For assessment component replacement, clients must first show a destructive-replacement warning and then send:

```json
{
  "confirmReplace": true,
  "reason": "Corrected the finalized component mapping.",
  "components": [
    {
      "title": "Linear equations",
      "maximumMarks": 20,
      "learningOutcomeId": "optional-outcome-id",
      "difficulty": "MEDIUM"
    }
  ]
}
```

Supported query parameters include `academicSessionId`, `dateFrom`, `dateTo`, `page`, `limit`, `search`, `className`, and `section` where relevant.

## Role and privacy behavior

- School owners/admins: tenant-wide students, class/section/school summaries, configuration, rules, snapshots, overrides, interventions, and reports.
- Curriculum managers: tenant-wide academic analytics and learning outcomes, without configuration/override administration.
- Teachers: only assigned classes/sections; subject access checks require the relevant assignment. Internal observations are available only in their permitted scope.
- Students: only the token-linked student.
- Parents: only linked children. Internal comments and non-parent-visible interventions are removed.
- Platform owners are deliberately excluded from individual student endpoints. Cross-school adoption analytics should be implemented as aggregate-only platform metrics.

## Frontend

Routes:

- `/analytics/students`
- `/analytics/students/:studentId`
- `/analytics/students/:studentId/subjects/:subjectId`
- `/analytics/students/:studentId/subjects/:subjectId/chapters/:chapterId`
- `/analytics/school`
- `/analytics/classes/:classId`
- `/analytics/sections/:sectionId`
- `/analytics/configuration`

The feature is under `frontend/src/features/analytics` and contains dedicated API, hook, page, component, and constants folders. It uses existing Tailwind, Framer Motion, React Query, Recharts, shared cards/badges/buttons, light/dark themes, skeletons, errors, responsive cards, accessible chart tables, and sticky data headers.

The analytics links are also integrated into the existing owner/admin, teacher, student, and parent dashboards and role-aware sidebar.

## Phased implementation record

1. Foundation: audited schema/auth/UI; added configuration, score/coverage engines, student overview API, cache, and basic profile UI.
2. Subject/chapter: added drill-down engines/UI, learning outcomes, advanced assessment mapping, outcome evidence, and chapter filters.
3. Risk/recommendations: added configurable risk rules, explainable category-capped risk, role-specific recommendations, snapshot persistence, and deduplicated risk notifications.
4. Intervention: extended the existing workflow, audit history, parent visibility, confidential notes, timeline UI, and follow-up states.
5. Class/school/reporting: added batched snapshot-backed class/section/school summaries, dashboards, PDF/CSV exports, and print-compatible browser surfaces.
6. Optimization: added query indexes, batching, short-lived caching, cache invalidation for analytics mutations, immutable snapshots, formula versioning, regression tests, and this documentation.

## Setup and verification

From `backend`:

```text
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run seed:analytics
npm test
```

Use `npx prisma migrate dev` only in a development database. Do not use `prisma db push` for production.

From `frontend`:

```text
npm run build
```

Verification on 2026-07-23:

- Prisma schema validation: passed.
- Prisma client generation: passed.
- Backend test suite: 79 tests discovered; 67 passed and 12 database-gated checks skipped, with zero failures.
- Analytics engine tests: all passed, including missing-versus-zero, normalized weights, risk/recommendations, and excused/reopened/resubmitted homework cases.
- Frontend production build: passed.
- Frontend ESLint: passed.
- JavaScript syntax checks for the analytics module and Prisma scripts: passed.
- Git whitespace validation: passed.
- Connected database migration status: the analytics migration is pending and was intentionally not applied automatically to the shared Supabase database.

Database integration checks can be enabled after migration and seeding:

```text
RUN_DB_INTEGRATION_TESTS=true npm test
```

## Compatibility and operational risks

- Apply the migration before starting a backend version that imports the new Prisma models.
- Cache invalidation is process-local. In a horizontally scaled deployment, use a shared cache/event transport (for example Redis) so source-module mutations invalidate every backend instance. The short TTL remains the safe fallback.
- Class/school finalized health depends on generated snapshots. This prevents expensive N+1 live calculation and preserves formula history, but administrators should schedule monthly/term snapshot generation.
- General exam grades/ranks cannot be calculated until SchoolOS gains a canonical exam/marks model. Chapter-assessment analytics is production-backed; no fake exam data is shown.
- Subject attendance is returned as unavailable because the current platform stores daily student attendance, not period-wise subject attendance.
- Public ranking remains disabled by default and no peer marks are returned.
- Existing `Student` class/section names should remain synchronized with enrollment history. Analytics resolves them tenant-safely but cannot repair inconsistent legacy membership.
