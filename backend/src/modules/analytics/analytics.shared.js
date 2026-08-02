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

export const round = (value) => value === null || value === undefined ? null : Number(Number(value).toFixed(2));
export const meanRatings = (row, keys) => average(keys.map((key) => Number(row[key]) * 20));
export const groupBy = (rows, key) => rows.reduce((map, row) => map.set(row[key], [...(map.get(row[key]) || []), row]), new Map());
export const monthKey = (date) => new Date(date).toISOString().slice(0, 7);
export const assertTeacherAcademicScope = async (user, scope) => {
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

export const attendanceSummary = (rows) => {
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

export const resourceSummary = (resources, activities, events) => {
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

export const evaluationScore = (rows) => rows.length ? average(rows.map((row) => meanRatings(row, [
  'attentionRating', 'participationRating', 'homeworkRating', 'conceptClarityRating',
]))) : null;
export const feedbackScore = (rows) => rows.length ? average(rows.map((row) => average([
  row.understandingRating * 20, row.confidenceRating * 20, (6 - row.difficultyRating) * 20,
]))) : null;
export const assessmentScore = (rows) => rows.length ? average(rows.map((row) => row.normalizedScore ?? percentage(row.rawScore, row.maxScore))) : null;

export const evidenceForScope = (evidence, { subjectId, chapterId } = {}) => {
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

export const chapterAnalytics = (chapter, evidence, configuration) => {
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

export const subjectAnalytics = (subjectId, subjectName, evidence, configuration, chapters) => {
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

export const aggregateStudentRows = ({ students, attendance, snapshots, interventions }) => {
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
