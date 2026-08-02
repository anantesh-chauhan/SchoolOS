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
