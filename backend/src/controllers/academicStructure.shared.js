import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import {
  ACADEMIC_LEVELS,
  CLASS_NAMES,
  CLASS_WEEKLY_SUBJECTS,
  OPTIONAL_ACTIVITIES,
  PERIOD_TEMPLATE,
  SCIENCE_COMPONENT_SPLIT,
  SENIOR_SECTION_CATALOG,
  STREAM_DEFINITIONS,
  SUBJECT_MASTER,
  WEEK_DAYS,
} from '../constants/academicTemplate.js';

export const WEEKLY_TOTAL = 48;

export const getClassNumber = (className) => {
  const match = String(className || '').match(/class\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

export const getClassTemplate = (className) => {
  if (className === 'LKG') return CLASS_WEEKLY_SUBJECTS.LKG;
  if (className === 'UKG') return CLASS_WEEKLY_SUBJECTS.UKG;

  const classNo = getClassNumber(className);
  if (classNo >= 1 && classNo <= 5) return CLASS_WEEKLY_SUBJECTS.PRIMARY_1_5;
  if (classNo >= 6 && classNo <= 8) return CLASS_WEEKLY_SUBJECTS.MIDDLE_6_8;
  if (classNo >= 9 && classNo <= 10) return CLASS_WEEKLY_SUBJECTS.SECONDARY_9_10;

  return null;
};

export const resolveStreamCodeBySectionName = (sectionName) => {
  const name = String(sectionName || '').toUpperCase();
  if (name.startsWith('PCM')) return 'PCM';
  if (name.startsWith('PCB')) return 'PCB';
  if (name.startsWith('PCMB')) return 'PCMB';
  if (name.startsWith('COM')) return 'COM';
  if (name.startsWith('HUM')) return 'HUM';
  return null;
};

export const sumPeriods = (rows) => rows.reduce((acc, row) => acc + Number(row.periodsPerWeek || 0), 0);

export const ensureExactWeeklyTotal = (rows) => {
  const total = sumPeriods(rows);
  if (total !== WEEKLY_TOTAL) {
    throw new Error(`Weekly periods must total exactly ${WEEKLY_TOTAL}. Received ${total}.`);
  }
};
