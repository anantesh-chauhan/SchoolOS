CREATE TYPE "TeacherAssignmentRoleType" AS ENUM ('SUBJECT_TEACHER', 'CLASS_TEACHER', 'BOTH');
CREATE TYPE "ChapterProgressStatus" AS ENUM ('NOT_STARTED', 'ONGOING', 'COMPLETED');
CREATE TYPE "SectionResourceType" AS ENUM ('NOTE', 'LINK', 'PDF', 'IMAGE', 'VIDEO', 'ASSIGNMENT', 'OTHER');

ALTER TABLE "TeacherAssignment"
  ADD COLUMN "roleType" "TeacherAssignmentRoleType" NOT NULL DEFAULT 'SUBJECT_TEACHER',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "TeacherAssignment" DROP CONSTRAINT IF EXISTS "TeacherAssignment_schoolId_classId_sectionId_subjectId_key";
DROP INDEX IF EXISTS "TeacherAssignment_schoolId_classId_sectionId_subjectId_key";
CREATE UNIQUE INDEX "TeacherAssignment_schoolId_teacherId_classId_sectionId_subjectId_key"
  ON "TeacherAssignment"("schoolId", "teacherId", "classId", "sectionId", "subjectId");
CREATE INDEX "TeacherAssignment_schoolId_teacherId_isActive_idx"
  ON "TeacherAssignment"("schoolId", "teacherId", "isActive");

CREATE TABLE "ChapterProgress" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "teacherId" TEXT,
  "status" "ChapterProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "remarks" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChapterProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectionResource" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "chapterId" TEXT,
  "teacherId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "resourceType" "SectionResourceType" NOT NULL DEFAULT 'NOTE',
  "fileUrl" TEXT,
  "externalUrl" TEXT,
  "isVisibleToStudents" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SectionResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChapterProgress_schoolId_classId_sectionId_subjectId_chapterId_key"
  ON "ChapterProgress"("schoolId", "classId", "sectionId", "subjectId", "chapterId");
CREATE INDEX "ChapterProgress_schoolId_teacherId_idx" ON "ChapterProgress"("schoolId", "teacherId");
CREATE INDEX "ChapterProgress_schoolId_classId_sectionId_subjectId_idx"
  ON "ChapterProgress"("schoolId", "classId", "sectionId", "subjectId");
CREATE INDEX "ChapterProgress_schoolId_status_idx" ON "ChapterProgress"("schoolId", "status");

CREATE INDEX "SectionResource_schoolId_classId_sectionId_subjectId_idx"
  ON "SectionResource"("schoolId", "classId", "sectionId", "subjectId");
CREATE INDEX "SectionResource_schoolId_teacherId_idx" ON "SectionResource"("schoolId", "teacherId");
CREATE INDEX "SectionResource_schoolId_chapterId_idx" ON "SectionResource"("schoolId", "chapterId");
CREATE INDEX "SectionResource_schoolId_isVisibleToStudents_idx"
  ON "SectionResource"("schoolId", "isVisibleToStudents");

ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SectionResource" ADD CONSTRAINT "SectionResource_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionResource" ADD CONSTRAINT "SectionResource_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionResource" ADD CONSTRAINT "SectionResource_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionResource" ADD CONSTRAINT "SectionResource_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionResource" ADD CONSTRAINT "SectionResource_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SectionResource" ADD CONSTRAINT "SectionResource_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
