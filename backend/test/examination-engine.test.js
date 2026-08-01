import test from 'node:test';
import assert from 'node:assert/strict';
import { assignRanks, calculateStudent, gradeFor } from '../src/modules/examinations/examination.engine.js';

test('grade scale is configurable and boundary-safe', () => {
  const rules = [{ min: 75, grade: 'Distinction', point: 4 }, { min: 40, grade: 'Pass', point: 2 }, { min: 0, grade: 'Needs Improvement', point: 0 }];
  assert.equal(gradeFor(75, rules).grade, 'Distinction');
  assert.equal(gradeFor(39.99, rules).grade, 'Needs Improvement');
});

test('calculation handles weighted components, grace and promotion', () => {
  const result = calculateStudent({
    gradeRules: [{ min: 80, grade: 'A', point: 4 }, { min: 33, grade: 'P', point: 2 }, { min: 0, grade: 'F', point: 0 }],
    graceConfig: { maximumPerSubject: 2 }, promotionConfig: { subjectPassingPercentage: 33, compartmentSubjectLimit: 1 },
    subjects: [{ examSubjectId: 'english', components: [
      { code: 'THEORY', name: 'Theory', maximumMarks: 80, passingMarks: 26, weightage: 100, isMandatory: true, marks: 25, attendanceStatus: 'PRESENT' },
      { code: 'INTERNAL', name: 'Internal', maximumMarks: 20, passingMarks: 7, weightage: 100, isMandatory: true, marks: 18, attendanceStatus: 'PRESENT' },
    ] }],
  });
  assert.equal(result.resultStatus, 'PASS');
  assert.equal(result.promotionStatus, 'PROMOTED_WITH_GRACE');
  assert.equal(result.graceMarks, 1);
});

test('ranking assigns shared ranks to exact ties', () => {
  const ranked = assignRanks([{ studentId: 'b', percentage: 90, totalObtained: 450 }, { studentId: 'a', percentage: 90, totalObtained: 450 }, { studentId: 'c', percentage: 80, totalObtained: 400 }]);
  assert.deepEqual(ranked.map((row) => row.rank), [1, 1, 3]);
});

