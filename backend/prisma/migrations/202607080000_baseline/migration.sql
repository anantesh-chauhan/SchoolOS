-- Baseline of the core schema that existed before Prisma migration tracking began.
-- Existing databases must mark this migration as applied; it must not be executed over live core tables.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('FIXED', 'PERIOD');

-- CreateEnum
CREATE TYPE "WidgetPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SubjectCategory" AS ENUM ('PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY');

-- CreateEnum
CREATE TYPE "StreamType" AS ENUM ('GENERAL', 'SCIENCE', 'COMMERCE', 'ARTS');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('CORE', 'OPTIONAL', 'LAB', 'ACTIVITY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "schoolId" TEXT,
    "classId" TEXT,
    "sectionId" TEXT,
    "employeeId" TEXT,
    "joiningYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileImage" TEXT,
    "alternateMobile" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolCode" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "logoUrl" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "theme" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryGroup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryPhoto" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "website" TEXT,
    "supportEmail" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "classOrder" INTEGER NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicLevelId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "streamId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "parentSubjectId" TEXT,
    "subjectType" "SubjectType" NOT NULL DEFAULT 'CORE',
    "isLab" BOOLEAN NOT NULL DEFAULT false,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "category" "SubjectCategory",
    "stream" "StreamType",
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubject" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "periodsPerWeek" INTEGER,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionSubject" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "joiningYear" INTEGER,
    "qualification" TEXT,
    "specialization" TEXT,
    "subjectsHandled" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schoolId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectWeeklyRequirement" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "periodsPerWeek" INTEGER NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectWeeklyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timetable" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "periodNumber" INTEGER,
    "sequenceOrder" INTEGER NOT NULL,
    "slotType" "SlotType" NOT NULL DEFAULT 'PERIOD',
    "slotLabel" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectComponentId" TEXT,
    "teacherId" TEXT,
    "activityId" TEXT,
    "labRoomId" TEXT,
    "isActivityPeriod" BOOLEAN NOT NULL DEFAULT false,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicLevel" (
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

-- CreateTable
CREATE TABLE "SubjectComponent" (
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

-- CreateTable
CREATE TABLE "Stream" (
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

-- CreateTable
CREATE TABLE "ClassStream" (
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

-- CreateTable
CREATE TABLE "StreamSubject" (
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

-- CreateTable
CREATE TABLE "TeacherSubject" (
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

-- CreateTable
CREATE TABLE "Activity" (
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

-- CreateTable
CREATE TABLE "ActivityEnrollment" (
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

-- CreateTable
CREATE TABLE "PeriodDefinition" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActivityPeriod" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabRoom" (
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

-- CreateTable
CREATE TABLE "LabSubjectRule" (
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

-- CreateTable
CREATE TABLE "UserWidgetPreference" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "size" TEXT NOT NULL DEFAULT 'MD',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWidgetPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWidgetTodo" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "WidgetPriority" NOT NULL DEFAULT 'MEDIUM',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWidgetTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWidgetNote" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "color" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWidgetNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWidgetBookmark" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "tag" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWidgetBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWidgetNotification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWidgetNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWidgetActivity" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWidgetActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLoginStreak" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "streakStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLoginStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemContent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "admissionNo" TEXT,
    "studentFirstName" TEXT NOT NULL,
    "studentLastName" TEXT,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "bloodGroup" TEXT,
    "category" TEXT,
    "religion" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "rollNumber" TEXT,
    "admissionDate" TIMESTAMP(3),
    "fatherName" TEXT NOT NULL,
    "motherName" TEXT,
    "parentMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "parentEmail" TEXT,
    "occupation" TEXT,
    "session" TEXT NOT NULL,
    "serialNo" INTEGER,
    "studentUserId" TEXT,
    "parentUserId" TEXT,
    "studentPasswordHash" TEXT,
    "parentPasswordHash" TEXT,
    "passwordGenerated" BOOLEAN NOT NULL DEFAULT false,
    "lastPasswordGeneratedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAcademicHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "session" TEXT NOT NULL,
    "rollNumber" TEXT,
    "promotedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAcademicHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_schoolId_role_idx" ON "User"("schoolId", "role");

-- CreateIndex
CREATE INDEX "User_classId_idx" ON "User"("classId");

-- CreateIndex
CREATE INDEX "User_sectionId_idx" ON "User"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_employeeId_key" ON "User"("schoolId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "School_schoolCode_key" ON "School"("schoolCode");

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE INDEX "School_schoolName_idx" ON "School"("schoolName");

-- CreateIndex
CREATE INDEX "School_city_state_idx" ON "School"("city", "state");

-- CreateIndex
CREATE INDEX "GalleryGroup_schoolId_isVisible_displayOrder_idx" ON "GalleryGroup"("schoolId", "isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "GalleryGroup_schoolId_createdAt_idx" ON "GalleryGroup"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryGroup_schoolId_title_key" ON "GalleryGroup"("schoolId", "title");

-- CreateIndex
CREATE INDEX "GalleryPhoto_schoolId_groupId_isVisible_displayOrder_idx" ON "GalleryPhoto"("schoolId", "groupId", "isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "GalleryPhoto_groupId_displayOrder_idx" ON "GalleryPhoto"("groupId", "displayOrder");

-- CreateIndex
CREATE INDEX "SchoolSettings_schoolId_idx" ON "SchoolSettings"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_schoolId_className_key" ON "Class"("schoolId", "className");

-- CreateIndex
CREATE UNIQUE INDEX "Class_schoolId_classOrder_key" ON "Class"("schoolId", "classOrder");

-- CreateIndex
CREATE INDEX "Class_schoolId_classOrder_idx" ON "Class"("schoolId", "classOrder");

-- CreateIndex
CREATE INDEX "Class_academicLevelId_idx" ON "Class"("academicLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_classId_sectionName_key" ON "Section"("classId", "sectionName");

-- CreateIndex
CREATE UNIQUE INDEX "Section_classId_sectionOrder_key" ON "Section"("classId", "sectionOrder");

-- CreateIndex
CREATE INDEX "Section_classId_sectionOrder_idx" ON "Section"("classId", "sectionOrder");

-- CreateIndex
CREATE INDEX "Section_schoolId_idx" ON "Section"("schoolId");

-- CreateIndex
CREATE INDEX "Section_streamId_idx" ON "Section"("streamId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_subjectName_key" ON "Subject"("schoolId", "subjectName");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_subjectCode_key" ON "Subject"("schoolId", "subjectCode");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE INDEX "Subject_parentSubjectId_idx" ON "Subject"("parentSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_key" ON "ClassSubject"("classId", "subjectId");

-- CreateIndex
CREATE INDEX "ClassSubject_classId_idx" ON "ClassSubject"("classId");

-- CreateIndex
CREATE INDEX "ClassSubject_subjectId_idx" ON "ClassSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionSubject_sectionId_subjectId_key" ON "SectionSubject"("sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "SectionSubject_sectionId_idx" ON "SectionSubject"("sectionId");

-- CreateIndex
CREATE INDEX "SectionSubject_subjectId_idx" ON "SectionSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_schoolId_email_key" ON "Teacher"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_schoolId_employeeId_key" ON "Teacher"("schoolId", "employeeId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_teacherName_idx" ON "Teacher"("schoolId", "teacherName");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_specialization_idx" ON "Teacher"("schoolId", "specialization");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAssignment_schoolId_classId_sectionId_subjectId_key" ON "TeacherAssignment"("schoolId", "classId", "sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_teacherId_idx" ON "TeacherAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_schoolId_sectionId_idx" ON "TeacherAssignment"("schoolId", "sectionId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_schoolId_subjectId_idx" ON "TeacherAssignment"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_schoolId_classId_sectionId_idx" ON "TeacherAssignment"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectWeeklyRequirement_schoolId_classId_sectionId_subjectId_key" ON "SubjectWeeklyRequirement"("schoolId", "classId", "sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "SubjectWeeklyRequirement_schoolId_classId_sectionId_idx" ON "SubjectWeeklyRequirement"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "SubjectWeeklyRequirement_schoolId_subjectId_idx" ON "SubjectWeeklyRequirement"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Timetable_schoolId_classId_sectionId_academicYear_key" ON "Timetable"("schoolId", "classId", "sectionId", "academicYear");

-- CreateIndex
CREATE INDEX "Timetable_schoolId_classId_idx" ON "Timetable"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Timetable_schoolId_sectionId_idx" ON "Timetable"("schoolId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_timetableId_dayOfWeek_sequenceOrder_key" ON "TimetableSlot"("timetableId", "dayOfWeek", "sequenceOrder");

-- CreateIndex
CREATE INDEX "TimetableSlot_timetableId_dayOfWeek_idx" ON "TimetableSlot"("timetableId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimetableSlot_schoolId_teacherId_dayOfWeek_startTime_endTime_idx" ON "TimetableSlot"("schoolId", "teacherId", "dayOfWeek", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "TimetableSlot_schoolId_classId_sectionId_idx" ON "TimetableSlot"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "TimetableSlot_subjectComponentId_idx" ON "TimetableSlot"("subjectComponentId");

-- CreateIndex
CREATE INDEX "TimetableSlot_activityId_idx" ON "TimetableSlot"("activityId");

-- CreateIndex
CREATE INDEX "TimetableSlot_labRoomId_idx" ON "TimetableSlot"("labRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicLevel_schoolId_code_key" ON "AcademicLevel"("schoolId", "code");

-- CreateIndex
CREATE INDEX "AcademicLevel_schoolId_displayOrder_idx" ON "AcademicLevel"("schoolId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectComponent_schoolId_subjectId_code_key" ON "SubjectComponent"("schoolId", "subjectId", "code");

-- CreateIndex
CREATE INDEX "SubjectComponent_schoolId_subjectId_displayOrder_idx" ON "SubjectComponent"("schoolId", "subjectId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_schoolId_code_key" ON "Stream"("schoolId", "code");

-- CreateIndex
CREATE INDEX "Stream_schoolId_displayOrder_idx" ON "Stream"("schoolId", "displayOrder");

-- CreateIndex
CREATE INDEX "ClassStream_schoolId_classId_sectionId_idx" ON "ClassStream"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "ClassStream_schoolId_streamId_academicYear_idx" ON "ClassStream"("schoolId", "streamId", "academicYear");

-- CreateIndex
CREATE INDEX "StreamSubject_schoolId_streamId_displayOrder_idx" ON "StreamSubject"("schoolId", "streamId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StreamSubject_streamId_subjectId_subjectComponentId_key" ON "StreamSubject"("streamId", "subjectId", "subjectComponentId");

-- CreateIndex
CREATE INDEX "TeacherSubject_schoolId_teacherId_idx" ON "TeacherSubject"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "TeacherSubject_schoolId_subjectId_idx" ON "TeacherSubject"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "TeacherSubject_schoolId_classId_sectionId_idx" ON "TeacherSubject"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "Activity_schoolId_displayOrder_idx" ON "Activity"("schoolId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_schoolId_code_key" ON "Activity"("schoolId", "code");

-- CreateIndex
CREATE INDEX "ActivityEnrollment_schoolId_userId_idx" ON "ActivityEnrollment"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityEnrollment_schoolId_activityId_userId_key" ON "ActivityEnrollment"("schoolId", "activityId", "userId");

-- CreateIndex
CREATE INDEX "PeriodDefinition_schoolId_dayOfWeek_idx" ON "PeriodDefinition"("schoolId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodDefinition_schoolId_dayOfWeek_periodNumber_key" ON "PeriodDefinition"("schoolId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "LabRoom_schoolId_idx" ON "LabRoom"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LabRoom_schoolId_roomCode_key" ON "LabRoom"("schoolId", "roomCode");

-- CreateIndex
CREATE INDEX "LabSubjectRule_schoolId_idx" ON "LabSubjectRule"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LabSubjectRule_schoolId_subjectId_key" ON "LabSubjectRule"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "UserWidgetPreference_schoolId_userId_idx" ON "UserWidgetPreference"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "UserWidgetPreference_schoolId_widgetKey_idx" ON "UserWidgetPreference"("schoolId", "widgetKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserWidgetPreference_userId_widgetKey_key" ON "UserWidgetPreference"("userId", "widgetKey");

-- CreateIndex
CREATE INDEX "UserWidgetTodo_schoolId_userId_isCompleted_idx" ON "UserWidgetTodo"("schoolId", "userId", "isCompleted");

-- CreateIndex
CREATE INDEX "UserWidgetTodo_schoolId_dueDate_idx" ON "UserWidgetTodo"("schoolId", "dueDate");

-- CreateIndex
CREATE INDEX "UserWidgetNote_schoolId_userId_orderIndex_idx" ON "UserWidgetNote"("schoolId", "userId", "orderIndex");

-- CreateIndex
CREATE INDEX "UserWidgetBookmark_schoolId_userId_isActive_idx" ON "UserWidgetBookmark"("schoolId", "userId", "isActive");

-- CreateIndex
CREATE INDEX "UserWidgetNotification_schoolId_userId_isRead_idx" ON "UserWidgetNotification"("schoolId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "UserWidgetNotification_schoolId_createdAt_idx" ON "UserWidgetNotification"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "UserWidgetActivity_schoolId_userId_createdAt_idx" ON "UserWidgetActivity"("schoolId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserWidgetActivity_schoolId_activityKey_idx" ON "UserWidgetActivity"("schoolId", "activityKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserLoginStreak_userId_key" ON "UserLoginStreak"("userId");

-- CreateIndex
CREATE INDEX "UserLoginStreak_schoolId_currentStreak_idx" ON "UserLoginStreak"("schoolId", "currentStreak");

-- CreateIndex
CREATE INDEX "SystemContent_schoolId_isPublished_idx" ON "SystemContent"("schoolId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "SystemContent_schoolId_contentKey_key" ON "SystemContent"("schoolId", "contentKey");

-- CreateIndex
CREATE UNIQUE INDEX "Student_admissionNo_key" ON "Student"("admissionNo");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE INDEX "Student_schoolId_session_idx" ON "Student"("schoolId", "session");

-- CreateIndex
CREATE INDEX "Student_schoolId_className_idx" ON "Student"("schoolId", "className");

-- CreateIndex
CREATE INDEX "Student_mobile_idx" ON "Student"("mobile");

-- CreateIndex
CREATE INDEX "Student_email_idx" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Student_session_idx" ON "Student"("session");

-- CreateIndex
CREATE INDEX "Student_isActive_idx" ON "Student"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentUserId_key" ON "Student"("studentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_parentUserId_key" ON "Student"("parentUserId");

-- CreateIndex
CREATE INDEX "StudentAcademicHistory_studentId_session_idx" ON "StudentAcademicHistory"("studentId", "session");

-- CreateIndex
CREATE INDEX "StudentAcademicHistory_session_idx" ON "StudentAcademicHistory"("session");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryGroup" ADD CONSTRAINT "GalleryGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryPhoto" ADD CONSTRAINT "GalleryPhoto_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryPhoto" ADD CONSTRAINT "GalleryPhoto_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GalleryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSettings" ADD CONSTRAINT "SchoolSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_academicLevelId_fkey" FOREIGN KEY ("academicLevelId") REFERENCES "AcademicLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_parentSubjectId_fkey" FOREIGN KEY ("parentSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSubject" ADD CONSTRAINT "SectionSubject_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSubject" ADD CONSTRAINT "SectionSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectComponentId_fkey" FOREIGN KEY ("subjectComponentId") REFERENCES "SubjectComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_labRoomId_fkey" FOREIGN KEY ("labRoomId") REFERENCES "LabRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicLevel" ADD CONSTRAINT "AcademicLevel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectComponent" ADD CONSTRAINT "SubjectComponent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectComponent" ADD CONSTRAINT "SubjectComponent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassStream" ADD CONSTRAINT "ClassStream_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassStream" ADD CONSTRAINT "ClassStream_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassStream" ADD CONSTRAINT "ClassStream_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassStream" ADD CONSTRAINT "ClassStream_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSubject" ADD CONSTRAINT "StreamSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSubject" ADD CONSTRAINT "StreamSubject_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSubject" ADD CONSTRAINT "StreamSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSubject" ADD CONSTRAINT "StreamSubject_subjectComponentId_fkey" FOREIGN KEY ("subjectComponentId") REFERENCES "SubjectComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_subjectComponentId_fkey" FOREIGN KEY ("subjectComponentId") REFERENCES "SubjectComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEnrollment" ADD CONSTRAINT "ActivityEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEnrollment" ADD CONSTRAINT "ActivityEnrollment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEnrollment" ADD CONSTRAINT "ActivityEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodDefinition" ADD CONSTRAINT "PeriodDefinition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabRoom" ADD CONSTRAINT "LabRoom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSubjectRule" ADD CONSTRAINT "LabSubjectRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSubjectRule" ADD CONSTRAINT "LabSubjectRule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetPreference" ADD CONSTRAINT "UserWidgetPreference_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetPreference" ADD CONSTRAINT "UserWidgetPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetTodo" ADD CONSTRAINT "UserWidgetTodo_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetTodo" ADD CONSTRAINT "UserWidgetTodo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetNote" ADD CONSTRAINT "UserWidgetNote_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetNote" ADD CONSTRAINT "UserWidgetNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetBookmark" ADD CONSTRAINT "UserWidgetBookmark_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetBookmark" ADD CONSTRAINT "UserWidgetBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetNotification" ADD CONSTRAINT "UserWidgetNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetNotification" ADD CONSTRAINT "UserWidgetNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetActivity" ADD CONSTRAINT "UserWidgetActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWidgetActivity" ADD CONSTRAINT "UserWidgetActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoginStreak" ADD CONSTRAINT "UserLoginStreak_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoginStreak" ADD CONSTRAINT "UserLoginStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemContent" ADD CONSTRAINT "SystemContent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemContent" ADD CONSTRAINT "SystemContent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAcademicHistory" ADD CONSTRAINT "StudentAcademicHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
