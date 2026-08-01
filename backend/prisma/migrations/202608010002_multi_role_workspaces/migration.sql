-- Additive and repeat-safe in intent: the legacy User.role column is retained
-- until every deployment has verified the backfill.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EXAM_CONTROLLER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLASS_TEACHER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HR_MANAGER';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveRoleId" TEXT;

CREATE TABLE IF NOT EXISTS "UserSchoolRole" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "assignmentNotes" TEXT,
  "assignedById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSchoolRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserSchoolRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserSchoolRole_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSchoolRole_userId_schoolId_role_key" ON "UserSchoolRole"("userId", "schoolId", "role");
CREATE INDEX IF NOT EXISTS "UserSchoolRole_userId_schoolId_isActive_idx" ON "UserSchoolRole"("userId", "schoolId", "isActive");
CREATE INDEX IF NOT EXISTS "UserSchoolRole_schoolId_role_isActive_idx" ON "UserSchoolRole"("schoolId", "role", "isActive");

CREATE TABLE IF NOT EXISTS "RoleScope" (
  "id" TEXT NOT NULL,
  "roleAssignmentId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "classId" TEXT,
  "sectionId" TEXT,
  "subjectId" TEXT,
  "sessionId" TEXT,
  "examinationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoleScope_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoleScope_roleAssignmentId_fkey" FOREIGN KEY ("roleAssignmentId") REFERENCES "UserSchoolRole"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "RoleScope_roleAssignmentId_scopeType_idx" ON "RoleScope"("roleAssignmentId", "scopeType");
CREATE INDEX IF NOT EXISTS "RoleScope_classId_sectionId_subjectId_idx" ON "RoleScope"("classId", "sectionId", "subjectId");

CREATE TABLE IF NOT EXISTS "WorkspaceAuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "activeRole" "Role" NOT NULL,
  "roleAssignmentId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "WorkspaceAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "WorkspaceAuditLog_schoolId_createdAt_idx" ON "WorkspaceAuditLog"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceAuditLog_userId_roleAssignmentId_createdAt_idx" ON "WorkspaceAuditLog"("userId", "roleAssignmentId", "createdAt");

CREATE TABLE IF NOT EXISTS "SeparationOfDutiesPolicy" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'STRICT',
  "principalApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
  "workflows" JSONB,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeparationOfDutiesPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeparationOfDutiesPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SeparationOfDutiesPolicy_schoolId_key" ON "SeparationOfDutiesPolicy"("schoolId");

CREATE TABLE IF NOT EXISTS "AuthSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "schoolId" TEXT,
  "roleAssignmentId" TEXT,
  "refreshTokenHash" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");
CREATE INDEX IF NOT EXISTS "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- Backfill all legacy school users. ON CONFLICT makes reruns harmless.
INSERT INTO "UserSchoolRole" ("id", "userId", "schoolId", "role", "isActive", "isDefault", "createdAt", "updatedAt")
SELECT 'legacy_' || md5(u."id" || ':' || u."schoolId" || ':' || u."role"::text),
       u."id", u."schoolId", u."role", u."isActive", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE u."schoolId" IS NOT NULL
ON CONFLICT ("userId", "schoolId", "role") DO NOTHING;

UPDATE "User" u
SET "lastActiveRoleId" = r."id"
FROM "UserSchoolRole" r
WHERE r."userId" = u."id" AND r."schoolId" = u."schoolId"
  AND r."role" = u."role" AND u."lastActiveRoleId" IS NULL;
