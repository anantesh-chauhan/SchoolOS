CREATE TYPE "CalendarDayType" AS ENUM ('WORKING_DAY', 'HOLIDAY', 'WEEKLY_OFF', 'EXAM', 'EVENT', 'VACATION');

ALTER TABLE "StudentAttendance" ADD COLUMN "academicSession" TEXT;
UPDATE "StudentAttendance" sa SET "academicSession" = COALESCE(s."session", 'Unspecified') FROM "Student" s WHERE s."id" = sa."studentId";
ALTER TABLE "StudentAttendance" ALTER COLUMN "academicSession" SET NOT NULL;

ALTER TABLE "TeacherAttendance" ADD COLUMN "academicSession" TEXT NOT NULL DEFAULT 'Unspecified';
ALTER TABLE "TeacherAttendance" ALTER COLUMN "academicSession" DROP DEFAULT;

CREATE TABLE "AcademicCalendarDay" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "calendarDate" TIMESTAMP(3) NOT NULL,
  "academicSession" TEXT NOT NULL,
  "dayType" "CalendarDayType" NOT NULL DEFAULT 'WORKING_DAY',
  "title" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicCalendarDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicCalendarDay_schoolId_calendarDate_key" ON "AcademicCalendarDay"("schoolId", "calendarDate");
CREATE INDEX "AcademicCalendarDay_schoolId_academicSession_calendarDate_idx" ON "AcademicCalendarDay"("schoolId", "academicSession", "calendarDate");
CREATE INDEX "StudentAttendance_schoolId_studentId_academicSession_idx" ON "StudentAttendance"("schoolId", "studentId", "academicSession");
CREATE INDEX "TeacherAttendance_schoolId_teacherId_academicSession_idx" ON "TeacherAttendance"("schoolId", "teacherId", "academicSession");
ALTER TABLE "AcademicCalendarDay" ADD CONSTRAINT "AcademicCalendarDay_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
