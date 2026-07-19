import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();
const at = (days, hours = 17) => { const value = new Date(); value.setDate(value.getDate() + days); value.setHours(hours, 0, 0, 0); return value; };

const upsertByTitle = async (schoolId, title, data) => {
  const existing = await prisma.homework.findFirst({ where: { schoolId, title } });
  return existing ? prisma.homework.update({ where: { id: existing.id }, data }) : prisma.homework.create({ data: { schoolId, title, ...data } });
};

export async function seedHomeworkResources() {
  const schools = await prisma.school.findMany({ where: { status: 'ACTIVE' } });
  for (const school of schools) {
    let assignment = await prisma.teacherAssignment.findFirst({ where: { schoolId: school.id, isActive: true }, include: { class: true, section: true, subject: true } });
    const creator = await prisma.user.findFirst({ where: { schoolId: school.id, role: { in: ['ADMIN','SCHOOL_OWNER','CURRICULUM_MANAGER'] }, isActive: true } });
    if (!creator) continue;
    if (!assignment) {
      const classRow = await prisma.class.findFirst({ where: { schoolId: school.id, deletedAt: null }, orderBy: { classOrder: 'asc' } });
      const section = classRow && await prisma.section.findFirst({ where: { schoolId: school.id, classId: classRow.id, deletedAt: null }, orderBy: { sectionOrder: 'asc' } });
      if (!classRow || !section) continue;
      let subject = await prisma.subject.findFirst({ where: { schoolId: school.id, subjectName: 'Mathematics', deletedAt: null } });
      if (!subject) subject = await prisma.subject.create({ data: { schoolId: school.id, subjectName: 'Mathematics', subjectCode: `${school.schoolCode}-MATH` } });
      await prisma.sectionSubject.upsert({ where: { sectionId_subjectId: { sectionId: section.id, subjectId: subject.id } }, update: {}, create: { sectionId: section.id, subjectId: subject.id } });
      const teacher = await prisma.teacher.upsert({ where: { schoolId_employeeId: { schoolId: school.id, employeeId: `T-${school.schoolCode}-001` } }, update: {},
        create: { schoolId: school.id, teacherName: 'Demo Mathematics Teacher', email: `teacher.${school.schoolCode.toLowerCase()}@schoolos.demo`, phone: '9000000000', employeeId: `T-${school.schoolCode}-001`, specialization: 'Mathematics' } });
      assignment = await prisma.teacherAssignment.create({ data: { schoolId: school.id, teacherId: teacher.id, classId: classRow.id, sectionId: section.id, subjectId: subject.id }, include: { class: true, section: true, subject: true } });
    }
    let chapter = await prisma.chapter.findFirst({ where: { schoolId: school.id, classId: assignment.classId, subjectId: assignment.subjectId, deletedAt: null,
      OR: [{ sectionId: assignment.sectionId }, { sectionId: null }] }, orderBy: { chapterNumber: 'asc' } });
    if (!chapter) chapter = await prisma.chapter.create({ data: { schoolId: school.id, classId: assignment.classId, sectionId: assignment.sectionId, subjectId: assignment.subjectId, chapterName: 'Whole Numbers', chapterNumber: 1, description: 'Seed chapter for homework and resources demonstrations.' } });
    const students = await prisma.student.findMany({ where: { schoolId: school.id, className: assignment.class.className, section: assignment.section.sectionName, isActive: true }, take: 4, orderBy: { rollNumber: 'asc' } });
    const session = students[0]?.session || school.config?.academicSession || '2026-27';
    await prisma.homeworkModuleSetting.upsert({ where: { schoolId: school.id }, create: { schoolId: school.id }, update: {} });
    const common = { academicSession: session, createdByUserId: creator.id, createdByRole: creator.role, classId: assignment.classId, sectionId: assignment.sectionId,
      subjectId: assignment.subjectId, teacherAssignmentId: assignment.id, allowSubmission: true, textResponseEnabled: true, maximumAttempts: 2 };
    const published = await upsertByTitle(school.id, '[Demo] Chapter practice set', { ...common, chapterId: chapter?.id || null, description: 'Complete the practice questions and explain your method.', instructions: 'Answer every question. Show the steps used to reach each answer.', homeworkType: 'PRACTICE', priority: 'HIGH', estimatedMinutes: 35, maximumMarks: 20, passingMarks: 8, status: 'PUBLISHED', publishedAt: at(-2), assignedAt: at(-2), dueAt: at(2), allowLateSubmission: true });
    await upsertByTitle(school.id, '[Demo] Reading reflection', { ...common, chapterId: null, description: 'Read the assigned pages and write a short reflection.', homeworkType: 'READING', priority: 'NORMAL', status: 'PUBLISHED', publishedAt: at(-1), assignedAt: at(-1), dueAt: at(0, 23), allowSubmission: true });
    await upsertByTitle(school.id, '[Demo] Overdue worksheet', { ...common, chapterId: chapter?.id || null, description: 'A deliberately overdue example for dashboard testing.', homeworkType: 'WORKSHEET', status: 'PUBLISHED', publishedAt: at(-5), assignedAt: at(-5), dueAt: at(-1), allowLateSubmission: true, requiresAttachment: true });
    await upsertByTitle(school.id, '[Demo] Draft project brief', { ...common, description: 'Draft content visible only to authorized staff.', homeworkType: 'PROJECT', status: 'DRAFT', publishedAt: null, dueAt: at(10), priority: 'NORMAL' });
    await upsertByTitle(school.id, '[Demo] Scheduled revision', { ...common, description: 'Scheduled revision material.', homeworkType: 'REVISION', status: 'SCHEDULED', scheduledAt: at(1, 8), publishedAt: null, dueAt: at(4), allowSubmission: false });
    const selected = await upsertByTitle(school.id, '[Demo] Focus-group extension', { ...common, description: 'Extension work assigned to selected students only.', status: 'PUBLISHED', publishedAt: at(-1), dueAt: at(3), audienceMode: 'SELECTED_STUDENTS' });
    await prisma.homeworkAudience.deleteMany({ where: { homeworkId: selected.id } });
    if (students[0]) await prisma.homeworkAudience.create({ data: { schoolId: school.id, homeworkId: selected.id, studentId: students[0].id, kind: 'INCLUDE' } });
    if (students[0]) await prisma.homeworkSubmission.upsert({ where: { homeworkId_studentId_attemptNumber: { homeworkId: published.id, studentId: students[0].id, attemptNumber: 1 } },
      create: { schoolId: school.id, homeworkId: published.id, studentId: students[0].id, attemptNumber: 1, textResponse: 'I completed the questions and checked each result.', submittedAt: at(-1), status: 'GRADED', reviewedAt: new Date(), reviewedByUserId: creator.id, marksAwarded: 17, feedback: 'Clear method and accurate working.', marksReleasedAt: new Date() },
      update: { status: 'GRADED', marksAwarded: 17, feedback: 'Clear method and accurate working.', marksReleasedAt: new Date() } });
    if (students[1]) await prisma.homeworkSubmission.upsert({ where: { homeworkId_studentId_attemptNumber: { homeworkId: published.id, studentId: students[1].id, attemptNumber: 1 } },
      create: { schoolId: school.id, homeworkId: published.id, studentId: students[1].id, attemptNumber: 1, textResponse: 'Please review my revised working.', submittedAt: new Date(), status: 'RESUBMISSION_REQUESTED', isLate: true, reviewedAt: new Date(), reviewedByUserId: creator.id, feedback: 'Please add the missing calculation.', resubmissionRequestedAt: new Date() },
      update: { status: 'RESUBMISSION_REQUESTED', feedback: 'Please add the missing calculation.', resubmissionRequestedAt: new Date() } });
    const resourceData = { schoolId: school.id, classId: assignment.classId, sectionId: assignment.sectionId, subjectId: assignment.subjectId, chapterId: chapter?.id || null,
      teacherId: assignment.teacherId, academicSession: session, createdByUserId: creator.id, createdByRole: creator.role, title: '[Demo] Chapter summary notes',
      description: 'Concise revision notes and worked examples for this chapter.', resourceType: 'NOTES', status: 'PUBLISHED', publishedAt: at(-2), isVisibleToStudents: true, isFeatured: true, isDownloadable: true };
    const existingResource = await prisma.sectionResource.findFirst({ where: { schoolId: school.id, title: resourceData.title } });
    const resource = existingResource ? await prisma.sectionResource.update({ where: { id: existingResource.id }, data: resourceData }) : await prisma.sectionResource.create({ data: resourceData });
    if (!await prisma.academicExternalLink.count({ where: { resourceId: resource.id } })) await prisma.academicExternalLink.create({ data: { schoolId: school.id, resourceId: resource.id, label: 'Reference reading', url: 'https://ncert.nic.in/textbook.php', domain: 'ncert.nic.in' } });
    if (!await prisma.academicAttachment.count({ where: { homeworkId: published.id } })) await prisma.academicAttachment.create({ data: { schoolId: school.id, homeworkId: published.id,
      fileName: 'practice-worksheet.pdf', originalName: 'Practice Worksheet.pdf', fileUrl: 'https://res.cloudinary.com/demo/raw/upload/sample.pdf', mimeType: 'application/pdf', fileSize: 245760, attachmentType: 'PDF', uploadedByUserId: creator.id } });
    console.log(`[homework-seed] ${school.schoolName}: homework, resources, audiences, and submissions ready`);
  }
}

export const disconnectHomeworkSeed = () => prisma.$disconnect();

if (process.argv[1]?.endsWith('seedHomeworkResources.js')) seedHomeworkResources().finally(disconnectHomeworkSeed);
