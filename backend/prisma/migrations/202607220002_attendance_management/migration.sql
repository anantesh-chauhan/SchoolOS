-- Complete, tenant-scoped attendance management foundation.
ALTER TABLE "StudentAttendance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StudentAttendance" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "StudentAttendance" ALTER COLUMN "status" SET DEFAULT 'PRESENT';
ALTER TABLE "TeacherAttendance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TeacherAttendance" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "TeacherAttendance" ALTER COLUMN "status" SET DEFAULT 'PRESENT';
ALTER TABLE "EmployeeAttendance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "EmployeeAttendance" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "EmployeeAttendance" ALTER COLUMN "status" SET DEFAULT 'PRESENT';

ALTER TABLE "StudentAttendance"
  ADD COLUMN "attendanceUnits" DECIMAL(4,2) NOT NULL DEFAULT 1,
  ADD COLUMN "enrollmentId" TEXT,
  ADD COLUMN "leaveReference" TEXT,
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmployeeAttendance"
  ADD COLUMN "attendanceUnits" DECIMAL(4,2) NOT NULL DEFAULT 1,
  ADD COLUMN "salaryImpactDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "approvalStatus" "LeaveRequestStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "leaveReference" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3);

UPDATE "StudentAttendance" SET "attendanceUnits" = CASE
  WHEN "status" IN ('PRESENT','LATE','OFFICIAL_DUTY') THEN 1
  WHEN "status" = 'HALF_DAY' THEN 0.5
  ELSE 0 END;
UPDATE "EmployeeAttendance" SET
  "attendanceUnits" = CASE WHEN "status" IN ('PRESENT','LATE','EARLY_EXIT','WORK_FROM_HOME','OFFICIAL_DUTY','TRAINING','ON_DUTY') THEN 1 WHEN "status" = 'HALF_DAY' THEN 0.5 ELSE 0 END,
  "salaryImpactDays" = CASE WHEN "status" IN ('ABSENT','UNPAID_LEAVE') THEN 1 WHEN "status" = 'HALF_DAY' THEN 0.5 ELSE 0 END;

CREATE TABLE "AttendanceStatusDefinition" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "code" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "shortLabel" TEXT NOT NULL, "countsAsPresent" BOOLEAN NOT NULL DEFAULT false,
  "countsAsAbsent" BOOLEAN NOT NULL DEFAULT false, "attendanceWeight" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "affectsSalary" BOOLEAN NOT NULL DEFAULT false, "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "requiresRemark" BOOLEAN NOT NULL DEFAULT false, "audience" TEXT NOT NULL DEFAULT 'BOTH',
  "badgeStyle" TEXT NOT NULL DEFAULT 'slate', "excludedFromWork" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceStatusDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceRule" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "academicSessionStart" TIMESTAMP(3), "academicSessionEnd" TIMESTAMP(3), "weeklyOffDays" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
  "markingDeadline" TEXT NOT NULL DEFAULT '10:30', "correctionWindowHours" INTEGER NOT NULL DEFAULT 48,
  "studentMinimumPercentage" DECIMAL(5,2) NOT NULL DEFAULT 75, "employeeMinimumPercentage" DECIMAL(5,2) NOT NULL DEFAULT 85,
  "halfDayWeight" DECIMAL(4,2) NOT NULL DEFAULT 0.5, "lateWeight" DECIMAL(4,2) NOT NULL DEFAULT 1,
  "approvedLeaveWeight" DECIMAL(4,2) NOT NULL DEFAULT 0, "medicalLeaveWeight" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "consecutiveAbsenceAlertDays" INTEGER NOT NULL DEFAULT 3, "parentAbsenceNotifications" BOOLEAN NOT NULL DEFAULT true,
  "studentNotifications" BOOLEAN NOT NULL DEFAULT true, "requiresFinalSubmission" BOOLEAN NOT NULL DEFAULT true,
  "automaticMonthEndLock" BOOLEAN NOT NULL DEFAULT false, "correctionsRequireAdminApproval" BOOLEAN NOT NULL DEFAULT true,
  "payrollIntegrationEnabled" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AttendanceRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceDailyRegister" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSession" TEXT NOT NULL, "classId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL, "attendanceDate" TIMESTAMP(3) NOT NULL, "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "markedCount" INTEGER NOT NULL DEFAULT 0, "submittedById" TEXT, "submittedAt" TIMESTAMP(3), "lockedById" TEXT,
  "lockedAt" TIMESTAMP(3), "lockReason" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceDailyRegister_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceCorrectionRequest" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "personType" TEXT NOT NULL, "personId" TEXT NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL, "studentAttendanceId" TEXT, "employeeAttendanceId" TEXT,
  "existingStatus" TEXT NOT NULL, "requestedStatus" TEXT NOT NULL, "reason" TEXT NOT NULL, "evidenceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "requestedById" TEXT NOT NULL, "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3), "reviewRemark" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceAuditLog" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "actorId" TEXT, "actorRole" TEXT, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT, "oldValue" JSONB, "newValue" JSONB, "reason" TEXT,
  "approvalReference" TEXT, "ipAddress" TEXT, "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AttendanceAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceLock" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSession" TEXT NOT NULL, "scope" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "lockedById" TEXT NOT NULL, "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "unlockReason" TEXT,
  "approvalReference" TEXT, "unlockedById" TEXT, "unlockedAt" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AttendanceLock_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceMonthlySnapshot" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSession" TEXT NOT NULL, "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL, "month" TIMESTAMP(3) NOT NULL, "summary" JSONB NOT NULL, "ruleVersion" TEXT,
  "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AttendanceMonthlySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AttendanceNotificationLog" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL, "attendanceDate" TIMESTAMP(3), "dedupeKey" TEXT NOT NULL,
  "recipientCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceNotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SchoolWorkingDay" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicSession" TEXT NOT NULL, "calendarDate" TIMESTAMP(3) NOT NULL,
  "calendarType" TEXT NOT NULL DEFAULT 'STUDENT', "classId" TEXT, "sectionId" TEXT,
  "isWorkingDay" BOOLEAN NOT NULL DEFAULT true, "eligibleDayWeight" DECIMAL(4,2) NOT NULL DEFAULT 1, "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolWorkingDay_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StudentEnrollmentHistory" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "academicSession" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "sectionId" TEXT NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3),
  "exitReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentEnrollmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceStatusDefinition_schoolId_code_key" ON "AttendanceStatusDefinition"("schoolId","code");
CREATE INDEX "AttendanceStatusDefinition_schoolId_audience_isActive_idx" ON "AttendanceStatusDefinition"("schoolId","audience","isActive");
CREATE UNIQUE INDEX "AttendanceRule_schoolId_key" ON "AttendanceRule"("schoolId");
CREATE UNIQUE INDEX "AttendanceDailyRegister_schoolId_classId_sectionId_attendanceDate_key" ON "AttendanceDailyRegister"("schoolId","classId","sectionId","attendanceDate");
CREATE INDEX "AttendanceDailyRegister_schoolId_academicSession_attendanceDate_state_idx" ON "AttendanceDailyRegister"("schoolId","academicSession","attendanceDate","state");
CREATE INDEX "AttendanceCorrectionRequest_schoolId_status_createdAt_idx" ON "AttendanceCorrectionRequest"("schoolId","status","createdAt");
CREATE INDEX "AttendanceCorrectionRequest_schoolId_personType_personId_attendanceDate_idx" ON "AttendanceCorrectionRequest"("schoolId","personType","personId","attendanceDate");
CREATE INDEX "AttendanceAuditLog_schoolId_createdAt_idx" ON "AttendanceAuditLog"("schoolId","createdAt");
CREATE INDEX "AttendanceAuditLog_schoolId_entityType_entityId_idx" ON "AttendanceAuditLog"("schoolId","entityType","entityId");
CREATE UNIQUE INDEX "AttendanceLock_one_active_period_key" ON "AttendanceLock"("schoolId","scope","scopeKey","periodStart","periodEnd") WHERE "isActive" = true;
CREATE INDEX "AttendanceLock_schoolId_scope_scopeKey_periodStart_periodEnd_isActive_idx" ON "AttendanceLock"("schoolId","scope","scopeKey","periodStart","periodEnd","isActive");
CREATE INDEX "AttendanceLock_schoolId_academicSession_scope_isActive_idx" ON "AttendanceLock"("schoolId","academicSession","scope","isActive");
CREATE UNIQUE INDEX "AttendanceMonthlySnapshot_schoolId_academicSession_subjectType_subjectId_month_key" ON "AttendanceMonthlySnapshot"("schoolId","academicSession","subjectType","subjectId","month");
CREATE INDEX "AttendanceMonthlySnapshot_schoolId_month_subjectType_idx" ON "AttendanceMonthlySnapshot"("schoolId","month","subjectType");
CREATE UNIQUE INDEX "AttendanceNotificationLog_schoolId_dedupeKey_key" ON "AttendanceNotificationLog"("schoolId","dedupeKey");
CREATE INDEX "AttendanceNotificationLog_schoolId_eventType_createdAt_idx" ON "AttendanceNotificationLog"("schoolId","eventType","createdAt");
CREATE UNIQUE INDEX "SchoolWorkingDay_schoolId_calendarDate_calendarType_classId_sectionId_key" ON "SchoolWorkingDay"("schoolId","calendarDate","calendarType","classId","sectionId");
CREATE INDEX "SchoolWorkingDay_schoolId_academicSession_calendarDate_calendarType_idx" ON "SchoolWorkingDay"("schoolId","academicSession","calendarDate","calendarType");
CREATE UNIQUE INDEX "StudentEnrollmentHistory_schoolId_studentId_classId_sectionId_effectiveFrom_key" ON "StudentEnrollmentHistory"("schoolId","studentId","classId","sectionId","effectiveFrom");
CREATE INDEX "StudentEnrollmentHistory_schoolId_classId_sectionId_academicSession_effectiveFrom_idx" ON "StudentEnrollmentHistory"("schoolId","classId","sectionId","academicSession","effectiveFrom");
CREATE INDEX "StudentEnrollmentHistory_schoolId_studentId_effectiveFrom_effectiveTo_idx" ON "StudentEnrollmentHistory"("schoolId","studentId","effectiveFrom","effectiveTo");
CREATE INDEX "StudentAttendance_schoolId_academicSession_attendanceDate_status_idx" ON "StudentAttendance"("schoolId","academicSession","attendanceDate","status");
CREATE INDEX "StudentAttendance_enrollmentId_attendanceDate_idx" ON "StudentAttendance"("enrollmentId","attendanceDate");
CREATE INDEX "EmployeeAttendance_schoolId_attendanceDate_salaryImpactDays_idx" ON "EmployeeAttendance"("schoolId","attendanceDate","salaryImpactDays");

ALTER TABLE "AttendanceStatusDefinition" ADD CONSTRAINT "AttendanceStatusDefinition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRule" ADD CONSTRAINT "AttendanceRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceDailyRegister" ADD CONSTRAINT "AttendanceDailyRegister_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceLock" ADD CONSTRAINT "AttendanceLock_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceMonthlySnapshot" ADD CONSTRAINT "AttendanceMonthlySnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceNotificationLog" ADD CONSTRAINT "AttendanceNotificationLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolWorkingDay" ADD CONSTRAINT "SchoolWorkingDay_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentHistory" ADD CONSTRAINT "StudentEnrollmentHistory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentHistory" ADD CONSTRAINT "StudentEnrollmentHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
