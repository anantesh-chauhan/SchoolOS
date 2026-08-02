import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { DEFAULT_ACADEMIC_CONFIGURATION, isTeacherEligible, resolveAcademicContext } from '../services/academicStaffing.service.js';
import { DAYS, DAILY_TEMPLATE, CLASS_SLOT_CAPACITY, getTimetableLimits, getClassNumber, getScopedRequirements, validateRequirementPayload, getRequirementProgress } from './timetable.shared.js';

export const assignSlot = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { slotId } = req.params;
    const { subjectId, teacherId } = req.body;

    if (!subjectId) {
      return res.status(400).json({ success: false, message: 'subjectId is required' });
    }

    const slot = await prisma.timetableSlot.findFirst({
      where: { id: slotId, schoolId },
      include: {
        timetable: true,
        section: true,
        class: true,
      },
    });

    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    if (slot.slotType !== 'PERIOD') {
      return res.status(409).json({ success: false, message: 'Only period slots can be assigned' });
    }

    const [subject, sectionSubject, mappedAssignment] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, schoolId } }),
      prisma.sectionSubject.findFirst({ where: { sectionId: slot.sectionId, subjectId } }),
      prisma.teacherAssignment.findFirst({
        where: {
          schoolId,
          classId: slot.classId,
          sectionId: slot.sectionId,
          subjectId,
        },
      }),
    ]);

    const resolvedTeacherId = teacherId || mappedAssignment?.teacherId || null;

    const scopedRequirements = await getScopedRequirements({
      schoolId,
      classId: slot.classId,
      sectionId: slot.sectionId,
    });
    const requirement = scopedRequirements.rows.find((row) => row.subjectId === subjectId) || null;

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found in this school' });
    }

    if (!resolvedTeacherId) {
      return res.status(409).json({
        success: false,
        message: 'No teacher mapped for selected subject in this section. Assign teacher or pick teacher manually.',
      });
    }

    const teacher = await prisma.teacher.findFirst({ where: { id: resolvedTeacherId, schoolId, isActive: true, deletedAt: null }, include: { qualifications: true } });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found in this school' });
    }
    if (!isTeacherEligible({ teacher, subject, className: slot.class.className, requiresPractical: Boolean(subject.isLab) })) {
      return res.status(409).json({ success: false, message: 'Teacher is not qualified or class-level eligible for this subject' });
    }

    if (!sectionSubject) {
      return res.status(409).json({ success: false, message: 'Subject is not mapped to this section' });
    }

    const limits = await getTimetableLimits(schoolId, slot.timetable.academicYear);
    const [teacherClash, teacherDailyCount, teacherWeeklyCount, subjectWeeklyCount] = await Promise.all([
      prisma.timetableSlot.findFirst({
        where: {
          schoolId,
          teacherId: resolvedTeacherId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          id: { not: slot.id },
          subjectId: { not: null },
        },
      }),
      prisma.timetableSlot.count({
        where: {
          schoolId,
          teacherId: resolvedTeacherId,
          dayOfWeek: slot.dayOfWeek,
          slotType: 'PERIOD',
          subjectId: { not: null },
          id: { not: slot.id },
        },
      }),
      prisma.timetableSlot.count({
        where: {
          schoolId,
          teacherId: resolvedTeacherId,
          timetable: { academicYear: slot.timetable.academicYear },
          slotType: 'PERIOD',
          subjectId: { not: null },
          id: { not: slot.id },
        },
      }),
      prisma.timetableSlot.count({
        where: {
          schoolId,
          timetableId: slot.timetableId,
          subjectId,
          slotType: 'PERIOD',
          id: { not: slot.id },
        },
      }),
    ]);

    if (teacherClash) {
      return res.status(409).json({ success: false, message: 'Teacher clash detected at this time slot' });
    }

    if (teacherDailyCount >= limits.maximumTeacherPeriodsPerDay) {
      return res.status(409).json({ success: false, message: `Teacher daily load cannot exceed ${limits.maximumTeacherPeriodsPerDay} periods` });
    }

    if (teacherWeeklyCount >= Math.min(teacher.maximumPeriodsPerWeek || limits.maximumTeacherPeriodsPerWeek, limits.maximumTeacherPeriodsPerWeek)) {
      return res.status(409).json({ success: false, message: `Teacher maximum weekly load cannot exceed ${Math.min(teacher.maximumPeriodsPerWeek || limits.maximumTeacherPeriodsPerWeek, limits.maximumTeacherPeriodsPerWeek)} periods` });
    }

    if (requirement && subjectWeeklyCount >= requirement.periodsPerWeek) {
      return res.status(409).json({ success: false, message: 'Subject weekly requirement already fulfilled for this class-section timetable' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.teacherAssignment.upsert({
        where: {
          schoolId_classId_sectionId_subjectId: {
            schoolId,
            classId: slot.classId,
            sectionId: slot.sectionId,
            subjectId,
          },
        },
        update: {
          teacherId: resolvedTeacherId,
          isTemporary: false,
          effectiveTo: null,
        },
        create: {
          schoolId,
          classId: slot.classId,
          sectionId: slot.sectionId,
          subjectId,
          teacherId: resolvedTeacherId,
        },
      });

      return tx.timetableSlot.update({
        where: { id: slot.id },
        data: {
          subjectId,
          teacherId: resolvedTeacherId,
        },
        include: {
          subject: true,
          teacher: true,
        },
      });
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to assign slot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const resetSlot = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { slotId } = req.params;

    const slot = await prisma.timetableSlot.findFirst({ where: { id: slotId, schoolId } });
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    const updated = await prisma.timetableSlot.update({
      where: { id: slot.id },
      data: {
        subjectId: null,
        teacherId: null,
      },
      include: {
        subject: true,
        teacher: true,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reset slot assignment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const validateTimetable = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { id } = req.params;

    const timetable = await prisma.timetable.findFirst({ where: { id, schoolId } });
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }
    const limits = await getTimetableLimits(schoolId, timetable.academicYear);

    const [progress, teacherDailyLoadRows, teacherWeeklyLoadRows, emptyPeriodCount] = await Promise.all([
      getRequirementProgress(timetable),
      prisma.timetableSlot.groupBy({
        by: ['teacherId', 'dayOfWeek'],
        where: {
          schoolId,
          timetable: { academicYear: timetable.academicYear },
          slotType: 'PERIOD',
          teacherId: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.timetableSlot.groupBy({
        by: ['teacherId'],
        where: {
          schoolId,
          timetable: { academicYear: timetable.academicYear },
          slotType: 'PERIOD',
          teacherId: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.timetableSlot.count({
        where: {
          schoolId,
          timetableId: id,
          slotType: 'PERIOD',
          subjectId: null,
        },
      }),
    ]);

    const issues = [];

    for (const row of progress) {
      if (row.assigned < row.required) {
        issues.push({
          type: row.isMandatory ? 'MANDATORY_SUBJECT_UNDER_ASSIGNED' : 'OPTIONAL_SUBJECT_UNDER_ASSIGNED',
          message: `${row.subjectName}: assigned ${row.assigned}/${row.required}`,
        });
      }
    }

    for (const row of teacherDailyLoadRows) {
      if (row._count._all > limits.maximumTeacherPeriodsPerDay) {
        issues.push({
          type: 'TEACHER_DAILY_OVERLOAD',
          message: `Teacher ${row.teacherId} has ${row._count._all} periods on ${row.dayOfWeek}`,
        });
      }
    }

    for (const row of teacherWeeklyLoadRows) {
      if (row._count._all > limits.maximumTeacherPeriodsPerWeek) {
        issues.push({
          type: 'TEACHER_WEEKLY_OVERLOAD',
          message: `Teacher ${row.teacherId} has ${row._count._all} periods in the week`,
        });
      }
    }

    if (emptyPeriodCount > 0) {
      issues.push({
        type: 'EMPTY_SLOTS',
        message: `${emptyPeriodCount} period slots are unassigned`,
      });
    }

    return res.json({
      success: true,
      data: {
        progress,
        issues,
        isValid: issues.length === 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to validate timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
