import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { DEFAULT_ACADEMIC_CONFIGURATION, isTeacherEligible, resolveAcademicContext } from '../services/academicStaffing.service.js';
import { DAYS, DAILY_TEMPLATE, CLASS_SLOT_CAPACITY, getTimetableLimits, getClassNumber, getScopedRequirements, validateRequirementPayload, getRequirementProgress } from './timetable.shared.js';

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
