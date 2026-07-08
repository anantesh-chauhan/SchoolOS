ALTER TABLE "TeacherAssignment" DROP CONSTRAINT IF EXISTS "TeacherAssignment_schoolId_classId_sectionId_subjectId_key";
DROP INDEX IF EXISTS "TeacherAssignment_schoolId_classId_sectionId_subjectId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherAssignment_schoolId_teacherId_classId_sectionId_subjectId_key"
  ON "TeacherAssignment"("schoolId", "teacherId", "classId", "sectionId", "subjectId");
