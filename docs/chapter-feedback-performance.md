# Chapter Feedback and Performance Analytics

## Implementation map

The module extends the existing chapter progress, student mastery, attendance, homework,
resources, assessment, notification, intervention, and analytics features. It does not
create duplicate academic entities. Every poll, response, template, summary, and audit
query is scoped by `schoolId`.

## 1. Database and migration

Migration: `backend/prisma/migrations/202607280001_chapter_feedback_performance_module/migration.sql`

The migration:

- expands poll status with `SCHEDULED`, `OPEN`, `ARCHIVED`, and `CANCELLED`;
- adds poll type, academic session, audience/privacy settings, response threshold, and
  enabled dimensions to `ChapterPoll`;
- changes both respondent tables to draft/version/snapshot records;
- adds all eight teacher and ten student 1–5 dimensions plus follow-up answers;
- adds `FeedbackTemplate` and tenant-scoped `FeedbackAuditLog`;
- removes the one-poll-per-chapter constraint so a chapter can have follow-up polls;
- preserves legacy response columns for existing analytics and migrates old submissions
  to `SUBMITTED`.

Apply in a controlled environment with:

```powershell
cd backend
npx prisma migrate deploy
npx prisma generate
```

## 2. Seed data

`backend/prisma/seedAnalytics.js` now creates deterministic 1–5 student and teacher
responses, response snapshots, support selections, attendance, homework, assessments,
and interventions. The profile list is fixed, so the dataset is reproducible.

```powershell
cd backend
npm run seed
npm run seed:analytics
```

## 3. Backend routes and services

All routes are below `/api` and require authentication.

| Workflow | Route |
|---|---|
| Teacher poll roster | `GET /teacher/polls` |
| Teacher bulk draft | `PUT /teacher/polls/:pollId/student-evaluations/draft` |
| Teacher final submit | `POST /teacher/polls/:pollId/student-evaluations` |
| Student poll list/own response | `GET /student/polls` |
| Student draft | `PUT /student/polls/:pollId/draft` |
| Student final submit | `POST /student/polls/:pollId/vote` |
| Completion queue | `GET /admin/chapter-completions` |
| Create/list polls | `POST/GET /admin/chapter-polls` |
| Duplicate poll | `POST /admin/chapter-polls/:pollId/duplicate` |
| Open/close/archive/cancel | `PATCH /admin/chapter-polls/:pollId/status` |
| Response monitor | `GET /admin/chapter-polls/:pollId/raw-status` |
| Compile permanently | `POST /admin/chapter-polls/:pollId/compile` |
| Template list/save | `GET/POST /admin/feedback-templates` |
| Audit log | `GET /admin/feedback-audit` |
| Assessment/mastery/intervention | existing chapter assessment, mastery, analytics,
  and intervention routes |

Draft and final teacher writes use short batch transactions, with submitted rows
protected against later overwrites. Response audits are bulk-written after persistence
and cannot roll back a valid response. A submitted response has `submittedAt`, `submittedById`, `lockedAt`,
`version`, and an immutable JSON snapshot. Compile is one-way and cannot be repeated.

## 4. Frontend

- Admin feedback operations remain integrated into the admin dashboard and its existing
  analytics pages.
- `TeacherWholeClassRatingPage.jsx` provides a sticky attendance-style roster,
  1–5 controls, search, incomplete filter, quick-fill, autosave, progress, desktop
  sticky table, mobile cards, review, and final confirmation.
- `StudentChapterFeedbackPage.jsx` provides the ten short rating questions, selectable
  follow-ups, multi-select support needs, optional short answers, autosave, restored
  drafts, progress, and a read-only submitted view.
- Existing chapter, subject, student, class, school analytics and intervention pages
  consume the compiled evidence through the mastery and analytics services.

## 5. Permission matrix

| Role | Polls | Responses | Compiled analytics | Interventions |
|---|---|---|---|---|
| Platform Owner | Platform adoption only; emergency changes require a separately audited operational action | Private comments excluded by default | Platform summary | No routine student action |
| School Owner | View/manage school polls | View, never edit submissions | School-wide | Create/view |
| Admin | Create, schedule, open, close, compile, archive, duplicate | Monitor and investigate | Individual and aggregate | Create/update |
| Curriculum Manager | Same academic poll/template/compile access | Monitor | Subject/chapter/class | Create academic actions |
| Subject Teacher | Assigned polls only | Draft/final class ratings; final is read-only | Assigned class insights and anonymized aggregate student feedback | Assigned subject |
| Class Teacher | Assigned participation/compiled section data when configured | No unrelated subject access | Own section | Coordinate |
| Student | Assigned class-section polls | Own draft/final/view only | Permitted personal summary | View own support |
| Parent | No response access | None | Child summary when enabled | Child progress |

## 6. Formula version `chapter-feedback-v2.0`

Raw inputs, normalized inputs, and the formula version are stored in each compiled
student summary.

- Teacher feedback average: mean of the eight enabled teacher dimensions.
- Student self-assessment: understanding, confidence, test readiness, practice
  usefulness, and doubt resolution when available.
- Engagement: teacher participation plus existing attendance, homework, and resource
  evidence in the mastery engine.
- Readiness: weighted self-assessment, teacher evidence, and available performance
  evidence; missing data is omitted rather than treated as zero.
- Perception gap: absolute teacher/student understanding difference, interpreted beside
  assessment percentage when available.
- Categories: Strong, Progressing Well, Developing, Needs Support, and Immediate
  Follow-up Recommended. They are indicators, never permanent labels.
- Compiled metadata includes eligible students, response count, and the 1, 2, 3, 4,
  and 5 understanding distribution.

## 7. Tests

`backend/test/chapter-feedback-workflow.test.js` covers formula evidence, perception gap,
assessment comparison, response/sample counts, distributions, snapshots, response
states, tenant fields, and audit schema. The existing analytics, access, attendance,
homework, staffing, security, and integration suites continue to cover the reused data
sources and role boundaries.

```powershell
cd backend
node --test test/chapter-feedback-workflow.test.js
npm test

cd ../frontend
npm run build
```

## 8. Demo login flow

After the normal seeds:

- Admin: `admin@greenvalley.edu.in` / `admin123`
- Teacher example: `ananya.gvs001@schoolos.com` / `admin123`
- Student usernames are deterministic:
  `<first-name>.<class><section>.<roll>@gvs001.schoolos` / `admin123`
- Curriculum manager is created by `seedSecurityCurriculumCalendar.js`; its default
  non-production password is `Curriculum@2026!`.

Use only seeded credentials in a local/demo environment.

## 9. End-to-end verification

1. Sign in as an assigned teacher, mark a chapter complete, and confirm the admin
   completion queue receives it.
2. Sign in as admin, create an open poll, set the threshold/privacy options, and confirm
   teacher/student notifications.
3. As teacher, open `/teacher/polls/:pollId`, partially rate several rows, wait four
   seconds, reload, and confirm the draft and version are restored.
4. Use quick-fill and incomplete filtering, submit the full roster, then confirm every
   row is read-only and a second write receives HTTP 409.
5. As a student in the section, save a partial draft, reload, finish and submit, then
   confirm only that student's locked response is visible.
6. As a different student or a user from another school, request the response and
   confirm it is unavailable.
7. Close the poll. In response monitor, verify eligible counts, drafts, missing
   respondents, response rate, threshold warning, and deadline state.
8. Compile once. Confirm drafts close, submitted rows become compiled, the summary
   records raw/normalized/formula evidence, and a second compile returns HTTP 409.
9. Review chapter/student/class analytics, create an intervention, and later record its
   outcome.
10. Query `/admin/feedback-audit?pollId=...` and verify create, open, draft, submit,
    close, duplicate, and compile actions.

## 10. Privacy behavior

Teachers receive only aggregate student feedback through compiled analysis. Individual
student responses are returned only to the owning student and authorized school
management. Anonymous-to-teacher mode does not remove identity from the admin
investigation record. Every result displays its sample size, and teacher insights are
phrased as evidence-based indicators rather than rankings or disciplinary conclusions.
