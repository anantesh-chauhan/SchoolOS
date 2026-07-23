-- Normalized, polymorphic academic-content targeting and engagement.
-- Existing single-section rows remain valid and are backfilled below.
CREATE TYPE "AcademicAudienceScope" AS ENUM (
  'WHOLE_SCHOOL', 'SELECTED_CLASSES', 'ENTIRE_CLASS', 'SELECTED_SECTIONS',
  'SUBJECT_BASED', 'CHAPTER_BASED', 'SELECTED_STUDENTS'
);
CREATE TYPE "ResourceActivityKind" AS ENUM ('VIEW', 'DOWNLOAD', 'BOOKMARK', 'ACKNOWLEDGMENT', 'COMPLETION', 'HELPFUL', 'BROKEN_LINK');
CREATE TYPE "ResourceModerationStatus" AS ENUM ('PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

ALTER TABLE "Homework"
  ADD COLUMN "audienceScope" "AcademicAudienceScope" NOT NULL DEFAULT 'SELECTED_SECTIONS',
  ADD COLUMN "parentVisibility" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "contentTypeCode" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Homework" ALTER COLUMN "classId" DROP NOT NULL, ALTER COLUMN "sectionId" DROP NOT NULL, ALTER COLUMN "subjectId" DROP NOT NULL;
ALTER TABLE "SectionResource"
  ADD COLUMN "audienceScope" "AcademicAudienceScope" NOT NULL DEFAULT 'SELECTED_SECTIONS',
  ADD COLUMN "parentVisibility" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "priority" "HomeworkPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "contentTypeCode" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "curriculumSource" TEXT,
  ADD COLUMN "difficultyLevel" TEXT,
  ADD COLUMN "estimatedMinutes" INTEGER,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "SectionResource" ALTER COLUMN "classId" DROP NOT NULL, ALTER COLUMN "sectionId" DROP NOT NULL, ALTER COLUMN "subjectId" DROP NOT NULL;
ALTER TABLE "HomeworkModuleSetting"
  ADD COLUMN "moderationMode" TEXT NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "classTeacherPublication" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "zipUploadsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "defaultParentVisibility" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ResourceTarget" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "homeworkId" TEXT,
  "resourceId" TEXT,
  "scope" "AcademicAudienceScope" NOT NULL,
  "classId" TEXT,
  "sectionId" TEXT,
  "subjectId" TEXT,
  "chapterId" TEXT,
  "studentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceTarget_exactly_one_content_check" CHECK (("homeworkId" IS NOT NULL) <> ("resourceId" IS NOT NULL)),
  CONSTRAINT "ResourceTarget_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceTarget_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceTarget_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceTarget_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT,
  CONSTRAINT "ResourceTarget_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT,
  CONSTRAINT "ResourceTarget_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT,
  CONSTRAINT "ResourceTarget_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL,
  CONSTRAINT "ResourceTarget_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE
);
CREATE INDEX "ResourceTarget_schoolId_scope_idx" ON "ResourceTarget"("schoolId", "scope");
CREATE INDEX "ResourceTarget_schoolId_classId_sectionId_idx" ON "ResourceTarget"("schoolId", "classId", "sectionId");
CREATE INDEX "ResourceTarget_schoolId_subjectId_chapterId_idx" ON "ResourceTarget"("schoolId", "subjectId", "chapterId");
CREATE INDEX "ResourceTarget_schoolId_studentId_idx" ON "ResourceTarget"("schoolId", "studentId");
CREATE INDEX "ResourceTarget_homeworkId_idx" ON "ResourceTarget"("homeworkId");
CREATE INDEX "ResourceTarget_resourceId_idx" ON "ResourceTarget"("resourceId");

CREATE TABLE "ResourceVersion" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT, "resourceId" TEXT,
  "version" INTEGER NOT NULL, "snapshot" JSONB NOT NULL, "reason" TEXT,
  "createdByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceVersion_exactly_one_content_check" CHECK (("homeworkId" IS NOT NULL) <> ("resourceId" IS NOT NULL)),
  CONSTRAINT "ResourceVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceVersion_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ResourceVersion_homeworkId_version_key" ON "ResourceVersion"("homeworkId", "version");
CREATE UNIQUE INDEX "ResourceVersion_resourceId_version_key" ON "ResourceVersion"("resourceId", "version");
CREATE INDEX "ResourceVersion_schoolId_createdAt_idx" ON "ResourceVersion"("schoolId", "createdAt");

CREATE TABLE "ResourceActivity" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT, "resourceId" TEXT,
  "studentId" TEXT NOT NULL, "kind" "ResourceActivityKind" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1, "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "ResourceActivity_exactly_one_content_check" CHECK (("homeworkId" IS NOT NULL) <> ("resourceId" IS NOT NULL)),
  CONSTRAINT "ResourceActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceActivity_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceActivity_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceActivity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ResourceActivity_homeworkId_studentId_kind_key" ON "ResourceActivity"("homeworkId", "studentId", "kind");
CREATE UNIQUE INDEX "ResourceActivity_resourceId_studentId_kind_key" ON "ResourceActivity"("resourceId", "studentId", "kind");
CREATE INDEX "ResourceActivity_schoolId_kind_lastAt_idx" ON "ResourceActivity"("schoolId", "kind", "lastAt");

CREATE TABLE "ResourceComment" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT, "resourceId" TEXT,
  "studentId" TEXT, "authorUserId" TEXT, "parentId" TEXT, "body" TEXT NOT NULL,
  "isPrivate" BOOLEAN NOT NULL DEFAULT true, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "replyToId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResourceComment_exactly_one_content_check" CHECK (("homeworkId" IS NOT NULL) <> ("resourceId" IS NOT NULL)),
  CONSTRAINT "ResourceComment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceComment_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceComment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceComment_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ResourceComment"("id") ON DELETE CASCADE
);
CREATE INDEX "ResourceComment_schoolId_status_createdAt_idx" ON "ResourceComment"("schoolId", "status", "createdAt");

CREATE TABLE "ResourceModeration" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "homeworkId" TEXT, "resourceId" TEXT,
  "status" "ResourceModerationStatus" NOT NULL, "submittedByUserId" TEXT,
  "reviewedByUserId" TEXT, "reviewComment" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ResourceModeration_exactly_one_content_check" CHECK (("homeworkId" IS NOT NULL) <> ("resourceId" IS NOT NULL)),
  CONSTRAINT "ResourceModeration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceModeration_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceModeration_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE
);
CREATE INDEX "ResourceModeration_schoolId_status_createdAt_idx" ON "ResourceModeration"("schoolId", "status", "createdAt");

CREATE TABLE "AcademicContentType" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "displayName" TEXT NOT NULL, "code" TEXT NOT NULL, "icon" TEXT,
  "supportsSubmission" BOOLEAN NOT NULL DEFAULT false, "supportsDueDate" BOOLEAN NOT NULL DEFAULT false,
  "supportsMarks" BOOLEAN NOT NULL DEFAULT false, "supportsChapter" BOOLEAN NOT NULL DEFAULT true,
  "canBeSchoolWide" BOOLEAN NOT NULL DEFAULT false, "maximumFileBytes" INTEGER NOT NULL DEFAULT 10485760,
  "allowedMimeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[], "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicContentType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "AcademicContentType_schoolId_code_key" ON "AcademicContentType"("schoolId", "code");
CREATE INDEX "AcademicContentType_schoolId_active_displayName_idx" ON "AcademicContentType"("schoolId", "active", "displayName");

CREATE TABLE "ResourceCategory" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResourceCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ResourceCategory_schoolId_slug_key" ON "ResourceCategory"("schoolId", "slug");
CREATE INDEX "ResourceCategory_schoolId_active_name_idx" ON "ResourceCategory"("schoolId", "active", "name");
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ResourceCategory"("id") ON DELETE SET NULL;
ALTER TABLE "SectionResource" ADD CONSTRAINT "SectionResource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ResourceCategory"("id") ON DELETE SET NULL;

CREATE TABLE "ResourceTag" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceTag_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ResourceTag_schoolId_normalizedName_key" ON "ResourceTag"("schoolId", "normalizedName");
CREATE INDEX "ResourceTag_schoolId_active_name_idx" ON "ResourceTag"("schoolId", "active", "name");

CREATE TABLE "ResourceTagAssignment" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "tagId" TEXT NOT NULL, "homeworkId" TEXT, "resourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceTagAssignment_exactly_one_content_check" CHECK (("homeworkId" IS NOT NULL) <> ("resourceId" IS NOT NULL)),
  CONSTRAINT "ResourceTagAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ResourceTag"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceTagAssignment_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE,
  CONSTRAINT "ResourceTagAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "SectionResource"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ResourceTagAssignment_tagId_homeworkId_key" ON "ResourceTagAssignment"("tagId", "homeworkId");
CREATE UNIQUE INDEX "ResourceTagAssignment_tagId_resourceId_key" ON "ResourceTagAssignment"("tagId", "resourceId");
CREATE INDEX "ResourceTagAssignment_schoolId_homeworkId_idx" ON "ResourceTagAssignment"("schoolId", "homeworkId");
CREATE INDEX "ResourceTagAssignment_schoolId_resourceId_idx" ON "ResourceTagAssignment"("schoolId", "resourceId");

CREATE TABLE "StudentSubjectEnrollment" (
  "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "academicSession" TEXT NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentSubjectEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "StudentSubjectEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE,
  CONSTRAINT "StudentSubjectEnrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "StudentSubjectEnrollment_studentId_subjectId_academicSession_key" ON "StudentSubjectEnrollment"("studentId", "subjectId", "academicSession");
CREATE INDEX "StudentSubjectEnrollment_schoolId_subjectId_isActive_idx" ON "StudentSubjectEnrollment"("schoolId", "subjectId", "isActive");
CREATE INDEX "StudentSubjectEnrollment_schoolId_studentId_academicSession_isActive_idx" ON "StudentSubjectEnrollment"("schoolId", "studentId", "academicSession", "isActive");

INSERT INTO "ResourceTarget" ("id", "schoolId", "homeworkId", "scope", "classId", "sectionId", "subjectId", "chapterId")
SELECT 'legacy-hw-' || "id", "schoolId", "id", 'SELECTED_SECTIONS', "classId", "sectionId", "subjectId", "chapterId" FROM "Homework";
INSERT INTO "ResourceTarget" ("id", "schoolId", "resourceId", "scope", "classId", "sectionId", "subjectId", "chapterId")
SELECT 'legacy-res-' || "id", "schoolId", "id", 'SELECTED_SECTIONS', "classId", "sectionId", "subjectId", "chapterId" FROM "SectionResource";

CREATE INDEX "Homework_schoolId_audienceScope_status_idx" ON "Homework"("schoolId", "audienceScope", "status");
CREATE INDEX "Homework_schoolId_expiresAt_idx" ON "Homework"("schoolId", "expiresAt");
CREATE INDEX "SectionResource_schoolId_audienceScope_status_idx" ON "SectionResource"("schoolId", "audienceScope", "status");
CREATE INDEX "SectionResource_schoolId_expiresAt_idx" ON "SectionResource"("schoolId", "expiresAt");
