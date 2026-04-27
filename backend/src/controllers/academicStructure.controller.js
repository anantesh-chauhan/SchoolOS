import { PrismaClient } from '@prisma/client';
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

const prisma = new PrismaClient();

const WEEKLY_TOTAL = 48;

const getClassNumber = (className) => {
  const match = String(className || '').match(/class\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

const getClassTemplate = (className) => {
  if (className === 'LKG') return CLASS_WEEKLY_SUBJECTS.LKG;
  if (className === 'UKG') return CLASS_WEEKLY_SUBJECTS.UKG;

  const classNo = getClassNumber(className);
  if (classNo >= 1 && classNo <= 5) return CLASS_WEEKLY_SUBJECTS.PRIMARY_1_5;
  if (classNo >= 6 && classNo <= 8) return CLASS_WEEKLY_SUBJECTS.MIDDLE_6_8;
  if (classNo >= 9 && classNo <= 10) return CLASS_WEEKLY_SUBJECTS.SECONDARY_9_10;

  return null;
};

const resolveStreamCodeBySectionName = (sectionName) => {
  const name = String(sectionName || '').toUpperCase();
  if (name.startsWith('PCM')) return 'PCM';
  if (name.startsWith('PCB')) return 'PCB';
  if (name.startsWith('PCMB')) return 'PCMB';
  if (name.startsWith('COM')) return 'COM';
  if (name.startsWith('HUM')) return 'HUM';
  return null;
};

const sumPeriods = (rows) => rows.reduce((acc, row) => acc + Number(row.periodsPerWeek || 0), 0);

const ensureExactWeeklyTotal = (rows) => {
  const total = sumPeriods(rows);
  if (total !== WEEKLY_TOTAL) {
    throw new Error(`Weekly periods must total exactly ${WEEKLY_TOTAL}. Received ${total}.`);
  }
};

export const bootstrapAcademicStructure = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    const result = await prisma.$transaction(async (tx) => {
      for (const level of ACADEMIC_LEVELS) {
        await tx.academicLevel.upsert({
          where: {
            schoolId_code: {
              schoolId,
              code: level.code,
            },
          },
          update: {
            name: level.name,
            minClassOrder: level.minClassOrder,
            maxClassOrder: level.maxClassOrder,
            displayOrder: level.displayOrder,
            isDefaultTemplate: false,
            deletedAt: null,
          },
          create: {
            schoolId,
            code: level.code,
            name: level.name,
            minClassOrder: level.minClassOrder,
            maxClassOrder: level.maxClassOrder,
            displayOrder: level.displayOrder,
          },
        });
      }

      const levels = await tx.academicLevel.findMany({ where: { schoolId } });
      const levelByRange = levels.map((item) => ({
        id: item.id,
        minClassOrder: item.minClassOrder,
        maxClassOrder: item.maxClassOrder,
      }));

      const classes = await tx.class.findMany({ where: { schoolId } });
      const classByName = new Map(classes.map((item) => [item.className, item]));

      for (const className of CLASS_NAMES) {
        if (!classByName.has(className)) {
          const classOrder = className === 'LKG' ? 1 : className === 'UKG' ? 2 : Number(className.replace('Class ', '')) + 2;
          const created = await tx.class.create({
            data: {
              schoolId,
              className,
              classOrder,
            },
          });
          classByName.set(className, created);
        }
      }

      for (const classRow of classByName.values()) {
        const level = levelByRange.find((item) => classRow.classOrder >= item.minClassOrder && classRow.classOrder <= item.maxClassOrder);
        if (level) {
          await tx.class.update({
            where: { id: classRow.id },
            data: { academicLevelId: level.id },
          });
        }
      }

      const existingSubjects = await tx.subject.findMany({ where: { schoolId } });
      const subjectByCode = new Map(existingSubjects.map((subject) => [subject.subjectCode, subject]));

      for (const definition of SUBJECT_MASTER) {
        const subject = await tx.subject.upsert({
          where: {
            schoolId_subjectCode: {
              schoolId,
              subjectCode: definition.code,
            },
          },
          update: {
            subjectName: definition.name,
            subjectType: definition.subjectType,
            isLab: definition.isLab,
            isOptional: definition.isOptional,
            displayOrder: definition.displayOrder,
            deletedAt: null,
          },
          create: {
            schoolId,
            subjectName: definition.name,
            subjectCode: definition.code,
            subjectType: definition.subjectType,
            isLab: definition.isLab,
            isOptional: definition.isOptional,
            displayOrder: definition.displayOrder,
          },
        });
        subjectByCode.set(definition.code, subject);
      }

      for (const definition of SUBJECT_MASTER.filter((item) => item.parentCode)) {
        const current = subjectByCode.get(definition.code);
        const parent = subjectByCode.get(definition.parentCode);
        if (current && parent && current.parentSubjectId !== parent.id) {
          await tx.subject.update({
            where: { id: current.id },
            data: { parentSubjectId: parent.id },
          });
        }
      }

      for (const classRow of classByName.values()) {
        const template = getClassTemplate(classRow.className);
        if (!template) continue;

        ensureExactWeeklyTotal(template);

        await tx.classSubject.deleteMany({ where: { classId: classRow.id } });
        await tx.subjectWeeklyRequirement.deleteMany({ where: { schoolId, classId: classRow.id, sectionId: null } });

        const classSubjects = [];
        const weeklyRows = [];

        for (const item of template) {
          const subject = existingSubjects.find((subjectRow) => subjectRow.subjectName === item.name)
            || subjectByCode.get(SUBJECT_MASTER.find((subjectRow) => subjectRow.name === item.name)?.code || '');
          if (!subject) continue;

          classSubjects.push({
            classId: classRow.id,
            subjectId: subject.id,
            periodsPerWeek: item.periodsPerWeek,
            isOptional: Boolean(item.isOptional),
          });

          weeklyRows.push({
            schoolId,
            classId: classRow.id,
            sectionId: null,
            subjectId: subject.id,
            periodsPerWeek: item.periodsPerWeek,
            isMandatory: !item.isOptional,
            isOptional: Boolean(item.isOptional),
          });
        }

        if (classSubjects.length > 0) {
          await tx.classSubject.createMany({ data: classSubjects, skipDuplicates: true });
          await tx.subjectWeeklyRequirement.createMany({ data: weeklyRows, skipDuplicates: true });
        }
      }

      const scienceSubject = await tx.subject.findFirst({ where: { schoolId, subjectCode: 'SCI' } });
      if (scienceSubject) {
        for (const component of SCIENCE_COMPONENT_SPLIT) {
          await tx.subjectComponent.upsert({
            where: {
              schoolId_subjectId_code: {
                schoolId,
                subjectId: scienceSubject.id,
                code: component.code,
              },
            },
            update: {
              name: component.componentName,
              periodsPerWeek: component.periodsPerWeek,
              displayOrder: component.displayOrder,
              deletedAt: null,
            },
            create: {
              schoolId,
              subjectId: scienceSubject.id,
              code: component.code,
              name: component.componentName,
              periodsPerWeek: component.periodsPerWeek,
              displayOrder: component.displayOrder,
              isLab: false,
            },
          });
        }
      }

      for (const stream of STREAM_DEFINITIONS) {
        const streamRow = await tx.stream.upsert({
          where: {
            schoolId_code: {
              schoolId,
              code: stream.code,
            },
          },
          update: {
            name: stream.name,
            classFrom: 11,
            classTo: 12,
            isActive: true,
            deletedAt: null,
          },
          create: {
            schoolId,
            code: stream.code,
            name: stream.name,
            classFrom: 11,
            classTo: 12,
          },
        });

        ensureExactWeeklyTotal(stream.subjects);

        await tx.streamSubject.deleteMany({ where: { streamId: streamRow.id } });

        const streamRows = stream.subjects
          .map((subjectItem) => {
            const subject = subjectByCode.get(subjectItem.code);
            if (!subject) return null;
            return {
              schoolId,
              streamId: streamRow.id,
              subjectId: subject.id,
              periodsPerWeek: subjectItem.periodsPerWeek,
              isMandatory: Boolean(subjectItem.isMandatory),
              isOptional: Boolean(subjectItem.isOptional),
              displayOrder: subjectItem.displayOrder,
            };
          })
          .filter(Boolean);

        if (streamRows.length > 0) {
          await tx.streamSubject.createMany({ data: streamRows });
        }
      }

      const seniorClasses = await tx.class.findMany({
        where: {
          schoolId,
          className: { in: ['Class 11', 'Class 12'] },
        },
      });

      const streamByCode = new Map((await tx.stream.findMany({ where: { schoolId } })).map((item) => [item.code, item]));

      for (const classRow of seniorClasses) {
        for (let index = 0; index < SENIOR_SECTION_CATALOG.length; index += 1) {
          const sectionName = SENIOR_SECTION_CATALOG[index];
          let section = await tx.section.findFirst({ where: { schoolId, classId: classRow.id, sectionName } });
          if (!section) {
            section = await tx.section.create({
              data: {
                schoolId,
                classId: classRow.id,
                sectionName,
                sectionOrder: index + 1,
              },
            });
          }

          const streamCode = resolveStreamCodeBySectionName(sectionName);
          const stream = streamCode ? streamByCode.get(streamCode) : null;
          if (!stream) continue;

          await tx.section.update({ where: { id: section.id }, data: { streamId: stream.id } });

          const streamSubjects = await tx.streamSubject.findMany({ where: { streamId: stream.id } });
          await tx.sectionSubject.deleteMany({ where: { sectionId: section.id } });
          await tx.subjectWeeklyRequirement.deleteMany({ where: { schoolId, classId: classRow.id, sectionId: section.id } });

          if (streamSubjects.length > 0) {
            await tx.sectionSubject.createMany({
              data: streamSubjects.map((item) => ({
                sectionId: section.id,
                subjectId: item.subjectId,
              })),
              skipDuplicates: true,
            });

            await tx.subjectWeeklyRequirement.createMany({
              data: streamSubjects.map((item) => ({
                schoolId,
                classId: classRow.id,
                sectionId: section.id,
                subjectId: item.subjectId,
                periodsPerWeek: item.periodsPerWeek,
                isMandatory: item.isMandatory,
                isOptional: item.isOptional,
              })),
            });
          }
        }
      }

      for (const activity of OPTIONAL_ACTIVITIES) {
        await tx.activity.upsert({
          where: {
            schoolId_code: {
              schoolId,
              code: activity.code,
            },
          },
          update: {
            name: activity.name,
            capacity: activity.capacity,
            displayOrder: activity.displayOrder,
            isActive: true,
            deletedAt: null,
          },
          create: {
            schoolId,
            code: activity.code,
            name: activity.name,
            capacity: activity.capacity,
            displayOrder: activity.displayOrder,
            isActive: true,
          },
        });
      }

      await tx.periodDefinition.deleteMany({ where: { schoolId } });
      const periodRows = [];
      for (const dayOfWeek of WEEK_DAYS) {
        for (const period of PERIOD_TEMPLATE) {
          periodRows.push({
            schoolId,
            dayOfWeek,
            periodNumber: period.periodNumber,
            startTime: period.startTime,
            endTime: period.endTime,
            isActivityPeriod: period.isActivityPeriod,
          });
        }
      }
      await tx.periodDefinition.createMany({ data: periodRows });

      const labSubjects = await tx.subject.findMany({
        where: {
          schoolId,
          subjectCode: { in: ['PHY_LAB', 'CHE_LAB'] },
        },
      });

      for (const room of [
        { roomName: 'Physics Lab', roomCode: 'LAB_PHY' },
        { roomName: 'Chemistry Lab', roomCode: 'LAB_CHE' },
        { roomName: 'Computer Lab', roomCode: 'LAB_CMP' },
      ]) {
        await tx.labRoom.upsert({
          where: {
            schoolId_roomCode: {
              schoolId,
              roomCode: room.roomCode,
            },
          },
          update: {
            roomName: room.roomName,
            isActive: true,
            deletedAt: null,
          },
          create: {
            schoolId,
            roomName: room.roomName,
            roomCode: room.roomCode,
            capacity: 40,
          },
        });
      }

      for (const subject of labSubjects) {
        await tx.labSubjectRule.upsert({
          where: {
            schoolId_subjectId: {
              schoolId,
              subjectId: subject.id,
            },
          },
          update: {
            requiresLabRoom: true,
            minConsecutivePeriods: 2,
            deletedAt: null,
          },
          create: {
            schoolId,
            subjectId: subject.id,
            requiresLabRoom: true,
            minConsecutivePeriods: 2,
          },
        });
      }

      return {
        schoolId,
        classesProcessed: classByName.size,
        streamCount: STREAM_DEFINITIONS.length,
        activitiesCount: OPTIONAL_ACTIVITIES.length,
      };
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to bootstrap academic structure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

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
          sections: { where: { deletedAt: null }, include: { stream: true }, orderBy: { sectionOrder: 'asc' } },
          academicLevel: true,
          classSubjects: { include: { subject: true } },
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
