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
