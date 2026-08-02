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
import { bootstrapAcademicStructure } from './academicBootstrap.controller.js';

export const getDefaultAcademicTemplate = async (_req, res) => {
  return res.json({
    success: true,
    data: {
      levels: ACADEMIC_LEVELS,
      subjects: SUBJECT_MASTER,
      streams: STREAM_DEFINITIONS,
      activities: OPTIONAL_ACTIVITIES,
      periodTemplate: PERIOD_TEMPLATE,
      weekDays: WEEK_DAYS,
      classTemplates: CLASS_WEEKLY_SUBJECTS,
      scienceSplit: SCIENCE_COMPONENT_SPLIT,
    },
  });
};

export const pushDefaultTemplateToSchool = async (req, res) => bootstrapAcademicStructure(req, res);

export const listAcademicStructure = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const [levels, classes, subjects, streams, activities, periods, labRooms] = await Promise.all([
      prisma.academicLevel.findMany({ where: { schoolId, deletedAt: null }, orderBy: { displayOrder: 'asc' } }),
      prisma.class.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          sections: {
            where: { deletedAt: null },
            include: {
              stream: true,
              sectionSubjects: {
                include: { subject: true },
                orderBy: { createdAt: 'asc' },
              },
              subjectWeeklyRequirements: {
                include: { subject: true },
                orderBy: { subject: { subjectName: 'asc' } },
              },
              teacherAssignments: {
                where: { isActive: true },
                include: { teacher: true, subject: true },
                orderBy: { createdAt: 'asc' },
              },
              _count: {
                select: {
                  users: true,
                  sectionSubjects: true,
                  teacherAssignments: true,
                },
              },
            },
            orderBy: { sectionOrder: 'asc' },
          },
          academicLevel: true,
          classSubjects: {
            include: { subject: true },
            orderBy: { createdAt: 'asc' },
          },
          subjectWeeklyRequirements: {
            where: { sectionId: null },
            include: { subject: true },
            orderBy: { subject: { subjectName: 'asc' } },
          },
          teacherAssignments: {
            where: { isActive: true },
            include: { teacher: true, subject: true, section: true },
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: {
              sections: true,
              classSubjects: true,
              users: true,
            },
          },
        },
        orderBy: { classOrder: 'asc' },
      }),
      prisma.subject.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          childSubjects: true,
          subjectComponents: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.stream.findMany({
        where: { schoolId, deletedAt: null, isActive: true },
        include: {
          streamSubjects: {
            where: { deletedAt: null },
            include: { subject: true, subjectComponent: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.activity.findMany({ where: { schoolId, deletedAt: null }, orderBy: { displayOrder: 'asc' } }),
      prisma.periodDefinition.findMany({ where: { schoolId, deletedAt: null }, orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }] }),
      prisma.labRoom.findMany({ where: { schoolId, deletedAt: null, isActive: true }, orderBy: { roomName: 'asc' } }),
    ]);

    return res.json({
      success: true,
      data: {
        levels,
        classes,
        subjects,
        streams,
        activities,
        periods,
        labRooms,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch academic structure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const assignTeacherComponentLoads = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const {
      classId,
      sectionId,
      subjectId,
      components,
    } = req.body;

    if (!classId || !sectionId || !subjectId || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'classId, sectionId, subjectId and components[] are required',
      });
    }

    const requirement = await prisma.subjectWeeklyRequirement.findFirst({
      where: { schoolId, classId, sectionId, subjectId },
    }) || await prisma.subjectWeeklyRequirement.findFirst({
      where: { schoolId, classId, sectionId: null, subjectId },
    });

    const totalAssigned = components.reduce((acc, item) => acc + Number(item.periodsPerWeek || 0), 0);
    if (requirement && totalAssigned !== requirement.periodsPerWeek) {
      return res.status(409).json({
        success: false,
        message: `Teacher component load must equal subject weekly periods (${requirement.periodsPerWeek}). Received ${totalAssigned}.`,
      });
    }

    const teacherIds = [...new Set(components.map((item) => item.teacherId).filter(Boolean))];
    const existingTeachers = await prisma.teacher.findMany({ where: { schoolId, id: { in: teacherIds } }, select: { id: true } });
    if (existingTeachers.length !== teacherIds.length) {
      return res.status(404).json({ success: false, message: 'Some teacherIds are invalid for this school' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.teacherSubject.deleteMany({
        where: {
          schoolId,
          classId,
          sectionId,
          subjectId,
          deletedAt: null,
        },
      });

      await tx.teacherSubject.createMany({
        data: components.map((item) => ({
          schoolId,
          classId,
          sectionId,
          subjectId,
          teacherId: item.teacherId,
          subjectComponentId: item.subjectComponentId || null,
          periodsPerWeek: Number(item.periodsPerWeek),
        })),
      });
    });

    const rows = await prisma.teacherSubject.findMany({
      where: { schoolId, classId, sectionId, subjectId, deletedAt: null },
      include: { teacher: true, subjectComponent: true, subject: true },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to assign teacher component loads',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const upsertPeriodStructure = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { periods } = req.body;

    if (!Array.isArray(periods) || periods.length !== WEEK_DAYS.length * 8) {
      return res.status(400).json({
        success: false,
        message: 'periods[] must contain exactly 48 records (6 days x 8 periods)',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.periodDefinition.deleteMany({ where: { schoolId } });
      await tx.periodDefinition.createMany({
        data: periods.map((item) => ({
          schoolId,
          dayOfWeek: item.dayOfWeek,
          periodNumber: Number(item.periodNumber),
          startTime: item.startTime,
          endTime: item.endTime,
          isActivityPeriod: Boolean(item.isActivityPeriod),
        })),
      });
    });

    return res.json({ success: true, message: 'Period structure updated' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update period structure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
