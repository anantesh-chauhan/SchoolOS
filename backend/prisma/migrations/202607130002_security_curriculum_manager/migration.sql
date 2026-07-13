ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CURRICULUM_MANAGER';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "securityQuestionsConfigured" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "securitySetupCompletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "recoveryEnabled" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "studentMustChangePassword" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "parentMustChangePassword" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "securityQuestionsConfigured" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "securitySetupCompletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "recoveryEnabled" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UserSecurityQuestion" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "accountKey" TEXT NOT NULL, "questionKey" TEXT NOT NULL, "answerHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UserSecurityQuestion_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "UserSecurityQuestion_schoolId_accountKey_questionKey_key" ON "UserSecurityQuestion"("schoolId","accountKey","questionKey");
CREATE INDEX IF NOT EXISTS "UserSecurityQuestion_schoolId_accountKey_idx" ON "UserSecurityQuestion"("schoolId","accountKey");
ALTER TABLE "UserSecurityQuestion" ADD CONSTRAINT "UserSecurityQuestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PasswordResetToken" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "accountKey" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "requestedIp" TEXT, "requestMethod" TEXT, "verificationState" JSONB, CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_schoolId_accountKey_expiresAt_idx" ON "PasswordResetToken"("schoolId","accountKey","expiresAt");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SecurityAuditLog" ("id" TEXT NOT NULL, "schoolId" TEXT, "actorUserId" TEXT, "targetUserId" TEXT, "action" TEXT NOT NULL, "status" TEXT NOT NULL, "metadata" JSONB, "ipAddress" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_schoolId_createdAt_idx" ON "SecurityAuditLog"("schoolId","createdAt");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_actorUserId_createdAt_idx" ON "SecurityAuditLog"("actorUserId","createdAt");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_targetUserId_createdAt_idx" ON "SecurityAuditLog"("targetUserId","createdAt");
ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Curriculum" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "name" TEXT NOT NULL, "curriculumType" TEXT NOT NULL, "academicSession" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "Curriculum_schoolId_name_academicSession_key" ON "Curriculum"("schoolId","name","academicSession");
CREATE INDEX IF NOT EXISTS "Curriculum_schoolId_academicSession_isActive_idx" ON "Curriculum"("schoolId","academicSession","isActive");
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CurriculumVersion" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "curriculumId" TEXT NOT NULL, "versionNumber" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "changeSummary" TEXT, "snapshot" JSONB, "publishedAt" TIMESTAMP(3), "archivedAt" TIMESTAMP(3), "createdById" TEXT, "publishedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CurriculumVersion_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumVersion_curriculumId_versionNumber_key" ON "CurriculumVersion"("curriculumId","versionNumber");
CREATE INDEX IF NOT EXISTS "CurriculumVersion_schoolId_status_idx" ON "CurriculumVersion"("schoolId","status");
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Publisher" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "name" TEXT NOT NULL, "website" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "Publisher_schoolId_name_key" ON "Publisher"("schoolId","name");
CREATE INDEX IF NOT EXISTS "Publisher_schoolId_isActive_idx" ON "Publisher"("schoolId","isActive");
ALTER TABLE "Publisher" ADD CONSTRAINT "Publisher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Book" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "curriculumVersionId" TEXT, "publisherId" TEXT, "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "title" TEXT NOT NULL, "author" TEXT, "edition" TEXT, "isbn" TEXT, "academicSession" TEXT NOT NULL, "coverImageUrl" TEXT, "board" TEXT, "resourceSource" TEXT, "resourcePreference" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Book_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "Book_schoolId_academicSession_classId_subjectId_title_key" ON "Book"("schoolId","academicSession","classId","subjectId","title");
CREATE INDEX IF NOT EXISTS "Book_schoolId_classId_subjectId_idx" ON "Book"("schoolId","classId","subjectId");
CREATE INDEX IF NOT EXISTS "Book_publisherId_idx" ON "Book"("publisherId");
ALTER TABLE "Book" ADD CONSTRAINT "Book_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Book" ADD CONSTRAINT "Book_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Book" ADD CONSTRAINT "Book_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Book" ADD CONSTRAINT "Book_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Book" ADD CONSTRAINT "Book_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CurriculumUnit" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "curriculumVersionId" TEXT, "subjectId" TEXT NOT NULL, "classId" TEXT, "name" TEXT NOT NULL, "displayOrder" INTEGER NOT NULL DEFAULT 0, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CurriculumUnit_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumUnit_schoolId_curriculumVersionId_subjectId_classId_name_key" ON "CurriculumUnit"("schoolId","curriculumVersionId","subjectId","classId","name");
CREATE INDEX IF NOT EXISTS "CurriculumUnit_schoolId_subjectId_classId_idx" ON "CurriculumUnit"("schoolId","subjectId","classId");
ALTER TABLE "CurriculumUnit" ADD CONSTRAINT "CurriculumUnit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurriculumUnit" ADD CONSTRAINT "CurriculumUnit_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumUnit" ADD CONSTRAINT "CurriculumUnit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumUnit" ADD CONSTRAINT "CurriculumUnit_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CurriculumAuditLog" ("id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "actorUserId" TEXT, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CurriculumAuditLog_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "CurriculumAuditLog_schoolId_createdAt_idx" ON "CurriculumAuditLog"("schoolId","createdAt");
CREATE INDEX IF NOT EXISTS "CurriculumAuditLog_schoolId_entityType_entityId_idx" ON "CurriculumAuditLog"("schoolId","entityType","entityId");
ALTER TABLE "CurriculumAuditLog" ADD CONSTRAINT "CurriculumAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "curriculumVersionId" TEXT, ADD COLUMN IF NOT EXISTS "bookId" TEXT, ADD COLUMN IF NOT EXISTS "unitId" TEXT, ADD COLUMN IF NOT EXISTS "academicSession" TEXT, ADD COLUMN IF NOT EXISTS "description" TEXT, ADD COLUMN IF NOT EXISTS "learningObjectives" JSONB, ADD COLUMN IF NOT EXISTS "teachingOrder" INTEGER, ADD COLUMN IF NOT EXISTS "difficultyLevel" TEXT, ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "targetCompletionDate" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "publicationStatus" TEXT NOT NULL DEFAULT 'PUBLISHED', ADD COLUMN IF NOT EXISTS "resourcePreference" TEXT;
CREATE INDEX IF NOT EXISTS "Chapter_schoolId_curriculumVersionId_idx" ON "Chapter"("schoolId","curriculumVersionId");
CREATE INDEX IF NOT EXISTS "Chapter_schoolId_bookId_idx" ON "Chapter"("schoolId","bookId");
CREATE INDEX IF NOT EXISTS "Chapter_schoolId_unitId_idx" ON "Chapter"("schoolId","unitId");
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "CurriculumUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcademicCalendarDay" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "eventType" TEXT, ADD COLUMN IF NOT EXISTS "holidayType" TEXT, ADD COLUMN IF NOT EXISTS "applicableClassIds" TEXT[] DEFAULT ARRAY[]::TEXT[], ADD COLUMN IF NOT EXISTS "applicableSectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[], ADD COLUMN IF NOT EXISTS "applicableRoles" TEXT[] DEFAULT ARRAY[]::TEXT[], ADD COLUMN IF NOT EXISTS "isFullDay" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "isSchoolWide" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "region" TEXT, ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "colorCategory" TEXT, ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "sourceNote" TEXT, ADD COLUMN IF NOT EXISTS "createdById" TEXT;
