ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "sectionId" TEXT;

DROP INDEX IF EXISTS "Chapter_subjectId_chapterName_key";
DROP INDEX IF EXISTS "Chapter_subjectId_chapterNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_schoolId_classId_sectionId_subjectId_chapterName_key"
  ON "Chapter"("schoolId", "classId", "sectionId", "subjectId", "chapterName");

CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_schoolId_classId_sectionId_subjectId_chapterNumber_key"
  ON "Chapter"("schoolId", "classId", "sectionId", "subjectId", "chapterNumber");

CREATE INDEX IF NOT EXISTS "Chapter_schoolId_classId_sectionId_idx" ON "Chapter"("schoolId", "classId", "sectionId");

ALTER TABLE "Chapter"
  ADD CONSTRAINT "Chapter_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chapter"
  ADD CONSTRAINT "Chapter_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
