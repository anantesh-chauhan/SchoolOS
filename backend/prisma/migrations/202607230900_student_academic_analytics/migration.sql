-- Student academic analytics foundation.
-- This migration is additive. Existing intervention rows receive safe defaults;
-- no academic records are deleted or rewritten.

ALTER TYPE "InterventionStatus" ADD VALUE IF NOT EXISTS 'NO_RESPONSE';
ALTER TYPE "InterventionStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_REQUIRED';

CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AnalyticsRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INSUFFICIENT_DATA');
CREATE TYPE "AssessmentDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "ResourceEngagementEventType" AS ENUM ('OPENED', 'STARTED', 'PROGRESSED', 'COMPLETED', 'DOWNLOADED', 'LINK_OPENED', 'REOPENED');
CREATE TYPE "AnalyticsRecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "AnalyticsRecommendationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');
CREATE TYPE "AnalyticsSnapshotType" AS ENUM ('MONTHLY', 'FINAL_EXAM', 'TERM_REPORT', 'SESSION_END', 'COMPILED_CHAPTER', 'MANUAL');

ALTER TABLE "LearningIntervention"
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "assignedToUserId" TEXT,
  ADD COLUMN "interventionType" TEXT NOT NULL DEFAULT 'REMEDIAL_CLASS',
  ADD COLUMN "title" TEXT,
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "outcome" TEXT,
  ADD COLUMN "followUpDate" TIMESTAMP(3),
  ADD COLUMN "parentVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "confidentialNotes" TEXT;

CREATE INDEX "LearningIntervention_schoolId_createdAt_idx" ON "LearningIntervention"("schoolId", "createdAt");

CREATE TABLE "AnalyticsConfiguration" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "examWeight" DOUBLE PRECISION NOT NULL DEFAULT 30,
  "chapterQuizWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "attendanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "homeworkWeight" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "teacherEvaluationWeight" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "studentFeedbackWeight" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "resourceEngagementWeight" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "chapterAssessmentWeight" DOUBLE PRECISION NOT NULL DEFAULT 30,
  "chapterHomeworkWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "chapterTeacherWeight" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "chapterFeedbackWeight" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "chapterAttendanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "chapterResourceWeight" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "lowRiskThreshold" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "mediumRiskThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "minimumAttendanceTarget" DOUBLE PRECISION NOT NULL DEFAULT 75,
  "minimumHomeworkTarget" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "minimumChapterTarget" DOUBLE PRECISION NOT NULL DEFAULT 60,
  "rankingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "formulaVersion" TEXT NOT NULL DEFAULT '1.0',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsConfiguration_schoolId_key" ON "AnalyticsConfiguration"("schoolId");
CREATE INDEX "AnalyticsConfiguration_schoolId_updatedAt_idx" ON "AnalyticsConfiguration"("schoolId", "updatedAt");

CREATE TABLE "AnalyticsRiskRule" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "severity" "RiskSeverity" NOT NULL,
  "threshold" DOUBLE PRECISION,
  "configuration" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsRiskRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsRiskRule_schoolId_code_key" ON "AnalyticsRiskRule"("schoolId", "code");
CREATE INDEX "AnalyticsRiskRule_schoolId_isEnabled_idx" ON "AnalyticsRiskRule"("schoolId", "isEnabled");

CREATE TABLE "LearningOutcome" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningOutcome_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LearningOutcome_schoolId_chapterId_title_key" ON "LearningOutcome"("schoolId", "chapterId", "title");
CREATE INDEX "LearningOutcome_schoolId_chapterId_isActive_idx" ON "LearningOutcome"("schoolId", "chapterId", "isActive");

CREATE TABLE "AssessmentComponent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "chapterId" TEXT,
  "learningOutcomeId" TEXT,
  "title" TEXT NOT NULL,
  "maximumMarks" DOUBLE PRECISION NOT NULL,
  "difficulty" "AssessmentDifficulty",
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssessmentComponent_schoolId_assessmentId_order_key" ON "AssessmentComponent"("schoolId", "assessmentId", "order");
CREATE INDEX "AssessmentComponent_schoolId_assessmentId_idx" ON "AssessmentComponent"("schoolId", "assessmentId");
CREATE INDEX "AssessmentComponent_schoolId_chapterId_idx" ON "AssessmentComponent"("schoolId", "chapterId");
CREATE INDEX "AssessmentComponent_schoolId_learningOutcomeId_idx" ON "AssessmentComponent"("schoolId", "learningOutcomeId");

CREATE TABLE "StudentAssessmentComponentScore" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "assessmentComponentId" TEXT NOT NULL,
  "marksObtained" DOUBLE PRECISION,
  "absent" BOOLEAN NOT NULL DEFAULT false,
  "remarks" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentAssessmentComponentScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentAssessmentComponentScore_assessmentComponentId_studentId_key" ON "StudentAssessmentComponentScore"("assessmentComponentId", "studentId");
CREATE INDEX "StudentAssessmentComponentScore_schoolId_studentId_recordedAt_idx" ON "StudentAssessmentComponentScore"("schoolId", "studentId", "recordedAt");
CREATE INDEX "StudentAssessmentComponentScore_schoolId_assessmentComponentId_idx" ON "StudentAssessmentComponentScore"("schoolId", "assessmentComponentId");

CREATE TABLE "ResourceEngagementEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "eventType" "ResourceEngagementEventType" NOT NULL,
  "progress" DOUBLE PRECISION,
  "durationSec" INTEGER,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dedupeKey" TEXT,
  CONSTRAINT "ResourceEngagementEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResourceEngagementEvent_dedupeKey_key" ON "ResourceEngagementEvent"("dedupeKey");
CREATE INDEX "ResourceEngagementEvent_schoolId_studentId_occurredAt_idx" ON "ResourceEngagementEvent"("schoolId", "studentId", "occurredAt");
CREATE INDEX "ResourceEngagementEvent_schoolId_resourceId_studentId_idx" ON "ResourceEngagementEvent"("schoolId", "resourceId", "studentId");

CREATE TABLE "AnalyticsRecommendation" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT,
  "subjectId" TEXT,
  "chapterId" TEXT,
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "recommendedRole" "Role" NOT NULL,
  "priority" "AnalyticsRecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "AnalyticsRecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "suggestedDeadline" TIMESTAMP(3),
  "completionNote" TEXT,
  "sourceCode" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "parentVisible" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsRecommendation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsRecommendation_schoolId_dedupeKey_key" ON "AnalyticsRecommendation"("schoolId", "dedupeKey");
CREATE INDEX "AnalyticsRecommendation_schoolId_studentId_status_idx" ON "AnalyticsRecommendation"("schoolId", "studentId", "status");
CREATE INDEX "AnalyticsRecommendation_schoolId_recommendedRole_status_idx" ON "AnalyticsRecommendation"("schoolId", "recommendedRole", "status");

CREATE TABLE "StudentAnalyticsSnapshot" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicSessionId" TEXT NOT NULL,
  "snapshotType" "AnalyticsSnapshotType" NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "score" DOUBLE PRECISION,
  "riskLevel" "AnalyticsRiskLevel",
  "dataCoverage" DOUBLE PRECISION,
  "payload" JSONB NOT NULL,
  "formulaVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "StudentAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentAnalyticsSnapshot_schoolId_studentId_createdAt_idx" ON "StudentAnalyticsSnapshot"("schoolId", "studentId", "createdAt");
CREATE INDEX "StudentAnalyticsSnapshot_schoolId_academicSessionId_snapshotType_idx" ON "StudentAnalyticsSnapshot"("schoolId", "academicSessionId", "snapshotType");

CREATE TABLE "AnalyticsAuditLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT,
  "userRole" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsAuditLog_schoolId_createdAt_idx" ON "AnalyticsAuditLog"("schoolId", "createdAt");
CREATE INDEX "AnalyticsAuditLog_schoolId_entityType_entityId_idx" ON "AnalyticsAuditLog"("schoolId", "entityType", "entityId");

CREATE TABLE "AnalyticsStatusOverride" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "calculatedStatus" TEXT NOT NULL,
  "overriddenStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AnalyticsStatusOverride_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsStatusOverride_schoolId_entityType_entityId_createdAt_idx" ON "AnalyticsStatusOverride"("schoolId", "entityType", "entityId", "createdAt");
CREATE INDEX "AnalyticsStatusOverride_schoolId_createdById_idx" ON "AnalyticsStatusOverride"("schoolId", "createdById");

-- Explicit tenant-safe referential integrity. Historical snapshot and audit
-- references intentionally remain scalar so finalized evidence survives archival.
ALTER TABLE "AnalyticsConfiguration" ADD CONSTRAINT "AnalyticsConfiguration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsRiskRule" ADD CONSTRAINT "AnalyticsRiskRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ChapterAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_learningOutcomeId_fkey" FOREIGN KEY ("learningOutcomeId") REFERENCES "LearningOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentAssessmentComponentScore" ADD CONSTRAINT "StudentAssessmentComponentScore_assessmentComponentId_fkey" FOREIGN KEY ("assessmentComponentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceEngagementEvent" ADD CONSTRAINT "ResourceEngagementEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
