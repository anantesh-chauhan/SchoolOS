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

