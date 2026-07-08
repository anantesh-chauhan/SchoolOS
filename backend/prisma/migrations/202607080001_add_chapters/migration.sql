CREATE TABLE IF NOT EXISTS "Chapter" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "chapterName" TEXT NOT NULL,
  "chapterNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "estimatedClasses" INTEGER NOT NULL DEFAULT 4,
  "resourcesCount" INTEGER NOT NULL DEFAULT 0,
  "assignmentsCount" INTEGER NOT NULL DEFAULT 0,
  "completion" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_subjectId_chapterName_key" ON "Chapter"("subjectId", "chapterName");
CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_subjectId_chapterNumber_key" ON "Chapter"("subjectId", "chapterNumber");
CREATE INDEX IF NOT EXISTS "Chapter_schoolId_subjectId_idx" ON "Chapter"("schoolId", "subjectId");
CREATE INDEX IF NOT EXISTS "Chapter_schoolId_status_idx" ON "Chapter"("schoolId", "status");

ALTER TABLE "Chapter"
  ADD CONSTRAINT "Chapter_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chapter"
  ADD CONSTRAINT "Chapter_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
