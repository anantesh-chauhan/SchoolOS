-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('CHAPTER_QUIZ', 'CLASS_TEST', 'ASSIGNMENT', 'HOMEWORK', 'PRACTICAL', 'REASSESSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MasteryLevel" AS ENUM ('CRITICAL', 'NEEDS_ATTENTION', 'DEVELOPING', 'PROFICIENT', 'MASTERED');

-- CreateEnum
CREATE TYPE "MasteryConfidence" AS ENUM ('INSUFFICIENT_DATA', 'PRELIMINARY', 'RELIABLE');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ChapterAssessment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "pollId" TEXT,
    "teacherId" TEXT,
    "title" TEXT NOT NULL,
    "assessmentType" "AssessmentType" NOT NULL DEFAULT 'CHAPTER_QUIZ',
    "assessmentDate" TIMESTAMP(3),
    "maxScore" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterAssessmentResult" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "normalizedScore" DOUBLE PRECISION NOT NULL,
    "isReassessment" BOOLEAN NOT NULL DEFAULT false,
    "reassessmentNumber" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterAssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentChapterMastery" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "masteryLevel" "MasteryLevel",
    "confidence" "MasteryConfidence" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "componentBreakdown" JSONB NOT NULL,
    "dataCompleteness" JSONB NOT NULL,
    "summary" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentChapterMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningGap" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "studentId" TEXT,
    "gapType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LearningGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningIntervention" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedTeacherId" TEXT,
    "reason" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "status" "InterventionStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "reassessmentRequired" BOOLEAN NOT NULL DEFAULT true,
    "beforeScore" DOUBLE PRECISION,
    "afterScore" DOUBLE PRECISION,
    "improvement" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChapterAssessment_schoolId_classId_sectionId_subjectId_idx" ON "ChapterAssessment"("schoolId", "classId", "sectionId", "subjectId");
CREATE INDEX "ChapterAssessment_schoolId_chapterId_idx" ON "ChapterAssessment"("schoolId", "chapterId");
CREATE INDEX "ChapterAssessment_schoolId_pollId_idx" ON "ChapterAssessment"("schoolId", "pollId");
CREATE UNIQUE INDEX "ChapterAssessmentResult_assessmentId_studentId_key" ON "ChapterAssessmentResult"("assessmentId", "studentId");
CREATE INDEX "ChapterAssessmentResult_schoolId_studentId_chapterId_idx" ON "ChapterAssessmentResult"("schoolId", "studentId", "chapterId");
CREATE INDEX "ChapterAssessmentResult_schoolId_classId_sectionId_subjectId_chapterId_idx" ON "ChapterAssessmentResult"("schoolId", "classId", "sectionId", "subjectId", "chapterId");
CREATE UNIQUE INDEX "StudentChapterMastery_scope_student_key" ON "StudentChapterMastery"("schoolId", "classId", "sectionId", "subjectId", "chapterId", "studentId");
CREATE INDEX "StudentChapterMastery_schoolId_studentId_idx" ON "StudentChapterMastery"("schoolId", "studentId");
CREATE INDEX "StudentChapterMastery_scope_idx" ON "StudentChapterMastery"("schoolId", "classId", "sectionId", "subjectId", "chapterId");
CREATE INDEX "StudentChapterMastery_schoolId_masteryLevel_idx" ON "StudentChapterMastery"("schoolId", "masteryLevel");
CREATE INDEX "LearningGap_schoolId_classId_sectionId_subjectId_chapterId_idx" ON "LearningGap"("schoolId", "classId", "sectionId", "subjectId", "chapterId");
CREATE INDEX "LearningGap_schoolId_studentId_isResolved_idx" ON "LearningGap"("schoolId", "studentId", "isResolved");
CREATE INDEX "LearningIntervention_schoolId_studentId_status_idx" ON "LearningIntervention"("schoolId", "studentId", "status");
CREATE INDEX "LearningIntervention_schoolId_assignedTeacherId_status_idx" ON "LearningIntervention"("schoolId", "assignedTeacherId", "status");
CREATE INDEX "LearningIntervention_schoolId_classId_sectionId_subjectId_chapterId_idx" ON "LearningIntervention"("schoolId", "classId", "sectionId", "subjectId", "chapterId");

-- AddForeignKey
ALTER TABLE "ChapterAssessment" ADD CONSTRAINT "ChapterAssessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessment" ADD CONSTRAINT "ChapterAssessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessment" ADD CONSTRAINT "ChapterAssessment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessment" ADD CONSTRAINT "ChapterAssessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessment" ADD CONSTRAINT "ChapterAssessment_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessment" ADD CONSTRAINT "ChapterAssessment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessment" ADD CONSTRAINT "ChapterAssessment_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ChapterPoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChapterAssessmentResult" ADD CONSTRAINT "ChapterAssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ChapterAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessmentResult" ADD CONSTRAINT "ChapterAssessmentResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessmentResult" ADD CONSTRAINT "ChapterAssessmentResult_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessmentResult" ADD CONSTRAINT "ChapterAssessmentResult_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessmentResult" ADD CONSTRAINT "ChapterAssessmentResult_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessmentResult" ADD CONSTRAINT "ChapterAssessmentResult_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAssessmentResult" ADD CONSTRAINT "ChapterAssessmentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentChapterMastery" ADD CONSTRAINT "StudentChapterMastery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterMastery" ADD CONSTRAINT "StudentChapterMastery_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterMastery" ADD CONSTRAINT "StudentChapterMastery_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterMastery" ADD CONSTRAINT "StudentChapterMastery_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterMastery" ADD CONSTRAINT "StudentChapterMastery_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterMastery" ADD CONSTRAINT "StudentChapterMastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningGap" ADD CONSTRAINT "LearningGap_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGap" ADD CONSTRAINT "LearningGap_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGap" ADD CONSTRAINT "LearningGap_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGap" ADD CONSTRAINT "LearningGap_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGap" ADD CONSTRAINT "LearningGap_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGap" ADD CONSTRAINT "LearningGap_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningIntervention" ADD CONSTRAINT "LearningIntervention_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningIntervention" ADD CONSTRAINT "LearningIntervention_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningIntervention" ADD CONSTRAINT "LearningIntervention_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningIntervention" ADD CONSTRAINT "LearningIntervention_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningIntervention" ADD CONSTRAINT "LearningIntervention_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningIntervention" ADD CONSTRAINT "LearningIntervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningIntervention" ADD CONSTRAINT "LearningIntervention_assignedTeacherId_fkey" FOREIGN KEY ("assignedTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
