# Homework and learning resources

The module extends SchoolOS's existing `Class`, `Section`, `SectionSubject`, `Subject`, `Chapter`, `TeacherAssignment`, `Student`, `SectionResource`, user, widget-notification, and curriculum-audit conventions. Academic sessions intentionally remain strings because that is the current enrollment convention (`Student.session`).

## API

- Staff: `/api/homework`, lifecycle endpoints, `/api/homework/:id/submissions`, `/api/homework/analytics`, and `/api/homework/context`.
- Students: published audience-scoped homework, draft/final submissions, attempts, marks, and feedback.
- Parents: `/api/parent/homework-children` plus child-scoped homework/resources aliases.
- Resources: `/api/resources` with draft/publish/archive lifecycle and normalized files/links.
- Scheduled jobs: invoke `POST /api/homework/jobs/publish-scheduled` and `POST /api/homework/jobs/reminders` from cron/a job runner with a school admin service identity.

Every data lookup includes authenticated `schoolId`. Teacher writes and reviews additionally require a current subject assignment. Section/class, subject mapping, chapter/subject, audience enrollment, parent link, submission ownership, marks, dates, URLs, and attachment metadata are revalidated on the server.

## Setup

Development:

```bash
cd backend
npx prisma format
npx prisma validate
npx prisma migrate dev --name homework_learning_resources
npx prisma generate
npm run seed
npm test

cd ../frontend
npm run build
```

Production:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

No new environment variables are required. Existing Cloudinary upload configuration is reused; clients submit validated Cloudinary metadata with content or submission requests.

## Demo accounts

The existing instant-login convention remains authoritative. Green Valley staff accounts include `admin@greenvalley.edu.in` and `owner@greenvalley.edu.in`; development seed password is `admin123`. Student, parent, teacher, and curriculum-manager IDs are visible in the existing instant-login account picker and are not duplicated here.

## Manual checklist

1. Sign in as a teacher and confirm the creation scope contains assigned section-subject pairs only.
2. Create a draft with and without a chapter, publish it, and confirm only matching students/parents see it.
3. Try a mismatched chapter ID, unassigned section, malformed URL, executable attachment metadata, invalid marks, and late submission with late work disabled.
4. Submit as a targeted student, review as the subject teacher, release marks, and request a second attempt.
5. Verify another student, unrelated parent, and another school's staff receive 403/404 responses.
6. Test draft, scheduled, published, closed, archived, and cancelled views at mobile, tablet, and desktop widths in light/dark mode.

## Current operational limits

- SchoolOS currently models one primary student on a parent login. Additional children are supported through existing active `FeeFamilyLink` records until a general parent-student relation is introduced.
- Scheduling has a service endpoint and abstraction, but no BullMQ worker exists in this repository; deployment must call it from cron or a job runner.
- Upload bytes continue to flow directly to the configured Cloudinary service. This module validates stored metadata and ownership; private signed-download delivery depends on the storage account's access mode.
- Academic sessions and enrollment are legacy string fields. A future normalized session/enrollment migration should backfill first and retain these compatibility fields during rollout.
