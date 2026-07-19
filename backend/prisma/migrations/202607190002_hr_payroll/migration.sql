ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HR';

CREATE TYPE "EmployeeCategory" AS ENUM ('TEACHING','NON_TEACHING','SUPPORT','ADMINISTRATION','TRANSPORT','LIBRARY','LABORATORY','IT','OTHER');
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT','CONTRACT','GUEST_FACULTY','VISITING_FACULTY','PART_TIME');
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE','ON_LEAVE','SUSPENDED','RESIGNED','RETIRED');
CREATE TYPE "EmployeeAttendanceStatus" AS ENUM ('PRESENT','ABSENT','HALF_DAY','PAID_LEAVE','CASUAL_LEAVE','MEDICAL_LEAVE','EARNED_LEAVE','MATERNITY_LEAVE','PATERNITY_LEAVE','HOLIDAY','WORK_FROM_HOME','OFFICIAL_DUTY','LATE','EARLY_EXIT');
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL','BULK','IMPORT','BIOMETRIC','RFID','FACE_RECOGNITION','GPS');
CREATE TYPE "EmployeeLeaveType" AS ENUM ('PAID','CASUAL','MEDICAL','EARNED','MATERNITY','PATERNITY','UNPAID','OTHER');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
CREATE TYPE "PayrollStatus" AS ENUM ('PENDING','PROCESSED','PAID','CANCELLED','HOLD');

CREATE TABLE "Employee" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "userId" TEXT, "teacherId" TEXT,
  "employeeId" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastName" TEXT, "gender" TEXT,
  "dateOfBirth" TIMESTAMP(3), "bloodGroup" TEXT, "mobile" TEXT NOT NULL, "email" TEXT,
  "aadhaarMasked" TEXT, "panMasked" TEXT, "address" TEXT, "department" TEXT NOT NULL,
  "designation" TEXT NOT NULL, "category" "EmployeeCategory" NOT NULL,
  "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
  "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE', "joiningDate" TIMESTAMP(3) NOT NULL,
  "exitDate" TIMESTAMP(3), "bankName" TEXT, "bankAccountMasked" TEXT, "ifsc" TEXT,
  "emergencyContact" JSONB, "qualifications" JSONB, "experience" JSONB,
  "profileImageUrl" TEXT, "metadata" JSONB, "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeDocument" (
  "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "type" TEXT NOT NULL, "name" TEXT NOT NULL,
  "url" TEXT NOT NULL, "expiresAt" TIMESTAMP(3), "verifiedAt" TIMESTAMP(3), "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeSalaryRevision" (
  "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "monthlyGross" DECIMAL(14,2) NOT NULL,
  "basicSalary" DECIMAL(14,2) NOT NULL, "components" JSONB, "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3), "reason" TEXT, "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EmployeeSalaryRevision_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HrLeavePolicy" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "annualLeaveCount" DECIMAL(6,2) NOT NULL DEFAULT 15,
  "monthlyPaidLimit" DECIMAL(6,2) NOT NULL DEFAULT 2, "carryForward" BOOLEAN NOT NULL DEFAULT true,
  "maxCarryForward" DECIMAL(6,2), "leaveExpiryMonth" INTEGER, "lateEntriesPerDay" INTEGER,
  "includeWeeklyOff" BOOLEAN NOT NULL DEFAULT false, "rules" JSONB, "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLeavePolicy_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeLeaveBalance" (
  "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "leaveYear" INTEGER NOT NULL,
  "opening" DECIMAL(6,2) NOT NULL DEFAULT 0, "accrued" DECIMAL(6,2) NOT NULL DEFAULT 15,
  "used" DECIMAL(6,2) NOT NULL DEFAULT 0, "adjusted" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmployeeLeaveBalance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeLeaveApplication" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "leaveType" "EmployeeLeaveType" NOT NULL, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
  "days" DECIMAL(6,2) NOT NULL, "reason" TEXT NOT NULL, "attachmentUrl" TEXT,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING', "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3), "reviewComment" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmployeeLeaveApplication_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeAttendance" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL, "status" "EmployeeAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL', "checkIn" TIMESTAMP(3), "checkOut" TIMESTAMP(3),
  "minutesLate" INTEGER NOT NULL DEFAULT 0, "minutesEarlyExit" INTEGER NOT NULL DEFAULT 0,
  "remarks" TEXT, "sourceReference" TEXT, "markedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeAttendance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeePayroll" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "payrollMonth" TIMESTAMP(3) NOT NULL,
  "workingDays" DECIMAL(6,2) NOT NULL, "payableDays" DECIMAL(6,2) NOT NULL, "attendanceSummary" JSONB NOT NULL,
  "monthlyGross" DECIMAL(14,2) NOT NULL, "basePay" DECIMAL(14,2) NOT NULL, "allowances" JSONB,
  "allowanceTotal" DECIMAL(14,2) NOT NULL DEFAULT 0, "deductions" JSONB,
  "deductionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0, "netSalary" DECIMAL(14,2) NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'PENDING', "lockedAt" TIMESTAMP(3), "generatedById" TEXT,
  "paidAt" TIMESTAMP(3), "transactionReference" TEXT, "remarks" TEXT, "payslipNumber" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePayroll_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HrAuditLog" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "actorId" TEXT, "actorRole" TEXT, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT, "oldValue" JSONB, "newValue" JSONB, "reason" TEXT,
  "ipAddress" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_teacherId_key" ON "Employee"("teacherId");
CREATE UNIQUE INDEX "Employee_schoolId_employeeId_key" ON "Employee"("schoolId","employeeId");
CREATE INDEX "Employee_schoolId_status_deletedAt_idx" ON "Employee"("schoolId","status","deletedAt");
CREATE INDEX "Employee_schoolId_department_designation_idx" ON "Employee"("schoolId","department","designation");
CREATE INDEX "Employee_schoolId_category_idx" ON "Employee"("schoolId","category");
CREATE INDEX "Employee_schoolId_mobile_idx" ON "Employee"("schoolId","mobile");
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");
CREATE INDEX "EmployeeDocument_employeeId_type_idx" ON "EmployeeDocument"("employeeId","type");
CREATE INDEX "EmployeeDocument_expiresAt_idx" ON "EmployeeDocument"("expiresAt");
CREATE UNIQUE INDEX "EmployeeSalaryRevision_employeeId_effectiveFrom_key" ON "EmployeeSalaryRevision"("employeeId","effectiveFrom");
CREATE INDEX "EmployeeSalaryRevision_employeeId_effectiveFrom_effectiveTo_idx" ON "EmployeeSalaryRevision"("employeeId","effectiveFrom","effectiveTo");
CREATE UNIQUE INDEX "HrLeavePolicy_schoolId_key" ON "HrLeavePolicy"("schoolId");
CREATE UNIQUE INDEX "EmployeeLeaveBalance_employeeId_leaveYear_key" ON "EmployeeLeaveBalance"("employeeId","leaveYear");
CREATE INDEX "EmployeeLeaveBalance_leaveYear_idx" ON "EmployeeLeaveBalance"("leaveYear");
CREATE INDEX "EmployeeLeaveApplication_schoolId_status_startDate_idx" ON "EmployeeLeaveApplication"("schoolId","status","startDate");
CREATE INDEX "EmployeeLeaveApplication_schoolId_employeeId_startDate_idx" ON "EmployeeLeaveApplication"("schoolId","employeeId","startDate");
CREATE UNIQUE INDEX "EmployeeAttendance_schoolId_employeeId_attendanceDate_key" ON "EmployeeAttendance"("schoolId","employeeId","attendanceDate");
CREATE INDEX "EmployeeAttendance_schoolId_attendanceDate_status_idx" ON "EmployeeAttendance"("schoolId","attendanceDate","status");
CREATE INDEX "EmployeeAttendance_schoolId_employeeId_attendanceDate_idx" ON "EmployeeAttendance"("schoolId","employeeId","attendanceDate");
CREATE INDEX "EmployeeAttendance_source_sourceReference_idx" ON "EmployeeAttendance"("source","sourceReference");
CREATE UNIQUE INDEX "EmployeePayroll_schoolId_employeeId_payrollMonth_key" ON "EmployeePayroll"("schoolId","employeeId","payrollMonth");
CREATE UNIQUE INDEX "EmployeePayroll_schoolId_payslipNumber_key" ON "EmployeePayroll"("schoolId","payslipNumber");
CREATE INDEX "EmployeePayroll_schoolId_payrollMonth_status_idx" ON "EmployeePayroll"("schoolId","payrollMonth","status");
CREATE INDEX "EmployeePayroll_schoolId_employeeId_payrollMonth_idx" ON "EmployeePayroll"("schoolId","employeeId","payrollMonth");
CREATE INDEX "HrAuditLog_schoolId_createdAt_idx" ON "HrAuditLog"("schoolId","createdAt");
CREATE INDEX "HrAuditLog_schoolId_entityType_entityId_idx" ON "HrAuditLog"("schoolId","entityType","entityId");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryRevision" ADD CONSTRAINT "EmployeeSalaryRevision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrLeavePolicy" ADD CONSTRAINT "HrLeavePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLeaveBalance" ADD CONSTRAINT "EmployeeLeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLeaveApplication" ADD CONSTRAINT "EmployeeLeaveApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLeaveApplication" ADD CONSTRAINT "EmployeeLeaveApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePayroll" ADD CONSTRAINT "EmployeePayroll_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePayroll" ADD CONSTRAINT "EmployeePayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAuditLog" ADD CONSTRAINT "HrAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
