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
