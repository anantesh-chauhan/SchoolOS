CREATE TYPE "TeacherCategory" AS ENUM ('PRE_PRIMARY', 'PRE_PRIMARY_ASSISTANT', 'PRT', 'TGT', 'PGT', 'SPECIALIST');
CREATE TYPE "CurriculumSource" AS ENUM ('CBSE_DEFAULT', 'NCERT_ALIGNED', 'SCHOOL_CUSTOM', 'IMPORTED');
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'TEACHER_REQUIRED', 'READY', 'TIMETABLED', 'CONFLICTED', 'INACTIVE');
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');

ALTER TYPE "TeacherAssignmentRoleType" ADD VALUE IF NOT EXISTS 'CO_TEACHER';
ALTER TYPE "TeacherAssignmentRoleType" ADD VALUE IF NOT EXISTS 'PRACTICAL_TEACHER';
ALTER TYPE "TeacherAssignmentRoleType" ADD VALUE IF NOT EXISTS 'LAB_ASSISTANT';
ALTER TYPE "TeacherAssignmentRoleType" ADD VALUE IF NOT EXISTS 'REMEDIAL_TEACHER';
ALTER TYPE "TeacherAssignmentRoleType" ADD VALUE IF NOT EXISTS 'ACTIVITY_TEACHER';
ALTER TYPE "TeacherAssignmentRoleType" ADD VALUE IF NOT EXISTS 'SUBSTITUTE_TEACHER';

ALTER TABLE "Teacher" ADD COLUMN "designation" TEXT,
ADD COLUMN "teacherCategory" "TeacherCategory" NOT NULL DEFAULT 'TGT',
ADD COLUMN "eligibleClassFrom" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "eligibleClassTo" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN "canBeClassTeacher" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "canTeachPractical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maximumPeriodsPerDay" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "maximumPeriodsPerWeek" INTEGER NOT NULL DEFAULT 36,
ADD COLUMN "targetPeriodsPerWeek" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "TeacherAssignment" ADD COLUMN "academicSessionId" TEXT,
ADD COLUMN "weeklySlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Timetable" ADD COLUMN "requiresRegeneration" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "TeacherAssignment_schoolId_teacherId_classId_sectionId_subjectId_key";
DROP INDEX IF EXISTS "TeacherAssignment_schoolId_teacherId_classId_sectionId_subj_key";
CREATE UNIQUE INDEX "TeacherAssignment_schoolId_classId_sectionId_subjectId_key" ON "TeacherAssignment"("schoolId", "classId", "sectionId", "subjectId");

CREATE TABLE "AcademicSession" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "name" TEXT NOT NULL, "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicSession_schoolId_name_key" ON "AcademicSession"("schoolId", "name");
CREATE INDEX "AcademicSession_schoolId_isActive_idx" ON "AcademicSession"("schoolId", "isActive");

CREATE TABLE "AcademicConfiguration" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSessionId" TEXT NOT NULL, "workingDaysPerWeek" INTEGER NOT NULL DEFAULT 6,
  "periodsPerDay" INTEGER NOT NULL DEFAULT 8, "totalPeriodsPerWeek" INTEGER NOT NULL DEFAULT 48, "defaultPeriodDurationMinutes" INTEGER NOT NULL DEFAULT 40,
  "shortBreakAfterPeriod" INTEGER, "lunchBreakAfterPeriod" INTEGER, "maximumTeacherPeriodsPerDay" INTEGER NOT NULL DEFAULT 7,
  "maximumTeacherPeriodsPerWeek" INTEGER NOT NULL DEFAULT 36, "minimumTeacherFreePeriodsWeek" INTEGER NOT NULL DEFAULT 6,
  "targetTeacherPeriodsPerWeek" INTEGER NOT NULL DEFAULT 30, "classTeacherRequired" BOOLEAN NOT NULL DEFAULT true,
  "classTeacherDutyPeriods" INTEGER NOT NULL DEFAULT 1, "prePrimaryAssistantRequired" BOOLEAN NOT NULL DEFAULT false,
  "primaryGeneralistModel" BOOLEAN NOT NULL DEFAULT true, "saturdayWorking" BOOLEAN NOT NULL DEFAULT true,
  "timetableGenerationEnabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AcademicConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicConfiguration_academicSessionId_key" ON "AcademicConfiguration"("academicSessionId");
CREATE UNIQUE INDEX "AcademicConfiguration_schoolId_academicSessionId_key" ON "AcademicConfiguration"("schoolId", "academicSessionId");
CREATE INDEX "AcademicConfiguration_schoolId_idx" ON "AcademicConfiguration"("schoolId");

CREATE TABLE "TeacherQualification" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "teacherId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "isPreferred" BOOLEAN NOT NULL DEFAULT false, "canTeachPractical" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TeacherQualification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherQualification_schoolId_teacherId_subjectId_key" ON "TeacherQualification"("schoolId", "teacherId", "subjectId");
CREATE INDEX "TeacherQualification_schoolId_subjectId_idx" ON "TeacherQualification"("schoolId", "subjectId");

CREATE TABLE "WeeklySubjectSlotTemplate" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSessionId" TEXT NOT NULL, "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "minimumSlots" INTEGER NOT NULL, "recommendedSlots" INTEGER NOT NULL, "maximumSlots" INTEGER NOT NULL, "theorySlots" INTEGER NOT NULL DEFAULT 0,
  "practicalSlots" INTEGER NOT NULL DEFAULT 0, "labDoublePeriods" INTEGER NOT NULL DEFAULT 0, "isCore" BOOLEAN NOT NULL DEFAULT false,
  "isOptional" BOOLEAN NOT NULL DEFAULT false, "isActivity" BOOLEAN NOT NULL DEFAULT false, "isRemedial" BOOLEAN NOT NULL DEFAULT false,
  "sourceType" "CurriculumSource" NOT NULL DEFAULT 'CBSE_DEFAULT', "notes" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WeeklySubjectSlotTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeeklySubjectSlotTemplate_schoolId_academicSessionId_classId_subjectId_key" ON "WeeklySubjectSlotTemplate"("schoolId", "academicSessionId", "classId", "subjectId");
CREATE INDEX "WeeklySubjectSlotTemplate_schoolId_academicSessionId_classId_idx" ON "WeeklySubjectSlotTemplate"("schoolId", "academicSessionId", "classId");

CREATE TABLE "SectionSubjectAllocation" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSessionId" TEXT NOT NULL, "classId" TEXT NOT NULL, "sectionId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL, "teacherId" TEXT, "weeklySlots" INTEGER NOT NULL, "theorySlots" INTEGER NOT NULL DEFAULT 0,
  "practicalSlots" INTEGER NOT NULL DEFAULT 0, "remedialSlots" INTEGER NOT NULL DEFAULT 0,
  "assignmentType" "TeacherAssignmentRoleType" NOT NULL DEFAULT 'SUBJECT_TEACHER', "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
  "workloadContribution" INTEGER NOT NULL DEFAULT 0, "timetableEligible" BOOLEAN NOT NULL DEFAULT true, "requiresLab" BOOLEAN NOT NULL DEFAULT false,
  "requiresDoublePeriod" BOOLEAN NOT NULL DEFAULT false, "maxSameSubjectPeriodsPerDay" INTEGER NOT NULL DEFAULT 2,
  "minimumDistributionDays" INTEGER NOT NULL DEFAULT 3, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SectionSubjectAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SectionSubjectAllocation_schoolId_academicSessionId_sectionId_subjectId_key" ON "SectionSubjectAllocation"("schoolId", "academicSessionId", "sectionId", "subjectId");
CREATE INDEX "SectionSubjectAllocation_schoolId_academicSessionId_teacherId_idx" ON "SectionSubjectAllocation"("schoolId", "academicSessionId", "teacherId");
CREATE INDEX "SectionSubjectAllocation_schoolId_status_idx" ON "SectionSubjectAllocation"("schoolId", "status");

CREATE TABLE "SectionClassTeacherAssignment" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSessionId" TEXT NOT NULL, "sectionId" TEXT NOT NULL, "teacherId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3),
  "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE', "dutyPeriods" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SectionClassTeacherAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SectionClassTeacherAssignment_schoolId_academicSessionId_sectionId_isPrimary_key" ON "SectionClassTeacherAssignment"("schoolId", "academicSessionId", "sectionId", "isPrimary");
CREATE INDEX "SectionClassTeacherAssignment_schoolId_academicSessionId_teacherId_idx" ON "SectionClassTeacherAssignment"("schoolId", "academicSessionId", "teacherId");

CREATE TABLE "AcademicStaffingAuditLog" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSessionId" TEXT, "actorUserId" TEXT, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT, "previousValue" JSONB, "newValue" JSONB, "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AcademicStaffingAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AcademicStaffingAuditLog_schoolId_academicSessionId_createdAt_idx" ON "AcademicStaffingAuditLog"("schoolId", "academicSessionId", "createdAt");
CREATE INDEX "AcademicStaffingAuditLog_schoolId_entityType_entityId_idx" ON "AcademicStaffingAuditLog"("schoolId", "entityType", "entityId");

ALTER TABLE "AcademicSession" ADD CONSTRAINT "AcademicSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicConfiguration" ADD CONSTRAINT "AcademicConfiguration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicConfiguration" ADD CONSTRAINT "AcademicConfiguration_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherQualification" ADD CONSTRAINT "TeacherQualification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherQualification" ADD CONSTRAINT "TeacherQualification_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherQualification" ADD CONSTRAINT "TeacherQualification_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklySubjectSlotTemplate" ADD CONSTRAINT "WeeklySubjectSlotTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklySubjectSlotTemplate" ADD CONSTRAINT "WeeklySubjectSlotTemplate_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklySubjectSlotTemplate" ADD CONSTRAINT "WeeklySubjectSlotTemplate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklySubjectSlotTemplate" ADD CONSTRAINT "WeeklySubjectSlotTemplate_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSubjectAllocation" ADD CONSTRAINT "SectionSubjectAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSubjectAllocation" ADD CONSTRAINT "SectionSubjectAllocation_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSubjectAllocation" ADD CONSTRAINT "SectionSubjectAllocation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSubjectAllocation" ADD CONSTRAINT "SectionSubjectAllocation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSubjectAllocation" ADD CONSTRAINT "SectionSubjectAllocation_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionSubjectAllocation" ADD CONSTRAINT "SectionSubjectAllocation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SectionClassTeacherAssignment" ADD CONSTRAINT "SectionClassTeacherAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionClassTeacherAssignment" ADD CONSTRAINT "SectionClassTeacherAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionClassTeacherAssignment" ADD CONSTRAINT "SectionClassTeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionClassTeacherAssignment" ADD CONSTRAINT "SectionClassTeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicStaffingAuditLog" ADD CONSTRAINT "AcademicStaffingAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicStaffingAuditLog" ADD CONSTRAINT "AcademicStaffingAuditLog_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcademicStaffingAuditLog" ADD CONSTRAINT "AcademicStaffingAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TeacherAssignment_schoolId_academicSessionId_isActive_idx" ON "TeacherAssignment"("schoolId", "academicSessionId", "isActive");
