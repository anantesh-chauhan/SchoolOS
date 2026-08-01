-- Legacy schools can predate AcademicSession and SectionSubjectAllocation.
-- Examinations require both, so create the current session and translate the
-- existing class/section subject plan into ready, tenant-scoped allocations.
WITH academic_year AS (
  SELECT CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
    THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1
  END AS start_year
)
INSERT INTO "AcademicSession" (
  "id", "schoolId", "name", "startDate", "endDate", "isActive", "createdAt", "updatedAt"
)
SELECT
  'legacy_session_' || SUBSTRING(MD5(s."id" || academic_year.start_year::TEXT), 1, 16),
  s."id",
  academic_year.start_year::TEXT || '-' || RIGHT((academic_year.start_year + 1)::TEXT, 2),
  MAKE_DATE(academic_year.start_year, 4, 1),
  MAKE_DATE(academic_year.start_year + 1, 3, 31),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "School" s
CROSS JOIN academic_year
WHERE s."status" = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM "AcademicSession" existing WHERE existing."schoolId" = s."id")
ON CONFLICT ("schoolId", "name") DO NOTHING;

UPDATE "TeacherAssignment" assignment
SET "academicSessionId" = (
  SELECT candidate."id" FROM "AcademicSession" candidate
  WHERE candidate."schoolId" = assignment."schoolId" AND candidate."isActive" = true
  ORDER BY candidate."startDate" DESC LIMIT 1
), "updatedAt" = CURRENT_TIMESTAMP
WHERE assignment."academicSessionId" IS NULL
  AND EXISTS (SELECT 1 FROM "AcademicSession" candidate WHERE candidate."schoolId" = assignment."schoolId" AND candidate."isActive" = true);

INSERT INTO "SectionSubjectAllocation" (
  "id", "schoolId", "academicSessionId", "classId", "sectionId", "subjectId", "teacherId",
  "weeklySlots", "theorySlots", "practicalSlots", "remedialSlots", "assignmentType", "status",
  "workloadContribution", "timetableEligible", "requiresLab", "requiresDoublePeriod",
  "maxSameSubjectPeriodsPerDay", "minimumDistributionDays", "createdAt", "updatedAt"
)
SELECT
  'legacy_alloc_' || SUBSTRING(MD5(session."id" || section_subject."id"), 1, 18),
  section."schoolId",
  session."id",
  section."classId",
  section."id",
  section_subject."subjectId",
  teacher_assignment."teacherId",
  COALESCE(NULLIF(class_subject."periodsPerWeek", 0), NULLIF(teacher_assignment."weeklySlots", 0), 5),
  COALESCE(NULLIF(class_subject."periodsPerWeek", 0), NULLIF(teacher_assignment."weeklySlots", 0), 5),
  0,
  0,
  COALESCE(teacher_assignment."roleType", 'SUBJECT_TEACHER'::"TeacherAssignmentRoleType"),
  'READY'::"AllocationStatus",
  COALESCE(NULLIF(teacher_assignment."weeklySlots", 0), NULLIF(class_subject."periodsPerWeek", 0), 5),
  true,
  false,
  false,
  2,
  3,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SectionSubject" section_subject
JOIN "Section" section ON section."id" = section_subject."sectionId"
JOIN LATERAL (
  SELECT candidate."id"
  FROM "AcademicSession" candidate
  WHERE candidate."schoolId" = section."schoolId" AND candidate."isActive" = true
  ORDER BY candidate."startDate" DESC
  LIMIT 1
) session ON true
LEFT JOIN "ClassSubject" class_subject
  ON class_subject."classId" = section."classId" AND class_subject."subjectId" = section_subject."subjectId"
LEFT JOIN "TeacherAssignment" teacher_assignment
  ON teacher_assignment."schoolId" = section."schoolId"
  AND teacher_assignment."sectionId" = section."id"
  AND teacher_assignment."subjectId" = section_subject."subjectId"
  AND teacher_assignment."isActive" = true
WHERE section."deletedAt" IS NULL
ON CONFLICT ("schoolId", "academicSessionId", "sectionId", "subjectId") DO NOTHING;
