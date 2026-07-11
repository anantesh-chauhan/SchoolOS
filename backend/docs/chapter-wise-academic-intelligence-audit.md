# Chapter-Wise Academic Intelligence Audit

## Existing Architecture Summary

SchoolOS is a multi-tenant React/Vite frontend with an Express, Prisma, and PostgreSQL backend. Tenant isolation is primarily enforced with `schoolId` on school-owned records and backend role checks. Authentication uses JWT middleware, while role-based access uses `requireRole` and helper utilities such as `requireSchoolAdminOrAssignedTeacher`.

## Existing Relevant Features

- Academic hierarchy exists for School, Class, Section, Subject, Chapter, TeacherAssignment, ChapterProgress, SectionResource, Student, and attendance.
- Teachers can manage assigned section/subject chapter progress and resources.
- Completed chapters can become `ChapterPoll` records.
- Students can submit chapter understanding feedback once.
- Teachers can submit roster-based chapter evaluations.
- Admins can compile and publish chapter analysis summaries.

## Reusable Models, APIs, Services, and Components

- Models: `Chapter`, `ChapterProgress`, `SectionResource`, `ChapterPoll`, `StudentChapterVote`, `TeacherStudentEvaluation`, `ChapterAnalysisSummary`, `TeacherAssignment`, `Student`.
- Backend utilities: `teacherAuthorization.util.js`, `auth.middleware.js`, `chapterAnalysis.service.js`.
- Frontend surfaces: teacher dashboard feedback workflow, student dashboard poll workflow, `chapterFeedbackService`.

## Missing Features Before This Slice

- Durable chapter assessment/result storage.
- Deterministic 0-100 chapter mastery snapshots.
- Data completeness/confidence indicators.
- Learning gap records.
- Intervention records.
- Teacher-facing Student x Chapter mastery matrix.
- Student-facing simple mastery summaries.

## Database Gap Analysis

| Feature | Existing | Partial | Missing | Required Changes |
| --- | --- | --- | --- | --- |
| Chapter completion | `ChapterProgress` | Yes | Planned dates/revision status | Extend later |
| Student feedback | `StudentChapterVote` | Yes | Topic-level feedback | Add topics later |
| Teacher evaluation | `TeacherStudentEvaluation` | Yes | Draft workflow | Add draft status later |
| Assessment data | No durable model | No | Assessment/result tables | Added in this slice |
| Chapter mastery | Summary JSON only | Partial | Per-student score snapshots | Added in this slice |
| Learning gaps | No | No | Explainable gap records | Added in this slice |
| Interventions | No | No | Intervention lifecycle | Added base model in this slice |

## Recommended Architecture

Controllers should stay thin. Academic calculations belong in reusable services. The first service added is `masteryCalculation.service.js`, which accepts available signals, redistributes weights across available evidence, stores explainable score breakdowns, and marks confidence honestly.

## Required Prisma Changes

This slice adds:

- `ChapterAssessment`
- `ChapterAssessmentResult`
- `StudentChapterMastery`
- `LearningGap`
- `LearningIntervention`
- `AssessmentType`
- `MasteryLevel`
- `MasteryConfidence`
- `InterventionStatus`

All new records include `schoolId` and indexes for school/class/section/subject/chapter access.

## Phased Implementation Order

1. Foundation: preserve existing class-section-subject-chapter and teacher assignment checks.
2. Data collection: reuse polls, student votes, teacher evaluations, add assessment results.
3. Mastery analytics: calculate per-student chapter mastery and matrix.
4. Learning gaps: deterministic low-mastery and mismatch rules.
5. Intervention: create base interventions from low mastery rows.
6. Role-based intelligence: student summaries and future parent/admin dashboards.

## Risks and Compatibility Concerns

- Current student records store `className` and `section` text, while chapter records use class/section IDs. Existing helper logic bridges this, but a future normalized student class-section relationship would reduce risk.
- Chapter progress supports only `NOT_STARTED`, `ONGOING`, and `COMPLETED`; `REVISION` needs a later additive enum migration.
- This slice intentionally avoids AI scoring and does not infer engagement where no reliable data exists.
