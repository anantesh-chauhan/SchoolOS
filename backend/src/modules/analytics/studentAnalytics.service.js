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

export const getStudentOverview = async ({ user, studentId, academicSessionId, dateFrom, dateTo, bypassCache = false }) => {
  const schoolId = requireTenant(user);
  const ctx = await repository.resolveStudentContext({ schoolId, studentId, academicSessionId });
  const permission = await assertStudentAccess(user, ctx?.student);
  const subjectScopeKey = permission.allowedSubjectIds?.sort().join(',') || 'all';
  const cacheKey = `${studentCacheKey(schoolId, studentId, ctx.session?.id || ctx.sessionName)}:${user.role}:${subjectScopeKey}`;
  if (!bypassCache && !dateFrom && !dateTo) {
    const cached = analyticsCache.get(cacheKey);
    if (cached) return filterForRole(cached, user);
  }
  const [configuration, loadedEvidence, riskRules] = await Promise.all([
    repository.getConfiguration(schoolId),
    repository.loadStudentEvidence(ctx, { dateFrom, dateTo }),
    prisma.analyticsRiskRule.findMany({ where: { schoolId } }),
  ]);
  const evidence = loadedEvidence;
  if (permission.scope === 'SUBJECT') {
    const allowed = new Set(permission.allowedSubjectIds);
    for (const key of ['homework', 'assessments', 'masteries', 'votes', 'evaluations', 'chapters', 'progress', 'resources', 'assignments']) {
      evidence[key] = evidence[key].filter((row) => allowed.has(row.subjectId));
    }
    const homeworkIds = new Set(evidence.homework.map((row) => row.id));
    const resourceIds = new Set(evidence.resources.map((row) => row.id));
    const assessmentIds = new Set(evidence.assessments.map((row) => row.assessmentId));
    evidence.submissions = evidence.submissions.filter((row) => homeworkIds.has(row.homeworkId));
    evidence.activities = evidence.activities.filter((row) => resourceIds.has(row.resourceId));
    evidence.engagementEvents = evidence.engagementEvents.filter((row) => resourceIds.has(row.resourceId));
    evidence.assessmentComponents = evidence.assessmentComponents.filter((row) => allowed.has(row.subjectId) && assessmentIds.has(row.assessmentId));
    const componentIds = new Set(evidence.assessmentComponents.map((row) => row.id));
    evidence.componentScores = evidence.componentScores.filter((row) => componentIds.has(row.assessmentComponentId));
    const chapterIds = new Set(evidence.chapters.map((row) => row.id));
    evidence.learningOutcomes = evidence.learningOutcomes.filter((row) => chapterIds.has(row.chapterId));
    evidence.interventions = evidence.interventions.filter((row) => allowed.has(row.subjectId));
  }
  const attendance = attendanceSummary(evidence.attendance);
  const homework = calculateHomeworkSummary(evidence.homework, evidence.submissions);
  const resources = resourceSummary(evidence.resources, evidence.activities, evidence.engagementEvents);
  const chapters = evidence.chapters.map((chapter) => chapterAnalytics(chapter, evidence, configuration));
  const subjectMap = new Map(evidence.chapters.map((row) => [row.subjectId, row.subject?.subjectName || 'Subject']));
  evidence.assignments.forEach((row) => subjectMap.set(row.subjectId, row.subject.subjectName));
  const subjects = [...subjectMap].map(([id, name]) => subjectAnalytics(id, name, evidence, configuration, chapters));
  const examRows = evidence.assessments.filter((row) => row.assessment.assessmentType === 'CLASS_TEST');
  const health = calculateAcademicHealth({
    exam: assessmentScore(examRows),
    chapterQuiz: average(chapters.map((row) => row.health.score)) ?? assessmentScore(evidence.assessments),
    attendance: attendance.percentage,
    homework: homework.percentage,
    teacherEvaluation: evaluationScore(evidence.evaluations),
    studentFeedback: feedbackScore(evidence.votes),
    resourceEngagement: resources.score,
  }, { ...configuration, riskRules });
  const examTrend = calculateTrend(examRows.map((row) => row.normalizedScore));
  const weakChapters = chapters.filter((row) => ['WEAK', 'AT_RISK', 'NEEDS_REVISION'].includes(row.health.chapterStatus));
  const risk = detectRisk({
    attendance: attendance.percentage, attendanceTrend: attendance.trend.trend, consecutiveAbsences: attendance.consecutiveAbsences,
    homework: homework.percentage, missingHomework: homework.missing, academicHealth: health.score,
    weakChapters: weakChapters.length, examTrend: examTrend.trend,
    teacherConcern: evidence.evaluations.some((row) => row.improvementNeedRating >= 4),
    noImprovementAfterIntervention: evidence.interventions.some((row) => row.status === 'COMPLETED' && row.improvement !== null && row.improvement <= 0),
  }, configuration);
  const riskOverride = evidence.overrides.find((row) => row.entityType === 'STUDENT_RISK' && row.entityId === studentId);
  if (riskOverride) {
    risk.calculatedRiskLevel = risk.riskLevel;
    risk.riskLevel = riskOverride.overriddenStatus;
    risk.overrideReason = riskOverride.reason;
  }
  const recommendations = generateRecommendations(risk, { studentId });
  const insights = [];
  if (attendance.percentage !== null && health.score !== null && attendance.percentage < configuration.minimumAttendanceTarget) {
    insights.push(`Attendance is below the school target and may be associated with current academic performance; teacher review is recommended.`);
  }
  if (homework.percentage !== null && homework.percentage < configuration.minimumHomeworkTarget) {
    insights.push(`Homework completion is ${homework.percentage}%. This shows a possible relationship with current chapter performance and requires teacher review.`);
  }
  const result = {
    student: {
      id: ctx.student.id, name: `${ctx.student.studentFirstName} ${ctx.student.studentLastName || ''}`.trim(),
      admissionNo: ctx.student.admissionNo, className: ctx.student.className, section: ctx.student.section,
      rollNumber: ctx.student.rollNumber, academicSession: ctx.sessionName,
      academicSessionId: ctx.session?.id || null,
      classTeacher: evidence.assignments.find((row) => ['CLASS_TEACHER', 'BOTH'].includes(row.roleType))?.teacher?.teacherName || null,
    },
    academicHealth: health, risk, attendance, homework, resources, subjects,
    weakChapters, strongChapters: chapters.filter((row) => row.health.chapterStatus === 'MASTERED'),
    chapters, performanceTrend: examTrend, insights,
    teacherObservations: evidence.evaluations.slice(0, 10),
    recommendations, interventions: evidence.interventions,
    formulaVersion: configuration.formulaVersion || FORMULA_VERSION,
    generatedAt: new Date().toISOString(),
  };
  if (!dateFrom && !dateTo) analyticsCache.set(cacheKey, result);
  return filterForRole(result, user);
};

export const getStudentSubject = async ({ user, studentId, subjectId, ...filters }) => {
  const overview = await getStudentOverview({ user, studentId, ...filters });
  const subject = overview.subjects.find((row) => row.id === subjectId);
  if (!subject) {
    const error = new Error('Subject analytics are not available for this student.');
    error.status = 404;
    throw error;
  }
  const ctx = await repository.resolveStudentContext({ schoolId: user.schoolId, studentId, academicSessionId: filters.academicSessionId });
  const [configuration, classResults] = await Promise.all([
    repository.getConfiguration(user.schoolId),
    ctx?.classRow && ctx?.section ? prisma.chapterAssessmentResult.findMany({
      where: {
        schoolId: user.schoolId, classId: ctx.classRow.id, sectionId: ctx.section.id, subjectId,
        ...(filters.dateFrom || filters.dateTo ? { recordedAt: {
          ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        } } : {}),
      },
      select: { studentId: true, normalizedScore: true, rawScore: true, maxScore: true },
    }) : [],
  ]);
  const scoresByStudent = groupBy(classResults, 'studentId');
  const comparisonRows = [...scoresByStudent].map(([id, rows]) => ({
    studentId: id,
    score: average(rows.map((row) => row.normalizedScore ?? percentage(row.rawScore, row.maxScore))),
  })).filter((row) => row.score !== null).sort((a, b) => b.score - a.score);
  const studentAssessmentScore = comparisonRows.find((row) => row.studentId === studentId)?.score ?? null;
  const classAverage = average(comparisonRows.map((row) => row.score));
  const rank = configuration.rankingEnabled && studentAssessmentScore !== null
    ? comparisonRows.findIndex((row) => row.studentId === studentId) + 1 : null;
  return {
    student: overview.student,
    subject: {
      ...subject,
      classAverage,
      highestClassScore: comparisonRows[0]?.score ?? null,
      lowestClassScore: comparisonRows.at(-1)?.score ?? null,
      differenceFromClassAverage: studentAssessmentScore !== null && classAverage !== null ? round(studentAssessmentScore - classAverage) : null,
      subjectRank: rank || null,
      rankingEnabled: configuration.rankingEnabled,
      comparisonBasis: 'RECORDED_ASSESSMENTS',
      comparisonStudentCount: comparisonRows.length,
    },
    chapters: overview.chapters.filter((row) => row.subjectId === subjectId),
    formulaVersion: overview.formulaVersion,
  };
};

export const getStudentChapter = async ({ user, studentId, subjectId, chapterId, ...filters }) => {
  const detail = await getStudentSubject({ user, studentId, subjectId, ...filters });
  const chapter = detail.chapters.find((row) => row.id === chapterId);
  if (!chapter) {
    const error = new Error('Chapter analytics are not available for this student and subject.');
    error.status = 404;
    throw error;
  }
  return { student: detail.student, subject: detail.subject, chapter, formulaVersion: detail.formulaVersion };
};

export const getStudents = async ({ user, query }) => {
  const schoolId = requireTenant(user);
  if (!['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'TEACHER'].includes(user.role)) {
    const studentIds = await getLinkedStudentIds(user);
    const [items, total] = studentIds.length
      ? await repository.listStudents({ schoolId, page: 1, limit: 100, studentIds })
      : [[], 0];
    return { items, pagination: { page: 1, limit: 100, total, pages: total ? 1 : 0 } };
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  let scopeOr;
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findFirst({ where: { schoolId, isActive: true, deletedAt: null, OR: [
      ...(user.email ? [{ email: user.email }] : []), ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
    ] } });
    const assignments = teacher ? await prisma.teacherAssignment.findMany({
      where: { schoolId, teacherId: teacher.id, isActive: true },
      include: { class: { select: { className: true } }, section: { select: { sectionName: true } } },
    }) : [];
    scopeOr = assignments.map((row) => ({ className: row.class.className, section: row.section.sectionName }));
    if (!scopeOr.length) return { items: [], pagination: { page, limit, total: 0, pages: 0 } };
  }
  const [students, total] = await repository.listStudents({ schoolId, page, limit, search: query.search, className: query.className, section: query.section, scopeOr });
  return { items: students, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};
