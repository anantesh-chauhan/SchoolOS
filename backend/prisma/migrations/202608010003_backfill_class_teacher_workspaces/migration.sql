-- Existing academic class-teacher allocations become a separate workspace for
-- the same login. Subject-teacher access remains a distinct assignment.
INSERT INTO "UserSchoolRole" (
  "id", "userId", "schoolId", "role", "isActive", "isDefault",
  "assignmentNotes", "createdAt", "updatedAt"
)
SELECT DISTINCT
  'class_role_' || md5(u."id" || ':' || u."schoolId"),
  u."id",
  u."schoolId",
  'CLASS_TEACHER'::"Role",
  true,
  false,
  'Backfilled from active class-teacher allocation',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Teacher" t
  ON t."schoolId" = u."schoolId"
 AND t."deletedAt" IS NULL
 AND (
   t."email" = u."email"
   OR (u."contactEmail" IS NOT NULL AND t."email" = u."contactEmail")
   OR (u."employeeId" IS NOT NULL AND t."employeeId" = u."employeeId")
 )
JOIN "TeacherAssignment" ta
  ON ta."teacherId" = t."id"
 AND ta."schoolId" = u."schoolId"
 AND ta."isActive" = true
 AND ta."roleType" IN ('CLASS_TEACHER', 'BOTH')
WHERE u."isActive" = true
ON CONFLICT ("userId", "schoolId", "role") DO UPDATE
SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RoleScope" (
  "id", "roleAssignmentId", "scopeType", "classId", "sectionId",
  "createdAt", "updatedAt"
)
SELECT DISTINCT
  'class_scope_' || md5(r."id" || ':' || ta."classId" || ':' || ta."sectionId"),
  r."id",
  'SECTION',
  ta."classId",
  ta."sectionId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "UserSchoolRole" r
JOIN "User" u ON u."id" = r."userId" AND u."schoolId" = r."schoolId"
JOIN "Teacher" t
  ON t."schoolId" = u."schoolId"
 AND t."deletedAt" IS NULL
 AND (
   t."email" = u."email"
   OR (u."contactEmail" IS NOT NULL AND t."email" = u."contactEmail")
   OR (u."employeeId" IS NOT NULL AND t."employeeId" = u."employeeId")
 )
JOIN "TeacherAssignment" ta
  ON ta."teacherId" = t."id"
 AND ta."schoolId" = u."schoolId"
 AND ta."isActive" = true
 AND ta."roleType" IN ('CLASS_TEACHER', 'BOTH')
WHERE r."role" = 'CLASS_TEACHER'
ON CONFLICT ("id") DO UPDATE
SET "classId" = EXCLUDED."classId", "sectionId" = EXCLUDED."sectionId", "updatedAt" = CURRENT_TIMESTAMP;
