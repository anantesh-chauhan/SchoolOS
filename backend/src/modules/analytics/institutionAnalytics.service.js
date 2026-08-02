import prisma from '../../config/prisma.client.js';
import { ACADEMIC_COMPONENTS, CHAPTER_COMPONENTS, DEFAULT_CONFIGURATION, FORMULA_VERSION } from './analytics.constants.js';
import { analyticsCache, studentCacheKey } from './analytics.cache.js';
import { assertStudentAccess, filterForRole, getLinkedStudentIds, requireTenant } from './analytics.permissions.js';
import * as repository from './analytics.repository.js';
import { average, percentage, validateWeights } from './engines/weighted-score.engine.js';
import { calculateAcademicHealth } from './engines/academic-health.engine.js';
import { calculateSubjectScore } from './engines/subject-score.engine.js';
import { calculateChapterScore } from './engines/chapter-score.engine.js';
import { calculateTrend } from './engines/trend.engine.js';
import { detectRisk } from './engines/risk.engine.js';
import { generateRecommendations } from './engines/recommendation.engine.js';
import { calculateHomeworkSummary } from './engines/homework.engine.js';
import { invalidateSchoolAnalytics } from './analytics.invalidation.js';
import { round, meanRatings, groupBy, monthKey, assertTeacherAcademicScope, attendanceSummary, resourceSummary, evaluationScore, feedbackScore, assessmentScore, evidenceForScope, chapterAnalytics, subjectAnalytics, aggregateStudentRows } from './analytics.shared.js';

export const getClassOrSectionOverview = async ({ user, classId, sectionId, academicSessionId }) => {
  const schoolId = requireTenant(user);
  let teacherSubjectScope = null;
  const [classRow, section, session] = await Promise.all([
    prisma.class.findFirst({ where: { id: classId, schoolId, deletedAt: null } }),
    sectionId ? prisma.section.findFirst({ where: { id: sectionId, schoolId, classId, deletedAt: null } }) : null,
    academicSessionId ? prisma.academicSession.findFirst({ where: { id: academicSessionId, schoolId } }) : prisma.academicSession.findFirst({ where: { schoolId, isActive: true }, orderBy: { startDate: 'desc' } }),
  ]);
  if (!classRow || (sectionId && !section)) { const error = new Error('Class or section not found.'); error.status = 404; throw error; }
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findFirst({ where: { schoolId, isActive: true, OR: [...(user.email ? [{ email: user.email }] : []), ...(user.employeeId ? [{ employeeId: user.employeeId }] : [])] } });
    const allowed = teacher ? await prisma.teacherAssignment.findMany({ where: { schoolId, teacherId: teacher.id, classId, ...(sectionId ? { sectionId } : {}), isActive: true }, select: { subjectId: true, roleType: true } }) : [];
    if (!allowed.length) { const error = new Error('This class or section is outside your teaching assignments.'); error.status = 403; throw error; }
    if (!allowed.some((row) => ['CLASS_TEACHER', 'BOTH'].includes(row.roleType))) teacherSubjectScope = new Set(allowed.map((row) => row.subjectId));
  }
  const cacheKey = `analytics:${sectionId ? 'section' : 'class'}:${schoolId}:${sectionId || classId}:${session?.id || 'current'}:${user.role}:${user.id || 'account'}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached) return cached;
  const studentWhere = { schoolId, isActive: true, className: classRow.className, ...(section ? { section: section.sectionName } : {}) };
  const students = await prisma.student.findMany({ where: studentWhere, select: { id: true, studentFirstName: true, studentLastName: true, admissionNo: true, rollNumber: true, className: true, section: true } });
  const ids = students.map((row) => row.id);
  const [attendance, snapshots, interventions, chapterProgress] = await Promise.all([
    prisma.studentAttendance.findMany({ where: { schoolId, studentId: { in: ids }, ...(session ? { academicSession: session.name } : {}) } }),
    prisma.studentAnalyticsSnapshot.findMany({ where: { schoolId, studentId: { in: ids }, ...(session ? { academicSessionId: session.id } : {}) }, orderBy: { createdAt: 'desc' } }),
    prisma.learningIntervention.findMany({ where: { schoolId, studentId: { in: ids }, ...(teacherSubjectScope ? { subjectId: { in: [...teacherSubjectScope] } } : {}) }, select: { studentId: true, status: true } }),
    prisma.chapterProgress.findMany({ where: { schoolId, classId, ...(sectionId ? { sectionId } : {}) } }),
  ]);
  const summary = aggregateStudentRows({ students, attendance, snapshots, interventions });
  if (teacherSubjectScope) {
    const snapshotByStudent = new Map();
    snapshots.forEach((row) => { if (!snapshotByStudent.has(row.studentId)) snapshotByStudent.set(row.studentId, row); });
    summary.items = summary.items.map((item) => {
      const subjectRows = (snapshotByStudent.get(item.id)?.payload?.subjects || []).filter((row) => teacherSubjectScope.has(row.id));
      const assignedScore = average(subjectRows.map((row) => row.score?.score));
      return {
        ...item,
        academicHealth: assignedScore,
        dataCoverage: average(subjectRows.map((row) => row.score?.dataCoverage)),
        homework: average(subjectRows.map((row) => row.homeworkCompletion)),
        examAverage: average(subjectRows.map((row) => row.examAverage)),
        weakChapters: subjectRows.reduce((sum, row) => sum + (row.weakChapters?.length || 0), 0),
        riskLevel: assignedScore === null ? 'INSUFFICIENT_DATA' : assignedScore < 45 ? 'HIGH' : assignedScore < 60 ? 'MEDIUM' : 'LOW',
        analyticsSource: 'ASSIGNED_SUBJECT_SNAPSHOT',
      };
    });
    summary.averages = {
      academicHealth: average(summary.items.map((row) => row.academicHealth)),
      attendance: average(summary.items.map((row) => row.attendance)),
      homework: average(summary.items.map((row) => row.homework)),
      examAverage: average(summary.items.map((row) => row.examAverage)),
      dataCoverage: average(summary.items.map((row) => row.dataCoverage)),
    };
    summary.riskDistribution = Object.entries(summary.items.reduce((counts, row) => ({ ...counts, [row.riskLevel]: (counts[row.riskLevel] || 0) + 1 }), {})).map(([riskLevel, count]) => ({ riskLevel, count }));
  }
  const latestSnapshot = new Map();
  snapshots.forEach((row) => { if (!latestSnapshot.has(row.studentId)) latestSnapshot.set(row.studentId, row); });
  const subjectEvidence = [...latestSnapshot.values()].flatMap((row) => row.payload?.subjects || []).filter((row) => !teacherSubjectScope || teacherSubjectScope.has(row.id));
  const subjectGroups = groupBy(subjectEvidence, 'id');
  const result = {
    class: { id: classRow.id, name: classRow.className },
    section: section ? { id: section.id, name: section.sectionName } : null,
    academicSession: session ? { id: session.id, name: session.name } : null,
    studentCount: students.length,
    ...summary,
    syllabusCompletion: percentage(chapterProgress.filter((row) => row.status === 'COMPLETED').length, chapterProgress.length),
    subjectAverages: [...subjectGroups].map(([subjectId, rows]) => ({ subjectId, subjectName: rows[0]?.name, score: average(rows.map((row) => row.score?.score)), students: rows.length })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    formulaVersion: snapshots[0]?.formulaVersion || FORMULA_VERSION,
    generatedAt: new Date().toISOString(),
  };
  analyticsCache.set(cacheKey, result, 120_000);
  return result;
};

export const getSchoolOverview = async ({ user, academicSessionId }) => {
  const schoolId = requireTenant(user);
  const session = academicSessionId ? await prisma.academicSession.findFirst({ where: { id: academicSessionId, schoolId } })
    : await prisma.academicSession.findFirst({ where: { schoolId, isActive: true }, orderBy: { startDate: 'desc' } });
  const cacheKey = `analytics:school:${schoolId}:${session?.id || 'current'}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached) return cached;
  const [students, attendance, snapshots, interventions, progress, resources, evaluations] = await Promise.all([
    prisma.student.findMany({ where: { schoolId, isActive: true }, select: { id: true, studentFirstName: true, studentLastName: true, admissionNo: true, rollNumber: true, className: true, section: true } }),
    prisma.studentAttendance.findMany({ where: { schoolId, ...(session ? { academicSession: session.name } : {}) } }),
    prisma.studentAnalyticsSnapshot.findMany({ where: { schoolId, ...(session ? { academicSessionId: session.id } : {}) }, orderBy: { createdAt: 'desc' } }),
    prisma.learningIntervention.findMany({ where: { schoolId }, select: { studentId: true, status: true } }),
    prisma.chapterProgress.findMany({ where: { schoolId } }),
    prisma.resourceActivity.groupBy({ by: ['kind'], where: { schoolId }, _sum: { count: true } }),
    prisma.teacherStudentEvaluation.count({ where: { schoolId } }),
  ]);
  const summary = aggregateStudentRows({ students, attendance, snapshots, interventions });
  const classGroups = groupBy(summary.items, 'className');
  const latestSnapshot = new Map();
  snapshots.forEach((row) => { if (!latestSnapshot.has(row.studentId)) latestSnapshot.set(row.studentId, row); });
  const subjectEvidence = [...latestSnapshot.values()].flatMap((row) => row.payload?.subjects || []);
  const subjectGroups = groupBy(subjectEvidence, 'id');
  const chapterEvidence = [...latestSnapshot.values()].flatMap((row) => row.payload?.chapters || []);
  const chapterGroups = groupBy(chapterEvidence, 'id');
  const result = {
    academicSession: session ? { id: session.id, name: session.name } : null,
    studentCount: students.length,
    ...summary,
    classAnalytics: [...classGroups].map(([className, rows]) => ({
      className, studentCount: rows.length, academicHealth: average(rows.map((row) => row.academicHealth)),
      attendance: average(rows.map((row) => row.attendance)), homework: average(rows.map((row) => row.homework)), examAverage: average(rows.map((row) => row.examAverage)), dataCoverage: average(rows.map((row) => row.dataCoverage)),
    })),
    subjectAnalytics: [...subjectGroups].map(([subjectId, rows]) => ({ subjectId, subjectName: rows[0]?.name, score: average(rows.map((row) => row.score?.score)), students: rows.length })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    difficultChapters: [...chapterGroups].map(([chapterId, rows]) => ({ chapterId, chapterTitle: rows[0]?.title, subjectName: rows[0]?.subjectName, score: average(rows.map((row) => row.health?.score)), students: rows.length })).filter((row) => row.score !== null).sort((a, b) => a.score - b.score).slice(0, 10),
    syllabusCompletion: percentage(progress.filter((row) => row.status === 'COMPLETED').length, progress.length),
    interventionStatus: Object.entries(interventions.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] || 0) + 1 }), {})).map(([status, count]) => ({ status, count })),
    resourceUsage: resources.map((row) => ({ type: row.kind, events: row._sum.count || 0 })),
    teacherEvaluationCount: evaluations,
    formulaVersion: snapshots[0]?.formulaVersion || FORMULA_VERSION,
    generatedAt: new Date().toISOString(),
  };
  analyticsCache.set(cacheKey, result, 120_000);
  return result;
};
