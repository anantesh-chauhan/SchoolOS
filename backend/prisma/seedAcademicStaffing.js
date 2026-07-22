import 'dotenv/config';
import bcryptjs from 'bcryptjs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '../src/generated/prisma/index.js';
import {
  DEFAULT_ACADEMIC_CONFIGURATION,
  classBand,
  getSlotDefault,
  runStaffingAudit,
  selectBestTeacher,
} from '../src/services/academicStaffing.service.js';

const prisma = new PrismaClient();
const FIRST_NAMES = ['Aarav', 'Aditi', 'Akash', 'Ananya', 'Arjun', 'Bhavna', 'Deepak', 'Divya', 'Farah', 'Gaurav', 'Ishita', 'Kabir', 'Kavita', 'Manish', 'Meera', 'Mohit', 'Neha', 'Nikhil', 'Pooja', 'Priya', 'Rahul', 'Ritu', 'Rohan', 'Sakshi', 'Sanjay', 'Shalini', 'Sneha', 'Sunita', 'Varun', 'Vikram'];
const LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Mehta', 'Iyer', 'Nair', 'Rao', 'Kapoor', 'Mishra', 'Khan', 'Joshi'];
const CATEGORY = { PRE_PRIMARY: 'PRE_PRIMARY', PRIMARY: 'PRT', MIDDLE: 'TGT', SECONDARY: 'TGT', SENIOR: 'PGT' };
const RANGE = { PRE_PRIMARY: [0, 0], PRIMARY: [1, 5], MIDDLE: [6, 8], SECONDARY: [9, 10], SENIOR: [11, 12] };
const QUALIFICATION = { PRE_PRIMARY: 'Diploma in Early Childhood Education', PRIMARY: 'B.Ed., Graduate', MIDDLE: 'B.Ed., Graduate', SECONDARY: 'B.Ed., Graduate', SENIOR: 'M.Ed., Postgraduate' };
const SENIOR_COMBINATIONS = {
  SCI: new Set(['English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Physical Education']),
  COM: new Set(['English', 'Accountancy', 'Business Studies', 'Economics', 'Applied Mathematics', 'Informatics Practices', 'Physical Education']),
  HUM: new Set(['English', 'History', 'Political Science', 'Geography', 'Economics', 'Psychology', 'Physical Education']),
};
const seniorSubjectsForSection = (section, subjects) => {
  if (subjects.length <= 8) return subjects;
  const prefix = String(section.sectionName).toUpperCase().match(/^(SCI|COM|HUM)/)?.[1] || ['SCI', 'COM', 'HUM'][(section.sectionOrder - 1) % 3];
  return subjects.filter((subject) => SENIOR_COMBINATIONS[prefix].has(subject.subjectName));
};

const fitDefaults = (className, subjects, capacity) => {
  const rows = subjects.map((subject) => ({ subject, slots: getSlotDefault(className, subject) }));
  let total = rows.reduce((sum, row) => sum + row.slots.recommendedSlots, 0);
  for (const row of [...rows].sort((a, b) => Number(b.slots.isActivity) - Number(a.slots.isActivity) || b.slots.recommendedSlots - a.slots.recommendedSlots)) {
    while (total > capacity && row.slots.recommendedSlots > row.slots.minimumSlots) { row.slots.recommendedSlots -= 1; row.slots.theorySlots = Math.max(0, row.slots.theorySlots - 1); total -= 1; }
  }
  if (total > capacity) throw new Error(`${className}: minimum subject demand ${total} exceeds capacity ${capacity} (${subjects.map((row) => row.subjectName).join(', ')})`);
  return rows;
};

const ensureSession = async (tx, school) => {
  const session = await tx.academicSession.upsert({
    where: { schoolId_name: { schoolId: school.id, name: '2026-27' } },
    update: { isActive: true },
    create: { schoolId: school.id, name: '2026-27', startDate: new Date('2026-04-01T00:00:00.000Z'), endDate: new Date('2027-03-31T00:00:00.000Z'), isActive: true },
  });
  const config = await tx.academicConfiguration.upsert({ where: { academicSessionId: session.id }, update: {}, create: { schoolId: school.id, academicSessionId: session.id, ...DEFAULT_ACADEMIC_CONFIGURATION } });
  return { session, config };
};

const createTemplatesAndAllocations = async (tx, school, session, config) => {
  const classes = await tx.class.findMany({ where: { schoolId: school.id, deletedAt: null }, include: { classSubjects: { include: { subject: true } }, sections: { where: { deletedAt: null }, include: { sectionSubjects: { include: { subject: true } } } } }, orderBy: { classOrder: 'asc' } });
  let templates = 0; let allocations = 0;
  for (const classRow of classes) {
    // Senior-secondary class mappings contain the union of stream/elective choices.
    // Capacity applies to each section's chosen combination, not that union.
    const fitted = classBand(classRow.className) === 'SENIOR'
      ? classRow.classSubjects.map((row) => ({ subject: row.subject, slots: getSlotDefault(classRow.className, row.subject) }))
      : fitDefaults(classRow.className, classRow.classSubjects.map((row) => row.subject), config.totalPeriodsPerWeek);
    const bySubjectId = new Map(fitted.map((row) => [row.subject.id, row.slots]));
    for (const { subject, slots } of fitted) {
      await tx.weeklySubjectSlotTemplate.upsert({ where: { schoolId_academicSessionId_classId_subjectId: { schoolId: school.id, academicSessionId: session.id, classId: classRow.id, subjectId: subject.id } }, update: { ...slots, sourceType: 'CBSE_DEFAULT', isActive: true }, create: { schoolId: school.id, academicSessionId: session.id, classId: classRow.id, subjectId: subject.id, ...slots, sourceType: 'CBSE_DEFAULT' } }); templates += 1;
    }
    for (const section of classRow.sections) {
      const mappedSubjects = section.sectionSubjects.length ? section.sectionSubjects.map((row) => row.subject) : fitted.map((row) => row.subject);
      const subjects = classBand(classRow.className) === 'SENIOR' ? seniorSubjectsForSection(section, mappedSubjects) : mappedSubjects;
      const sectionRows = fitDefaults(classRow.className, subjects, config.totalPeriodsPerWeek);
      for (const { subject, slots: sectionDefault } of sectionRows) {
        const slots = bySubjectId.get(subject.id) || sectionDefault;
        await tx.sectionSubjectAllocation.upsert({ where: { schoolId_academicSessionId_sectionId_subjectId: { schoolId: school.id, academicSessionId: session.id, sectionId: section.id, subjectId: subject.id } }, update: { weeklySlots: slots.recommendedSlots, theorySlots: slots.theorySlots, practicalSlots: slots.practicalSlots, workloadContribution: slots.recommendedSlots, requiresLab: slots.practicalSlots > 0, requiresDoublePeriod: slots.labDoublePeriods > 0, status: 'TEACHER_REQUIRED' }, create: { schoolId: school.id, academicSessionId: session.id, classId: classRow.id, sectionId: section.id, subjectId: subject.id, weeklySlots: slots.recommendedSlots, theorySlots: slots.theorySlots, practicalSlots: slots.practicalSlots, workloadContribution: slots.recommendedSlots, requiresLab: slots.practicalSlots > 0, requiresDoublePeriod: slots.labDoublePeriods > 0, status: 'TEACHER_REQUIRED' } }); allocations += 1;
      }
    }
  }
  return { classes, templates, allocations };
};

const seedDemandTeachers = async (tx, school, session, config, passwordHash) => {
  const allocations = await tx.sectionSubjectAllocation.findMany({ where: { schoolId: school.id, academicSessionId: session.id }, include: { class: true, subject: true } });
  const demand = new Map();
  for (const row of allocations) { const band = classBand(row.class.className); const key = `${band}:${row.subjectId}`; const current = demand.get(key) || { band, subject: row.subject, periods: 0, practical: false }; current.periods += row.weeklySlots; current.practical ||= row.practicalSlots > 0; demand.set(key, current); }
  let sequence = 1; let created = 0;
  const teachers = [];
  for (const item of [...demand.values()].sort((a, b) => a.band.localeCompare(b.band) || a.subject.subjectCode.localeCompare(b.subject.subjectCode))) {
    const count = Math.max(1, Math.ceil(item.periods / config.targetTeacherPeriodsPerWeek));
    for (let index = 0; index < count; index += 1) {
      const employeeId = `${school.schoolCode.replace(/\d+$/, '') || 'GVS'}-TCH-${String(sequence++).padStart(4, '0')}`;
      const nameIndex = sequence + index + item.subject.displayOrder;
      const teacherName = `${FIRST_NAMES[nameIndex % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(nameIndex / FIRST_NAMES.length) % LAST_NAMES.length]}`;
      const email = `${employeeId.toLowerCase()}@${school.schoolCode.toLowerCase()}.schoolos.test`;
      const [from, to] = RANGE[item.band];
      const teacher = await tx.teacher.upsert({ where: { schoolId_employeeId: { schoolId: school.id, employeeId } }, update: { isActive: true }, create: { schoolId: school.id, teacherName, email, phone: `+91${String(7000000000 + sequence).slice(0, 10)}`, employeeId, joiningYear: 2026, qualification: QUALIFICATION[item.band], specialization: item.subject.subjectName, subjectsHandled: [item.subject.subjectName, item.subject.subjectCode], designation: `${CATEGORY[item.band]} ${item.subject.subjectName}`, teacherCategory: CATEGORY[item.band], eligibleClassFrom: from, eligibleClassTo: to, canBeClassTeacher: true, canTeachPractical: item.practical, maximumPeriodsPerDay: config.maximumTeacherPeriodsPerDay, maximumPeriodsPerWeek: config.maximumTeacherPeriodsPerWeek, targetPeriodsPerWeek: config.targetTeacherPeriodsPerWeek, isActive: true } });
      await tx.teacherQualification.upsert({ where: { schoolId_teacherId_subjectId: { schoolId: school.id, teacherId: teacher.id, subjectId: item.subject.id } }, update: { isPreferred: true, canTeachPractical: item.practical }, create: { schoolId: school.id, teacherId: teacher.id, subjectId: item.subject.id, isPreferred: true, canTeachPractical: item.practical } });
      await tx.user.upsert({ where: { email }, update: { password: passwordHash, name: teacherName, role: 'TEACHER', schoolId: school.id, employeeId, isActive: true }, create: { email, password: passwordHash, name: teacherName, contactEmail: email, role: 'TEACHER', schoolId: school.id, employeeId, joiningYear: 2026, isActive: true, mustChangePassword: true } });
      teachers.push(teacher); created += 1;
    }
  }
  return { teachers, created };
};

const allocateTeachers = async (tx, school, session, config) => {
  const [allocations, teachers] = await Promise.all([tx.sectionSubjectAllocation.findMany({ where: { schoolId: school.id, academicSessionId: session.id }, include: { class: true, subject: true }, orderBy: [{ class: { classOrder: 'asc' } }, { subject: { subjectCode: 'asc' } }] }), tx.teacher.findMany({ where: { schoolId: school.id, isActive: true, deletedAt: null }, include: { qualifications: true }, orderBy: { employeeId: 'asc' } })]);
  const loadByTeacher = new Map(teachers.map((row) => [row.id, 0])); let assigned = 0; let unresolved = 0;
  for (const allocation of allocations) {
    const teacher = selectBestTeacher({ teachers, subject: allocation.subject, className: allocation.class.className, requiresPractical: allocation.practicalSlots > 0, loadByTeacher });
    if (!teacher || (loadByTeacher.get(teacher.id) || 0) + allocation.weeklySlots > teacher.maximumPeriodsPerWeek) { await tx.sectionSubjectAllocation.update({ where: { id: allocation.id }, data: { teacherId: null, status: 'TEACHER_REQUIRED' } }); unresolved += 1; continue; }
    await tx.sectionSubjectAllocation.update({ where: { id: allocation.id }, data: { teacherId: teacher.id, status: 'READY' } });
    allocation.teacherId = teacher.id;
    await tx.teacherAssignment.upsert({ where: { schoolId_classId_sectionId_subjectId: { schoolId: school.id, classId: allocation.classId, sectionId: allocation.sectionId, subjectId: allocation.subjectId } }, update: { teacherId: teacher.id, academicSessionId: session.id, weeklySlots: allocation.weeklySlots, roleType: 'SUBJECT_TEACHER', status: 'ACTIVE', isActive: true }, create: { schoolId: school.id, academicSessionId: session.id, teacherId: teacher.id, classId: allocation.classId, sectionId: allocation.sectionId, subjectId: allocation.subjectId, weeklySlots: allocation.weeklySlots } });
    loadByTeacher.set(teacher.id, (loadByTeacher.get(teacher.id) || 0) + allocation.weeklySlots); assigned += 1;
  }
  const sections = await tx.section.findMany({ where: { schoolId: school.id, deletedAt: null }, orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }] });
  const primaryUsed = new Set(); let classTeachers = 0;
  for (const section of sections) {
    const candidates = allocations.filter((row) => row.sectionId === section.id && row.teacherId).map((row) => teachers.find((teacher) => teacher.id === row.teacherId)).filter((teacher) => teacher?.canBeClassTeacher && !primaryUsed.has(teacher.id)).sort((a, b) => (loadByTeacher.get(a.id) || 0) - (loadByTeacher.get(b.id) || 0) || a.employeeId.localeCompare(b.employeeId));
    const teacher = candidates[0]; if (!teacher) continue;
    await tx.sectionClassTeacherAssignment.upsert({ where: { schoolId_academicSessionId_sectionId_isPrimary: { schoolId: school.id, academicSessionId: session.id, sectionId: section.id, isPrimary: true } }, update: { teacherId: teacher.id, status: 'ACTIVE', endDate: null, dutyPeriods: config.classTeacherDutyPeriods }, create: { schoolId: school.id, academicSessionId: session.id, sectionId: section.id, teacherId: teacher.id, isPrimary: true, startDate: session.startDate, dutyPeriods: config.classTeacherDutyPeriods } });
    const subjectAssignment = await tx.teacherAssignment.findFirst({ where: { schoolId: school.id, sectionId: section.id, teacherId: teacher.id, academicSessionId: session.id } });
    if (subjectAssignment) await tx.teacherAssignment.update({ where: { id: subjectAssignment.id }, data: { roleType: 'BOTH' } });
    primaryUsed.add(teacher.id); classTeachers += 1;
  }
  return { assigned, unresolved, classTeachers, sectionCount: sections.length };
};

export const seedAcademicStaffingForSchool = async (school, { assignOnly = false } = {}) => {
  const passwordHash = await bcryptjs.hash('Teacher@2026', 10);
  // Each phase is idempotent and intentionally committed separately; medium and
  // large schools can exceed interactive-transaction timeouts on remote databases.
  const { session, config } = await ensureSession(prisma, school);
  const structure = assignOnly ? {
    classes: await prisma.class.findMany({ where: { schoolId: school.id, deletedAt: null } }),
    templates: await prisma.weeklySubjectSlotTemplate.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
    allocations: await prisma.sectionSubjectAllocation.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
  } : await createTemplatesAndAllocations(prisma, school, session, config);
  const teacherResult = assignOnly ? { teachers: [], created: await prisma.teacherQualification.groupBy({ by: ['teacherId'], where: { schoolId: school.id } }).then((rows) => rows.length) } : await seedDemandTeachers(prisma, school, session, config, passwordHash);
  const assignment = await allocateTeachers(prisma, school, session, config);
  const result = { session, config, structure, teacherResult, assignment };
  const audit = await runStaffingAudit({ schoolId: school.id, academicSessionId: result.session.id });
  const summary = { school: school.schoolName, academicSession: result.session.name, classes: result.structure.classes.length, sections: result.assignment.sectionCount, templates: result.structure.templates, allocations: result.structure.allocations, teachersCreated: result.teacherResult.created, classTeachers: `${result.assignment.classTeachers}/${result.assignment.sectionCount}`, subjectAssignments: `${result.assignment.assigned}/${result.structure.allocations}`, audit };
  console.log('[academic-staffing-seed]', JSON.stringify(summary, null, 2));
  if (!audit.isValid) throw new Error(`Academic staffing seed audit failed for ${school.schoolName}: ${audit.errors.map((row) => row.code).join(', ')}`);
  return summary;
};

export const seedAcademicStaffing = async () => {
  const schoolCode = process.argv.find((value) => value.startsWith('--schoolCode='))?.split('=')[1];
  const schools = await prisma.school.findMany({ where: { status: 'ACTIVE', ...(schoolCode ? { schoolCode } : {}) }, select: { id: true, schoolName: true, schoolCode: true } });
  const assignOnly = process.argv.includes('--assign-only');
  const results = []; for (const school of schools) results.push(await seedAcademicStaffingForSchool(school, { assignOnly })); return results;
};

export const disconnectAcademicStaffingSeed = () => prisma.$disconnect();

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) seedAcademicStaffing().catch((error) => { console.error(error); process.exitCode = 1; }).finally(disconnectAcademicStaffingSeed);
