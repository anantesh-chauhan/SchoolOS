import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';

const prisma = new PrismaClient();

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAILY_TEMPLATE = [
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

const CLASS_SLOT_CAPACITY = DAYS.length * 8;

const getClassNumber = (className) => {
  const match = String(className || '').match(/class\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

const getScopedRequirements = async ({ schoolId, classId, sectionId }) => {
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

const validateRequirementPayload = (className, requirements) => {
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
    if (mandatoryCount !== 5 || optionalCount !== 1 || requirements.length !== 6) {
      return 'For Class 9-12 exactly 5 mandatory subjects and 1 optional subject are required';
    }
  }

  if (optionalCount > 1) {
    return 'Only one optional subject is allowed';
  }

  return null;
};

const getRequirementProgress = async (timetable) => {
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

export const upsertWeeklyRequirements = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { classId, sectionId, requirements } = req.body;

    if (!classId || !Array.isArray(requirements)) {
      return res.status(400).json({ success: false, message: 'classId and requirements[] are required' });
    }

    const classRow = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!classRow) {
      return res.status(404).json({ success: false, message: 'Class not found for this school' });
    }

    if (sectionId) {
      const sectionRow = await prisma.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          classId,
        },
      });

      if (!sectionRow) {
        return res.status(404).json({ success: false, message: 'Section not found for this class in school' });
      }
    }

    const payloadError = validateRequirementPayload(classRow.className, requirements);
    if (payloadError) {
      return res.status(409).json({ success: false, message: payloadError });
    }

    const subjectIds = [...new Set(requirements.map((row) => row.subjectId))];
    const [subjects, mappedScopeSubjects] = await Promise.all([
      prisma.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true } }),
      sectionId
        ? prisma.sectionSubject.findMany({ where: { sectionId, subjectId: { in: subjectIds } }, select: { subjectId: true } })
        : prisma.classSubject.findMany({ where: { classId, subjectId: { in: subjectIds } }, select: { subjectId: true } }),
    ]);

    if (subjects.length !== subjectIds.length) {
      return res.status(404).json({ success: false, message: 'Some subjects are invalid for this school' });
    }

    const scopedSubjectIdSet = new Set(mappedScopeSubjects.map((row) => row.subjectId));
    if (!subjectIds.every((id) => scopedSubjectIdSet.has(id))) {
      return res.status(409).json({ success: false, message: sectionId
        ? 'All requirements subjects must be assigned to the selected section first'
        : 'All requirements subjects must be assigned to class first' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.subjectWeeklyRequirement.deleteMany({ where: { schoolId, classId, sectionId: sectionId || null } });
      await tx.subjectWeeklyRequirement.createMany({
        data: requirements.map((row) => ({
          schoolId,
          classId,
          sectionId: sectionId || null,
          subjectId: row.subjectId,
          periodsPerWeek: Number(row.periodsPerWeek),
          isMandatory: Boolean(row.isMandatory),
          isOptional: Boolean(row.isOptional),
        })),
      });
    });

    const saved = await prisma.subjectWeeklyRequirement.findMany({
      where: { schoolId, classId, sectionId: sectionId || null },
      include: { subject: true },
      orderBy: { subject: { subjectName: 'asc' } },
    });

    return res.json({
      success: true,
      scope: sectionId ? 'SECTION' : 'CLASS',
      data: saved,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to save weekly requirements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const propagateClassTemplateToSections = async (tx, { schoolId, classId }) => {
  const [sections, classTemplate] = await Promise.all([
    tx.section.findMany({
      where: { schoolId, classId },
      select: { id: true, sectionName: true },
      orderBy: { sectionOrder: 'asc' },
    }),
    tx.subjectWeeklyRequirement.findMany({
      where: { schoolId, classId, sectionId: null },
      select: {
        subjectId: true,
        periodsPerWeek: true,
        isMandatory: true,
        isOptional: true,
      },
    }),
  ]);

  if (classTemplate.length === 0) {
    return { classId, appliedSections: 0, skippedSections: sections.length, reason: 'No class-level weekly template found' };
  }

  let appliedSections = 0;
  let skippedSections = 0;

  for (const section of sections) {
    const sectionSubjects = await tx.sectionSubject.findMany({
      where: { sectionId: section.id },
      select: { subjectId: true },
    });
    const sectionSubjectSet = new Set(sectionSubjects.map((row) => row.subjectId));

    const scopedTemplate = classTemplate.filter((row) => sectionSubjectSet.has(row.subjectId));
    if (scopedTemplate.length === 0) {
      skippedSections += 1;
      continue;
    }

    await tx.subjectWeeklyRequirement.deleteMany({
      where: { schoolId, classId, sectionId: section.id },
    });

    await tx.subjectWeeklyRequirement.createMany({
      data: scopedTemplate.map((row) => ({
        schoolId,
        classId,
        sectionId: section.id,
        subjectId: row.subjectId,
        periodsPerWeek: row.periodsPerWeek,
        isMandatory: row.isMandatory,
        isOptional: row.isOptional,
      })),
    });

    appliedSections += 1;
  }

  return { classId, appliedSections, skippedSections };
};

export const propagateWeeklyRequirements = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { classId, applyToAllClasses = false } = req.body;

    if (!applyToAllClasses && !classId) {
      return res.status(400).json({
        success: false,
        message: 'classId is required unless applyToAllClasses=true',
      });
    }

    const classIds = applyToAllClasses
      ? (await prisma.class.findMany({ where: { schoolId }, select: { id: true } })).map((row) => row.id)
      : [classId];

    const summary = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const currentClassId of classIds) {
        const result = await propagateClassTemplateToSections(tx, {
          schoolId,
          classId: currentClassId,
        });
        rows.push(result);
      }
      return rows;
    });

    return res.json({
      success: true,
      data: {
        classesProcessed: summary.length,
        summary,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to propagate weekly requirements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listWeeklyRequirements = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { classId, sectionId } = req.query;

    if (!classId) {
      return res.status(400).json({ success: false, message: 'classId is required' });
    }

    const response = await getScopedRequirements({
      schoolId,
      classId,
      sectionId,
    });

    return res.json({ success: true, scope: response.scope, data: response.rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly requirements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createTimetable = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { classId, sectionId, academicYear } = req.body;

    if (!classId || !sectionId || !academicYear) {
      return res.status(400).json({ success: false, message: 'classId, sectionId and academicYear are required' });
    }

    const section = await prisma.section.findFirst({ where: { id: sectionId, classId, schoolId } });
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found for class in this school' });
    }

    const exists = await prisma.timetable.findFirst({ where: { schoolId, classId, sectionId, academicYear } });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Timetable already exists for class-section-academic year' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const timetable = await tx.timetable.create({
        data: {
          schoolId,
          classId,
          sectionId,
          academicYear,
        },
      });

      const slotRows = [];
      for (const day of DAYS) {
        for (let sequence = 0; sequence < DAILY_TEMPLATE.length; sequence += 1) {
          const tpl = DAILY_TEMPLATE[sequence];
          slotRows.push({
            timetableId: timetable.id,
            schoolId,
            classId,
            sectionId,
            dayOfWeek: day,
            periodNumber: tpl.periodNumber,
            sequenceOrder: sequence + 1,
            slotType: tpl.slotType,
            slotLabel: tpl.slotLabel,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
          });
        }
      }

      await tx.timetableSlot.createMany({ data: slotRows });
      return timetable;
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listTimetables = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { classId, sectionId, academicYear } = req.query;

    const rows = await prisma.timetable.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
      include: {
        class: { select: { id: true, className: true, classOrder: true } },
        section: { select: { id: true, sectionName: true, sectionOrder: true } },
      },
      orderBy: [{ class: { classOrder: 'asc' } }, { section: { sectionOrder: 'asc' } }],
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch timetables',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getTimetableBody = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { id } = req.params;

    const timetable = await prisma.timetable.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        section: true,
        slots: {
          include: {
            subject: true,
            teacher: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { sequenceOrder: 'asc' }],
        },
      },
    });

    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    const requirementProgress = await getRequirementProgress(timetable);
    const [sectionSubjects, teachers] = await Promise.all([
      prisma.sectionSubject.findMany({
        where: { sectionId: timetable.sectionId },
        include: { subject: true },
        orderBy: { subject: { subjectName: 'asc' } },
      }),
      prisma.teacher.findMany({
        where: { schoolId: timetable.schoolId },
        orderBy: { teacherName: 'asc' },
      }),
    ]);

    const teacherAssignments = await prisma.teacherAssignment.findMany({
      where: {
        schoolId: timetable.schoolId,
        classId: timetable.classId,
        sectionId: timetable.sectionId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            teacherName: true,
            employeeId: true,
            specialization: true,
          },
        },
        subject: {
          select: {
            id: true,
            subjectName: true,
            subjectCode: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: {
        timetable,
        dayOrder: DAYS,
        requirementProgress,
        availableSubjects: sectionSubjects.map((row) => row.subject),
        availableTeachers: teachers,
        sectionTeacherAssignments: teacherAssignments,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable body',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

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

    const teacher = await prisma.teacher.findFirst({ where: { id: resolvedTeacherId, schoolId } });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found in this school' });
    }

    if (!sectionSubject) {
      return res.status(409).json({ success: false, message: 'Subject is not mapped to this section' });
    }

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
          timetableId: slot.timetableId,
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

    if (teacherDailyCount >= 6) {
      return res.status(409).json({ success: false, message: 'Teacher daily load cannot exceed 6 periods' });
    }

    if (teacherWeeklyCount >= 7) {
      return res.status(409).json({ success: false, message: 'Teacher maximum weekly load cannot exceed 7 periods in this timetable' });
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

    const [progress, teacherDailyLoadRows, teacherWeeklyLoadRows, emptyPeriodCount] = await Promise.all([
      getRequirementProgress(timetable),
      prisma.timetableSlot.groupBy({
        by: ['teacherId', 'dayOfWeek'],
        where: {
          schoolId,
          timetableId: id,
          slotType: 'PERIOD',
          teacherId: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.timetableSlot.groupBy({
        by: ['teacherId'],
        where: {
          schoolId,
          timetableId: id,
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
      if (row._count._all > 6) {
        issues.push({
          type: 'TEACHER_DAILY_OVERLOAD',
          message: `Teacher ${row.teacherId} has ${row._count._all} periods on ${row.dayOfWeek}`,
        });
      }
    }

    for (const row of teacherWeeklyLoadRows) {
      if (row._count._all > 7) {
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

export const getReconciliationReport = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const classIdFilter = req.query.classId ? String(req.query.classId) : null;
    const sectionIdFilter = req.query.sectionId ? String(req.query.sectionId) : null;
    const academicYearFilter = req.query.academicYear ? String(req.query.academicYear) : null;

    const sections = await prisma.section.findMany({
      where: {
        schoolId,
        ...(classIdFilter ? { classId: classIdFilter } : {}),
        ...(sectionIdFilter ? { id: sectionIdFilter } : {}),
      },
      include: {
        class: {
          select: { id: true, className: true, classOrder: true },
        },
      },
      orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }],
    });

    const results = [];
    let totalIssues = 0;

    for (const section of sections) {
      const [sectionSubjectsRows, classSubjectsRows, teacherAssignmentsRows, requirementResponse, timetables] = await Promise.all([
        prisma.sectionSubject.findMany({
          where: { sectionId: section.id },
          include: { subject: true },
        }),
        prisma.classSubject.findMany({
          where: { classId: section.classId },
          include: { subject: true },
        }),
        prisma.teacherAssignment.findMany({
          where: {
            schoolId,
            classId: section.classId,
            sectionId: section.id,
          },
          include: {
            subject: true,
            teacher: true,
          },
        }),
        getScopedRequirements({
          schoolId,
          classId: section.classId,
          sectionId: section.id,
        }),
        prisma.timetable.findMany({
          where: {
            schoolId,
            classId: section.classId,
            sectionId: section.id,
            ...(academicYearFilter ? { academicYear: academicYearFilter } : {}),
          },
          include: {
            slots: true,
          },
        }),
      ]);

      const sectionSubjectMap = new Map(sectionSubjectsRows.map((row) => [row.subjectId, row.subject]));
      const classSubjectSet = new Set(classSubjectsRows.map((row) => row.subjectId));
      const teacherAssignmentBySubject = new Map(teacherAssignmentsRows.map((row) => [row.subjectId, row]));
      const requirements = requirementResponse.rows;
      const requirementBySubject = new Map(requirements.map((row) => [row.subjectId, row]));

      const issues = [];

      for (const subjectId of sectionSubjectMap.keys()) {
        if (!classSubjectSet.has(subjectId)) {
          const subject = sectionSubjectMap.get(subjectId);
          issues.push({
            type: 'SECTION_SUBJECT_NOT_IN_CLASS',
            message: `${subject.subjectName} exists in section but missing at class level`,
          });
        }

        if (!teacherAssignmentBySubject.has(subjectId)) {
          const subject = sectionSubjectMap.get(subjectId);
          issues.push({
            type: 'MISSING_TEACHER_ASSIGNMENT',
            message: `${subject.subjectName} has no teacher mapping`,
          });
        }

        if (!requirementBySubject.has(subjectId)) {
          const subject = sectionSubjectMap.get(subjectId);
          issues.push({
            type: 'MISSING_WEEKLY_REQUIREMENT',
            message: `${subject.subjectName} has no weekly requirement`,
          });
        }
      }

      for (const assignment of teacherAssignmentsRows) {
        if (!sectionSubjectMap.has(assignment.subjectId)) {
          issues.push({
            type: 'ASSIGNMENT_SUBJECT_NOT_IN_SECTION',
            message: `${assignment.subject.subjectName} assigned to ${assignment.teacher.teacherName} but not mapped to section`,
          });
        }
      }

      for (const timetable of timetables) {
        const periodSlots = timetable.slots.filter((slot) => slot.slotType === 'PERIOD');
        const subjectCountById = new Map();

        for (const slot of periodSlots) {
          if (!slot.subjectId) {
            continue;
          }
          subjectCountById.set(slot.subjectId, (subjectCountById.get(slot.subjectId) || 0) + 1);

          const mappedAssignment = teacherAssignmentBySubject.get(slot.subjectId);
          if (!mappedAssignment) {
            issues.push({
              type: 'TIMETABLE_SUBJECT_WITHOUT_ASSIGNMENT',
              message: `Timetable ${timetable.academicYear}: slot subject has no teacher assignment`,
            });
          } else if (slot.teacherId && mappedAssignment.teacherId !== slot.teacherId) {
            issues.push({
              type: 'TIMETABLE_TEACHER_MISMATCH',
              message: `Timetable ${timetable.academicYear}: slot teacher differs from section teacher mapping for ${mappedAssignment.subject.subjectName}`,
            });
          }
        }

        for (const requirement of requirements) {
          const assigned = subjectCountById.get(requirement.subjectId) || 0;
          if (assigned < requirement.periodsPerWeek) {
            issues.push({
              type: 'WEEKLY_REQUIREMENT_UNDERSERVED',
              message: `Timetable ${timetable.academicYear}: ${requirement.subject.subjectName} assigned ${assigned}/${requirement.periodsPerWeek}`,
            });
          }
        }
      }

      totalIssues += issues.length;
      results.push({
        classId: section.classId,
        className: section.class.className,
        sectionId: section.id,
        sectionName: section.sectionName,
        totalSectionSubjects: sectionSubjectMap.size,
        totalTeacherAssignments: teacherAssignmentsRows.length,
        requirementScope: requirementResponse.scope,
        totalRequirements: requirements.length,
        timetableCount: timetables.length,
        issues,
        isCompliant: issues.length === 0,
      });
    }

    return res.json({
      success: true,
      data: {
        summary: {
          sectionsChecked: results.length,
          compliantSections: results.filter((row) => row.isCompliant).length,
          nonCompliantSections: results.filter((row) => !row.isCompliant).length,
          totalIssues,
        },
        sections: results,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate reconciliation report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
