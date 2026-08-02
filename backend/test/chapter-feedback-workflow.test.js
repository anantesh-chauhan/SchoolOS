import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { buildChapterAnalysisSummary } from '../src/services/chapterAnalysis.service.js';

const poll = { id: 'poll-1', schoolId: 'school-1', classId: 'class-1', sectionId: 'section-1', subjectId: 'subject-1', chapterId: 'chapter-1', teacherId: 'teacher-1' };
const students = [{ id: 'student-1', studentFirstName: 'Asha', studentLastName: 'Rao', rollNumber: '1' }];

test('compiled summary stores formula evidence and a perception-gap indicator', () => {
  const summary = buildChapterAnalysisSummary({
    poll,
    students,
    votes: [{ studentId: 'student-1', understandingRating: 5, confidenceRating: 5, testReadinessRating: 5, teachingRating: 4, clarityRating: 4, paceRating: 4 }],
    evaluations: [{ studentId: 'student-1', understandingRating: 2, participationRating: 3, practiceRating: 2, applicationRating: 2, confidenceRating: 3, improvementRating: 3, independenceRating: 2, consistencyRating: 3 }],
    assessmentResults: [{ studentId: 'student-1', normalizedScore: 42 }],
  });
  const student = summary.studentSummaries[0];
  assert.equal(student.formulaVersion, 'chapter-feedback-v2.0');
  assert.ok(student.perceptionGap >= 1.5);
  assert.match(student.perceptionIndicator, /guided practice/i);
  assert.equal(student.assessmentPercent, 42);
  assert.ok(student.rawValues.student);
  assert.ok(student.normalizedValues);
});

test('analytics uses only supplied eligible submitted responses and records sample size', () => {
  const summary = buildChapterAnalysisSummary({
    poll,
    students,
    votes: [{ studentId: 'student-1', understandingRating: 4, confidenceRating: 4, teachingRating: 5, clarityRating: 5, paceRating: 4, examplesRating: 4 }],
    evaluations: [],
  });
  const metadata = summary.recommendations.find((item) => typeof item === 'object');
  assert.equal(metadata.responseCount, 1);
  assert.equal(metadata.eligibleStudents, 1);
  assert.equal(metadata.understandingDistribution.find((row) => row.range === '4').count, 1);
});

test('legacy ten-point responses normalize to the five-point analytics scale', () => {
  const summary = buildChapterAnalysisSummary({
    poll,
    students,
    votes: [{ studentId: 'student-1', understandingRating: 8, confidenceRating: 8, testReadinessRating: 8 }],
    evaluations: [],
  });
  assert.equal(summary.studentSummaries[0].studentSelfAssessmentAverage, 4);
});

test('submission contracts use valid audit actors, five-point ratings, and conflict-free teacher saves', async () => {
  const controllerDirectory = new URL('../src/controllers/', import.meta.url);
  const controllerFiles = (await readdir(controllerDirectory))
    .filter((file) => file.startsWith('chapterFeedback') && file.endsWith('.js'))
    .sort();
  const controller = (await Promise.all(
    controllerFiles.map((file) => readFile(new URL(file, controllerDirectory), 'utf8')),
  )).join('\n');
  const portal = await readFile(new URL('../src/modules/student/studentPortal.service.js', import.meta.url), 'utf8');
  assert.match(controller, /actorId: \['STUDENT', 'PARENT'\]\.includes\(req\.user\.role\) \? null : req\.user\.id/);
  assert.match(controller, /number >= 1 && number <= 5/);
  assert.doesNotMatch(controller, /A newer draft exists\. Refresh before saving again\./);
  assert.match(controller, /if \(writes\.length\) await prisma\.\$transaction\(writes\)/);
  assert.match(controller, /await prisma\.feedbackAuditLog\.createMany/);
  assert.match(portal, /value > 5/);
});

test('schema contains immutable response state, snapshots, tenancy and feedback audit log', async () => {
  const schemaDirectory = new URL('../prisma/', import.meta.url);
  const modelDirectory = new URL('../prisma/models/', import.meta.url);
  const modelFiles = (await readdir(modelDirectory)).filter((file) => file.endsWith('.prisma')).sort();
  const schema = [
    await readFile(new URL('schema.prisma', schemaDirectory), 'utf8'),
    ...await Promise.all(modelFiles.map((file) => readFile(new URL(file, modelDirectory), 'utf8'))),
  ].join('\n');
  assert.match(schema, /enum FeedbackResponseState[\s\S]*SUBMITTED[\s\S]*LOCKED[\s\S]*COMPILED/);
  assert.match(schema, /model StudentChapterVote[\s\S]*schoolId[\s\S]*snapshot\s+Json\?/);
  assert.match(schema, /model TeacherStudentEvaluation[\s\S]*version\s+Int[\s\S]*snapshot\s+Json\?/);
  assert.match(schema, /model FeedbackAuditLog[\s\S]*schoolId[\s\S]*actorRole/);
});
