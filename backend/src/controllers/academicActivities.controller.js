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
import { WEEKLY_TOTAL, getClassNumber, getClassTemplate, resolveStreamCodeBySectionName, sumPeriods, ensureExactWeeklyTotal } from './academicStructure.shared.js';

export const listActivities = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const activities = await prisma.activity.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: {
            enrollments: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return res.json({ success: true, data: activities });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to list activities',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const upsertActivity = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { name, code, capacity, displayOrder, isActive = true } = req.body;

    if (!name || !code || Number.isNaN(Number(capacity))) {
      return res.status(400).json({ success: false, message: 'name, code and capacity are required' });
    }

    const activity = await prisma.activity.upsert({
      where: {
        schoolId_code: {
          schoolId,
          code: String(code).trim().toUpperCase(),
        },
      },
      update: {
        name: String(name).trim(),
        capacity: Number(capacity),
        displayOrder: Number(displayOrder || 0),
        isActive: Boolean(isActive),
        deletedAt: null,
      },
      create: {
        schoolId,
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        capacity: Number(capacity),
        displayOrder: Number(displayOrder || 0),
        isActive: Boolean(isActive),
      },
    });

    return res.json({ success: true, data: activity });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to upsert activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const enrollStudentInActivity = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { activityId, studentId } = req.body;

    if (!activityId || !studentId) {
      return res.status(400).json({ success: false, message: 'activityId and studentId are required' });
    }

    const [activity, student] = await Promise.all([
      prisma.activity.findFirst({ where: { id: activityId, schoolId, deletedAt: null, isActive: true } }),
      prisma.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } }),
    ]);

    if (!activity || !student) {
      return res.status(404).json({ success: false, message: 'Activity or student not found' });
    }

    const currentCount = await prisma.activityEnrollment.count({
      where: { schoolId, activityId, deletedAt: null },
    });

    if (currentCount >= activity.capacity) {
      return res.status(409).json({ success: false, message: 'Activity capacity reached' });
    }

    const enrollment = await prisma.activityEnrollment.upsert({
      where: {
        schoolId_activityId_userId: {
          schoolId,
          activityId,
          userId: studentId,
        },
      },
      update: {
        deletedAt: null,
      },
      create: {
        schoolId,
        activityId,
        userId: studentId,
      },
    });

    return res.json({ success: true, data: enrollment });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to enroll student in activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const validateAcademicRules = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const issues = [];

    const weeklyRows = await prisma.subjectWeeklyRequirement.findMany({
      where: { schoolId },
      include: { class: true, section: true },
    });

    const bucket = new Map();
    for (const row of weeklyRows) {
      const key = `${row.classId}:${row.sectionId || 'CLASS'}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          className: row.class.className,
          sectionName: row.section?.sectionName || null,
          total: 0,
        });
      }
      const ref = bucket.get(key);
      ref.total += row.periodsPerWeek;
    }

    for (const [key, value] of bucket.entries()) {
      if (value.total !== WEEKLY_TOTAL) {
        issues.push({
          type: 'WEEKLY_TOTAL_INVALID',
          key,
          message: `${value.className}${value.sectionName ? `-${value.sectionName}` : ''} totals ${value.total}, expected ${WEEKLY_TOTAL}`,
        });
      }
    }

    const sameSubjectPerDay = await prisma.timetableSlot.groupBy({
      by: ['timetableId', 'dayOfWeek', 'subjectId'],
      where: {
        schoolId,
        slotType: 'PERIOD',
        subjectId: { not: null },
      },
      _count: { _all: true },
    });

    for (const row of sameSubjectPerDay) {
      if (row._count._all > 2) {
        issues.push({
          type: 'MAX_TWO_SAME_SUBJECT_PER_DAY',
          message: `Timetable ${row.timetableId} has subject ${row.subjectId} repeated ${row._count._all} times on ${row.dayOfWeek}`,
        });
      }
    }

    const teacherOverlap = await prisma.timetableSlot.groupBy({
      by: ['teacherId', 'dayOfWeek', 'startTime', 'endTime'],
      where: {
        schoolId,
        slotType: 'PERIOD',
        teacherId: { not: null },
      },
      _count: { _all: true },
    });

    for (const row of teacherOverlap) {
      if (row._count._all > 1) {
        issues.push({
          type: 'TEACHER_OVERLAP',
          message: `Teacher ${row.teacherId} overlaps at ${row.dayOfWeek} ${row.startTime}-${row.endTime}`,
        });
      }
    }

    const classOverlap = await prisma.timetableSlot.groupBy({
      by: ['classId', 'sectionId', 'dayOfWeek', 'startTime', 'endTime'],
      where: {
        schoolId,
        slotType: 'PERIOD',
      },
      _count: { _all: true },
    });

    for (const row of classOverlap) {
      if (row._count._all > 1) {
        issues.push({
          type: 'CLASS_OVERLAP',
          message: `Class ${row.classId}/${row.sectionId} overlaps at ${row.dayOfWeek} ${row.startTime}-${row.endTime}`,
        });
      }
    }

    const labSlots = await prisma.timetableSlot.findMany({
      where: {
        schoolId,
        slotType: 'PERIOD',
        OR: [
          { labRoomId: { not: null } },
          { subject: { isLab: true } },
        ],
      },
      include: {
        subject: true,
      },
      orderBy: [{ timetableId: 'asc' }, { dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    const groupedLab = new Map();
    for (const slot of labSlots) {
      const key = `${slot.timetableId}:${slot.dayOfWeek}:${slot.subjectId || 'NONE'}`;
      if (!groupedLab.has(key)) groupedLab.set(key, []);
      groupedLab.get(key).push(slot.periodNumber);
    }

    for (const [key, periods] of groupedLab.entries()) {
      const sorted = periods.filter(Boolean).sort((a, b) => a - b);
      let hasConsecutivePair = false;
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index] - sorted[index - 1] === 1) {
          hasConsecutivePair = true;
          break;
        }
      }
      if (!hasConsecutivePair && sorted.length > 0) {
        issues.push({
          type: 'LAB_NOT_CONSECUTIVE',
          message: `Lab booking is not consecutive for ${key}`,
        });
      }
    }

    const activityMismatch = await prisma.timetableSlot.findMany({
      where: {
        schoolId,
        slotType: 'PERIOD',
        OR: [
          {
            isActivityPeriod: true,
            subjectId: { not: null },
          },
          {
            isActivityPeriod: false,
            activityId: { not: null },
          },
        ],
      },
      select: { id: true, dayOfWeek: true, periodNumber: true, isActivityPeriod: true },
    });

    for (const row of activityMismatch) {
      issues.push({
        type: 'ACTIVITY_PERIOD_RULE_VIOLATION',
        message: `Slot ${row.id} violates activity optional period rule at ${row.dayOfWeek} period ${row.periodNumber}`,
      });
    }

    return res.json({
      success: true,
      data: {
        isValid: issues.length === 0,
        totalIssues: issues.length,
        issues,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to validate academic rules',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
