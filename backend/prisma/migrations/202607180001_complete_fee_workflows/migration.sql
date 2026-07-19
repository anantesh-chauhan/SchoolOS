-- Complete fee workflows. This migration is additive and preserves all existing financial rows.

CREATE TYPE "FeeInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'ADJUSTED');
CREATE TYPE "FeeRefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED', 'CANCELLED');
CREATE TYPE "TransportTripType" AS ENUM ('ONE_WAY_PICKUP', 'ONE_WAY_DROP', 'TWO_WAY');
CREATE TYPE "TransportAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED');
ALTER TYPE "FeePaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "FeePaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TABLE "FeePayment" ADD COLUMN "payerName" TEXT;
ALTER TABLE "FeePayment" ADD COLUMN "payerRelation" TEXT;
ALTER TABLE "StudentFeeCharge" ADD COLUMN "waiverMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "FeeComponent" ALTER COLUMN "feeStructureId" DROP NOT NULL;
ALTER TABLE "FeeComponent" ALTER COLUMN "academicSession" DROP NOT NULL;
ALTER TABLE "FeeComponent" ALTER COLUMN "amountMinor" SET DEFAULT 0;
ALTER TABLE "FeeComponent" ALTER COLUMN "frequency" SET DEFAULT 'ONE_TIME';
ALTER TABLE "FeeComponent" ADD COLUMN "categoryId" TEXT;

CREATE TABLE "FeeCategory" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeInvoice" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicSession" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "billingPeriod" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "classSnapshot" TEXT NOT NULL,
  "sectionSnapshot" TEXT,
  "grossAmountMinor" BIGINT NOT NULL,
  "discountMinor" BIGINT NOT NULL DEFAULT 0,
  "waiverMinor" BIGINT NOT NULL DEFAULT 0,
  "fineMinor" BIGINT NOT NULL DEFAULT 0,
  "previousDueMinor" BIGINT NOT NULL DEFAULT 0,
  "adjustmentMinor" BIGINT NOT NULL DEFAULT 0,
  "netPayableMinor" BIGINT NOT NULL,
  "amountPaidMinor" BIGINT NOT NULL DEFAULT 0,
  "outstandingMinor" BIGINT NOT NULL,
  "status" "FeeInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "idempotencyKey" TEXT NOT NULL,
  "issuedById" TEXT,
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeeInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeInvoiceItem" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "chargeId" TEXT NOT NULL,
  "componentNameSnapshot" TEXT NOT NULL,
  "componentCodeSnapshot" TEXT NOT NULL,
  "originalAmountMinor" BIGINT NOT NULL,
  "discountMinor" BIGINT NOT NULL DEFAULT 0,
  "waiverMinor" BIGINT NOT NULL DEFAULT 0,
  "fineMinor" BIGINT NOT NULL DEFAULT 0,
  "finalAmountMinor" BIGINT NOT NULL,
  "paidMinor" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeRefund" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "receiptId" TEXT,
  "refundNumber" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "method" "FeePaymentMethod" NOT NULL,
  "status" "FeeRefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "referenceNumber" TEXT,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "processedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeeRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeRefundAllocation" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "chargeId" TEXT,
  "amountMinor" BIGINT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeRefundAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportFeeRoute" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "vehicleNumber" TEXT,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransportFeeRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportFeeStop" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "distanceKm" DECIMAL(8,2),
  "monthlyMinor" BIGINT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransportFeeStop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportFeeAssignment" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicSession" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "pickupStopId" TEXT,
  "dropStopId" TEXT,
  "tripType" "TransportTripType" NOT NULL DEFAULT 'TWO_WAY',
  "monthlyMinor" BIGINT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "status" "TransportAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "prorationRule" TEXT NOT NULL DEFAULT 'DAILY',
  "createdById" TEXT,
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransportFeeAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeeCategory_schoolId_code_key" ON "FeeCategory"("schoolId", "code");
CREATE INDEX "FeeCategory_schoolId_active_displayOrder_idx" ON "FeeCategory"("schoolId", "active", "displayOrder");
CREATE INDEX "FeeComponent_schoolId_categoryId_active_idx" ON "FeeComponent"("schoolId", "categoryId", "active");
CREATE UNIQUE INDEX "FeeComponent_school_master_code_key" ON "FeeComponent"("schoolId", "code") WHERE "feeStructureId" IS NULL;
CREATE UNIQUE INDEX "FeeInvoice_schoolId_academicSession_invoiceNumber_key" ON "FeeInvoice"("schoolId", "academicSession", "invoiceNumber");
CREATE UNIQUE INDEX "FeeInvoice_schoolId_idempotencyKey_key" ON "FeeInvoice"("schoolId", "idempotencyKey");
CREATE INDEX "FeeInvoice_schoolId_academicSession_status_idx" ON "FeeInvoice"("schoolId", "academicSession", "status");
CREATE INDEX "FeeInvoice_schoolId_studentId_dueDate_idx" ON "FeeInvoice"("schoolId", "studentId", "dueDate");
CREATE UNIQUE INDEX "FeeInvoiceItem_chargeId_key" ON "FeeInvoiceItem"("chargeId");
CREATE INDEX "FeeInvoiceItem_schoolId_invoiceId_idx" ON "FeeInvoiceItem"("schoolId", "invoiceId");
CREATE INDEX "FeeInvoiceItem_schoolId_studentId_idx" ON "FeeInvoiceItem"("schoolId", "studentId");
CREATE UNIQUE INDEX "FeeRefund_schoolId_refundNumber_key" ON "FeeRefund"("schoolId", "refundNumber");
CREATE UNIQUE INDEX "FeeRefund_schoolId_idempotencyKey_key" ON "FeeRefund"("schoolId", "idempotencyKey");
CREATE INDEX "FeeRefund_schoolId_studentId_status_idx" ON "FeeRefund"("schoolId", "studentId", "status");
CREATE INDEX "FeeRefund_schoolId_paymentId_createdAt_idx" ON "FeeRefund"("schoolId", "paymentId", "createdAt");
CREATE INDEX "FeeRefundAllocation_schoolId_refundId_idx" ON "FeeRefundAllocation"("schoolId", "refundId");
CREATE INDEX "FeeRefundAllocation_schoolId_chargeId_idx" ON "FeeRefundAllocation"("schoolId", "chargeId");
CREATE UNIQUE INDEX "TransportFeeRoute_schoolId_code_key" ON "TransportFeeRoute"("schoolId", "code");
CREATE INDEX "TransportFeeRoute_schoolId_active_idx" ON "TransportFeeRoute"("schoolId", "active");
CREATE UNIQUE INDEX "TransportFeeStop_schoolId_routeId_name_key" ON "TransportFeeStop"("schoolId", "routeId", "name");
CREATE INDEX "TransportFeeStop_schoolId_routeId_active_idx" ON "TransportFeeStop"("schoolId", "routeId", "active");
CREATE INDEX "TransportFeeAssignment_schoolId_studentId_academicSession_status_idx" ON "TransportFeeAssignment"("schoolId", "studentId", "academicSession", "status");
CREATE INDEX "TransportFeeAssignment_schoolId_routeId_status_idx" ON "TransportFeeAssignment"("schoolId", "routeId", "status");

ALTER TABLE "FeeCategory" ADD CONSTRAINT "FeeCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentFeeCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FeePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "FeeReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeRefundAllocation" ADD CONSTRAINT "FeeRefundAllocation_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "FeeRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeRefundAllocation" ADD CONSTRAINT "FeeRefundAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeRefundAllocation" ADD CONSTRAINT "FeeRefundAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StudentFeeCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeRoute" ADD CONSTRAINT "TransportFeeRoute_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeStop" ADD CONSTRAINT "TransportFeeStop_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeStop" ADD CONSTRAINT "TransportFeeStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportFeeRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeAssignment" ADD CONSTRAINT "TransportFeeAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeAssignment" ADD CONSTRAINT "TransportFeeAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeAssignment" ADD CONSTRAINT "TransportFeeAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportFeeRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeAssignment" ADD CONSTRAINT "TransportFeeAssignment_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "TransportFeeStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportFeeAssignment" ADD CONSTRAINT "TransportFeeAssignment_dropStopId_fkey" FOREIGN KEY ("dropStopId") REFERENCES "TransportFeeStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
