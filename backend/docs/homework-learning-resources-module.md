# Homework and learning resources

## Architecture found and reused

SchoolOS already had tenant-aware authentication, the `Role` enum, school ownership, classes, sections, class/section subjects, chapters, effective-dated teacher assignments, student records, parent portal identities/family links, Cloudinary signing, communication notifications, and a first-generation homework/submission module. This implementation extends those components. It does not introduce a parallel identity, curriculum, notification, or upload stack.

`Homework` remains the submission-bearing record and `SectionResource` remains the learning-resource record. Shared behavior is normalized through `ResourceTarget`, `AcademicAttachment`, `AcademicExternalLink`, `ResourceVersion`, `ResourceActivity`, `ResourceComment`, `ResourceModeration`, categories, tags, content-type configuration, and the existing academic audit log.

## Data model and migration

Migration: `prisma/migrations/202607220003_academic_content_targeting/migration.sql`.

The migration is additive and backfills every existing homework/resource with a section target. It adds:

- `AcademicAudienceScope`: whole school, selected classes, entire class, selected sections, subject, chapter, and selected students.
- `ResourceTarget`: normalized polymorphic audience rules for homework and resources.
- `ResourceVersion`: immutable pre-change JSON snapshots and reasons.
- `ResourceActivity`: views, downloads, bookmarks, acknowledgments, completion, helpfulness, and broken-link reports.
- `ResourceComment`: private-by-default student questions and threaded replies.
- `ResourceModeration`: pending review, changes requested, approved, and rejected decisions.
- `AcademicContentType`: school-configurable behavior and upload limits.
- `ResourceCategory`, `ResourceTag`, and `ResourceTagAssignment`.
- Audience, visibility, taxonomy, priority, language, curriculum, expiry, and archive metadata on the existing content records.
- Module settings for direct/approval publication, class-teacher publishing, ZIP files, and default parent visibility.

Database checks ensure each polymorphic target, version, activity, comment, moderation item, and tag assignment belongs to exactly one homework or resource. Tenant/filter indexes cover status, session, audience, class/section, subject/chapter, student, expiry, activity, and moderation.

## Targeting and authorization

One content record owns one or more target rows. A whole-school target has no narrower identifiers; multi-class content has one class row per selected class; section/subject/chapter targets carry only their normalized curriculum IDs; selected-student targets carry the student ID and resolved academic context. The API derives recipients from current active school enrollment and never creates one content record per learner.

Before creation, `POST /api/academic-content/audience-preview` validates every target and returns active student and linked-parent counts. Publishing whole-school content requires an explicit confirmation flag.

| Role | Read | Create/target | Modify/review |
| --- | --- | --- | --- |
| School owner/admin | All tenant content | Every audience | Any tenant content; reason required for another owner's item |
| Curriculum manager | All academic content | Every audience | Moderate, archive/restore, review, report |
| Subject teacher | Current assigned scopes | Assigned section-subject/chapter and selected learners only | Own content; submissions only in current assignment |
| Student | Published, unexpired targets matching their identity/enrollment | Submission/question only | Own attempts, bookmark/activity only |
| Parent | Parent-visible content for a linked child | Private question | Read-only; cannot submit by default |
| Platform owner | No implicit private-content route | None | Aggregate platform behavior remains separate |

All resource/homework/detail/submission queries include the authenticated `schoolId`. Teacher target validation checks active effective-dated assignments. Student and parent detail routes rerun the same target predicate used by list routes, preventing ID manipulation. Private teacher notes are omitted from portal projections.

## API surface

Existing routes remain compatible:

- `GET/POST /api/homework`, `GET/PATCH/DELETE /api/homework/:id`
- `POST /api/homework/:id/{publish|close|archive|cancel}`
- `POST /api/homework/:id/submissions/draft`
- `POST /api/homework/:id/submissions`
- `GET /api/homework/:id/submissions`
- `PATCH /api/homework/:id/submissions/:submissionId/review`
- `GET/POST /api/resources`, `GET/PATCH/DELETE /api/resources/:id`
- `POST /api/resources/:id/{publish|archive|restore|duplicate}`

Shared workflow routes:

- `POST /api/academic-content/audience-preview`
- `GET /api/academic-content/:kind/:id/versions`
- `GET /api/academic-content/:kind/:id/engagement`
- `GET/POST /api/academic-content/:kind/:id/comments`
- `POST /api/academic-content/:kind/:id/activity/:activity`
- `POST /api/academic-content/:kind/:id/moderation`
- `GET /api/academic-content/moderation`
- `PATCH /api/academic-content/moderation/:moderationId`
- `POST /api/homework/jobs/publish-scheduled`
- `POST /api/homework/jobs/reminders`

Parent/student aliases are retained under `/api/student/homework` and `/api/parent/children/:studentId/{homework|resources}`.

## Upload handling

The browser uploads bytes directly to the existing Cloudinary account. `POST /api/uploads/academic-content-signature` first runs the same tenant, role, assignment, and target validation as publication, then signs a school/user-scoped folder. Submission uploads use the existing homework-specific signer after homework visibility is checked.

The backend revalidates stored metadata in the content transaction:

- MIME allowlist and per-school/per-content-type byte limit
- attachment count
- non-empty size/URL/name
- executable and active-content extension denylist
- sanitized filenames and labels
- HTTP/HTTPS external URLs without embedded credentials
- tenant-scoped content relation and uploader identity

## Frontend

The integrated `/homework` workspace is role-aware and responsive. It includes:

- Admin/curriculum/teacher analytics cards and quick creation.
- A structured audience builder with multiple targets and recipient preview.
- Draft, scheduled, and immediate publication; due/expiry dates; submission/late rules.
- Categories, normalized tags, configurable resource types, parent visibility, priority, files, and links.
- Whole-school confirmation.
- Homework/resource cards, search, filters, deadlines, and parent child selector.
- Student text/file submission, bookmarks, tracked views/downloads, and private questions.
- Teacher submission review with marks and published feedback.
- Admin/curriculum moderation queue with changes-requested and approve/publish actions.
- Light/dark theme tokens, accessible labels, loading states, empty states, and mobile wrapping.

The same workspace is linked from every supported dashboard role. Direct URL access is protected by the existing `ProtectedRoute` role gate; backend authorization remains authoritative.

## Notifications, history, and analytics

The module calls the centralized communication service for publication, updates, due-date changes, cancellation, submissions, feedback/marks, resubmission, scheduled publishing, and reminder events. Dedupe keys include event/content/version or day so job retries do not fan out duplicate messages.

Published edits and lifecycle transitions save the prior record to `ResourceVersion` and write `AcademicContentAudit`. Admin/owner modifications of another creator's record require a reason. Published homework with submissions cannot be permanently deleted.

Engagement reports aggregate assigned learners, views/downloads/bookmarks/acknowledgments/completions, and homework submission status without exposing one student's activity to another.

## Seed data

`npm run seed:homework` is idempotent and populates each active demo school with configurable content types, default categories/tags, school-wide content, multi-class content, section/chapter resources, selected-student work, published/draft/scheduled/overdue homework, archived content, pending moderation, graded/late/resubmission examples, attachments, and safe NCERT links. Every targeted row references actual school curriculum and student records.

## Apply and verify

Development:

```bash
cd backend
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run seed:homework
npm test

cd ../frontend
npm run build
```

Production:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run seed:homework
```

The repository's Node test runner may need permission to spawn child test processes in a restricted environment. An individual suite can be run directly with `node test/homework-validation.test.js`.

## Demo access and role checks

Use the existing instant-login account picker so IDs stay aligned with seeded tenant data. Green Valley staff seed accounts include `admin@greenvalley.edu.in` and `owner@greenvalley.edu.in`; the development seed password is `admin123`. Teacher, curriculum-manager, student, and parent identities are displayed by the same login picker.

1. Admin: publish a whole-school item, confirm the recipient count/confirmation, then inspect moderation and analytics.
2. Curriculum manager: create a multi-class/chapter resource and duplicate it to another authorized audience.
3. Teacher: verify only active assignments appear; attempt an unrelated target and confirm the API rejects it.
4. Student: verify only targeted content appears, save/submit work, bookmark, download, and ask a private question.
5. Parent: switch linked children and confirm unlinked child IDs are rejected.
6. Teacher/admin: review the submission, release marks, request resubmission, archive/restore content, and inspect version history through the API.

## Operational assumptions

- Academic-session and current enrollment compatibility still uses the repository's legacy `Student.session`, class-name, and section-name fields. Targets themselves store normalized curriculum IDs.
- Multiple parent children use the existing student identity plus active `FeeFamilyLink` records until the wider platform adopts a general parent-child table.
- Scheduled publishing/reminders are durable service endpoints. Deployment must invoke them from cron or a job runner; this repository does not contain a continuously running queue worker.
- Cloudinary access mode controls whether stored URLs are public or signed. Tenant authorization is checked before signing/upload metadata is accepted.
- Existing content is retained and backfilled; no published academic record is destructively rewritten by the migration.
