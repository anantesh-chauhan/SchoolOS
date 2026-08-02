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
