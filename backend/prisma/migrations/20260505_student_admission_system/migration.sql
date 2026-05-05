CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS admission_seq START 1;

CREATE OR REPLACE FUNCTION generate_admission_no()
RETURNS TEXT AS $$
DECLARE
    seq_num INT;
BEGIN
    seq_num := nextval('admission_seq');
    RETURN 'SCH' || TO_CHAR(CURRENT_DATE, 'YYYY') || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "Student"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "admissionNo" TEXT,
  ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "religion" TEXT,
  ADD COLUMN IF NOT EXISTS "mobile" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "pincode" TEXT,
  ADD COLUMN IF NOT EXISTS "section" TEXT,
  ADD COLUMN IF NOT EXISTS "rollNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "parentEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "occupation" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "Student"
SET "admissionNo" = generate_admission_no()
WHERE "admissionNo" IS NULL;

DROP INDEX IF EXISTS "Student_studentUserId_idx";
DROP INDEX IF EXISTS "Student_parentUserId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Student_admissionNo_key" ON "Student"("admissionNo");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_studentUserId_key" ON "Student"("studentUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_parentUserId_key" ON "Student"("parentUserId");
CREATE INDEX IF NOT EXISTS "Student_schoolId_session_idx" ON "Student"("schoolId", "session");
CREATE INDEX IF NOT EXISTS "Student_schoolId_className_idx" ON "Student"("schoolId", "className");
CREATE INDEX IF NOT EXISTS "Student_mobile_idx" ON "Student"("mobile");
CREATE INDEX IF NOT EXISTS "Student_email_idx" ON "Student"("email");
CREATE INDEX IF NOT EXISTS "Student_isActive_idx" ON "Student"("isActive");

CREATE TABLE IF NOT EXISTS "StudentAcademicHistory" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "section" TEXT,
  "session" TEXT NOT NULL,
  "rollNumber" TEXT,
  "promotedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAcademicHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "StudentAcademicHistory_studentId_session_idx" ON "StudentAcademicHistory"("studentId", "session");
CREATE INDEX IF NOT EXISTS "StudentAcademicHistory_session_idx" ON "StudentAcademicHistory"("session");
