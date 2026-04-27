-- Academic Structure and Weekly Period Management module
-- Generated for SchoolOS multi-tenant deployment

-- Existing table extensions
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicLevelId" TEXT;
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "streamId" TEXT;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "parentSubjectId" TEXT;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "subjectType" TEXT NOT NULL DEFAULT 'CORE';
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "isLab" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "isOptional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "ClassSubject" ADD COLUMN IF NOT EXISTS "periodsPerWeek" INTEGER;
ALTER TABLE "ClassSubject" ADD COLUMN IF NOT EXISTS "isOptional" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "subjectComponentId" TEXT;
ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "activityId" TEXT;
ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "labRoomId" TEXT;
ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "isActivityPeriod" BOOLEAN NOT NULL DEFAULT false;

-- New module tables
CREATE TABLE IF NOT EXISTS "AcademicLevel" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minClassOrder" INTEGER NOT NULL,
  "maxClassOrder" INTEGER NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isDefaultTemplate" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubjectComponent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "periodsPerWeek" INTEGER NOT NULL,
  "isLab" BOOLEAN NOT NULL DEFAULT false,
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubjectComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Stream" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "classFrom" INTEGER NOT NULL DEFAULT 11,
  "classTo" INTEGER NOT NULL DEFAULT 12,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StreamSubject" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectComponentId" TEXT,
  "periodsPerWeek" INTEGER NOT NULL,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StreamSubject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClassStream" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "streamId" TEXT NOT NULL,
  "academicYear" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassStream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeacherSubject" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT,
  "sectionId" TEXT,
  "subjectId" TEXT NOT NULL,
  "subjectComponentId" TEXT,
  "periodsPerWeek" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherSubject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Activity" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 40,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityEnrollment" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PeriodDefinition" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "dayOfWeek" TEXT NOT NULL,
  "periodNumber" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "isActivityPeriod" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PeriodDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LabRoom" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "roomName" TEXT NOT NULL,
  "roomCode" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 40,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LabSubjectRule" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "requiresLabRoom" BOOLEAN NOT NULL DEFAULT true,
  "minConsecutivePeriods" INTEGER NOT NULL DEFAULT 2,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabSubjectRule_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicLevel_schoolId_code_key" ON "AcademicLevel"("schoolId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "SubjectComponent_schoolId_subjectId_code_key" ON "SubjectComponent"("schoolId", "subjectId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Stream_schoolId_code_key" ON "Stream"("schoolId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "StreamSubject_streamId_subjectId_subjectComponentId_key" ON "StreamSubject"("streamId", "subjectId", "subjectComponentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Activity_schoolId_code_key" ON "Activity"("schoolId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityEnrollment_schoolId_activityId_userId_key" ON "ActivityEnrollment"("schoolId", "activityId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PeriodDefinition_schoolId_dayOfWeek_periodNumber_key" ON "PeriodDefinition"("schoolId", "dayOfWeek", "periodNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "LabRoom_schoolId_roomCode_key" ON "LabRoom"("schoolId", "roomCode");
CREATE UNIQUE INDEX IF NOT EXISTS "LabSubjectRule_schoolId_subjectId_key" ON "LabSubjectRule"("schoolId", "subjectId");

CREATE INDEX IF NOT EXISTS "Class_academicLevelId_idx" ON "Class"("academicLevelId");
CREATE INDEX IF NOT EXISTS "Section_streamId_idx" ON "Section"("streamId");
CREATE INDEX IF NOT EXISTS "Subject_parentSubjectId_idx" ON "Subject"("parentSubjectId");
CREATE INDEX IF NOT EXISTS "TimetableSlot_subjectComponentId_idx" ON "TimetableSlot"("subjectComponentId");
CREATE INDEX IF NOT EXISTS "TimetableSlot_activityId_idx" ON "TimetableSlot"("activityId");
CREATE INDEX IF NOT EXISTS "TimetableSlot_labRoomId_idx" ON "TimetableSlot"("labRoomId");

-- Foreign keys
ALTER TABLE "Class" ADD CONSTRAINT IF NOT EXISTS "Class_academicLevelId_fkey" FOREIGN KEY ("academicLevelId") REFERENCES "AcademicLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Section" ADD CONSTRAINT IF NOT EXISTS "Section_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT IF NOT EXISTS "Subject_parentSubjectId_fkey" FOREIGN KEY ("parentSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT IF NOT EXISTS "TimetableSlot_subjectComponentId_fkey" FOREIGN KEY ("subjectComponentId") REFERENCES "SubjectComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT IF NOT EXISTS "TimetableSlot_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT IF NOT EXISTS "TimetableSlot_labRoomId_fkey" FOREIGN KEY ("labRoomId") REFERENCES "LabRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcademicLevel" ADD CONSTRAINT IF NOT EXISTS "AcademicLevel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectComponent" ADD CONSTRAINT IF NOT EXISTS "SubjectComponent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectComponent" ADD CONSTRAINT IF NOT EXISTS "SubjectComponent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stream" ADD CONSTRAINT IF NOT EXISTS "Stream_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreamSubject" ADD CONSTRAINT IF NOT EXISTS "StreamSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreamSubject" ADD CONSTRAINT IF NOT EXISTS "StreamSubject_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreamSubject" ADD CONSTRAINT IF NOT EXISTS "StreamSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreamSubject" ADD CONSTRAINT IF NOT EXISTS "StreamSubject_subjectComponentId_fkey" FOREIGN KEY ("subjectComponentId") REFERENCES "SubjectComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassStream" ADD CONSTRAINT IF NOT EXISTS "ClassStream_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassStream" ADD CONSTRAINT IF NOT EXISTS "ClassStream_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassStream" ADD CONSTRAINT IF NOT EXISTS "ClassStream_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassStream" ADD CONSTRAINT IF NOT EXISTS "ClassStream_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT IF NOT EXISTS "TeacherSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT IF NOT EXISTS "TeacherSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT IF NOT EXISTS "TeacherSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT IF NOT EXISTS "TeacherSubject_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT IF NOT EXISTS "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSubject" ADD CONSTRAINT IF NOT EXISTS "TeacherSubject_subjectComponentId_fkey" FOREIGN KEY ("subjectComponentId") REFERENCES "SubjectComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT IF NOT EXISTS "Activity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEnrollment" ADD CONSTRAINT IF NOT EXISTS "ActivityEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEnrollment" ADD CONSTRAINT IF NOT EXISTS "ActivityEnrollment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEnrollment" ADD CONSTRAINT IF NOT EXISTS "ActivityEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodDefinition" ADD CONSTRAINT IF NOT EXISTS "PeriodDefinition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabRoom" ADD CONSTRAINT IF NOT EXISTS "LabRoom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabSubjectRule" ADD CONSTRAINT IF NOT EXISTS "LabSubjectRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabSubjectRule" ADD CONSTRAINT IF NOT EXISTS "LabSubjectRule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
