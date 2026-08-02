import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { DEFAULT_ACADEMIC_CONFIGURATION, isTeacherEligible, resolveAcademicContext } from '../services/academicStaffing.service.js';

export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export const DAILY_TEMPLATE = [
  { slotType: 'FIXED', slotLabel: 'Prayer', periodNumber: null, startTime: '08:00', endTime: '08:25' },
  { slotType: 'PERIOD', slotLabel: 'P1', periodNumber: 1, startTime: '08:25', endTime: '09:05' },
  { slotType: 'PERIOD', slotLabel: 'P2', periodNumber: 2, startTime: '09:05', endTime: '09:45' },
  { slotType: 'PERIOD', slotLabel: 'P3', periodNumber: 3, startTime: '09:45', endTime: '10:25' },
  { slotType: 'PERIOD', slotLabel: 'P4', periodNumber: 4, startTime: '10:25', endTime: '11:05' },
  { slotType: 'FIXED', slotLabel: 'Lunch', periodNumber: null, startTime: '11:05', endTime: '11:35' },
  { slotType: 'PERIOD', slotLabel: 'P5', periodNumber: 5, startTime: '11:35', endTime: '12:15' },
  { slotType: 'PERIOD', slotLabel: 'P6', periodNumber: 6, startTime: '12:15', endTime: '12:55' },
  { slotType: 'PERIOD', slotLabel: 'P7', periodNumber: 7, startTime: '12:55', endTime: '13:35' },
  { slotType: 'PERIOD', slotLabel: 'P8', periodNumber: 8, startTime: '13:35', endTime: '14:15' },
  { slotType: 'FIXED', slotLabel: 'Diary', periodNumber: null, startTime: '14:15', endTime: '14:25' },
];

export const CLASS_SLOT_CAPACITY = DAYS.length * 8;
export const getTimetableLimits = async (schoolId, academicYear) => {
  try {
    const session = await prisma.academicSession.findFirst({ where: { schoolId, name: academicYear } });
    return (await resolveAcademicContext(schoolId, session?.id)).config;
  } catch {
    return DEFAULT_ACADEMIC_CONFIGURATION;
  }
};

export const getClassNumber = (className) => {
  const match = String(className || '').match(/class\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

export const getScopedRequirements = async ({ schoolId, classId, sectionId }) => {
  if (sectionId) {
    const sectionRows = await prisma.subjectWeeklyRequirement.findMany({
      where: {
        schoolId,
        classId,
        sectionId,
      },
      include: { subject: true },
      orderBy: { subject: { subjectName: 'asc' } },
    });

    if (sectionRows.length > 0) {
      return {
        scope: 'SECTION',
        rows: sectionRows,
      };
    }
  }

  const classRows = await prisma.subjectWeeklyRequirement.findMany({
    where: {
      schoolId,
      classId,
      sectionId: null,
    },
    include: { subject: true },
    orderBy: { subject: { subjectName: 'asc' } },
  });

  return {
    scope: 'CLASS',
    rows: classRows,
  };
};

export const validateRequirementPayload = (className, requirements) => {
  const classNo = getClassNumber(className);
  let mandatoryCount = 0;
  let optionalCount = 0;
  let totalPeriods = 0;

  for (const row of requirements) {
    if (!row.subjectId || Number.isNaN(Number(row.periodsPerWeek))) {
      return 'subjectId and periodsPerWeek are required';
    }

    const periods = Number(row.periodsPerWeek);
    if (periods < 1) {
      return 'periodsPerWeek must be at least 1';
    }

    if (row.isMandatory && row.isOptional) {
      return 'A subject cannot be mandatory and optional at the same time';
    }

    totalPeriods += periods;
    if (row.isMandatory) mandatoryCount += 1;
    if (row.isOptional) optionalCount += 1;
  }

  if (totalPeriods > CLASS_SLOT_CAPACITY) {
    return `Total periods (${totalPeriods}) exceed weekly capacity (${CLASS_SLOT_CAPACITY})`;
  }

  if ([9, 10, 11, 12].includes(classNo)) {
    if (mandatoryCount < 5) {
      return 'For Class 9-12 at least 5 mandatory academic subjects are required';
    }
  }

  if ([9, 10, 11, 12].includes(classNo) && optionalCount > 2) {
    return 'Class 9-12 can have up to 2 optional/elective weekly requirements';
  }

  return null;
};

export const getRequirementProgress = async (timetable) => {
  const requirementResponse = await getScopedRequirements({
    schoolId: timetable.schoolId,
    classId: timetable.classId,
    sectionId: timetable.sectionId,
  });
  const requirements = requirementResponse.rows;

  const slots = await prisma.timetableSlot.findMany({
    where: {
      timetableId: timetable.id,
      slotType: 'PERIOD',
      subjectId: { not: null },
    },
    select: { subjectId: true },
  });

  const assignedCountBySubject = new Map();
  for (const row of slots) {
    assignedCountBySubject.set(row.subjectId, (assignedCountBySubject.get(row.subjectId) || 0) + 1);
  }

  return requirements.map((row) => ({
    subjectId: row.subjectId,
    subjectName: row.subject.subjectName,
    subjectCode: row.subject.subjectCode,
    required: row.periodsPerWeek,
    assigned: assignedCountBySubject.get(row.subjectId) || 0,
    isMandatory: row.isMandatory,
    isOptional: row.isOptional,
  }));
};
