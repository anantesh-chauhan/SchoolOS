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

const round = (value) => value === null || value === undefined ? null : Number(Number(value).toFixed(2));
const meanRatings = (row, keys) => average(keys.map((key) => Number(row[key]) * 20));
const groupBy = (rows, key) => rows.reduce((map, row) => map.set(row[key], [...(map.get(row[key]) || []), row]), new Map());
const monthKey = (date) => new Date(date).toISOString().slice(0, 7);
const assertTeacherAcademicScope = async (user, scope) => {
  if (user.role !== 'TEACHER') return;
  const teacher = await prisma.teacher.findFirst({ where: { schoolId: user.schoolId, isActive: true, deletedAt: null, OR: [
    ...(user.email ? [{ email: user.email }] : []), ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
  ] } });
  const assignment = teacher && await prisma.teacherAssignment.findFirst({ where: {
    schoolId: user.schoolId, teacherId: teacher.id, classId: scope.classId, subjectId: scope.subjectId,
    ...(scope.sectionId ? { sectionId: scope.sectionId } : {}), isActive: true,
  } });
  if (!assignment) { const error = new Error('This class, section, or subject is outside your teaching assignment.'); error.status = 403; throw error; }
};

const attendanceSummary = (rows) => {
  if (!rows.length) return { percentage: null, present: 0, absent: 0, leave: 0, halfDays: 0, late: 0, total: 0, trend: calculateTrend([]), monthly: [] };
  let eligible = 0; let attended = 0; let present = 0; let absent = 0; let leave = 0; let halfDays = 0; let late = 0;
  const excluded = new Set(['HOLIDAY', 'WEEKLY_OFF', 'NOT_MARKED']);
  const months = new Map();
  for (const row of rows) {
    const status = String(row.status).toUpperCase();
    if (excluded.has(status)) continue;
    eligible += 1;
    const units = Number(row.attendanceUnits);
    const credit = Number.isFinite(units) ? units : ['PRESENT', 'LATE', 'OFFICIAL_DUTY'].includes(status) ? 1 : status === 'HALF_DAY' ? 0.5 : 0;
    attended += credit;
    if (status === 'PRESENT') present += 1;
    else if (status === 'ABSENT') absent += 1;
    else if (status.includes('LEAVE')) leave += 1;
    else if (status === 'HALF_DAY') halfDays += 1;
    else if (status === 'LATE') late += 1;
    const key = monthKey(row.attendanceDate);
    const month = months.get(key) || { month: key, attended: 0, total: 0 };
    month.attended += credit; month.total += 1; months.set(key, month);
  }
  const monthly = [...months.values()].map((item) => ({ month: item.month, value: percentage(item.attended, item.total) }));
  let consecutiveAbsences = 0; let current = 0;
  for (const row of rows) {
    if (String(row.status).toUpperCase() === 'ABSENT') current += 1;
    else current = 0;
    consecutiveAbsences = Math.max(consecutiveAbsences, current);
  }
  return {
    percentage: percentage(attended, eligible), present, absent, leave, halfDays, late,
    total: eligible, consecutiveAbsences, monthly, trend: calculateTrend(monthly),
  };
};

const resourceSummary = (resources, activities, events) => {
  if (!resources.length) return { score: null, assigned: 0, opened: 0, completed: 0, completionRate: null, note: 'No in-platform resources are assigned.' };
  const resourceIds = new Set(resources.map((row) => row.id));
  const opened = new Set();
  const completed = new Set();
  activities.filter((row) => resourceIds.has(row.resourceId)).forEach((row) => {
    if (['VIEW', 'DOWNLOAD', 'COMPLETION'].includes(row.kind)) opened.add(row.resourceId);
    if (row.kind === 'COMPLETION') completed.add(row.resourceId);
  });
  events.filter((row) => resourceIds.has(row.resourceId)).forEach((row) => {
    opened.add(row.resourceId);
    if (row.eventType === 'COMPLETED') completed.add(row.resourceId);
  });
  const openRate = percentage(opened.size, resources.length);
  const completionRate = percentage(completed.size, resources.length);
  return {
    score: completionRate === null ? openRate : round(openRate * 0.4 + completionRate * 0.6),
    assigned: resources.length, opened: opened.size, completed: completed.size, completionRate,
    note: 'Engagement is a supporting indicator and is not proof of learning.',
  };
};

const evaluationScore = (rows) => rows.length ? average(rows.map((row) => meanRatings(row, [
  'attentionRating', 'participationRating', 'homeworkRating', 'conceptClarityRating',
]))) : null;
const feedbackScore = (rows) => rows.length ? average(rows.map((row) => average([
  row.understandingRating * 20, row.confidenceRating * 20, (6 - row.difficultyRating) * 20,
]))) : null;
const assessmentScore = (rows) => rows.length ? average(rows.map((row) => row.normalizedScore ?? percentage(row.rawScore, row.maxScore))) : null;

const evidenceForScope = (evidence, { subjectId, chapterId } = {}) => {
  const filter = (rows, extra = () => true) => rows.filter((row) =>
    (!subjectId || row.subjectId === subjectId) && (!chapterId || row.chapterId === chapterId) && extra(row));
  const homework = filter(evidence.homework);
  const homeworkIds = new Set(homework.map((row) => row.id));
  const resources = filter(evidence.resources);
  const resourceIds = new Set(resources.map((row) => row.id));
  return {
    assessments: filter(evidence.assessments),
    masteries: filter(evidence.masteries),
    votes: filter(evidence.votes),
    evaluations: filter(evidence.evaluations),
    homework,
    submissions: evidence.submissions.filter((row) => homeworkIds.has(row.homeworkId)),
    resources,
    activities: evidence.activities.filter((row) => resourceIds.has(row.resourceId)),
    engagementEvents: evidence.engagementEvents.filter((row) => resourceIds.has(row.resourceId)),
  };
};

const chapterAnalytics = (chapter, evidence, configuration) => {
  const scoped = evidenceForScope(evidence, { subjectId: chapter.subjectId, chapterId: chapter.id });
  const progress = evidence.progress.find((row) => row.chapterId === chapter.id);
  const attendance = attendanceSummary(evidence.attendance.filter((row) => {
    const date = new Date(row.attendanceDate);
    const start = chapter.startDate ? new Date(chapter.startDate) : null;
    const end = progress?.completedAt || chapter.targetCompletionDate;
    return (!start || date >= start) && (!end || date <= new Date(end));
  }));
  const hw = calculateHomeworkSummary(scoped.homework, scoped.submissions);
  const resource = resourceSummary(scoped.resources, scoped.activities, scoped.engagementEvents);
  const componentRows = evidence.assessmentComponents.filter((row) => row.chapterId === chapter.id);
  const scoresByComponent = new Map(evidence.componentScores.map((row) => [row.assessmentComponentId, row]));
  const mappedScores = componentRows.map((component) => {
    const value = scoresByComponent.get(component.id);
    return value && !value.absent && value.marksObtained !== null ? percentage(value.marksObtained, component.maximumMarks) : null;
  });
  const values = {
    assessment: average(mappedScores) ?? assessmentScore(scoped.assessments),
    homework: hw.percentage,
    teacherEvaluation: evaluationScore(scoped.evaluations),
    studentFeedback: feedbackScore(scoped.votes),
    attendance: attendance.percentage,
    resourceEngagement: resource.score,
  };
  const score = calculateChapterScore(values, configuration, progress?.status || String(chapter.status).toUpperCase());
  const override = evidence.overrides.find((row) => row.entityType === 'CHAPTER_STATUS' && row.entityId === `${evidence.studentId || ''}:${chapter.id}`);
  if (override) {
    score.calculatedStatus = score.chapterStatus;
    score.chapterStatus = override.overriddenStatus;
    score.overrideReason = override.reason;
  }
  const outcomeScores = evidence.learningOutcomes.filter((row) => row.chapterId === chapter.id).map((outcome) => {
    const outcomeComponents = componentRows.filter((row) => row.learningOutcomeId === outcome.id);
    const values = outcomeComponents.map((component) => {
      const value = scoresByComponent.get(component.id);
      return value && !value.absent && value.marksObtained !== null ? percentage(value.marksObtained, component.maximumMarks) : null;
    });
    return { id: outcome.id, title: outcome.title, score: average(values), assessedComponents: values.filter((value) => value !== null).length };
  });
  return {
    id: chapter.id, title: chapter.chapterName, sequence: chapter.chapterNumber, subjectId: chapter.subjectId,
    subjectName: chapter.subject?.subjectName, curriculumStatus: progress?.status || String(chapter.status).toUpperCase(),
    teachingStatus: progress?.status || 'NOT_STARTED', completionDate: progress?.completedAt,
    attendance: attendance.percentage, assignedHomework: hw.assigned, homeworkCompletion: hw.percentage,
    homeworkAverageScore: hw.averageScore, quizAverage: values.assessment,
    selfUnderstanding: values.studentFeedback, teacherEvaluation: values.teacherEvaluation,
    resourcesAssigned: resource.assigned, resourcesOpened: resource.opened, resourceCompletionRate: resource.completionRate,
    revisionStatus: score.chapterStatus === 'NEEDS_REVISION', revisionCount: scoped.engagementEvents.filter((row) => row.eventType === 'REOPENED').length,
    lastRevisionDate: scoped.engagementEvents.filter((row) => row.eventType === 'REOPENED').at(-1)?.occurredAt || null,
    health: score, difficultyLevel: chapter.difficultyLevel, teacherRemarks: scoped.evaluations[0]?.recommendation || null,
    studentRemarks: scoped.votes[0]?.comment || null,
    learningOutcomes: outcomeScores,
    weakConcepts: outcomeScores.filter((row) => row.score !== null && row.score < configuration.minimumChapterTarget),
  };
};

const subjectAnalytics = (subjectId, subjectName, evidence, configuration, chapters) => {
  const scoped = evidenceForScope(evidence, { subjectId });
  const hw = calculateHomeworkSummary(scoped.homework, scoped.submissions);
  const resource = resourceSummary(scoped.resources, scoped.activities, scoped.engagementEvents);
  const chapterRows = chapters.filter((row) => row.subjectId === subjectId);
  const chapterAverage = average(chapterRows.map((row) => row.health.score));
  const score = calculateSubjectScore({
    assessment: assessmentScore(scoped.assessments),
    chapterQuiz: chapterAverage ?? average(scoped.masteries.map((row) => row.score)),
    attendance: null,
    homework: hw.percentage,
    teacherEvaluation: evaluationScore(scoped.evaluations),
    studentFeedback: feedbackScore(scoped.votes),
    resourceEngagement: resource.score,
  }, configuration);
  const override = evidence.overrides.find((row) => row.entityType === 'SUBJECT_STATUS' && row.entityId === `${evidence.studentId}:${subjectId}`);
  if (override) {
    score.calculatedStatus = score.subjectStatus;
    score.subjectStatus = override.overriddenStatus;
    score.overrideReason = override.reason;
  }
  const assessmentTrend = calculateTrend(scoped.assessments.map((row) => ({ value: row.normalizedScore, date: row.recordedAt })));
  const assignment = evidence.assignments.find((row) => row.subjectId === subjectId);
  return {
    id: subjectId, name: subjectName, assignedTeacher: assignment?.teacher?.teacherName || null,
    score, examAverage: assessmentScore(scoped.assessments.filter((row) => row.assessment.assessmentType === 'CLASS_TEST')),
    quizAverage: assessmentScore(scoped.assessments.filter((row) => row.assessment.assessmentType !== 'CLASS_TEST')),
    chapterUnderstanding: chapterAverage, homeworkCompletion: hw.percentage, teacherEvaluation: evaluationScore(scoped.evaluations),
    resourceEngagement: resource, completedChapters: chapterRows.filter((row) => ['COMPLETED', 'MASTERED'].includes(row.health.chapterStatus)).length,
    weakChapters: chapterRows.filter((row) => ['WEAK', 'AT_RISK', 'NEEDS_REVISION'].includes(row.health.chapterStatus)),
    strongChapters: chapterRows.filter((row) => ['MASTERED', 'COMPLETED'].includes(row.health.chapterStatus)),
    trend: assessmentTrend, lastUpdated: scoped.assessments.at(-1)?.updatedAt || scoped.evaluations[0]?.submittedAt || null,
  };
};

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

export const getAnalyticsConfiguration = (user) => repository.getConfiguration(requireTenant(user));

export const updateAnalyticsConfiguration = async ({ user, body, requestMeta }) => {
  const schoolId = requireTenant(user);
  const previous = await repository.getConfiguration(schoolId);
  const allowed = Object.keys(DEFAULT_CONFIGURATION).filter((key) => key !== 'formulaVersion');
  const data = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  const merged = { ...previous, ...data };
  const academicValidation = validateWeights(ACADEMIC_COMPONENTS, merged);
  const chapterValidation = validateWeights(CHAPTER_COMPONENTS, merged);
  if (!academicValidation.valid || !chapterValidation.valid) {
    const error = new Error(academicValidation.message || chapterValidation.message);
    error.status = 422;
    throw error;
  }
  for (const key of ['lowRiskThreshold', 'mediumRiskThreshold', 'minimumAttendanceTarget', 'minimumHomeworkTarget', 'minimumChapterTarget']) {
    if (!Number.isFinite(Number(merged[key])) || merged[key] < 0 || merged[key] > 100) {
      const error = new Error(`${key} must be between 0 and 100.`);
      error.status = 422;
      throw error;
    }
  }
  const nextVersion = body.formulaVersion || `${Number.parseFloat(previous.formulaVersion || '1.0') + 0.1}`.replace(/(\.\d)\d+$/, '$1');
  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.analyticsConfiguration.upsert({
      where: { schoolId }, update: { ...data, formulaVersion: nextVersion },
      create: { schoolId, ...DEFAULT_CONFIGURATION, ...data, formulaVersion: nextVersion },
    });
    await tx.analyticsAuditLog.create({ data: {
      schoolId, userId: user.id, userRole: user.role, action: 'CONFIGURATION_UPDATED',
      entityType: 'AnalyticsConfiguration', entityId: row.id, oldValue: previous, newValue: row,
      reason: body.reason || null, ipAddress: requestMeta?.ip, userAgent: requestMeta?.userAgent,
    } });
    return row;
  });
  analyticsCache.invalidate(`analytics:student:${schoolId}:`);
  invalidateSchoolAnalytics(schoolId);
  return saved;
};

export const createSnapshot = async ({ user, body }) => {
  const schoolId = requireTenant(user);
  const overview = await getStudentOverview({ user, studentId: body.studentId, academicSessionId: body.academicSessionId, dateFrom: body.periodStart, dateTo: body.periodEnd, bypassCache: true });
  return prisma.$transaction(async (tx) => {
    const row = await tx.studentAnalyticsSnapshot.create({ data: {
      schoolId, studentId: body.studentId, academicSessionId: body.academicSessionId,
      snapshotType: body.snapshotType || 'MANUAL', periodStart: body.periodStart ? new Date(body.periodStart) : null,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : null, score: overview.academicHealth.score,
      riskLevel: overview.risk.riskLevel, dataCoverage: overview.academicHealth.dataCoverage,
      payload: overview, formulaVersion: overview.formulaVersion, createdById: user.id,
    } });
    const periodKey = (body.periodEnd || new Date().toISOString()).slice(0, 7);
    if (overview.recommendations?.length) {
      await tx.analyticsRecommendation.createMany({
        data: overview.recommendations.map((item) => ({
          schoolId, studentId: body.studentId, subjectId: item.relatedSubject, chapterId: item.relatedChapter,
          title: item.title, explanation: item.explanation, recommendedRole: item.recommendedRole,
          priority: item.priority, status: item.status, suggestedDeadline: new Date(item.suggestedDeadline),
          sourceCode: item.sourceCode, parentVisible: item.recommendedRole === 'PARENT',
          dedupeKey: `${body.studentId}:${periodKey}:${item.sourceCode}:${item.recommendedRole}`,
        })),
        skipDuplicates: true,
      });
    }
    if (['HIGH', 'CRITICAL'].includes(overview.risk.riskLevel)) {
      await tx.academicNotification.createMany({
        data: [{
          schoolId, recipientStudentId: body.studentId, recipientRole: 'STUDENT',
          type: 'ANALYTICS_RISK_REVIEW', title: 'Academic progress review available',
          body: 'Some academic indicators may need attention. Review the evidence and recommended next steps.',
          entityType: 'StudentAnalyticsSnapshot', entityId: row.id,
          dedupeKey: `analytics-risk:${schoolId}:${body.studentId}:${periodKey}:${overview.risk.riskLevel}`,
        }],
        skipDuplicates: true,
      });
    }
    await tx.analyticsAuditLog.create({ data: { schoolId, userId: user.id, userRole: user.role, action: 'SNAPSHOT_CREATED', entityType: 'StudentAnalyticsSnapshot', entityId: row.id, newValue: { snapshotType: row.snapshotType, studentId: row.studentId } } });
    invalidateSchoolAnalytics(schoolId);
    return row;
  });
};

export const listInterventions = async ({ user, studentId }) => {
  const ctx = await repository.resolveStudentContext({ schoolId: requireTenant(user), studentId });
  await assertStudentAccess(user, ctx?.student);
  const rows = await prisma.learningIntervention.findMany({ where: { schoolId: user.schoolId, studentId }, orderBy: { createdAt: 'desc' } });
  return filterForRole({ interventions: rows }, user).interventions;
};

export const createIntervention = async ({ user, body }) => {
  const schoolId = requireTenant(user);
  const ctx = await repository.resolveStudentContext({ schoolId, studentId: body.studentId, academicSessionId: body.academicSessionId });
  await assertStudentAccess(user, ctx?.student, { subjectId: body.subjectId });
  if (!ctx.classRow || !ctx.section || !body.subjectId || !body.chapterId || !body.reason || !body.recommendedAction) {
    const error = new Error('studentId, subjectId, chapterId, reason, and recommendedAction are required.');
    error.status = 422;
    throw error;
  }
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.learningIntervention.create({ data: {
      schoolId, classId: ctx.classRow.id, sectionId: ctx.section.id, subjectId: body.subjectId, chapterId: body.chapterId,
      studentId: body.studentId, createdByUserId: user.id, assignedToUserId: body.assignedToUserId || null,
      assignedTeacherId: body.assignedTeacherId || null, interventionType: body.type || 'REMEDIAL_CLASS',
      title: body.title || 'Academic support intervention', priority: body.priority || 'MEDIUM',
      reason: body.reason, recommendedAction: body.recommendedAction, status: body.status || 'PLANNED',
      startDate: body.plannedDate ? new Date(body.plannedDate) : null, dueDate: body.dueDate ? new Date(body.dueDate) : null,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null, parentVisible: Boolean(body.parentVisible),
      notes: body.notes || null, confidentialNotes: body.confidentialNotes || null,
    } });
    await tx.analyticsAuditLog.create({ data: { schoolId, userId: user.id, userRole: user.role, action: 'INTERVENTION_CREATED', entityType: 'LearningIntervention', entityId: saved.id, newValue: saved } });
    return saved;
  });
  analyticsCache.invalidate(`analytics:student:${schoolId}:${body.studentId}:`);
  invalidateSchoolAnalytics(schoolId);
  return row;
};

export const updateIntervention = async ({ user, interventionId, body }) => {
  const schoolId = requireTenant(user);
  const previous = await prisma.learningIntervention.findFirst({ where: { id: interventionId, schoolId } });
  if (!previous) {
    const error = new Error('Intervention not found.'); error.status = 404; throw error;
  }
  await assertTeacherAcademicScope(user, previous);
  const allowed = ['status', 'priority', 'notes', 'outcome', 'parentVisible', 'confidentialNotes', 'recommendedAction'];
  const data = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  if (body.completedAt) data.completedAt = new Date(body.completedAt);
  if (body.followUpDate) data.followUpDate = new Date(body.followUpDate);
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.learningIntervention.update({ where: { id: interventionId }, data });
    await tx.analyticsAuditLog.create({ data: { schoolId, userId: user.id, userRole: user.role, action: 'INTERVENTION_UPDATED', entityType: 'LearningIntervention', entityId: saved.id, oldValue: previous, newValue: saved, reason: body.reason || null } });
    return saved;
  });
  analyticsCache.invalidate(`analytics:student:${schoolId}:${previous.studentId}:`);
  invalidateSchoolAnalytics(schoolId);
  return row;
};

const aggregateStudentRows = ({ students, attendance, snapshots, interventions }) => {
  const attendanceByStudent = groupBy(attendance, 'studentId');
  const latestSnapshot = new Map();
  snapshots.forEach((row) => { if (!latestSnapshot.has(row.studentId)) latestSnapshot.set(row.studentId, row); });
  const interventionByStudent = groupBy(interventions, 'studentId');
  const items = students.map((student) => {
    const snapshot = latestSnapshot.get(student.id);
    const attendanceValue = attendanceSummary(attendanceByStudent.get(student.id) || []);
    return {
      id: student.id,
      name: `${student.studentFirstName} ${student.studentLastName || ''}`.trim(),
      admissionNo: student.admissionNo,
      rollNumber: student.rollNumber,
      className: student.className,
      section: student.section,
      attendance: attendanceValue.percentage,
      academicHealth: snapshot?.score ?? null,
      homework: snapshot?.payload?.homework?.percentage ?? null,
      examAverage: snapshot?.payload?.academicHealth?.components?.find((component) => component.name === 'Exam performance')?.rawScore ?? null,
      dataCoverage: snapshot?.dataCoverage ?? null,
      riskLevel: snapshot?.riskLevel || 'INSUFFICIENT_DATA',
      trend: snapshot?.payload?.performanceTrend?.trend || 'INSUFFICIENT_DATA',
      weakChapters: snapshot?.payload?.weakChapters?.length ?? null,
      interventionCount: (interventionByStudent.get(student.id) || []).length,
      analyticsSource: snapshot ? 'FINALIZED_SNAPSHOT' : 'LIVE_ATTENDANCE_ONLY',
    };
  });
  return {
    items,
    averages: {
      academicHealth: average(items.map((row) => row.academicHealth)),
      attendance: average(items.map((row) => row.attendance)),
      homework: average(items.map((row) => row.homework)),
      examAverage: average(items.map((row) => row.examAverage)),
      dataCoverage: average(items.map((row) => row.dataCoverage)),
    },
    riskDistribution: Object.entries(items.reduce((counts, row) => ({ ...counts, [row.riskLevel]: (counts[row.riskLevel] || 0) + 1 }), {})).map(([riskLevel, count]) => ({ riskLevel, count })),
  };
};

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

export const recordResourceEngagement = async ({ user, resourceId, body }) => {
  const schoolId = requireTenant(user);
  if (user.role !== 'STUDENT' || !user.studentId) { const error = new Error('Only a student can record their own resource engagement.'); error.status = 403; throw error; }
  const allowedTypes = new Set(['OPENED', 'STARTED', 'PROGRESSED', 'COMPLETED', 'DOWNLOADED', 'LINK_OPENED', 'REOPENED']);
  if (!allowedTypes.has(body.eventType)) { const error = new Error('Invalid engagement event type.'); error.status = 422; throw error; }
  const resource = await prisma.sectionResource.findFirst({
    where: { id: resourceId, schoolId, status: 'PUBLISHED', deletedAt: null, isVisibleToStudents: true },
    select: { id: true },
  });
  if (!resource) { const error = new Error('Resource is not available.'); error.status = 404; throw error; }
  const progress = body.progress === null || body.progress === undefined ? null : Math.max(0, Math.min(100, Number(body.progress)));
  const durationSec = body.tabActive === true && Number.isFinite(Number(body.durationSec))
    ? Math.max(0, Math.min(300, Math.round(Number(body.durationSec)))) : null;
  const bucket = Math.floor(Date.now() / 30_000);
  const dedupeKey = `${schoolId}:${resourceId}:${user.studentId}:${body.eventType}:${bucket}`;
  try {
    const row = await prisma.resourceEngagementEvent.create({ data: {
      schoolId, resourceId, studentId: user.studentId, eventType: body.eventType,
      progress: Number.isFinite(progress) ? progress : null, durationSec, dedupeKey,
    } });
    analyticsCache.invalidate(`analytics:student:${schoolId}:${user.studentId}:`);
    invalidateSchoolAnalytics(schoolId);
    return { recorded: true, event: row };
  } catch (error) {
    if (error.code === 'P2002') return { recorded: false, duplicateSuppressed: true };
    throw error;
  }
};

export const listRiskRules = async (user) => prisma.analyticsRiskRule.findMany({
  where: { schoolId: requireTenant(user) }, orderBy: [{ severity: 'desc' }, { code: 'asc' }],
});

export const saveRiskRule = async ({ user, ruleId, body }) => {
  const schoolId = requireTenant(user);
  if (!body.code || !body.title || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(body.severity)) {
    const error = new Error('code, title, and a valid severity are required.'); error.status = 422; throw error;
  }
  const existing = ruleId ? await prisma.analyticsRiskRule.findFirst({ where: { id: ruleId, schoolId } }) : null;
  const data = {
    code: String(body.code).trim().toUpperCase().slice(0, 80), title: String(body.title).trim().slice(0, 160),
    description: body.description ? String(body.description).trim().slice(0, 1000) : null,
    isEnabled: body.isEnabled !== false, severity: body.severity,
    threshold: body.threshold === null || body.threshold === undefined ? null : Number(body.threshold),
    configuration: body.configuration || null,
  };
  const row = await prisma.$transaction(async (tx) => {
    const saved = existing ? await tx.analyticsRiskRule.update({ where: { id: existing.id }, data })
      : await tx.analyticsRiskRule.upsert({ where: { schoolId_code: { schoolId, code: data.code } }, update: data, create: { schoolId, ...data } });
    await tx.analyticsAuditLog.create({ data: { schoolId, userId: user.id, userRole: user.role, action: 'RISK_RULE_UPDATED', entityType: 'AnalyticsRiskRule', entityId: saved.id, oldValue: existing, newValue: saved, reason: body.reason || null } });
    return saved;
  });
  analyticsCache.invalidate(`analytics:student:${schoolId}:`);
  invalidateSchoolAnalytics(schoolId);
  return row;
};

export const getLearningOutcomes = async ({ user, chapterId }) => {
  const schoolId = requireTenant(user);
  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, schoolId, deletedAt: null }, select: { id: true, classId: true, sectionId: true, subjectId: true } });
  if (!chapter) { const error = new Error('Chapter not found.'); error.status = 404; throw error; }
  await assertTeacherAcademicScope(user, chapter);
  return prisma.learningOutcome.findMany({ where: { schoolId, chapterId }, orderBy: { order: 'asc' } });
};

export const saveLearningOutcome = async ({ user, chapterId, outcomeId, body }) => {
  const schoolId = requireTenant(user);
  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, schoolId, deletedAt: null }, select: { id: true, classId: true, sectionId: true, subjectId: true } });
  if (!chapter) { const error = new Error('Chapter not found.'); error.status = 404; throw error; }
  await assertTeacherAcademicScope(user, chapter);
  if (!String(body.title || '').trim()) { const error = new Error('Learning outcome title is required.'); error.status = 422; throw error; }
  const data = { title: String(body.title).trim().slice(0, 300), description: body.description ? String(body.description).trim().slice(0, 2000) : null, order: Math.max(0, Number(body.order) || 0), isActive: body.isActive !== false };
  if (outcomeId) {
    const existing = await prisma.learningOutcome.findFirst({ where: { id: outcomeId, schoolId, chapterId } });
    if (!existing) { const error = new Error('Learning outcome not found.'); error.status = 404; throw error; }
    return prisma.learningOutcome.update({ where: { id: existing.id }, data });
  }
  return prisma.learningOutcome.upsert({ where: { schoolId_chapterId_title: { schoolId, chapterId, title: data.title } }, update: data, create: { schoolId, chapterId, ...data } });
};

export const saveAssessmentComponents = async ({ user, assessmentId, body }) => {
  const schoolId = requireTenant(user);
  const assessment = await prisma.chapterAssessment.findFirst({ where: { id: assessmentId, schoolId }, include: { class: { select: { className: true } }, section: { select: { sectionName: true } } } });
  if (!assessment) { const error = new Error('Assessment not found.'); error.status = 404; throw error; }
  await assertTeacherAcademicScope(user, assessment);
  const components = Array.isArray(body.components) ? body.components.slice(0, 100) : [];
  if (!components.length || components.some((row) => !String(row.title || '').trim() || !Number.isFinite(Number(row.maximumMarks)) || Number(row.maximumMarks) <= 0)) {
    const error = new Error('At least one component with a title and positive maximumMarks is required.'); error.status = 422; throw error;
  }
  const total = components.reduce((sum, row) => sum + Number(row.maximumMarks), 0);
  if (Math.abs(total - assessment.maxScore) > 0.01) { const error = new Error(`Component marks must total the assessment maximum of ${assessment.maxScore}.`); error.status = 422; throw error; }
  const outcomes = await prisma.learningOutcome.findMany({ where: { schoolId, chapterId: assessment.chapterId }, select: { id: true } });
  const outcomeIds = new Set(outcomes.map((row) => row.id));
  if (components.some((row) => row.learningOutcomeId && !outcomeIds.has(row.learningOutcomeId))) { const error = new Error('A learning outcome does not belong to this chapter.'); error.status = 422; throw error; }
  const existing = await prisma.assessmentComponent.findMany({
    where: { schoolId, assessmentId },
    include: { _count: { select: { scores: true } } },
    orderBy: { order: 'asc' },
  });
  if (existing.length && body.confirmReplace !== true) {
    const scoreCount = existing.reduce((sum, row) => sum + row._count.scores, 0);
    const error = new Error(`This replaces ${existing.length} existing component(s) and deletes ${scoreCount} component score(s). Send confirmReplace=true to continue.`);
    error.status = 409;
    error.code = 'ASSESSMENT_COMPONENT_REPLACEMENT_CONFIRMATION_REQUIRED';
    throw error;
  }
  return prisma.$transaction(async (tx) => {
    const oldComponentIds = existing.map((row) => row.id);
    if (oldComponentIds.length) {
      await tx.studentAssessmentComponentScore.deleteMany({ where: { schoolId, assessmentComponentId: { in: oldComponentIds } } });
    }
    await tx.assessmentComponent.deleteMany({ where: { schoolId, assessmentId } });
    await tx.assessmentComponent.createMany({ data: components.map((row, index) => ({
      schoolId, assessmentId, subjectId: assessment.subjectId, chapterId: assessment.chapterId,
      learningOutcomeId: row.learningOutcomeId || null, title: String(row.title).trim().slice(0, 300),
      maximumMarks: Number(row.maximumMarks), difficulty: row.difficulty || null, order: index,
    })) });
    const saved = await tx.assessmentComponent.findMany({ where: { schoolId, assessmentId }, orderBy: { order: 'asc' } });
    await tx.analyticsAuditLog.create({ data: {
      schoolId,
      userId: user.id,
      userRole: user.role,
      action: existing.length ? 'ASSESSMENT_COMPONENTS_REPLACED' : 'ASSESSMENT_COMPONENTS_CREATED',
      entityType: 'ChapterAssessment',
      entityId: assessmentId,
      oldValue: existing.map(({ _count, ...row }) => ({ ...row, scoreCount: _count.scores })),
      newValue: saved,
      reason: body.reason ? String(body.reason).trim().slice(0, 1000) : null,
    } });
    return saved;
  });
};

export const saveComponentScores = async ({ user, assessmentId, body }) => {
  const schoolId = requireTenant(user);
  const assessment = await prisma.chapterAssessment.findFirst({ where: { id: assessmentId, schoolId }, include: { class: { select: { className: true } }, section: { select: { sectionName: true } } } });
  if (!assessment) { const error = new Error('Assessment not found.'); error.status = 404; throw error; }
  await assertTeacherAcademicScope(user, assessment);
  const components = await prisma.assessmentComponent.findMany({ where: { schoolId, assessmentId } });
  const componentById = new Map(components.map((row) => [row.id, row]));
  const rows = Array.isArray(body.scores) ? body.scores.slice(0, 5000) : [];
  if (!rows.length) { const error = new Error('scores are required.'); error.status = 422; throw error; }
  const studentIds = [...new Set(rows.map((row) => row.studentId))];
  const students = await prisma.student.findMany({ where: { schoolId, id: { in: studentIds }, isActive: true, className: assessment.class.className, section: assessment.section.sectionName }, select: { id: true } });
  const validStudents = new Set(students.map((row) => row.id));
  if (validStudents.size !== studentIds.length || rows.some((row) => !componentById.has(row.assessmentComponentId))) { const error = new Error('A student or assessment component is outside this school assessment.'); error.status = 422; throw error; }
  for (const row of rows) {
    const maximum = componentById.get(row.assessmentComponentId).maximumMarks;
    if (!row.absent && (!Number.isFinite(Number(row.marksObtained)) || Number(row.marksObtained) < 0 || Number(row.marksObtained) > maximum)) {
      const error = new Error('Component marks must be between zero and the component maximum.'); error.status = 422; throw error;
    }
  }
  await prisma.$transaction(rows.map((row) => prisma.studentAssessmentComponentScore.upsert({
    where: { assessmentComponentId_studentId: { assessmentComponentId: row.assessmentComponentId, studentId: row.studentId } },
    update: { marksObtained: row.absent ? null : Number(row.marksObtained), absent: Boolean(row.absent), remarks: row.remarks || null },
    create: { schoolId, assessmentComponentId: row.assessmentComponentId, studentId: row.studentId, marksObtained: row.absent ? null : Number(row.marksObtained), absent: Boolean(row.absent), remarks: row.remarks || null },
  })));
  studentIds.forEach((id) => analyticsCache.invalidate(`analytics:student:${schoolId}:${id}:`));
  invalidateSchoolAnalytics(schoolId);
  return { saved: rows.length };
};

export const createStatusOverride = async ({ user, body }) => {
  const schoolId = requireTenant(user);
  if (!['STUDENT_RISK', 'CHAPTER_STATUS', 'SUBJECT_STATUS'].includes(body.entityType) || !body.entityId || !body.calculatedStatus || !body.overriddenStatus || !String(body.reason || '').trim()) {
    const error = new Error('entityType, entityId, calculatedStatus, overriddenStatus, and reason are required.'); error.status = 422; throw error;
  }
  const allowedStatuses = body.entityType === 'STUDENT_RISK'
    ? new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INSUFFICIENT_DATA'])
    : body.entityType === 'CHAPTER_STATUS'
      ? new Set(['NOT_STARTED', 'ONGOING', 'COMPLETED', 'MASTERED', 'NEEDS_REVISION', 'WEAK', 'AT_RISK', 'INSUFFICIENT_DATA'])
      : new Set(['EXCELLENT', 'GOOD', 'STABLE', 'NEEDS_ATTENTION', 'AT_RISK', 'INSUFFICIENT_DATA']);
  if (!allowedStatuses.has(body.overriddenStatus)) { const error = new Error('The overridden status is not valid for this analytics entity.'); error.status = 422; throw error; }
  if (body.entityType === 'STUDENT_RISK') {
    const student = await prisma.student.findFirst({ where: { id: body.entityId, schoolId, isActive: true }, select: { id: true } });
    if (!student) { const error = new Error('Student not found.'); error.status = 404; throw error; }
  } else {
    const [studentId, academicId] = String(body.entityId).split(':');
    const [student, academicEntity] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, schoolId, isActive: true }, select: { id: true } }),
      body.entityType === 'CHAPTER_STATUS'
        ? prisma.chapter.findFirst({ where: { id: academicId, schoolId, deletedAt: null }, select: { id: true } })
        : prisma.subject.findFirst({ where: { id: academicId, schoolId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!student || !academicEntity) { const error = new Error('Override target not found in this school.'); error.status = 404; throw error; }
  }
  const row = await prisma.$transaction(async (tx) => {
    await tx.analyticsStatusOverride.updateMany({ where: { schoolId, entityType: body.entityType, entityId: body.entityId, revokedAt: null }, data: { revokedAt: new Date() } });
    const saved = await tx.analyticsStatusOverride.create({ data: {
      schoolId, entityType: body.entityType, entityId: String(body.entityId),
      calculatedStatus: String(body.calculatedStatus), overriddenStatus: String(body.overriddenStatus),
      reason: String(body.reason).trim().slice(0, 2000), createdById: user.id,
    } });
    await tx.analyticsAuditLog.create({ data: { schoolId, userId: user.id, userRole: user.role, action: 'STATUS_OVERRIDDEN', entityType: body.entityType, entityId: body.entityId, oldValue: { status: body.calculatedStatus }, newValue: { status: body.overriddenStatus }, reason: saved.reason } });
    return saved;
  });
  analyticsCache.invalidate(`analytics:student:${schoolId}:`);
  invalidateSchoolAnalytics(schoolId);
  return row;
};

export const runAnalyticsNotificationChecks = async ({ user, now = new Date() }) => {
  const schoolId = requireTenant(user);
  const overdue = await prisma.learningIntervention.findMany({
    where: { schoolId, dueDate: { lt: now }, status: { in: ['PLANNED', 'IN_PROGRESS', 'FOLLOW_UP_REQUIRED'] } },
    select: { id: true, studentId: true, assignedToUserId: true, title: true, dueDate: true },
    take: 500,
  });
  const day = now.toISOString().slice(0, 10);
  if (overdue.length) {
    await prisma.academicNotification.createMany({
      data: overdue.map((row) => ({
        schoolId, recipientStudentId: row.studentId, recipientUserId: row.assignedToUserId,
        recipientRole: row.assignedToUserId ? null : 'ADMIN',
        type: 'ANALYTICS_INTERVENTION_OVERDUE', title: 'Academic intervention is overdue',
        body: `${row.title || 'An academic intervention'} was due ${row.dueDate.toISOString().slice(0, 10)} and requires review.`,
        entityType: 'LearningIntervention', entityId: row.id,
        dedupeKey: `analytics-intervention-overdue:${schoolId}:${row.id}:${day}`,
      })),
      skipDuplicates: true,
    });
  }
  return { evaluated: overdue.length, notificationsEligible: overdue.length, cooldownKey: day };
};

export const auditReportExport = ({ user, entityType, entityId, format, requestMeta }) =>
  prisma.analyticsAuditLog.create({ data: {
    schoolId: requireTenant(user), userId: user.id, userRole: user.role,
    action: 'REPORT_EXPORTED', entityType, entityId, newValue: { format },
    ipAddress: requestMeta?.ip, userAgent: requestMeta?.userAgent,
  } });
