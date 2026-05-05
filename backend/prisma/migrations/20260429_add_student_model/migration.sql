-- Add Student model migration

CREATE TABLE "Student" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "studentFirstName" TEXT NOT NULL,
  "studentLastName" TEXT,
  "dob" TIMESTAMP(3) NOT NULL,
  "gender" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "admissionDate" TIMESTAMP(3),
  "fatherName" TEXT NOT NULL,
  "motherName" TEXT,
  "parentMobile" TEXT NOT NULL,
  "alternateMobile" TEXT,
  "address" TEXT,
  "session" TEXT NOT NULL,
  "serialNo" INTEGER,
  "studentUserId" TEXT,
  "parentUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");
CREATE INDEX "Student_studentUserId_idx" ON "Student"("studentUserId");
CREATE INDEX "Student_parentUserId_idx" ON "Student"("parentUserId");
CREATE INDEX "Student_session_idx" ON "Student"("session");
