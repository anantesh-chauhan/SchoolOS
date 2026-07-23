import prisma from '../../config/prisma.client.js';
import { DEFAULT_CONFIGURATION } from './analytics.constants.js';

export const getConfiguration = async (schoolId) => {
  const existing = await prisma.analyticsConfiguration.findUnique({ where: { schoolId } });
  return existing || { ...DEFAULT_CONFIGURATION, schoolId };
};

export const resolveStudentContext = async ({ schoolId, studentId, academicSessionId }) => {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId, isActive: true } });
  if (!student) return null;
  const [classRow, sessionById] = await Promise.all([
    prisma.class.findFirst({ where: { schoolId, className: student.className, deletedAt: null } }),
    academicSessionId ? prisma.academicSession.findFirst({ where: { id: academicSessionId, schoolId } }) : null,
  ]);
  const [section, currentSession] = await Promise.all([
    classRow && student.section ? prisma.section.findFirst({ where: { schoolId, classId: classRow.id, sectionName: student.section, deletedAt: null } }) : null,
    !academicSessionId ? prisma.academicSession.findFirst({
      where: { schoolId, OR: [{ name: student.session }, { isActive: true }] },
      orderBy: [{ name: student.session ? 'asc' : 'desc' }, { startDate: 'desc' }],
    }) : null,
  ]);
  return { student, classRow, section, session: sessionById || currentSession, sessionName: (sessionById || currentSession)?.name || student.session };
};

export const loadStudentEvidence = async (ctx, { dateFrom, dateTo } = {}) => {
  const { student, classRow, section, sessionName } = ctx;
  const schoolId = student.schoolId;
  const dateFilter = dateFrom || dateTo ? {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lte: new Date(dateTo) } : {}),
  } : undefined;
  const classId = classRow?.id;
  const sectionId = section?.id;
  const scope = { schoolId, classId, sectionId };

  const [
    attendance, homework, submissions, assessments, masteries, votes, evaluations,
    chapters, progress, resources, activities, engagementEvents, interventions, assignments, overrides,
  ] = await Promise.all([
    prisma.studentAttendance.findMany({
      where: { schoolId, studentId: student.id, academicSession: sessionName, ...(dateFilter ? { attendanceDate: dateFilter } : {}) },
      orderBy: { attendanceDate: 'asc' },
    }),
    classId ? prisma.homework.findMany({
      where: {
        schoolId, academicSession: sessionName, deletedAt: null, status: { in: ['PUBLISHED', 'CLOSED', 'ARCHIVED'] },
        OR: [
          { classId, sectionId, audienceMode: 'ENTIRE_SECTION' },
          { classId, sectionId, audienceMode: 'ENTIRE_SECTION_WITH_EXCLUSIONS' },
          { audienceMode: 'SELECTED_STUDENTS', audiences: { some: { studentId: student.id, kind: 'INCLUDE' } } },
          { targets: { some: { studentId: student.id } } },
        ],
        NOT: { audiences: { some: { studentId: student.id, kind: 'EXCLUDE' } } },
        ...(dateFilter ? { assignedAt: dateFilter } : {}),
      },
      select: { id: true, subjectId: true, chapterId: true, title: true, maximumMarks: true, dueAt: true, assignedAt: true },
    }) : [],
    prisma.homeworkSubmission.findMany({
      where: { schoolId, studentId: student.id },
      orderBy: [{ homeworkId: 'asc' }, { attemptNumber: 'desc' }],
    }),
    prisma.chapterAssessmentResult.findMany({
      where: { schoolId, studentId: student.id, ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) },
      include: { assessment: { select: { title: true, assessmentType: true, assessmentDate: true, maxScore: true } } },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.studentChapterMastery.findMany({ where: { schoolId, studentId: student.id, ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) } }),
    prisma.studentChapterVote.findMany({ where: { schoolId, studentId: student.id, ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) } }),
    prisma.teacherStudentEvaluation.findMany({ where: { schoolId, studentId: student.id, ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) }, orderBy: { submittedAt: 'desc' } }),
    classId ? prisma.chapter.findMany({
      where: { schoolId, classId, deletedAt: null, OR: [{ sectionId }, { sectionId: null }] },
      include: { subject: { select: { id: true, subjectName: true } } },
      orderBy: [{ subjectId: 'asc' }, { chapterNumber: 'asc' }],
    }) : [],
    classId && sectionId ? prisma.chapterProgress.findMany({ where: scope }) : [],
    classId ? prisma.sectionResource.findMany({
      where: { schoolId, deletedAt: null, status: 'PUBLISHED', isVisibleToStudents: true, OR: [{ classId, sectionId }, { targets: { some: { studentId: student.id } } }] },
      select: { id: true, subjectId: true, chapterId: true, title: true, resourceType: true },
    }) : [],
    prisma.resourceActivity.findMany({ where: { schoolId, studentId: student.id, resourceId: { not: null } } }),
    prisma.resourceEngagementEvent.findMany({ where: { schoolId, studentId: student.id }, orderBy: { occurredAt: 'asc' } }),
    prisma.learningIntervention.findMany({
      where: { schoolId, studentId: student.id },
      orderBy: { createdAt: 'desc' },
    }),
    classId && sectionId ? prisma.teacherAssignment.findMany({
      where: { schoolId, classId, sectionId, isActive: true },
      include: { teacher: { select: { id: true, teacherName: true } }, subject: { select: { id: true, subjectName: true } } },
    }) : [],
    prisma.analyticsStatusOverride.findMany({
      where: { schoolId, revokedAt: null, OR: [
        { entityType: 'STUDENT_RISK', entityId: student.id },
        { entityType: 'CHAPTER_STATUS', entityId: { startsWith: `${student.id}:` } },
        { entityType: 'SUBJECT_STATUS', entityId: { startsWith: `${student.id}:` } },
      ] },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const assessmentIds = [...new Set(assessments.map((row) => row.assessmentId))];
  const chapterIds = chapters.map((row) => row.id);
  const [assessmentComponents, learningOutcomes] = await Promise.all([
    assessmentIds.length ? prisma.assessmentComponent.findMany({ where: { schoolId, assessmentId: { in: assessmentIds } }, orderBy: { order: 'asc' } }) : [],
    chapterIds.length ? prisma.learningOutcome.findMany({ where: { schoolId, chapterId: { in: chapterIds }, isActive: true }, orderBy: { order: 'asc' } }) : [],
  ]);
  const componentScores = assessmentComponents.length ? await prisma.studentAssessmentComponentScore.findMany({
    where: { schoolId, studentId: student.id, assessmentComponentId: { in: assessmentComponents.map((row) => row.id) } },
  }) : [];
  return { studentId: student.id, attendance, homework, submissions, assessments, masteries, votes, evaluations, chapters, progress, resources, activities, engagementEvents, interventions, assignments, overrides, assessmentComponents, componentScores, learningOutcomes };
};

export const listStudents = ({ schoolId, page, limit, search, className, section, scopeOr, studentIds }) => {
  const where = {
    schoolId, isActive: true, ...(className ? { className } : {}), ...(section ? { section } : {}),
    ...(studentIds ? { id: { in: studentIds } } : {}),
    ...(scopeOr?.length ? { OR: scopeOr } : {}),
    ...(search ? { AND: [{ OR: [
      { studentFirstName: { contains: search, mode: 'insensitive' } },
      { studentLastName: { contains: search, mode: 'insensitive' } },
      { admissionNo: { contains: search, mode: 'insensitive' } },
    ] }] } : {}),
  };
  return Promise.all([
    prisma.student.findMany({
      where,
      select: { id: true, admissionNo: true, studentFirstName: true, studentLastName: true, className: true, section: true, rollNumber: true, session: true },
      orderBy: [{ className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
  ]);
};
