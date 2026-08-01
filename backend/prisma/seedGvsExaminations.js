import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import prisma from '../src/config/prisma.client.js';
import { assignRanks, calculateStudent, DEFAULT_GRADE_RULES } from '../src/modules/examinations/examination.engine.js';

const stableNumber = (text) => [...String(text)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100003, 17);
const markFor = (studentId, component, examOffset) => {
  const max = Number(component.maximumMarks);
  const seed = stableNumber(`${studentId}:${component.code}:${examOffset}`);
  return Math.min(max, Math.max(0, Math.round((max * (0.42 + (seed % 53) / 100)) * (component.allowDecimal ? 2 : 1)) / (component.allowDecimal ? 2 : 1)));
};

const findSchool = () => prisma.school.findFirst({
  where: { OR: [{ schoolName: { contains: 'Green Valley', mode: 'insensitive' } }, { schoolCode: { contains: 'GVS', mode: 'insensitive' } }, { slug: { contains: 'green-valley', mode: 'insensitive' } }] },
  orderBy: { createdAt: 'asc' },
});

async function allocationsFor({ schoolId, academicSessionId, classId, sectionId }) {
  const published = await prisma.sectionSubjectAllocation.findMany({ where: { schoolId, academicSessionId, classId, sectionId, status: { in: ['READY', 'TIMETABLED'] } }, orderBy: { createdAt: 'asc' } });
  if (published.length) return published;
  const assigned = await prisma.teacherAssignment.findMany({ where: { schoolId, academicSessionId, classId, sectionId, isActive: true }, orderBy: { createdAt: 'asc' } });
  if (assigned.length) return assigned;
  const sectionSubjects = await prisma.sectionSubject.findMany({ where: { sectionId }, include: { subject: true }, orderBy: { subject: { displayOrder: 'asc' } } });
  return sectionSubjects.map((row) => ({ subjectId: row.subjectId, teacherId: null }));
}

async function seed() {
  const school = await findSchool();
  if (!school) throw new Error('Green Valley School was not found. No examination data was changed.');
  const students = await prisma.student.findMany({ where: { schoolId: school.id, isActive: true }, orderBy: [{ session: 'desc' }, { className: 'asc' }, { section: 'asc' }, { rollNumber: 'asc' }] });
  if (!students.length) {
    console.log(`Green Valley School (${school.schoolCode}) has no existing active students. Nothing to seed.`);
    return;
  }

  const actor = await prisma.user.findFirst({ where: { schoolId: school.id, role: { in: ['EXAM_COORDINATOR', 'ADMIN', 'SCHOOL_OWNER'] }, isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!actor) throw new Error('Green Valley School needs an active admin/owner before examination demo data can be seeded.');
  const sessions = await prisma.academicSession.findMany({ where: { schoolId: school.id }, orderBy: { startDate: 'desc' } });
  const classes = await prisma.class.findMany({ where: { schoolId: school.id, deletedAt: null }, include: { sections: { where: { deletedAt: null } } } });
  const subjects = await prisma.subject.findMany({ where: { schoolId: school.id, deletedAt: null } });
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  await prisma.examinationGradeScale.upsert({
    where: { schoolId_code: { schoolId: school.id, code: 'CBSE-9' } },
    create: { schoolId: school.id, name: 'CBSE Nine Point Scale', code: 'CBSE-9', rules: DEFAULT_GRADE_RULES, isDefault: true, createdById: actor.id },
    update: { rules: DEFAULT_GRADE_RULES, isActive: true, isDefault: true },
  });
  for (const rule of [
    { type: 'PROMOTION', name: 'Standard promotion', config: { subjectPassingPercentage: 33, compartmentSubjectLimit: 1 } },
    { type: 'GRACE', name: 'Maximum five marks', config: { maximumPerSubject: 5, maximumOverall: 10 } },
    { type: 'RANKING', name: 'Section merit with shared ties', config: { scopes: ['SCHOOL', 'CLASS', 'SECTION'], tieHandling: 'SAME_RANK', tieBreakers: ['TOTAL', 'ATTENDANCE'] } },
  ]) await prisma.examinationRuleSet.upsert({ where: { schoolId_type_name: { schoolId: school.id, type: rule.type, name: rule.name } }, create: { schoolId: school.id, createdById: actor.id, isDefault: true, ...rule }, update: { config: rule.config, isActive: true } });

  const validGroups = [];
  for (const student of students) {
    const session = sessions.find((item) => item.name === student.session);
    const klass = classes.find((item) => item.className === student.className);
    const section = klass?.sections.find((item) => item.sectionName === student.section);
    if (!session || !klass || !section) continue;
    const key = `${session.id}:${section.id}`;
    let group = validGroups.find((item) => item.key === key);
    if (!group) { group = { key, session, klass, section, students: [] }; validGroups.push(group); }
    group.students.push(student);
  }
  if (!validGroups.length) throw new Error('Existing Green Valley students are not allocated to matching academic session/class/section records. No demo results were created.');

  const usableSessions = [...new Map(validGroups.map((group) => [group.session.id, group.session])).values()].slice(0, 2);
  let seededStudents = 0;
  for (const [examOffset, session] of usableSessions.entries()) {
    const sessionGroups = validGroups.filter((group) => group.session.id === session.id);
    const code = `GVS-DEMO-${examOffset ? 'UT1' : 'ANNUAL'}-${session.name.replace(/\W/g, '')}`;
    await prisma.examination.deleteMany({ where: { schoolId: school.id, academicSessionId: session.id, code } });
    const isPublished = examOffset === 0;
    const exam = await prisma.examination.create({ data: {
      schoolId: school.id, academicSessionId: session.id, name: isPublished ? 'Annual Examination' : 'Unit Test 1', code,
      description: 'SchoolOS examination workflow demonstration using existing Green Valley School students only.',
      startDate: new Date(session.startDate.getTime() + (isPublished ? 250 : 80) * 86400000), endDate: new Date(session.startDate.getTime() + (isPublished ? 265 : 87) * 86400000),
      resultDate: new Date(session.startDate.getTime() + (isPublished ? 280 : 95) * 86400000), status: isPublished ? 'PUBLISHED' : 'MARK_ENTRY_OPEN',
      calculationConfig: { gradeRules: DEFAULT_GRADE_RULES, promotion: { subjectPassingPercentage: 33, compartmentSubjectLimit: 1 }, grace: { maximumPerSubject: 5, maximumOverall: 10 }, bestOf: null },
      rankingConfig: { scopes: ['SCHOOL', 'CLASS', 'SECTION'], tieHandling: 'SAME_RANK' }, createdById: actor.id,
      ...(isPublished ? { approvedById: actor.id, approvedAt: new Date(), publishedById: actor.id, publishedAt: new Date() } : {}),
    } });
    const resultRows = [];
    for (const group of sessionGroups) {
      const allocations = await allocationsFor({ schoolId: school.id, academicSessionId: session.id, classId: group.klass.id, sectionId: group.section.id });
      if (!allocations.length) continue;
      const cohort = await prisma.examinationCohort.create({ data: { examinationId: exam.id, schoolId: school.id, classId: group.klass.id, sectionId: group.section.id, status: isPublished ? 'PUBLISHED' : 'MARKS_IN_PROGRESS', ...(isPublished ? { classTeacherRemarks: 'Consistent progress across the academic session.', principalRemarks: 'Congratulations and best wishes.', promotionRecommendation: 'Promoted', forwardedById: actor.id, forwardedAt: new Date() } : {}) } });
      const preparedSubjects = allocations.map((allocation, subjectOffset) => {
        const subject = subjectById.get(allocation.subjectId);
        if (!subject) return null;
        const examSubject = { id: randomUUID(), examinationId: exam.id, cohortId: cohort.id, subjectId: subject.id, teacherId: allocation.teacherId || null, displayOrder: subjectOffset, isOptional: subject.isOptional, status: isPublished ? 'LOCKED' : subjectOffset % 3 === 0 ? 'SUBMITTED' : 'DRAFT', ...(isPublished || subjectOffset % 3 === 0 ? { submittedById: actor.id, submittedAt: new Date(), lockedAt: isPublished ? new Date() : null } : {}) };
        const practical = subject.isLab || /computer|science|physics|chemistry|biology/i.test(subject.subjectName);
        const definitions = practical ? [['Theory','THEORY',70,23],['Practical','PRACTICAL',20,7],['Internal','INTERNAL',10,3]] : [['Theory','THEORY',80,26],['Internal Assessment','INTERNAL',20,7]];
        const components = definitions.map(([name, componentCode, maximumMarks, passingMarks], position) => ({ id: randomUUID(), examSubjectId: examSubject.id, name, code: componentCode, maximumMarks, passingMarks, weightage: 100, isMandatory: true, allowDecimal: componentCode === 'INTERNAL', displayOrder: position }));
        return { subjectOffset, examSubject, components };
      }).filter(Boolean);
      await prisma.examinationSubject.createMany({ data: preparedSubjects.map((item) => item.examSubject) });
      await prisma.examinationComponent.createMany({ data: preparedSubjects.flatMap((item) => item.components) });
      const markRows = preparedSubjects.flatMap(({ subjectOffset, examSubject, components }) => group.students.flatMap((student, studentOffset) => components.map((component) => {
        const special = (studentOffset + subjectOffset + examOffset) % 41 === 0 ? 'ABSENT' : (studentOffset + subjectOffset) % 67 === 0 ? 'MEDICAL' : 'PRESENT';
        return { schoolId: school.id, examinationId: exam.id, componentId: component.id, studentId: student.id, marks: special === 'PRESENT' ? markFor(student.id, component, examOffset) : null, attendanceStatus: special, state: isPublished ? 'LOCKED' : examSubject.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT', enteredById: actor.id, submittedAt: examSubject.status === 'SUBMITTED' || isPublished ? new Date() : null };
      })));
      await prisma.examinationMark.createMany({ data: markRows });
      const resultSubjects = preparedSubjects.map(({ examSubject, components }) => ({ examSubject, components }));
      if (isPublished) {
        const componentIds = resultSubjects.flatMap((item) => item.components.map((component) => component.id));
        const savedMarks = await prisma.examinationMark.findMany({ where: { studentId: { in: group.students.map((student) => student.id) }, componentId: { in: componentIds } } });
        const markMap = new Map(savedMarks.map((mark) => [`${mark.studentId}:${mark.componentId}`, mark]));
        for (const student of group.students) resultRows.push({ studentId: student.id, ...calculateStudent({ gradeRules: DEFAULT_GRADE_RULES, graceConfig: { maximumPerSubject: 5 }, promotionConfig: { subjectPassingPercentage: 33, compartmentSubjectLimit: 1 }, subjects: resultSubjects.map(({ examSubject, components }) => ({ examSubjectId: examSubject.id, components: components.map((component) => ({ ...component, marks: markMap.get(`${student.id}:${component.id}`)?.marks, attendanceStatus: markMap.get(`${student.id}:${component.id}`)?.attendanceStatus })) })) }) });
      }
      seededStudents += group.students.length;
    }
    if (isPublished) {
      const ranked = assignRanks(resultRows);
      const prepared = ranked.map((row) => ({ row, resultId: randomUUID(), verificationId: randomUUID() }));
      await prisma.examinationStudentResult.createMany({ data: prepared.map(({ row, resultId }) => ({ id: resultId, schoolId: school.id, examinationId: exam.id, studentId: row.studentId, version: 1, totalObtained: row.totalObtained, totalMaximum: row.totalMaximum, percentage: row.percentage, grade: row.grade, gradePoint: row.gradePoint, rank: row.rank, sectionRank: row.sectionRank, resultStatus: row.resultStatus, promotionStatus: row.promotionStatus, graceMarks: row.graceMarks })) });
      await prisma.examinationSubjectResult.createMany({ data: prepared.flatMap(({ row, resultId }) => row.subjectResults.map((item) => ({ studentResultId: resultId, examSubjectId: item.examSubjectId, studentId: row.studentId, obtainedMarks: item.obtainedMarks, maximumMarks: item.maximumMarks, percentage: item.percentage, grade: item.grade, passed: item.passed, graceMarks: item.graceMarks, attendanceStatus: item.attendanceStatus, componentBreakdown: item.componentBreakdown }))) });
      await prisma.examinationReportCard.createMany({ data: prepared.map(({ row, verificationId }) => ({ examinationId: exam.id, studentId: row.studentId, resultVersion: 1, verificationId, generatedById: actor.id, metadata: { seeded: true, schoolCode: school.schoolCode } })) });
      const snapshot = prepared.map(({ row, verificationId }) => ({ ...row, verificationId }));
      await prisma.examinationResultVersion.create({ data: { examinationId: exam.id, version: 1, snapshot, reason: 'Green Valley existing-student demo seed', createdById: actor.id } });
    }
    await prisma.examinationAuditLog.create({ data: { schoolId: school.id, examinationId: exam.id, actorId: actor.id, action: 'DEMO_DATA_SEEDED', entityType: 'Examination', entityId: exam.id, newValue: { existingStudentsOnly: true, schoolCode: school.schoolCode, session: session.name } } });
  }
  console.log(`Seeded examination data for ${seededStudents} existing Green Valley roster placements across ${usableSessions.length} session(s). No students were created.`);
}

seed().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
