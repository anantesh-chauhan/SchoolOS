-- CreateEnum
CREATE TYPE "ChapterPollStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'COMPILED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "ChapterPoll" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "teacherId" TEXT,
    "createdByAdminId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChapterPollStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "compiledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentChapterVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "understandingRating" INTEGER NOT NULL,
    "difficultyRating" INTEGER NOT NULL,
    "confidenceRating" INTEGER NOT NULL,
    "teachingRating" INTEGER NOT NULL,
    "paceRating" INTEGER NOT NULL,
    "clarityRating" INTEGER NOT NULL,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentChapterVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherStudentEvaluation" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attentionRating" INTEGER NOT NULL,
    "participationRating" INTEGER NOT NULL,
    "homeworkRating" INTEGER NOT NULL,
    "conceptClarityRating" INTEGER NOT NULL,
    "improvementNeedRating" INTEGER NOT NULL,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "recommendation" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherStudentEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterAnalysisSummary" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "teacherId" TEXT,
    "compiledByAdminId" TEXT,
    "overallUnderstandingScore" DOUBLE PRECISION NOT NULL,
    "overallTeachingScore" DOUBLE PRECISION NOT NULL,
    "classStrengths" JSONB NOT NULL,
    "classWeaknesses" JSONB NOT NULL,
    "teacherStrengths" JSONB NOT NULL,
    "teacherImprovementAreas" JSONB NOT NULL,
    "studentSummaries" JSONB NOT NULL,
    "riskStudents" JSONB NOT NULL,
    "topperStudents" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "adminNotes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterAnalysisSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChapterPoll_schoolId_classId_sectionId_subjectId_chapterId_key" ON "ChapterPoll"("schoolId", "classId", "sectionId", "subjectId", "chapterId");
CREATE INDEX "ChapterPoll_schoolId_status_idx" ON "ChapterPoll"("schoolId", "status");
CREATE INDEX "ChapterPoll_schoolId_teacherId_idx" ON "ChapterPoll"("schoolId", "teacherId");
CREATE INDEX "ChapterPoll_schoolId_classId_sectionId_subjectId_idx" ON "ChapterPoll"("schoolId", "classId", "sectionId", "subjectId");
CREATE UNIQUE INDEX "StudentChapterVote_pollId_studentId_key" ON "StudentChapterVote"("pollId", "studentId");
CREATE INDEX "StudentChapterVote_schoolId_pollId_idx" ON "StudentChapterVote"("schoolId", "pollId");
CREATE INDEX "StudentChapterVote_schoolId_studentId_idx" ON "StudentChapterVote"("schoolId", "studentId");
CREATE UNIQUE INDEX "TeacherStudentEvaluation_pollId_teacherId_studentId_key" ON "TeacherStudentEvaluation"("pollId", "teacherId", "studentId");
CREATE INDEX "TeacherStudentEvaluation_schoolId_pollId_idx" ON "TeacherStudentEvaluation"("schoolId", "pollId");
CREATE INDEX "TeacherStudentEvaluation_schoolId_teacherId_idx" ON "TeacherStudentEvaluation"("schoolId", "teacherId");
CREATE INDEX "TeacherStudentEvaluation_schoolId_studentId_idx" ON "TeacherStudentEvaluation"("schoolId", "studentId");
CREATE UNIQUE INDEX "ChapterAnalysisSummary_pollId_key" ON "ChapterAnalysisSummary"("pollId");
CREATE INDEX "ChapterAnalysisSummary_schoolId_classId_sectionId_subjectId_idx" ON "ChapterAnalysisSummary"("schoolId", "classId", "sectionId", "subjectId");
CREATE INDEX "ChapterAnalysisSummary_schoolId_isPublished_idx" ON "ChapterAnalysisSummary"("schoolId", "isPublished");

-- AddForeignKey
ALTER TABLE "ChapterPoll" ADD CONSTRAINT "ChapterPoll_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterPoll" ADD CONSTRAINT "ChapterPoll_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterPoll" ADD CONSTRAINT "ChapterPoll_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterPoll" ADD CONSTRAINT "ChapterPoll_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterPoll" ADD CONSTRAINT "ChapterPoll_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterPoll" ADD CONSTRAINT "ChapterPoll_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChapterPoll" ADD CONSTRAINT "ChapterPoll_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentChapterVote" ADD CONSTRAINT "StudentChapterVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ChapterPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterVote" ADD CONSTRAINT "StudentChapterVote_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterVote" ADD CONSTRAINT "StudentChapterVote_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterVote" ADD CONSTRAINT "StudentChapterVote_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterVote" ADD CONSTRAINT "StudentChapterVote_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterVote" ADD CONSTRAINT "StudentChapterVote_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentChapterVote" ADD CONSTRAINT "StudentChapterVote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ChapterPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherStudentEvaluation" ADD CONSTRAINT "TeacherStudentEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ChapterPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChapterAnalysisSummary" ADD CONSTRAINT "ChapterAnalysisSummary_compiledByAdminId_fkey" FOREIGN KEY ("compiledByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
