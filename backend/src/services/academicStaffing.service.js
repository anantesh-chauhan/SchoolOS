import prisma from '../config/prisma.client.js';

export const DEFAULT_ACADEMIC_CONFIGURATION = Object.freeze({
  workingDaysPerWeek: 6,
  periodsPerDay: 8,
  totalPeriodsPerWeek: 48,
  defaultPeriodDurationMinutes: 40,
  shortBreakAfterPeriod: 2,
  lunchBreakAfterPeriod: 5,
  maximumTeacherPeriodsPerDay: 7,
  maximumTeacherPeriodsPerWeek: 36,
  minimumTeacherFreePeriodsWeek: 6,
  targetTeacherPeriodsPerWeek: 30,
  classTeacherRequired: true,
  classTeacherDutyPeriods: 1,
  prePrimaryAssistantRequired: false,
  primaryGeneralistModel: true,
  saturdayWorking: true,
  timetableGenerationEnabled: true,
});

const n = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const keyOf = (subject) => n(subject.subjectCode || subject.subjectName);

const DEFAULTS = {
  PRE_PRIMARY: { ENGLISH: 6, HINDI: 5, MATHEMATICS: 6, ENVIRONMENTAL_STUDIES: 4, ENVIRONMENTAL_AWARENESS: 4, RHYMES: 4, ART_CRAFT: 3, GENERAL_ACTIVITIES: 5, PHYSICAL_EDUCATION: 3, STORYTELLING: 2, LIFE_SKILLS: 2 },
  PRIMARY: { ENGLISH: 7, HINDI: 6, MATHEMATICS: 7, ENVIRONMENTAL_STUDIES: 6, COMPUTER: 2, GENERAL_KNOWLEDGE: 2, ART_CRAFT: 2, MUSIC: 1, PHYSICAL_EDUCATION: 2, LIBRARY: 1, MORAL_SCIENCE: 1 },
  MIDDLE: { ENGLISH: 6, HINDI: 5, MATHEMATICS: 7, SCIENCE: 7, SOCIAL_SCIENCE: 6, SANSKRIT: 4, COMPUTER: 2, PHYSICAL_EDUCATION: 2, ART_CRAFT: 1, MUSIC: 1, LIBRARY: 1, GENERAL_KNOWLEDGE: 1 },
  SECONDARY: { ENGLISH: 6, HINDI: 5, SANSKRIT: 5, MATHEMATICS: 7, SCIENCE: 8, SOCIAL_SCIENCE: 7, COMPUTER: 3, COMPUTER_APPLICATIONS: 3, PHYSICAL_EDUCATION: 2, ART_CRAFT: 1, LIBRARY: 1, VALUE_EDUCATION: 1 },
  SENIOR: { ENGLISH: 6, PHYSICS: 7, CHEMISTRY: 7, MATHEMATICS: 7, BIOLOGY: 7, COMPUTER_SCIENCE: 6, INFORMATICS_PRACTICES: 6, ACCOUNTANCY: 7, BUSINESS_STUDIES: 7, ECONOMICS: 7, HISTORY: 7, POLITICAL_SCIENCE: 7, GEOGRAPHY: 7, SOCIOLOGY: 6, PSYCHOLOGY: 6, PHYSICAL_EDUCATION: 4, LIBRARY: 1 },
};

const ALIASES = { ENG: 'ENGLISH', HIN: 'HINDI', MAT: 'MATHEMATICS', EVS: 'ENVIRONMENTAL_STUDIES', EAW: 'ENVIRONMENTAL_AWARENESS', COMP: 'COMPUTER', CB: 'COMPUTER', CA: 'COMPUTER_APPLICATIONS', SCI: 'SCIENCE', SST: 'SOCIAL_SCIENCE', SAN: 'SANSKRIT', PE: 'PHYSICAL_EDUCATION', ART: 'ART_CRAFT', ARTC: 'ART_CRAFT', MUS: 'MUSIC', GK: 'GENERAL_KNOWLEDGE', MS: 'MORAL_SCIENCE', PHY: 'PHYSICS', CHE: 'CHEMISTRY', BIO: 'BIOLOGY', CS: 'COMPUTER_SCIENCE', IP: 'INFORMATICS_PRACTICES', ACC: 'ACCOUNTANCY', BST: 'BUSINESS_STUDIES', ECO: 'ECONOMICS', HIS: 'HISTORY', POL: 'POLITICAL_SCIENCE', GEO: 'GEOGRAPHY', SOC: 'SOCIOLOGY', PSY: 'PSYCHOLOGY', LIB: 'LIBRARY' };

export const classBand = (className) => {
  const name = String(className || '').trim().toUpperCase();
  if (['NURSERY', 'LKG', 'UKG'].includes(name)) return 'PRE_PRIMARY';
  const value = Number(name.match(/(\d+)/)?.[1]);
  if (value <= 5) return 'PRIMARY';
  if (value <= 8) return 'MIDDLE';
  if (value <= 10) return 'SECONDARY';
  return 'SENIOR';
};

export const classNumber = (className) => {
  const band = classBand(className);
  if (band === 'PRE_PRIMARY') return 0;
  return Number(String(className || '').match(/(\d+)/)?.[1] || 0);
};

export const getSlotDefault = (className, subject) => {
  const band = classBand(className);
  const rawKey = keyOf(subject);
  const key = ALIASES[rawKey] || rawKey;
  const recommendedSlots = DEFAULTS[band][key] || (subject.subjectType === 'ACTIVITY' ? 1 : 4);
  const practical = Boolean(subject.isLab || subject.subjectType === 'LAB');
  return {
    minimumSlots: Math.max(1, recommendedSlots - 1),
    recommendedSlots,
    maximumSlots: recommendedSlots + 1,
    theorySlots: practical ? Math.max(0, recommendedSlots - 2) : recommendedSlots,
    practicalSlots: practical ? Math.min(2, recommendedSlots) : 0,
    labDoublePeriods: practical ? 1 : 0,
    isCore: subject.subjectType === 'CORE' && !subject.isOptional,
    isOptional: Boolean(subject.isOptional || subject.subjectType === 'OPTIONAL'),
    isActivity: subject.subjectType === 'ACTIVITY',
  };
};

export const calculateTeacherRequirement = (weeklyDemand, targetLoad = 30, availableCapacity = 0) => ({
  weeklyDemand,
  availableCapacity,
  capacityGap: Math.max(0, weeklyDemand - availableCapacity),
  additionalTeachersRequired: Math.ceil(Math.max(0, weeklyDemand - availableCapacity) / Math.max(1, targetLoad)),
  requiredTeacherCount: Math.ceil(weeklyDemand / Math.max(1, targetLoad)),
});

export const calculateWorkload = ({ teacher, allocations = [], classTeacherAssignments = [], config = DEFAULT_ACADEMIC_CONFIGURATION }) => {
  const byRole = (role) => allocations.filter((row) => row.assignmentType === role).reduce((sum, row) => sum + row.weeklySlots, 0);
  const subjectTeachingPeriods = allocations.filter((row) => !['PRACTICAL_TEACHER', 'REMEDIAL_TEACHER', 'ACTIVITY_TEACHER', 'SUBSTITUTE_TEACHER'].includes(row.assignmentType)).reduce((sum, row) => sum + row.theorySlots, 0);
  const practicalPeriods = allocations.reduce((sum, row) => sum + row.practicalSlots, 0);
  const classTeacherDutyPeriods = classTeacherAssignments.reduce((sum, row) => sum + row.dutyPeriods, 0);
  const remedialPeriods = byRole('REMEDIAL_TEACHER');
  const activityPeriods = byRole('ACTIVITY_TEACHER');
  const substitutePeriods = byRole('SUBSTITUTE_TEACHER');
  const totalAllocatedPeriods = allocations.reduce((sum, row) => sum + row.weeklySlots, 0) + classTeacherDutyPeriods;
  const targetPeriods = teacher.targetPeriodsPerWeek || config.targetTeacherPeriodsPerWeek;
  const maximumPeriods = teacher.maximumPeriodsPerWeek || config.maximumTeacherPeriodsPerWeek;
  const utilizationPercentage = targetPeriods ? Math.round((totalAllocatedPeriods / targetPeriods) * 100) : 0;
  const warningLevel = totalAllocatedPeriods > maximumPeriods ? 'OVERLOADED' : utilizationPercentage >= 110 ? 'NEAR_LIMIT' : utilizationPercentage < 60 ? 'UNDERUTILIZED' : 'BALANCED';
  return { teacherId: teacher.id, subjectTeachingPeriods, practicalPeriods, classTeacherDutyPeriods, remedialPeriods, activityPeriods, substitutePeriods, totalAllocatedPeriods, targetPeriods, maximumPeriods, remainingCapacity: Math.max(0, maximumPeriods - totalAllocatedPeriods), utilizationPercentage, assignedSections: [...new Set(allocations.map((row) => row.sectionId))], assignedSubjects: [...new Set(allocations.map((row) => row.subjectId))], warningLevel, warnings: warningLevel === 'BALANCED' ? [] : [warningLevel] };
};

export const isTeacherEligible = ({ teacher, subject, className, requiresPractical = false }) => {
  const grade = classNumber(className);
  const qualified = teacher.qualifications?.some((row) => row.subjectId === subject.id)
    || (teacher.subjectsHandled || []).some((value) => [n(subject.subjectName), n(subject.subjectCode)].includes(n(value)))
    || (grade <= 5 && ['PRE_PRIMARY', 'PRT'].includes(teacher.teacherCategory) && teacher.specialization?.toLowerCase().includes('general'));
  return Boolean(teacher.isActive && !teacher.deletedAt && qualified && grade >= teacher.eligibleClassFrom && grade <= teacher.eligibleClassTo && (!requiresPractical || teacher.canTeachPractical || teacher.qualifications?.some((row) => row.subjectId === subject.id && row.canTeachPractical)));
};

export const resolveAcademicContext = async (schoolId, academicSessionId, db = prisma) => {
  let session = academicSessionId ? await db.academicSession.findFirst({ where: { id: academicSessionId, schoolId } }) : null;
  if (!session) session = await db.academicSession.findFirst({ where: { schoolId, isActive: true }, orderBy: { startDate: 'desc' } });
  if (!session) throw Object.assign(new Error('No active academic session configured'), { statusCode: 409 });
  let config = await db.academicConfiguration.findUnique({ where: { academicSessionId: session.id } });
  if (!config) config = await db.academicConfiguration.create({ data: { schoolId, academicSessionId: session.id, ...DEFAULT_ACADEMIC_CONFIGURATION } });
  return { session, config };
};

export const getTeacherWorkloads = async ({ schoolId, academicSessionId, teacherId = null }, db = prisma) => {
  const { session, config } = await resolveAcademicContext(schoolId, academicSessionId, db);
  const teachers = await db.teacher.findMany({ where: { schoolId, isActive: true, deletedAt: null, ...(teacherId ? { id: teacherId } : {}) }, include: { qualifications: { include: { subject: true } } }, orderBy: { employeeId: 'asc' } });
  const [allocations, classTeachers] = await Promise.all([
    db.sectionSubjectAllocation.findMany({ where: { schoolId, academicSessionId: session.id, teacherId: { in: teachers.map((row) => row.id) }, status: { not: 'INACTIVE' } } }),
    db.sectionClassTeacherAssignment.findMany({ where: { schoolId, academicSessionId: session.id, teacherId: { in: teachers.map((row) => row.id) }, status: 'ACTIVE' } }),
  ]);
  return teachers.map((teacher) => ({ teacher, ...calculateWorkload({ teacher, allocations: allocations.filter((row) => row.teacherId === teacher.id), classTeacherAssignments: classTeachers.filter((row) => row.teacherId === teacher.id), config }) }));
};

export const runStaffingAudit = async ({ schoolId, academicSessionId }, db = prisma) => {
  const { session, config } = await resolveAcademicContext(schoolId, academicSessionId, db);
  const [sections, allocations, classTeachers, workloads, teachers] = await Promise.all([
    db.section.findMany({ where: { schoolId, deletedAt: null }, include: { class: true } }),
    db.sectionSubjectAllocation.findMany({ where: { schoolId, academicSessionId: session.id, status: { not: 'INACTIVE' } }, include: { subject: true, teacher: { include: { qualifications: true } }, section: true, class: true } }),
    db.sectionClassTeacherAssignment.findMany({ where: { schoolId, academicSessionId: session.id, status: 'ACTIVE', isPrimary: true }, include: { teacher: true, section: true } }),
    getTeacherWorkloads({ schoolId, academicSessionId: session.id }, db),
    db.teacher.findMany({ where: { schoolId, isActive: true, deletedAt: null }, include: { qualifications: true } }),
  ]);
  const errors = []; const warnings = [];
  const classTeacherSections = new Set(classTeachers.map((row) => row.sectionId));
  sections.filter((row) => !classTeacherSections.has(row.id)).forEach((row) => errors.push({ code: 'MISSING_CLASS_TEACHER', sectionId: row.id, message: `${row.class.className}-${row.sectionName} has no primary class teacher` }));
  allocations.filter((row) => !row.teacherId).forEach((row) => errors.push({ code: 'MISSING_SUBJECT_TEACHER', allocationId: row.id, subjectId: row.subjectId, message: `${row.class.className}-${row.section.sectionName}: ${row.subject.subjectName} needs a teacher` }));
  allocations.filter((row) => row.teacher && !isTeacherEligible({ teacher: row.teacher, subject: row.subject, className: row.class.className, requiresPractical: row.practicalSlots > 0 })).forEach((row) => errors.push({ code: 'INVALID_QUALIFICATION', allocationId: row.id, message: `${row.teacher.teacherName} is not eligible for ${row.subject.subjectName} in ${row.class.className}` }));
  allocations.filter((row) => row.teacher && (row.teacher.schoolId !== schoolId || row.section.schoolId !== schoolId || row.class.schoolId !== schoolId || row.subject.schoolId !== schoolId)).forEach((row) => errors.push({ code: 'CROSS_SCHOOL_ASSIGNMENT', allocationId: row.id, message: `Allocation ${row.id} contains a cross-school relation` }));
  classTeachers.filter((row) => row.teacher.schoolId !== schoolId || row.section.schoolId !== schoolId).forEach((row) => errors.push({ code: 'CROSS_SCHOOL_CLASS_TEACHER', assignmentId: row.id, message: `Class-teacher assignment ${row.id} contains a cross-school relation` }));
  const totals = new Map(); allocations.forEach((row) => totals.set(row.sectionId, (totals.get(row.sectionId) || 0) + row.weeklySlots));
  sections.filter((row) => (totals.get(row.id) || 0) > config.totalPeriodsPerWeek).forEach((row) => errors.push({ code: 'SECTION_PERIOD_OVERFLOW', sectionId: row.id, message: `${row.class.className}-${row.sectionName} exceeds ${config.totalPeriodsPerWeek} periods` }));
  workloads.filter((row) => row.totalAllocatedPeriods > row.maximumPeriods).forEach((row) => errors.push({ code: 'TEACHER_OVERLOADED', teacherId: row.teacherId, message: `${row.teacher.teacherName} has ${row.totalAllocatedPeriods}/${row.maximumPeriods} periods` }));
  workloads.filter((row) => row.warningLevel === 'UNDERUTILIZED').forEach((row) => warnings.push({ code: 'TEACHER_UNDERUTILIZED', teacherId: row.teacherId, message: `${row.teacher.teacherName} is at ${row.utilizationPercentage}% target utilization` }));
  const demandBySubject = new Map(); allocations.forEach((row) => { const current = demandBySubject.get(row.subjectId) || { subject: row.subject, demand: 0, classNames: new Set() }; current.demand += row.weeklySlots; current.classNames.add(row.class.className); demandBySubject.set(row.subjectId, current); });
  const suggestedTeacherRequirements = [...demandBySubject.values()].map(({ subject, demand, classNames }) => {
    const availableCapacity = teachers.filter((teacher) => [...classNames].some((className) => isTeacherEligible({ teacher, subject, className }))).reduce((sum, teacher) => sum + teacher.targetPeriodsPerWeek, 0);
    return { subjectId: subject.id, subject: subject.subjectName, ...calculateTeacherRequirement(demand, config.targetTeacherPeriodsPerWeek, availableCapacity) };
  }).filter((row) => row.capacityGap > 0);
  return { isValid: errors.length === 0, errors, warnings, summary: { sections: sections.length, allocations: allocations.length, assignedAllocations: allocations.filter((row) => row.teacherId).length, classTeachers: classTeachers.length, teachers: teachers.length, totalErrors: errors.length, totalWarnings: warnings.length }, unassignedSections: errors.filter((row) => row.code === 'MISSING_CLASS_TEACHER'), unassignedSubjects: errors.filter((row) => row.code === 'MISSING_SUBJECT_TEACHER'), overloadedTeachers: errors.filter((row) => row.code === 'TEACHER_OVERLOADED'), underutilizedTeachers: warnings.filter((row) => row.code === 'TEACHER_UNDERUTILIZED'), suggestedTeacherRequirements };
};

export const selectBestTeacher = ({ teachers, subject, className, requiresPractical, loadByTeacher, sectionTeacherIds = new Set() }) => teachers
  .filter((teacher) => isTeacherEligible({ teacher, subject, className, requiresPractical }))
  .filter((teacher) => (loadByTeacher.get(teacher.id) || 0) < teacher.maximumPeriodsPerWeek)
  .sort((a, b) => {
    const score = (teacher) => (teacher.qualifications.some((row) => row.subjectId === subject.id && row.isPreferred) ? 100 : 80) + (sectionTeacherIds.has(teacher.id) ? 15 : 0) - (loadByTeacher.get(teacher.id) || 0) * 2;
    return score(b) - score(a) || a.employeeId.localeCompare(b.employeeId);
  })[0] || null;
