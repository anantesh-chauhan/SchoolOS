-- AlterTable
ALTER TABLE "Chapter" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeacherAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSettings_schoolId_key" ON "SchoolSettings"("schoolId");

-- RenameIndex
ALTER INDEX "ChapterAssessmentResult_schoolId_classId_sectionId_subjectId_ch" RENAME TO "ChapterAssessmentResult_schoolId_classId_sectionId_subjectI_idx";

-- RenameIndex
ALTER INDEX "ChapterProgress_schoolId_classId_sectionId_subjectId_chapterId_" RENAME TO "ChapterProgress_schoolId_classId_sectionId_subjectId_chapte_key";

-- RenameIndex
ALTER INDEX "CurriculumUnit_schoolId_curriculumVersionId_subjectId_classId_n" RENAME TO "CurriculumUnit_schoolId_curriculumVersionId_subjectId_class_key";

-- RenameIndex
ALTER INDEX "LearningIntervention_schoolId_classId_sectionId_subjectId_chapt" RENAME TO "LearningIntervention_schoolId_classId_sectionId_subjectId_c_idx";

-- RenameIndex
ALTER INDEX "StudentAttendance_schoolId_classId_sectionId_studentId_attendan" RENAME TO "StudentAttendance_schoolId_classId_sectionId_studentId_atte_key";

-- RenameIndex
ALTER INDEX "SubjectWeeklyRequirement_schoolId_classId_sectionId_subjectId_k" RENAME TO "SubjectWeeklyRequirement_schoolId_classId_sectionId_subject_key";

-- RenameIndex
ALTER INDEX "TeacherAssignment_schoolId_teacherId_classId_sectionId_subjectI" RENAME TO "TeacherAssignment_schoolId_teacherId_classId_sectionId_subj_key";

-- RenameIndex
ALTER INDEX "TimetableSlot_schoolId_teacherId_dayOfWeek_startTime_endTime_id" RENAME TO "TimetableSlot_schoolId_teacherId_dayOfWeek_startTime_endTim_idx";

-- RenameIndex
ALTER INDEX "TransportFeeAssignment_schoolId_studentId_academicSession_statu" RENAME TO "TransportFeeAssignment_schoolId_studentId_academicSession_s_idx";
