-- CreateEnum
CREATE TYPE "FeeStructureMode" AS ENUM ('SIMPLE', 'COMPONENT_BASED');

-- CreateEnum
CREATE TYPE "FeeStructureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'BI_MONTHLY', 'QUARTERLY', 'FOUR_MONTHLY', 'HALF_YEARLY', 'ANNUAL', 'PER_TERM', 'PER_SEMESTER', 'PER_EXAMINATION', 'PER_ACTIVITY', 'PER_TRIP', 'PER_SERVICE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FeeAssignmentTarget" AS ENUM ('STUDENT', 'GROUP', 'SECTION', 'CLASS', 'SCHOOL', 'STREAM', 'COURSE', 'BATCH', 'CATEGORY', 'TRANSPORT', 'HOSTEL');

-- CreateEnum
CREATE TYPE "FeeAccountStatus" AS ENUM ('ACTIVE', 'LOCKED', 'CLOSED', 'EXEMPTED');

-- CreateEnum
CREATE TYPE "FeeChargeStatus" AS ENUM ('UPCOMING', 'DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'EXEMPTED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'DEMAND_DRAFT', 'BANK_TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'POS_CARD', 'WALLET', 'ONLINE_GATEWAY', 'OTHER');

-- CreateEnum
CREATE TYPE "FeePaymentStatus" AS ENUM ('PENDING_CLEARANCE', 'COMPLETED', 'CLEARED', 'BOUNCED', 'CANCELLED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeeReceiptStatus" AS ENUM ('VALID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FeeLedgerEntryType" AS ENUM ('CHARGE', 'LATE_FEE', 'DISCOUNT', 'SCHOLARSHIP', 'WAIVER', 'PAYMENT', 'REFUND', 'REVERSAL', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ADVANCE', 'CARRY_FORWARD');

-- CreateEnum
CREATE TYPE "FeeAdjustmentType" AS ENUM ('DISCOUNT', 'SCHOLARSHIP', 'WAIVER', 'LATE_FEE_WAIVER', 'REFUND', 'REVERSAL', 'CREDIT_NOTE', 'DEBIT_NOTE', 'BALANCE_CORRECTION', 'CARRY_FORWARD');

-- CreateEnum
CREATE TYPE "FeeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'PROCESSED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF', 'CURRICULUM_MANAGER', 'FEE_MANAGER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
COMMIT;

-- CreateTable
CREATE TABLE "FeeModuleSetting" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "FeeStructureMode" NOT NULL DEFAULT 'SIMPLE',
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "decimalPrecision" INTEGER NOT NULL DEFAULT 2,
    "financialYearStartMonth" INTEGER NOT NULL DEFAULT 4,
    "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "receiptFormat" TEXT NOT NULL DEFAULT '{SCHOOL}/{SESSION}/FEE/{SEQ}',
    "nextReceiptSequence" INTEGER NOT NULL DEFAULT 1,
    "approvalThresholdMinor" BIGINT NOT NULL DEFAULT 50000,
    "allowPlatformSummary" BOOLEAN NOT NULL DEFAULT false,
    "gatewayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeModuleSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "mode" "FeeStructureMode" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "FeeStructureStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeComponent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "feeType" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,
    "dueDay" INTEGER,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "lateFeeRule" JSONB,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "refundable" BOOLEAN NOT NULL DEFAULT false,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "applicability" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "studentId" TEXT,
    "targetType" "FeeAssignmentTarget" NOT NULL,
    "targetValue" TEXT,
    "priority" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeAccount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "status" "FeeAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "advanceBalanceMinor" BIGINT NOT NULL DEFAULT 0,
    "carriedForwardMinor" BIGINT NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeCharge" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeAccountId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "feeComponentId" TEXT,
    "academicSession" TEXT NOT NULL,
    "installmentName" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "baseAmountMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "scholarshipMinor" BIGINT NOT NULL DEFAULT 0,
    "lateFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "paidMinor" BIGINT NOT NULL DEFAULT 0,
    "refundedMinor" BIGINT NOT NULL DEFAULT 0,
    "status" "FeeChargeStatus" NOT NULL DEFAULT 'UPCOMING',
    "calculationSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeAccountId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "unappliedMinor" BIGINT NOT NULL DEFAULT 0,
    "method" "FeePaymentMethod" NOT NULL,
    "status" "FeePaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "bankName" TEXT,
    "instrumentNumber" TEXT,
    "instrumentDate" TIMESTAMP(3),
    "transactionReference" TEXT,
    "remarks" TEXT,
    "collectedById" TEXT,
    "collectionCounter" TEXT,
    "metadata" JSONB,
    "reversedPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePaymentAllocation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeePaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeReceipt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "status" "FeeReceiptStatus" NOT NULL DEFAULT 'VALID',
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeLedgerEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeAccountId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "entryType" "FeeLedgerEntryType" NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "description" TEXT NOT NULL,
    "debitMinor" BIGINT NOT NULL DEFAULT 0,
    "creditMinor" BIGINT NOT NULL DEFAULT 0,
    "balanceMinor" BIGINT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAdjustment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "type" "FeeAdjustmentType" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" "FeeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "supportingUrl" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScholarship" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valueMinor" BIGINT,
    "valueBasisPoints" INTEGER,
    "maximumMinor" BIGINT,
    "eligibilityConditions" JSONB,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeScholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeScholarship" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "chargeId" TEXT,
    "academicSession" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" "FeeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeScholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeNotificationTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeNotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeDailyCashClosing" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "closingDate" DATE NOT NULL,
    "feeManagerId" TEXT NOT NULL,
    "openingCashMinor" BIGINT NOT NULL DEFAULT 0,
    "cashCollectedMinor" BIGINT NOT NULL,
    "nonCashCollectedMinor" BIGINT NOT NULL,
    "refundsPaidMinor" BIGINT NOT NULL DEFAULT 0,
    "expectedClosingMinor" BIGINT NOT NULL,
    "actualClosingMinor" BIGINT NOT NULL,
    "differenceMinor" BIGINT NOT NULL,
    "status" "FeeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeDailyCashClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeFinancialPeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeFinancialPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeFamilyLink" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'PARENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeFamilyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeApprovalRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSession" TEXT,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "amountMinor" BIGINT,
    "status" "FeeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeReminder" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "readAt" TIMESTAMP(3),
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "approvalReference" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeModuleSetting_schoolId_key" ON "FeeModuleSetting"("schoolId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_academicSession_status_idx" ON "FeeStructure"("schoolId", "academicSession", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_schoolId_academicSession_code_version_key" ON "FeeStructure"("schoolId", "academicSession", "code", "version");

-- CreateIndex
CREATE INDEX "FeeComponent_schoolId_academicSession_active_idx" ON "FeeComponent"("schoolId", "academicSession", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FeeComponent_schoolId_feeStructureId_code_key" ON "FeeComponent"("schoolId", "feeStructureId", "code");

-- CreateIndex
CREATE INDEX "FeeAssignment_schoolId_academicSession_targetType_targetVal_idx" ON "FeeAssignment"("schoolId", "academicSession", "targetType", "targetValue");

-- CreateIndex
CREATE INDEX "FeeAssignment_schoolId_studentId_active_idx" ON "FeeAssignment"("schoolId", "studentId", "active");

-- CreateIndex
CREATE INDEX "StudentFeeAccount_schoolId_academicSession_status_idx" ON "StudentFeeAccount"("schoolId", "academicSession", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAccount_schoolId_studentId_academicSession_key" ON "StudentFeeAccount"("schoolId", "studentId", "academicSession");

-- CreateIndex
CREATE INDEX "StudentFeeCharge_schoolId_studentId_academicSession_idx" ON "StudentFeeCharge"("schoolId", "studentId", "academicSession");

-- CreateIndex
CREATE INDEX "StudentFeeCharge_schoolId_dueDate_status_idx" ON "StudentFeeCharge"("schoolId", "dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeCharge_schoolId_studentId_feeStructureId_feeCompo_key" ON "StudentFeeCharge"("schoolId", "studentId", "feeStructureId", "feeComponentId", "academicSession", "installmentName");

-- CreateIndex
CREATE INDEX "FeePayment_schoolId_paymentDate_status_idx" ON "FeePayment"("schoolId", "paymentDate", "status");

-- CreateIndex
CREATE INDEX "FeePayment_schoolId_studentId_idx" ON "FeePayment"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_schoolId_idempotencyKey_key" ON "FeePayment"("schoolId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_schoolId_paymentNumber_key" ON "FeePayment"("schoolId", "paymentNumber");

-- CreateIndex
CREATE INDEX "FeePaymentAllocation_schoolId_chargeId_idx" ON "FeePaymentAllocation"("schoolId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePaymentAllocation_paymentId_chargeId_key" ON "FeePaymentAllocation"("paymentId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReceipt_paymentId_key" ON "FeeReceipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReceipt_verificationCode_key" ON "FeeReceipt"("verificationCode");

-- CreateIndex
CREATE INDEX "FeeReceipt_schoolId_status_createdAt_idx" ON "FeeReceipt"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReceipt_schoolId_academicSession_receiptNumber_key" ON "FeeReceipt"("schoolId", "academicSession", "receiptNumber");

-- CreateIndex
CREATE INDEX "FeeLedgerEntry_schoolId_studentId_createdAt_idx" ON "FeeLedgerEntry"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeLedgerEntry_schoolId_referenceType_referenceId_entryType_key" ON "FeeLedgerEntry"("schoolId", "referenceType", "referenceId", "entryType");

-- CreateIndex
CREATE INDEX "FeeAdjustment_schoolId_status_createdAt_idx" ON "FeeAdjustment"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FeeAdjustment_schoolId_studentId_idx" ON "FeeAdjustment"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "FeeScholarship_schoolId_academicSession_active_idx" ON "FeeScholarship"("schoolId", "academicSession", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FeeScholarship_schoolId_academicSession_code_key" ON "FeeScholarship"("schoolId", "academicSession", "code");

-- CreateIndex
CREATE INDEX "StudentFeeScholarship_schoolId_studentId_academicSession_st_idx" ON "StudentFeeScholarship"("schoolId", "studentId", "academicSession", "status");

-- CreateIndex
CREATE INDEX "FeeNotificationTemplate_schoolId_type_active_idx" ON "FeeNotificationTemplate"("schoolId", "type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FeeNotificationTemplate_schoolId_name_key" ON "FeeNotificationTemplate"("schoolId", "name");

-- CreateIndex
CREATE INDEX "FeeDailyCashClosing_schoolId_closingDate_status_idx" ON "FeeDailyCashClosing"("schoolId", "closingDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeDailyCashClosing_schoolId_closingDate_feeManagerId_key" ON "FeeDailyCashClosing"("schoolId", "closingDate", "feeManagerId");

-- CreateIndex
CREATE INDEX "FeeFinancialPeriod_schoolId_startDate_endDate_lockedAt_idx" ON "FeeFinancialPeriod"("schoolId", "startDate", "endDate", "lockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeFinancialPeriod_schoolId_academicSession_periodKey_key" ON "FeeFinancialPeriod"("schoolId", "academicSession", "periodKey");

-- CreateIndex
CREATE INDEX "FeeDocument_schoolId_entityType_entityId_idx" ON "FeeDocument"("schoolId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "FeeFamilyLink_schoolId_parentUserId_active_idx" ON "FeeFamilyLink"("schoolId", "parentUserId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FeeFamilyLink_schoolId_parentUserId_studentId_key" ON "FeeFamilyLink"("schoolId", "parentUserId", "studentId");

-- CreateIndex
CREATE INDEX "FeeApprovalRequest_schoolId_status_createdAt_idx" ON "FeeApprovalRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FeeReminder_schoolId_studentId_sentAt_idx" ON "FeeReminder"("schoolId", "studentId", "sentAt");

-- CreateIndex
CREATE INDEX "FeeAuditLog_schoolId_createdAt_idx" ON "FeeAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeAuditLog_schoolId_entityType_entityId_idx" ON "FeeAuditLog"("schoolId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "FeeModuleSetting" ADD CONSTRAINT "FeeModuleSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAccount" ADD CONSTRAINT "StudentFeeAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAccount" ADD CONSTRAINT "StudentFeeAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeCharge" ADD CONSTRAINT "StudentFeeCharge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeCharge" ADD CONSTRAINT "StudentFeeCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeCharge" ADD CONSTRAINT "StudentFeeCharge_feeAccountId_fkey" FOREIGN KEY ("feeAccountId") REFERENCES "StudentFeeAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeCharge" ADD CONSTRAINT "StudentFeeCharge_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeCharge" ADD CONSTRAINT "StudentFeeCharge_feeComponentId_fkey" FOREIGN KEY ("feeComponentId") REFERENCES "FeeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_feeAccountId_fkey" FOREIGN KEY ("feeAccountId") REFERENCES "StudentFeeAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePaymentAllocation" ADD CONSTRAINT "FeePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FeePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePaymentAllocation" ADD CONSTRAINT "FeePaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentFeeCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceipt" ADD CONSTRAINT "FeeReceipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceipt" ADD CONSTRAINT "FeeReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FeePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLedgerEntry" ADD CONSTRAINT "FeeLedgerEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLedgerEntry" ADD CONSTRAINT "FeeLedgerEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLedgerEntry" ADD CONSTRAINT "FeeLedgerEntry_feeAccountId_fkey" FOREIGN KEY ("feeAccountId") REFERENCES "StudentFeeAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAdjustment" ADD CONSTRAINT "FeeAdjustment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAdjustment" ADD CONSTRAINT "FeeAdjustment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeScholarship" ADD CONSTRAINT "FeeScholarship_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeScholarship" ADD CONSTRAINT "StudentFeeScholarship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeScholarship" ADD CONSTRAINT "StudentFeeScholarship_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "FeeScholarship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeScholarship" ADD CONSTRAINT "StudentFeeScholarship_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentFeeCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeNotificationTemplate" ADD CONSTRAINT "FeeNotificationTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeDailyCashClosing" ADD CONSTRAINT "FeeDailyCashClosing_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeFinancialPeriod" ADD CONSTRAINT "FeeFinancialPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeDocument" ADD CONSTRAINT "FeeDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeFamilyLink" ADD CONSTRAINT "FeeFamilyLink_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeFamilyLink" ADD CONSTRAINT "FeeFamilyLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeApprovalRequest" ADD CONSTRAINT "FeeApprovalRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReminder" ADD CONSTRAINT "FeeReminder_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReminder" ADD CONSTRAINT "FeeReminder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAuditLog" ADD CONSTRAINT "FeeAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
