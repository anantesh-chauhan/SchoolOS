-- Expand the existing chapter analysis feature into an immutable, draft-capable
-- feedback workflow. Existing 1-5 records remain valid historical evidence.
ALTER TYPE "ChapterPollStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "ChapterPollStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "ChapterPollStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "ChapterPollStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "FeedbackPollType" AS ENUM (
  'CHAPTER_COMPLETION',
  'STUDENT_UNDERSTANDING_REVIEW',
  'TEACHER_OBSERVATION_REVIEW',
  'REMEDIAL_FOLLOW_UP',
  'POST_ASSESSMENT_REFLECTION',
  'CUSTOM'
);

CREATE TYPE "FeedbackResponseState" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'DRAFT_SAVED',
  'SUBMITTED',
  'LOCKED',
  'COMPILED'
);

ALTER TABLE "ChapterPoll"
  ADD COLUMN "academicSessionId" TEXT,
  ADD COLUMN "pollType" "FeedbackPollType" NOT NULL DEFAULT 'CHAPTER_COMPLETION',
  ADD COLUMN "respondentTypes" JSONB,
  ADD COLUMN "instructions" TEXT,
  ADD COLUMN "anonymousToTeacher" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "teacherVisibleToStudents" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowClassTeacher" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "commentsRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minimumResponsePercentage" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "enabledTeacherDimensions" JSONB,
  ADD COLUMN "enabledStudentDimensions" JSONB;

DROP INDEX IF EXISTS "ChapterPoll_schoolId_classId_sectionId_subjectId_chapterId_key";
CREATE INDEX "ChapterPoll_schoolId_classId_sectionId_subjectId_chapterId_idx"
  ON "ChapterPoll"("schoolId", "classId", "sectionId", "subjectId", "chapterId");

ALTER TABLE "ChapterPoll"
  ADD CONSTRAINT "ChapterPoll_academicSessionId_fkey"
  FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentChapterVote"
  ALTER COLUMN "understandingRating" DROP NOT NULL,
  ALTER COLUMN "difficultyRating" DROP NOT NULL,
  ALTER COLUMN "confidenceRating" DROP NOT NULL,
  ALTER COLUMN "teachingRating" DROP NOT NULL,
  ALTER COLUMN "paceRating" DROP NOT NULL,
  ALTER COLUMN "clarityRating" DROP NOT NULL,
  ALTER COLUMN "submittedAt" DROP NOT NULL,
  ALTER COLUMN "submittedAt" DROP DEFAULT,
  ADD COLUMN "examplesRating" INTEGER,
  ADD COLUMN "practiceRating" INTEGER,
  ADD COLUMN "resourcesRating" INTEGER,
  ADD COLUMN "interestRating" INTEGER,
  ADD COLUMN "doubtResolutionRating" INTEGER,
  ADD COLUMN "testReadinessRating" INTEGER,
  ADD COLUMN "difficultArea" TEXT,
  ADD COLUMN "helpfulMethod" TEXT,
  ADD COLUMN "supportNeeded" JSONB,
  ADD COLUMN "difficultTopic" TEXT,
  ADD COLUMN "helpfulExplanation" TEXT,
  ADD COLUMN "explainAgain" TEXT,
  ADD COLUMN "suggestion" TEXT,
  ADD COLUMN "state" "FeedbackResponseState" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "snapshot" JSONB;

UPDATE "StudentChapterVote"
SET "state" = 'SUBMITTED', "lastSavedAt" = COALESCE("submittedAt", CURRENT_TIMESTAMP)
WHERE "submittedAt" IS NOT NULL;

ALTER TABLE "TeacherStudentEvaluation"
  ALTER COLUMN "attentionRating" DROP NOT NULL,
  ALTER COLUMN "participationRating" DROP NOT NULL,
  ALTER COLUMN "homeworkRating" DROP NOT NULL,
  ALTER COLUMN "conceptClarityRating" DROP NOT NULL,
  ALTER COLUMN "improvementNeedRating" DROP NOT NULL,
  ALTER COLUMN "submittedAt" DROP NOT NULL,
  ALTER COLUMN "submittedAt" DROP DEFAULT,
  ADD COLUMN "understandingRating" INTEGER,
  ADD COLUMN "practiceRating" INTEGER,
  ADD COLUMN "applicationRating" INTEGER,
  ADD COLUMN "confidenceRating" INTEGER,
  ADD COLUMN "improvementRating" INTEGER,
  ADD COLUMN "independenceRating" INTEGER,
  ADD COLUMN "consistencyRating" INTEGER,
  ADD COLUMN "overallScore" DOUBLE PRECISION,
  ADD COLUMN "remark" TEXT,
  ADD COLUMN "state" "FeedbackResponseState" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "snapshot" JSONB;

UPDATE "TeacherStudentEvaluation"
SET "state" = 'SUBMITTED', "lastSavedAt" = COALESCE("submittedAt", CURRENT_TIMESTAMP)
WHERE "submittedAt" IS NOT NULL;

CREATE TABLE "FeedbackTemplate" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "createdById" TEXT,
  "name" TEXT NOT NULL,
  "pollType" "FeedbackPollType" NOT NULL DEFAULT 'CHAPTER_COMPLETION',
  "instructions" TEXT,
  "respondentTypes" JSONB,
  "teacherDimensions" JSONB NOT NULL,
  "studentDimensions" JSONB NOT NULL,
  "anonymousToTeacher" BOOLEAN NOT NULL DEFAULT true,
  "teacherVisibleToStudents" BOOLEAN NOT NULL DEFAULT false,
  "commentsRequired" BOOLEAN NOT NULL DEFAULT false,
  "minimumResponsePercentage" INTEGER NOT NULL DEFAULT 60,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeedbackTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedbackAuditLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "pollId" TEXT,
  "actorId" TEXT,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "previous" JSONB,
  "current" JSONB,
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeedbackTemplate_schoolId_name_key" ON "FeedbackTemplate"("schoolId", "name");
CREATE INDEX "FeedbackTemplate_schoolId_isActive_idx" ON "FeedbackTemplate"("schoolId", "isActive");
CREATE INDEX "FeedbackAuditLog_schoolId_pollId_createdAt_idx" ON "FeedbackAuditLog"("schoolId", "pollId", "createdAt");
CREATE INDEX "FeedbackAuditLog_schoolId_action_idx" ON "FeedbackAuditLog"("schoolId", "action");

ALTER TABLE "FeedbackTemplate" ADD CONSTRAINT "FeedbackTemplate_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackTemplate" ADD CONSTRAINT "FeedbackTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackAuditLog" ADD CONSTRAINT "FeedbackAuditLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackAuditLog" ADD CONSTRAINT "FeedbackAuditLog_pollId_fkey"
  FOREIGN KEY ("pollId") REFERENCES "ChapterPoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackAuditLog" ADD CONSTRAINT "FeedbackAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
