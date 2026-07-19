-- Production-safe additive migration for homework and learning resources.
CREATE TYPE "AcademicContentStatus" AS ENUM ('DRAFT','SCHEDULED','PUBLISHED','CLOSED','ARCHIVED','CANCELLED');
CREATE TYPE "HomeworkType" AS ENUM ('PRACTICE','WORKSHEET','READING','WRITING','PROJECT','REVISION','PRACTICAL','TEST_PREPARATION','OTHER');
CREATE TYPE "HomeworkPriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE "HomeworkAudienceMode" AS ENUM ('ENTIRE_SECTION','SELECTED_STUDENTS','ENTIRE_SECTION_WITH_EXCLUSIONS');
CREATE TYPE "HomeworkAudienceKind" AS ENUM ('INCLUDE','EXCLUDE');
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('NOT_STARTED','IN_PROGRESS','SUBMITTED','LATE_SUBMITTED','UNDER_REVIEW','RETURNED','RESUBMISSION_REQUESTED','RESUBMITTED','GRADED','EXCUSED');

ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'PRESENTATION';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'AUDIO';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'EXTERNAL_LINK';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'YOUTUBE';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'WORKSHEET';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'SAMPLE_PAPER';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'QUESTION_PAPER';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'ANSWER_KEY';
ALTER TYPE "SectionResourceType" ADD VALUE IF NOT EXISTS 'NOTES';

ALTER TABLE "SectionResource"
  ADD COLUMN "academicSession" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "createdByRole" "Role",
  ADD COLUMN "status" "AcademicContentStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isDownloadable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "SectionResource_schoolId_academicSession_status_publishedAt_idx" ON "SectionResource"("schoolId","academicSession","status","publishedAt");

CREATE TABLE "HomeworkModuleSetting" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL UNIQUE, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "parentVisibility" BOOLEAN NOT NULL DEFAULT true, "parentSubmissionAllowed" BOOLEAN NOT NULL DEFAULT false,
  "defaultLateSubmissionAllowed" BOOLEAN NOT NULL DEFAULT false, "defaultReminderHours" INTEGER[] DEFAULT ARRAY[24,3]::INTEGER[],
  "maximumUploadBytes" INTEGER NOT NULL DEFAULT 10485760, "maximumAttachmentCount" INTEGER NOT NULL DEFAULT 5,
  "allowedMimeTypes" TEXT[] DEFAULT ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/jpeg','image/png','image/webp','text/plain']::TEXT[],
  "studentResubmissionAllowed" BOOLEAN NOT NULL DEFAULT true, "teacherEditAfterPublication" BOOLEAN NOT NULL DEFAULT true,
  "marksVisible" BOOLEAN NOT NULL DEFAULT true, "feedbackVisible" BOOLEAN NOT NULL DEFAULT true,
  "resourceDownloadAllowed" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "HomeworkModuleSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);

CREATE TABLE "Homework" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "academicSession" TEXT NOT NULL, "createdByUserId" TEXT,
  "createdByRole" "Role" NOT NULL, "classId" TEXT NOT NULL, "sectionId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "chapterId" TEXT, "teacherAssignmentId" TEXT, "title" TEXT NOT NULL, "description" TEXT, "instructions" TEXT,
  "homeworkType" "HomeworkType" NOT NULL DEFAULT 'PRACTICE', "priority" "HomeworkPriority" NOT NULL DEFAULT 'NORMAL',
  "estimatedMinutes" INTEGER, "maximumMarks" INTEGER, "passingMarks" INTEGER, "allowSubmission" BOOLEAN NOT NULL DEFAULT true,
  "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false, "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
  "textResponseEnabled" BOOLEAN NOT NULL DEFAULT true, "resubmissionAllowed" BOOLEAN NOT NULL DEFAULT true,
  "maximumAttempts" INTEGER NOT NULL DEFAULT 1, "maximumAttachments" INTEGER NOT NULL DEFAULT 5,
  "allowedSubmissionTypes" TEXT[] DEFAULT ARRAY[]::TEXT[], "submissionInstructions" TEXT, "learningObjective" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "dueAt" TIMESTAMP(3), "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3), "status" "AcademicContentStatus" NOT NULL DEFAULT 'DRAFT',
  "audienceMode" "HomeworkAudienceMode" NOT NULL DEFAULT 'ENTIRE_SECTION', "updatedAfterPublish" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "Homework_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "Homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT,
  CONSTRAINT "Homework_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT,
  CONSTRAINT "Homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT,
  CONSTRAINT "Homework_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL,
  CONSTRAINT "Homework_marks_check" CHECK ("maximumMarks" IS NULL OR ("maximumMarks" >= 0 AND ("passingMarks" IS NULL OR "passingMarks" <= "maximumMarks"))),
  CONSTRAINT "Homework_attempts_check" CHECK ("maximumAttempts" BETWEEN 1 AND 20),
  CONSTRAINT "Homework_schedule_check" CHECK ("dueAt" IS NULL OR "scheduledAt" IS NULL OR "dueAt" >= "scheduledAt")
);
CREATE INDEX "Homework_schoolId_academicSession_status_publishedAt_idx" ON "Homework"("schoolId","academicSession","status","publishedAt");
CREATE INDEX "Homework_schoolId_classId_sectionId_subjectId_idx" ON "Homework"("schoolId","classId","sectionId","subjectId");
CREATE INDEX "Homework_schoolId_chapterId_idx" ON "Homework"("schoolId","chapterId");
CREATE INDEX "Homework_schoolId_createdByUserId_idx" ON "Homework"("schoolId","createdByUserId");
CREATE INDEX "Homework_schoolId_dueAt_idx" ON "Homework"("schoolId","dueAt");

CREATE TABLE "HomeworkAudience" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "kind" "HomeworkAudienceKind" NOT NULL DEFAULT 'INCLUDE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeworkAudience_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "HomeworkAudience_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "HomeworkAudience_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE,
  CONSTRAINT "HomeworkAudience_homeworkId_studentId_kind_key" UNIQUE ("homeworkId","studentId","kind")
);
CREATE INDEX "HomeworkAudience_schoolId_studentId_kind_idx" ON "HomeworkAudience"("schoolId","studentId","kind");

CREATE TABLE "HomeworkSubmission" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1, "textResponse" TEXT, "submittedAt" TIMESTAMP(3),
  "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS', "isLate" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" TIMESTAMP(3), "reviewedByUserId" TEXT, "marksAwarded" INTEGER, "feedback" TEXT, "privateTeacherNote" TEXT,
  "marksReleasedAt" TIMESTAMP(3), "returnedAt" TIMESTAMP(3), "resubmissionRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeworkSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE RESTRICT,
  CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT,
  CONSTRAINT "HomeworkSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "HomeworkSubmission_homeworkId_studentId_attemptNumber_key" UNIQUE ("homeworkId","studentId","attemptNumber"),
  CONSTRAINT "HomeworkSubmission_marks_check" CHECK ("marksAwarded" IS NULL OR "marksAwarded" >= 0)
);
CREATE INDEX "HomeworkSubmission_schoolId_homeworkId_status_submittedAt_idx" ON "HomeworkSubmission"("schoolId","homeworkId","status","submittedAt");
CREATE INDEX "HomeworkSubmission_schoolId_studentId_submittedAt_idx" ON "HomeworkSubmission"("schoolId","studentId","submittedAt");

CREATE TABLE "AcademicAttachment" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT, "resourceId" TEXT, "submissionId" TEXT,
  "fileName" TEXT NOT NULL, "originalName" TEXT NOT NULL, "fileUrl" TEXT NOT NULL, "publicId" TEXT, "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL, "attachmentType" TEXT NOT NULL, "uploadedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicAttachment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicAttachment_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicAttachment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "AcademicAttachment_owner_check" CHECK (num_nonnulls("homeworkId","resourceId","submissionId") = 1),
  CONSTRAINT "AcademicAttachment_file_size_check" CHECK ("fileSize" > 0)
);
CREATE INDEX "AcademicAttachment_schoolId_homeworkId_idx" ON "AcademicAttachment"("schoolId","homeworkId");
CREATE INDEX "AcademicAttachment_schoolId_resourceId_idx" ON "AcademicAttachment"("schoolId","resourceId");
CREATE INDEX "AcademicAttachment_schoolId_submissionId_idx" ON "AcademicAttachment"("schoolId","submissionId");

CREATE TABLE "AcademicExternalLink" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT, "resourceId" TEXT, "label" TEXT, "url" TEXT NOT NULL,
  "domain" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicExternalLink_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicExternalLink_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicExternalLink_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicExternalLink_owner_check" CHECK (num_nonnulls("homeworkId","resourceId") = 1)
);
CREATE INDEX "AcademicExternalLink_schoolId_homeworkId_idx" ON "AcademicExternalLink"("schoolId","homeworkId");
CREATE INDEX "AcademicExternalLink_schoolId_resourceId_idx" ON "AcademicExternalLink"("schoolId","resourceId");

CREATE TABLE "AcademicNotification" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "recipientStudentId" TEXT, "recipientRole" "Role", "recipientUserId" TEXT,
  "type" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL UNIQUE, "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicNotification_recipientStudentId_fkey" FOREIGN KEY ("recipientStudentId") REFERENCES "Student"("id") ON DELETE CASCADE
);
CREATE INDEX "AcademicNotification_schoolId_recipientStudentId_createdAt_idx" ON "AcademicNotification"("schoolId","recipientStudentId","createdAt");
CREATE INDEX "AcademicNotification_schoolId_recipientUserId_createdAt_idx" ON "AcademicNotification"("schoolId","recipientUserId","createdAt");

CREATE TABLE "AcademicContentAudit" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "actorUserId" TEXT, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL, "before" JSONB, "after" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicContentAudit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "AcademicContentAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX "AcademicContentAudit_schoolId_entityType_entityId_createdAt_idx" ON "AcademicContentAudit"("schoolId","entityType","entityId","createdAt");
CREATE INDEX "AcademicContentAudit_schoolId_actorUserId_createdAt_idx" ON "AcademicContentAudit"("schoolId","actorUserId","createdAt");
