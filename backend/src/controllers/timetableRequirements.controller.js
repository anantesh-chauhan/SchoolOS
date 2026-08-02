import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { DEFAULT_ACADEMIC_CONFIGURATION, isTeacherEligible, resolveAcademicContext } from '../services/academicStaffing.service.js';
import { DAYS, DAILY_TEMPLATE, CLASS_SLOT_CAPACITY, getTimetableLimits, getClassNumber, getScopedRequirements, validateRequirementPayload, getRequirementProgress } from './timetable.shared.js';

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
