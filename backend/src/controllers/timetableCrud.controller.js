import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { DEFAULT_ACADEMIC_CONFIGURATION, isTeacherEligible, resolveAcademicContext } from '../services/academicStaffing.service.js';
import { DAYS, DAILY_TEMPLATE, CLASS_SLOT_CAPACITY, getTimetableLimits, getClassNumber, getScopedRequirements, validateRequirementPayload, getRequirementProgress } from './timetable.shared.js';

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
