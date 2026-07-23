import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExternalLink, validateAttachments, validateHomeworkInput, validateResourceInput } from '../src/modules/homework/homework.validation.js';

const base = { academicSession: '2026-27', classId: 'class-1', sectionId: 'section-1', subjectId: 'subject-1', title: 'Practice set' };

test('homework accepts a valid draft and normalizes workflow values', () => {
  const result = validateHomeworkInput({ ...base, homeworkType: 'practice', priority: 'high', maximumMarks: 20, passingMarks: 8 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.value.homeworkType, 'PRACTICE');
  assert.equal(result.value.priority, 'HIGH');
});

test('homework rejects invalid dates, marks, and empty selected audience', () => {
  const result = validateHomeworkInput({ ...base, scheduledAt: '2026-08-02T10:00:00Z', dueAt: '2026-08-01T10:00:00Z', maximumMarks: 10, passingMarks: 11, audienceMode: 'SELECTED_STUDENTS' });
  assert.match(result.errors.join(' '), /dueAt/);
  assert.match(result.errors.join(' '), /passingMarks/);
  assert.match(result.errors.join(' '), /selected student/);
});

test('external URLs reject dangerous schemes and embedded credentials', () => {
  assert.equal(parseExternalLink('javascript:alert(1)'), null);
  assert.equal(parseExternalLink('https://user:secret@example.com/file'), null);
  assert.equal(parseExternalLink('https://example.com/notes')?.domain, 'example.com');
});

test('attachment validation rejects empty, executable, oversized, and MIME-mismatched files', () => {
  const result = validateAttachments([{ fileName: 'payload.exe', originalName: 'payload.exe', fileUrl: 'https://files.example/payload.exe', mimeType: 'application/x-msdownload', fileSize: 200 }], { maximumAttachmentCount: 2, maximumUploadBytes: 100, allowedMimeTypes: ['application/pdf'] });
  assert.ok(result.errors.length >= 3);
});

test('resource validation accepts multiple safe links and rejects malformed URLs', () => {
  assert.deepEqual(validateResourceInput({ ...base, resourceType: 'PDF', externalLinks: ['https://example.edu/one', 'https://example.edu/two'] }).errors, []);
  assert.match(validateResourceInput({ ...base, resourceType: 'PDF', externalLinks: ['not-a-url'] }).errors.join(' '), /External links/);
});

test('whole-school and multi-class targets are normalized without duplicating content', () => {
  const wholeSchool = validateResourceInput({ title: 'Student handbook', resourceType: 'PDF', audienceScope: 'WHOLE_SCHOOL', targets: [{}] });
  assert.deepEqual(wholeSchool.errors, []);
  assert.deepEqual(wholeSchool.value.targets, [{ scope: 'WHOLE_SCHOOL', classId: null, sectionId: null, subjectId: null, chapterId: null, studentId: null }]);

  const multiClass = validateResourceInput({ title: 'Career guide', audienceScope: 'SELECTED_CLASSES', targets: [{ classId: 'class-9' }, { classId: 'class-10' }] });
  assert.deepEqual(multiClass.errors, []);
  assert.equal(multiClass.value.targets.length, 2);
  assert.equal(multiClass.value.targets[1].classId, 'class-10');
});

test('target shape validation rejects incomplete chapter and selected-student audiences', () => {
  const chapter = validateHomeworkInput({ academicSession: '2026-27', title: 'Electricity', audienceScope: 'CHAPTER_BASED', targets: [{ classId: 'class-10', subjectId: 'science' }] });
  assert.match(chapter.errors.join(' '), /chapterId/);
  const student = validateResourceInput({ title: 'Remedial practice', audienceScope: 'SELECTED_STUDENTS', targets: [{ classId: 'class-8' }] });
  assert.match(student.errors.join(' '), /studentId/);
});
