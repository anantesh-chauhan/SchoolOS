-- CreateEnum
CREATE TYPE "ExaminationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'MARK_ENTRY_OPEN', 'MARK_ENTRY_CLOSED', 'VERIFICATION', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExaminationCohortStatus" AS ENUM ('PENDING', 'MARKS_IN_PROGRESS', 'READY_FOR_CLASS_REVIEW', 'FORWARDED', 'COORDINATOR_APPROVED', 'PRINCIPAL_APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ExaminationSubjectStatus" AS ENUM ('PENDING', 'DRAFT', 'SUBMITTED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ExaminationAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'MEDICAL', 'EXEMPTED', 'TRANSFERRED', 'LATE_ADMISSION');

-- CreateEnum
CREATE TYPE "ExaminationMarkState" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ExaminationRuleType" AS ENUM ('CALCULATION', 'RANKING', 'PROMOTION', 'GRACE', 'REMARK');

-- CreateEnum
CREATE TYPE "ExaminationApprovalLevel" AS ENUM ('CLASS_TEACHER', 'EXAM_COORDINATOR', 'PRINCIPAL', 'CORRECTION');

-- CreateEnum
CREATE TYPE "ExaminationDecision" AS ENUM ('FORWARDED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "ExaminationResultStatus" AS ENUM ('PASS', 'FAIL', 'COMPARTMENT', 'WITHHELD');

-- CreateEnum
CREATE TYPE "ExaminationPromotionStatus" AS ENUM ('PROMOTED', 'PROMOTED_WITH_GRACE', 'COMPARTMENT', 'FAILED', 'RETAINED');

ALTER TYPE "Role" ADD VALUE 'PRINCIPAL';
ALTER TYPE "Role" ADD VALUE 'EXAM_COORDINATOR';

-- CreateTable
CREATE TABLE "Examination" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "resultDate" TIMESTAMP(3),
    "publicationDate" TIMESTAMP(3),
    "status" "ExaminationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculationConfig" JSONB,
    "rankingConfig" JSONB,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationCohort" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "status" "ExaminationCohortStatus" NOT NULL DEFAULT 'PENDING',
    "classTeacherRemarks" TEXT,
    "principalRemarks" TEXT,
    "promotionRecommendation" TEXT,
    "forwardedById" TEXT,
    "forwardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationSubject" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExaminationSubjectStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationComponent" (
    "id" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maximumMarks" DECIMAL(7,2) NOT NULL,
    "passingMarks" DECIMAL(7,2) NOT NULL,
    "weightage" DECIMAL(7,2) NOT NULL DEFAULT 100,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "allowDecimal" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationMark" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marks" DECIMAL(7,2),
    "attendanceStatus" "ExaminationAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "teacherRemark" TEXT,
    "state" "ExaminationMarkState" NOT NULL DEFAULT 'DRAFT',
    "enteredById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationGradeScale" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationGradeScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationRuleSet" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ExaminationRuleType" NOT NULL,
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationReview" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "cohortId" TEXT,
    "level" "ExaminationApprovalLevel" NOT NULL,
    "decision" "ExaminationDecision" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExaminationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationStudentResult" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalObtained" DECIMAL(10,2) NOT NULL,
    "totalMaximum" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(7,2) NOT NULL,
    "grade" TEXT,
    "gradePoint" DECIMAL(5,2),
    "rank" INTEGER,
    "sectionRank" INTEGER,
    "resultStatus" "ExaminationResultStatus" NOT NULL,
    "promotionStatus" "ExaminationPromotionStatus",
    "graceMarks" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "attendanceSummary" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExaminationStudentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationSubjectResult" (
    "id" TEXT NOT NULL,
    "studentResultId" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "obtainedMarks" DECIMAL(7,2) NOT NULL,
    "maximumMarks" DECIMAL(7,2) NOT NULL,
    "percentage" DECIMAL(7,2) NOT NULL,
    "grade" TEXT,
    "passed" BOOLEAN NOT NULL,
    "graceMarks" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "attendanceStatus" "ExaminationAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "componentBreakdown" JSONB NOT NULL,

    CONSTRAINT "ExaminationSubjectResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationResultVersion" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExaminationResultVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationReportCard" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "verificationId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ExaminationReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examinationId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExaminationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Examination_schoolId_status_startDate_idx" ON "Examination"("schoolId", "status", "startDate");

-- CreateIndex
CREATE INDEX "Examination_academicSessionId_idx" ON "Examination"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Examination_schoolId_academicSessionId_code_key" ON "Examination"("schoolId", "academicSessionId", "code");

-- CreateIndex
CREATE INDEX "ExaminationCohort_schoolId_classId_sectionId_idx" ON "ExaminationCohort"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "ExaminationCohort_examinationId_status_idx" ON "ExaminationCohort"("examinationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationCohort_examinationId_sectionId_key" ON "ExaminationCohort"("examinationId", "sectionId");

-- CreateIndex
CREATE INDEX "ExaminationSubject_examinationId_teacherId_status_idx" ON "ExaminationSubject"("examinationId", "teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationSubject_cohortId_subjectId_key" ON "ExaminationSubject"("cohortId", "subjectId");

-- CreateIndex
CREATE INDEX "ExaminationComponent_examSubjectId_displayOrder_idx" ON "ExaminationComponent"("examSubjectId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationComponent_examSubjectId_code_key" ON "ExaminationComponent"("examSubjectId", "code");

-- CreateIndex
CREATE INDEX "ExaminationMark_schoolId_examinationId_studentId_idx" ON "ExaminationMark"("schoolId", "examinationId", "studentId");

-- CreateIndex
CREATE INDEX "ExaminationMark_examinationId_state_idx" ON "ExaminationMark"("examinationId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationMark_componentId_studentId_key" ON "ExaminationMark"("componentId", "studentId");

-- CreateIndex
CREATE INDEX "ExaminationGradeScale_schoolId_isActive_idx" ON "ExaminationGradeScale"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationGradeScale_schoolId_code_key" ON "ExaminationGradeScale"("schoolId", "code");

-- CreateIndex
CREATE INDEX "ExaminationRuleSet_schoolId_type_isActive_idx" ON "ExaminationRuleSet"("schoolId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationRuleSet_schoolId_type_name_key" ON "ExaminationRuleSet"("schoolId", "type", "name");

-- CreateIndex
CREATE INDEX "ExaminationReview_examinationId_level_createdAt_idx" ON "ExaminationReview"("examinationId", "level", "createdAt");

-- CreateIndex
CREATE INDEX "ExaminationReview_cohortId_idx" ON "ExaminationReview"("cohortId");

-- CreateIndex
CREATE INDEX "ExaminationStudentResult_schoolId_studentId_calculatedAt_idx" ON "ExaminationStudentResult"("schoolId", "studentId", "calculatedAt");

-- CreateIndex
CREATE INDEX "ExaminationStudentResult_examinationId_rank_idx" ON "ExaminationStudentResult"("examinationId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationStudentResult_examinationId_studentId_version_key" ON "ExaminationStudentResult"("examinationId", "studentId", "version");

-- CreateIndex
CREATE INDEX "ExaminationSubjectResult_studentId_examSubjectId_idx" ON "ExaminationSubjectResult"("studentId", "examSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationSubjectResult_studentResultId_examSubjectId_key" ON "ExaminationSubjectResult"("studentResultId", "examSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationResultVersion_examinationId_version_key" ON "ExaminationResultVersion"("examinationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationReportCard_verificationId_key" ON "ExaminationReportCard"("verificationId");

-- CreateIndex
CREATE INDEX "ExaminationReportCard_studentId_issuedAt_idx" ON "ExaminationReportCard"("studentId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationReportCard_examinationId_studentId_resultVersion_key" ON "ExaminationReportCard"("examinationId", "studentId", "resultVersion");

-- CreateIndex
CREATE INDEX "ExaminationAuditLog_schoolId_createdAt_idx" ON "ExaminationAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ExaminationAuditLog_examinationId_createdAt_idx" ON "ExaminationAuditLog"("examinationId", "createdAt");

-- CreateIndex
CREATE INDEX "ExaminationAuditLog_entityType_entityId_idx" ON "ExaminationAuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationCohort" ADD CONSTRAINT "ExaminationCohort_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationCohort" ADD CONSTRAINT "ExaminationCohort_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationCohort" ADD CONSTRAINT "ExaminationCohort_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationCohort" ADD CONSTRAINT "ExaminationCohort_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSubject" ADD CONSTRAINT "ExaminationSubject_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSubject" ADD CONSTRAINT "ExaminationSubject_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ExaminationCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSubject" ADD CONSTRAINT "ExaminationSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationComponent" ADD CONSTRAINT "ExaminationComponent_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExaminationSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationMark" ADD CONSTRAINT "ExaminationMark_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ExaminationComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationMark" ADD CONSTRAINT "ExaminationMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationGradeScale" ADD CONSTRAINT "ExaminationGradeScale_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationRuleSet" ADD CONSTRAINT "ExaminationRuleSet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationReview" ADD CONSTRAINT "ExaminationReview_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationReview" ADD CONSTRAINT "ExaminationReview_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ExaminationCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationStudentResult" ADD CONSTRAINT "ExaminationStudentResult_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationStudentResult" ADD CONSTRAINT "ExaminationStudentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSubjectResult" ADD CONSTRAINT "ExaminationSubjectResult_studentResultId_fkey" FOREIGN KEY ("studentResultId") REFERENCES "ExaminationStudentResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSubjectResult" ADD CONSTRAINT "ExaminationSubjectResult_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExaminationSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSubjectResult" ADD CONSTRAINT "ExaminationSubjectResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationResultVersion" ADD CONSTRAINT "ExaminationResultVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationReportCard" ADD CONSTRAINT "ExaminationReportCard_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationReportCard" ADD CONSTRAINT "ExaminationReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationAuditLog" ADD CONSTRAINT "ExaminationAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationAuditLog" ADD CONSTRAINT "ExaminationAuditLog_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
