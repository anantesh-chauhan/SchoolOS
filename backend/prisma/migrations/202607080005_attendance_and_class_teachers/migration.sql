CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE');

CREATE TABLE "StudentAttendance" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "remarks" TEXT,
  "markedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentAttendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAttendance" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "remarks" TEXT,
  "markedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentAttendance_schoolId_classId_sectionId_studentId_attendanceDate_key"
  ON "StudentAttendance"("schoolId", "classId", "sectionId", "studentId", "attendanceDate");
CREATE INDEX "StudentAttendance_schoolId_classId_sectionId_attendanceDate_idx"
  ON "StudentAttendance"("schoolId", "classId", "sectionId", "attendanceDate");
CREATE INDEX "StudentAttendance_schoolId_studentId_attendanceDate_idx"
  ON "StudentAttendance"("schoolId", "studentId", "attendanceDate");
CREATE INDEX "StudentAttendance_schoolId_markedById_idx"
  ON "StudentAttendance"("schoolId", "markedById");

CREATE UNIQUE INDEX "TeacherAttendance_schoolId_teacherId_attendanceDate_key"
  ON "TeacherAttendance"("schoolId", "teacherId", "attendanceDate");
CREATE INDEX "TeacherAttendance_schoolId_attendanceDate_idx"
  ON "TeacherAttendance"("schoolId", "attendanceDate");
CREATE INDEX "TeacherAttendance_schoolId_teacherId_attendanceDate_idx"
  ON "TeacherAttendance"("schoolId", "teacherId", "attendanceDate");
CREATE INDEX "TeacherAttendance_schoolId_markedById_idx"
  ON "TeacherAttendance"("schoolId", "markedById");

ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_markedById_fkey"
  FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_markedById_fkey"
  FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
