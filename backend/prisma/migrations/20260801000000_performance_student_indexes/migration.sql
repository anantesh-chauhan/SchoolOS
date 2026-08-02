CREATE INDEX IF NOT EXISTS "Student_schoolId_isActive_createdAt_idx"
ON "Student"("schoolId", "isActive", "createdAt");

CREATE INDEX IF NOT EXISTS "Student_schoolId_className_section_isActive_idx"
ON "Student"("schoolId", "className", "section", "isActive");
