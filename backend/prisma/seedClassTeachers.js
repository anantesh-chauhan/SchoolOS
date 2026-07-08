import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();

const CLASS_TEACHER_ROLES = ['CLASS_TEACHER', 'BOTH'];

const incrementLoad = (loadByTeacherId, teacherId) => {
  loadByTeacherId.set(teacherId, (loadByTeacherId.get(teacherId) || 0) + 1);
};

const pickLeastLoadedTeacher = (teachers, loadByTeacherId) => {
  return [...teachers].sort((a, b) => {
    const loadDiff = (loadByTeacherId.get(a.id) || 0) - (loadByTeacherId.get(b.id) || 0);
    if (loadDiff !== 0) return loadDiff;
    return a.teacherName.localeCompare(b.teacherName);
  })[0];
};

const pickSectionAssignment = (assignments, loadByTeacherId) => {
  return [...assignments].sort((a, b) => {
    const loadDiff = (loadByTeacherId.get(a.teacherId) || 0) - (loadByTeacherId.get(b.teacherId) || 0);
    if (loadDiff !== 0) return loadDiff;
    return a.teacher.teacherName.localeCompare(b.teacher.teacherName);
  })[0];
};

const getFirstSubjectForSection = async (tx, section) => {
  const sectionSubject = await tx.sectionSubject.findFirst({
    where: { sectionId: section.id },
    include: { subject: true },
    orderBy: [{ subject: { displayOrder: 'asc' } }, { createdAt: 'asc' }],
  });

  if (sectionSubject) return sectionSubject.subject;

  const classSubject = await tx.classSubject.findFirst({
    where: { classId: section.classId },
    include: { subject: true },
    orderBy: [{ subject: { displayOrder: 'asc' } }, { createdAt: 'asc' }],
  });

  return classSubject?.subject || null;
};

export const seedClassTeachersForSchool = async (school) => {
  const stats = {
    schoolId: school.id,
    created: 0,
    updated: 0,
    existing: 0,
    skipped: 0,
  };

  const teachers = await prisma.teacher.findMany({
    where: { schoolId: school.id, deletedAt: null },
    orderBy: { teacherName: 'asc' },
  });

  if (teachers.length === 0) {
    return { ...stats, skippedReason: 'No teachers found for school' };
  }

  const classTeacherRows = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: school.id,
      isActive: true,
      roleType: { in: CLASS_TEACHER_ROLES },
    },
    select: { teacherId: true },
  });

  const loadByTeacherId = new Map();
  classTeacherRows.forEach((row) => incrementLoad(loadByTeacherId, row.teacherId));

  const sections = await prisma.section.findMany({
    where: { schoolId: school.id, deletedAt: null },
    include: {
      class: { select: { className: true, classOrder: true } },
    },
    orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }],
  });

  for (const section of sections) {
    const existingClassTeacher = await prisma.teacherAssignment.findFirst({
      where: {
        schoolId: school.id,
        sectionId: section.id,
        isActive: true,
        roleType: { in: CLASS_TEACHER_ROLES },
      },
    });

    if (existingClassTeacher) {
      stats.existing += 1;
      continue;
    }

    const sectionAssignments = await prisma.teacherAssignment.findMany({
      where: {
        schoolId: school.id,
        classId: section.classId,
        sectionId: section.id,
        isActive: true,
      },
      include: {
        teacher: { select: { id: true, teacherName: true } },
        subject: { select: { id: true, subjectName: true } },
      },
    });

    const assignmentToPromote = pickSectionAssignment(sectionAssignments, loadByTeacherId);
    if (assignmentToPromote) {
      await prisma.teacherAssignment.update({
        where: { id: assignmentToPromote.id },
        data: { roleType: 'BOTH', isActive: true, effectiveTo: null },
      });
      incrementLoad(loadByTeacherId, assignmentToPromote.teacherId);
      stats.updated += 1;
      continue;
    }

    const subject = await getFirstSubjectForSection(prisma, section);
    if (!subject) {
      stats.skipped += 1;
      console.warn(
        `[class-teacher-seed] ${school.schoolName}: skipped ${section.class.className}-${section.sectionName}; no subjects found`
      );
      continue;
    }

    const teacher = pickLeastLoadedTeacher(teachers, loadByTeacherId);
    await prisma.teacherAssignment.upsert({
      where: {
        schoolId_teacherId_classId_sectionId_subjectId: {
          schoolId: school.id,
          teacherId: teacher.id,
          classId: section.classId,
          sectionId: section.id,
          subjectId: subject.id,
        },
      },
      update: { roleType: 'CLASS_TEACHER', isActive: true, effectiveTo: null },
      create: {
        schoolId: school.id,
        teacherId: teacher.id,
        classId: section.classId,
        sectionId: section.id,
        subjectId: subject.id,
        roleType: 'CLASS_TEACHER',
        isActive: true,
      },
    });
    incrementLoad(loadByTeacherId, teacher.id);
    stats.created += 1;
  }

  return stats;
};

export const seedClassTeachers = async () => {
  const schools = await prisma.school.findMany({
    select: { id: true, schoolName: true, schoolCode: true },
    orderBy: { schoolName: 'asc' },
  });

  const results = [];
  for (const school of schools) {
    const result = await seedClassTeachersForSchool(school);
    results.push({ schoolName: school.schoolName, ...result });
    console.log(`[class-teacher-seed] ${school.schoolName}:`, JSON.stringify(result));
  }

  return results;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedClassTeachers()
    .catch((error) => {
      console.error('[class-teacher-seed] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
