import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeightedScore, validateWeights } from '../src/modules/analytics/engines/weighted-score.engine.js';
import { calculateAcademicHealth } from '../src/modules/analytics/engines/academic-health.engine.js';
import { calculateChapterScore } from '../src/modules/analytics/engines/chapter-score.engine.js';
import { calculateSubjectScore } from '../src/modules/analytics/engines/subject-score.engine.js';
import { calculateTrend } from '../src/modules/analytics/engines/trend.engine.js';
import { detectRisk } from '../src/modules/analytics/engines/risk.engine.js';
import { generateRecommendations } from '../src/modules/analytics/engines/recommendation.engine.js';
import { calculateHomeworkSummary } from '../src/modules/analytics/engines/homework.engine.js';
import { ACADEMIC_COMPONENTS, DEFAULT_CONFIGURATION } from '../src/modules/analytics/analytics.constants.js';

test('weights must total 100', () => {
  assert.deepEqual(validateWeights(ACADEMIC_COMPONENTS, DEFAULT_CONFIGURATION), { valid: true, total: 100, message: null });
  const invalid = validateWeights(ACADEMIC_COMPONENTS, { ...DEFAULT_CONFIGURATION, examWeight: 20 });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.total, 90);
});

test('missing components are excluded and remaining weights are normalized', () => {
  const result = calculateAcademicHealth({ exam: 80, attendance: 100 }, DEFAULT_CONFIGURATION);
  assert.equal(result.score, 86.67);
  assert.equal(result.dataCoverage, 45);
  assert.deepEqual(result.components.map((item) => item.effectiveWeight), [66.67, 33.33]);
  assert.equal(result.components.reduce((sum, item) => sum + item.contribution, 0), result.score);
});

test('zero is a valid score while null is missing', () => {
  const definitions = [['A', 'a', 'aWeight'], ['B', 'b', 'bWeight']];
  const result = calculateWeightedScore({ values: { a: 0, b: null }, configuration: { aWeight: 50, bWeight: 50 }, definitions });
  assert.equal(result.score, 0);
  assert.equal(result.dataCoverage, 50);
  assert.equal(result.components.length, 1);
});

test('no data returns insufficient data, not zero', () => {
  const result = calculateAcademicHealth({}, DEFAULT_CONFIGURATION);
  assert.equal(result.score, null);
  assert.equal(result.status, 'INSUFFICIENT_DATA');
  assert.equal(result.dataCoverage, 0);
});

test('chapter and subject statuses follow score and coverage rules', () => {
  const chapter = calculateChapterScore({ assessment: 90, homework: 90 }, DEFAULT_CONFIGURATION, 'COMPLETED');
  assert.equal(chapter.chapterStatus, 'MASTERED');
  const subject = calculateSubjectScore({ assessment: 40, homework: 45 }, DEFAULT_CONFIGURATION);
  assert.equal(subject.subjectStatus, 'AT_RISK');
});

test('trend detection requires at least two valid values', () => {
  assert.equal(calculateTrend([80]).trend, 'INSUFFICIENT_DATA');
  assert.equal(calculateTrend([60, 70]).trend, 'IMPROVING');
  assert.equal(calculateTrend([80, 70, 60]).trend, 'STRONGLY_DECLINING');
  assert.equal(calculateTrend([70, 71, 70, 71]).trend, 'STABLE');
});

test('risk output contains explainable reasons', () => {
  const risk = detectRisk({ attendance: 68, homework: 42, missingHomework: 4, weakChapters: 3 }, DEFAULT_CONFIGURATION);
  assert.equal(risk.riskLevel, 'HIGH');
  assert.ok(risk.riskScore >= 50);
  assert.ok(risk.reasons.some((item) => item.code === 'LOW_ATTENDANCE' && item.message.includes('75%')));
  assert.ok(risk.reasons.every((item) => item.message && item.severity));
});

test('recommendations are role-specific and traceable to a rule', () => {
  const risk = detectRisk({ homework: 40, missingHomework: 4 }, DEFAULT_CONFIGURATION);
  const rows = generateRecommendations(risk, { studentId: 'student-1', now: new Date('2026-07-23T00:00:00Z') });
  assert.ok(rows.some((item) => item.recommendedRole === 'TEACHER'));
  assert.ok(rows.some((item) => item.recommendedRole === 'STUDENT'));
  assert.ok(rows.every((item) => item.relatedStudent === 'student-1' && item.sourceCode));
});

test('homework analytics excludes excused work and treats a real zero as a score', () => {
  const homework = [
    { id: 'h1', maximumMarks: 10 },
    { id: 'h2', maximumMarks: 10 },
  ];
  const result = calculateHomeworkSummary(homework, [
    { homeworkId: 'h1', attemptNumber: 1, status: 'GRADED', marksAwarded: 0, isLate: false },
    { homeworkId: 'h2', attemptNumber: 1, status: 'EXCUSED', marksAwarded: null, isLate: false },
  ]);
  assert.equal(result.assigned, 2);
  assert.equal(result.eligible, 1);
  assert.equal(result.exempted, 1);
  assert.equal(result.percentage, 100);
  assert.equal(result.averageScore, 0);
});

test('homework analytics uses the latest attempt and distinguishes reopened from resubmitted', () => {
  const homework = [
    { id: 'h1', maximumMarks: 20 },
    { id: 'h2', maximumMarks: 20 },
    { id: 'h3', maximumMarks: 20 },
  ];
  const result = calculateHomeworkSummary(homework, [
    { homeworkId: 'h1', attemptNumber: 1, status: 'LATE_SUBMITTED', isLate: true },
    { homeworkId: 'h1', attemptNumber: 2, status: 'RESUBMITTED', isLate: true, marksAwarded: 15 },
    { homeworkId: 'h2', attemptNumber: 1, status: 'RESUBMISSION_REQUESTED', isLate: false },
  ]);
  assert.equal(result.submitted, 1);
  assert.equal(result.late, 1);
  assert.equal(result.resubmitted, 1);
  assert.equal(result.reopened, 1);
  assert.equal(result.missing, 2);
  assert.equal(result.averageScore, 75);
});
