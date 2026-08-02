CREATE INDEX IF NOT EXISTS "Student_schoolId_isActive_className_section_createdAt_idx"
ON "Student"("schoolId", "isActive", "className", "section", "createdAt");
