import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTeacherRequirement,
  calculateWorkload,
  classBand,
  getSlotDefault,
  isTeacherEligible,
  selectBestTeacher,
} from '../src/services/academicStaffing.service.js';

const subject = { id: 'math', subjectName: 'Mathematics', subjectCode: 'MAT', subjectType: 'CORE', isOptional: false, isLab: false };
const teacher = (id, load = 0, patch = {}) => ({ id, employeeId: id, isActive: true, deletedAt: null, teacherCategory: 'TGT', eligibleClassFrom: 6, eligibleClassTo: 10, canTeachPractical: false, maximumPeriodsPerWeek: 36, targetPeriodsPerWeek: 30, subjectsHandled: ['Mathematics'], qualifications: [{ subjectId: 'math', isPreferred: true, canTeachPractical: false }], load, ...patch });

test('CBSE defaults distinguish developmental bands and expose ranges', () => {
  assert.equal(classBand('Nursery'), 'PRE_PRIMARY');
  assert.equal(classBand('Class 5'), 'PRIMARY');
  assert.equal(classBand('Class 8'), 'MIDDLE');
  assert.equal(classBand('Class 10'), 'SECONDARY');
  assert.equal(classBand('Class 12'), 'SENIOR');
  const primary = getSlotDefault('Class 3', subject);
  assert.equal(primary.recommendedSlots, 7);
  assert.ok(primary.minimumSlots < primary.recommendedSlots);
  assert.ok(primary.maximumSlots > primary.recommendedSlots);
});

test('teacher demand uses actual weekly periods and target capacity', () => {
  assert.deepEqual(calculateTeacherRequirement(126, 30, 92), { weeklyDemand: 126, availableCapacity: 92, capacityGap: 34, additionalTeachersRequired: 2, requiredTeacherCount: 5 });
  assert.equal(calculateTeacherRequirement(60, 30, 60).additionalTeachersRequired, 0);
});

test('workload includes subject, practical, remedial and class-teacher duty periods', () => {
  const result = calculateWorkload({ teacher: teacher('GVS-TCH-0001'), allocations: [{ sectionId: 'a', subjectId: 'math', assignmentType: 'SUBJECT_TEACHER', weeklySlots: 7, theorySlots: 5, practicalSlots: 2 }, { sectionId: 'b', subjectId: 'math', assignmentType: 'REMEDIAL_TEACHER', weeklySlots: 2, theorySlots: 0, practicalSlots: 0 }], classTeacherAssignments: [{ dutyPeriods: 1 }] });
  assert.equal(result.totalAllocatedPeriods, 10);
  assert.equal(result.practicalPeriods, 2);
  assert.equal(result.classTeacherDutyPeriods, 1);
  assert.equal(result.remedialPeriods, 2);
});

test('qualified-teacher filtering rejects inactive, out-of-range and non-practical teachers', () => {
  assert.equal(isTeacherEligible({ teacher: teacher('a'), subject, className: 'Class 8' }), true);
  assert.equal(isTeacherEligible({ teacher: teacher('b', 0, { isActive: false }), subject, className: 'Class 8' }), false);
  assert.equal(isTeacherEligible({ teacher: teacher('c'), subject, className: 'Class 12' }), false);
  assert.equal(isTeacherEligible({ teacher: teacher('d'), subject: { ...subject, isLab: true }, className: 'Class 8', requiresPractical: true }), false);
});

test('auto-allocation selection is deterministic and balances compatible workload', () => {
  const teachers = [teacher('GVS-TCH-0002'), teacher('GVS-TCH-0001')];
  assert.equal(selectBestTeacher({ teachers, subject, className: 'Class 8', loadByTeacher: new Map([['GVS-TCH-0001', 10], ['GVS-TCH-0002', 2]]) }).id, 'GVS-TCH-0002');
  assert.equal(selectBestTeacher({ teachers, subject, className: 'Class 8', loadByTeacher: new Map([['GVS-TCH-0001', 2], ['GVS-TCH-0002', 2]]) }).id, 'GVS-TCH-0001');
});

test('pre-primary generalist can cover learning areas but cannot teach senior secondary', () => {
  const generalist = teacher('GVS-TCH-PP01', 0, { teacherCategory: 'PRE_PRIMARY', eligibleClassFrom: 0, eligibleClassTo: 0, specialization: 'Pre-primary generalist', qualifications: [], subjectsHandled: [] });
  assert.equal(isTeacherEligible({ teacher: generalist, subject, className: 'Nursery' }), true);
  assert.equal(isTeacherEligible({ teacher: generalist, subject, className: 'Class 11' }), false);
});
