-- Attendance accountability: immutable revisions, marker ownership, controlled
-- admin overrides, configurable marking windows and richer audit context.
ALTER TABLE "AttendanceRule"
  ADD COLUMN "attendanceOpenTime" TEXT NOT NULL DEFAULT '07:30',
  ADD COLUMN "classTeacherDeadline" TEXT NOT NULL DEFAULT '09:30',
  ADD COLUMN "adminAlertTime" TEXT NOT NULL DEFAULT '09:45',
  ADD COLUMN "finalSubmissionTime" TEXT NOT NULL DEFAULT '12:00',
  ADD COLUMN "autoLockTime" TEXT NOT NULL DEFAULT '23:59',
  ADD COLUMN "allowBackdatedAttendance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maximumBackdatedDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "prohibitFutureAttendance" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowDraft" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "defaultAttendanceStatus" TEXT NOT NULL DEFAULT 'NOT_MARKED',
  ADD COLUMN "requireAdminOverrideReason" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyClassTeacherOnCorrection" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AttendanceDailyRegister"
  ADD COLUMN "assignedClassTeacherId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "markedById" TEXT,
  ADD COLUMN "markedByRole" TEXT,
  ADD COLUMN "markedByType" TEXT,
  ADD COLUMN "overrideReasonCode" TEXT,
  ADD COLUMN "overrideReasonNote" TEXT,
  ADD COLUMN "administrativeNote" TEXT,
  ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "draftSavedAt" TIMESTAMP(3),
  ADD COLUMN "correctedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "notApplicableAt" TIMESTAMP(3),
  ADD COLUMN "currentRevisionNumber" INTEGER NOT NULL DEFAULT 0;

-- Existing submitted/locked registers become immutable immediately.
UPDATE "AttendanceDailyRegister"
SET "isLocked" = true,
    "state" = CASE WHEN "state" = 'SUBMITTED' THEN 'LOCKED' ELSE "state" END,
    "currentRevisionNumber" = CASE WHEN "state" IN ('SUBMITTED', 'LOCKED') THEN 1 ELSE 0 END
WHERE "state" IN ('SUBMITTED', 'LOCKED');

CREATE TABLE "AttendanceRevision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "attendanceSessionId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "actionType" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByRole" TEXT NOT NULL,
  "reasonCode" TEXT,
  "reasonNote" TEXT,
  "summarySnapshot" JSONB NOT NULL,
  "recordSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRevisionChange" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "attendanceRevisionId" TEXT NOT NULL,
  "studentAttendanceId" TEXT,
  "studentId" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "previousRemark" TEXT,
  "newRemark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRevisionChange_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AttendanceAuditLog"
  ADD COLUMN "academicSessionId" TEXT,
  ADD COLUMN "attendanceSessionId" TEXT,
  ADD COLUMN "classId" TEXT,
  ADD COLUMN "sectionId" TEXT,
  ADD COLUMN "attendanceDate" TIMESTAMP(3),
  ADD COLUMN "assignedClassTeacherId" TEXT,
  ADD COLUMN "reasonCode" TEXT,
  ADD COLUMN "previousRevisionNumber" INTEGER,
  ADD COLUMN "newRevisionNumber" INTEGER,
  ADD COLUMN "changedStudentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "changedFields" JSONB,
  ADD COLUMN "requestId" TEXT;

CREATE UNIQUE INDEX "AttendanceRevision_attendanceSessionId_revisionNumber_key" ON "AttendanceRevision"("attendanceSessionId", "revisionNumber");
CREATE INDEX "AttendanceRevision_schoolId_attendanceSessionId_revisionNumber_idx" ON "AttendanceRevision"("schoolId", "attendanceSessionId", "revisionNumber");
CREATE INDEX "AttendanceRevision_schoolId_createdAt_idx" ON "AttendanceRevision"("schoolId", "createdAt");
CREATE INDEX "AttendanceRevisionChange_schoolId_studentId_createdAt_idx" ON "AttendanceRevisionChange"("schoolId", "studentId", "createdAt");
CREATE INDEX "AttendanceRevisionChange_attendanceRevisionId_studentId_idx" ON "AttendanceRevisionChange"("attendanceRevisionId", "studentId");
CREATE INDEX "AttendanceDailyRegister_schoolId_sectionId_attendanceDate_idx" ON "AttendanceDailyRegister"("schoolId", "sectionId", "attendanceDate");
CREATE INDEX "AttendanceDailyRegister_schoolId_assignedClassTeacherId_attendanceDate_idx" ON "AttendanceDailyRegister"("schoolId", "assignedClassTeacherId", "attendanceDate");
CREATE INDEX "AttendanceDailyRegister_schoolId_markedById_attendanceDate_idx" ON "AttendanceDailyRegister"("schoolId", "markedById", "attendanceDate");
CREATE INDEX "AttendanceAuditLog_schoolId_action_createdAt_idx" ON "AttendanceAuditLog"("schoolId", "action", "createdAt");
CREATE INDEX "AttendanceAuditLog_schoolId_attendanceSessionId_createdAt_idx" ON "AttendanceAuditLog"("schoolId", "attendanceSessionId", "createdAt");

ALTER TABLE "AttendanceRevision" ADD CONSTRAINT "AttendanceRevision_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRevision" ADD CONSTRAINT "AttendanceRevision_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceDailyRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRevisionChange" ADD CONSTRAINT "AttendanceRevisionChange_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRevisionChange" ADD CONSTRAINT "AttendanceRevisionChange_attendanceRevisionId_fkey" FOREIGN KEY ("attendanceRevisionId") REFERENCES "AttendanceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

