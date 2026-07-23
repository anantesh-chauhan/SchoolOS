const CONTENT_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'CLOSED', 'ARCHIVED', 'CANCELLED']);
const HOMEWORK_TYPES = new Set(['PRACTICE', 'WORKSHEET', 'READING', 'WRITING', 'PROJECT', 'REVISION', 'PRACTICAL', 'TEST_PREPARATION', 'OTHER']);
const PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const AUDIENCE_MODES = new Set(['ENTIRE_SECTION', 'SELECTED_STUDENTS', 'ENTIRE_SECTION_WITH_EXCLUSIONS']);
const AUDIENCE_SCOPES = new Set(['WHOLE_SCHOOL', 'SELECTED_CLASSES', 'ENTIRE_CLASS', 'SELECTED_SECTIONS', 'SUBJECT_BASED', 'CHAPTER_BASED', 'SELECTED_STUDENTS']);
const RESOURCE_TYPES = new Set(['NOTE', 'LINK', 'PDF', 'DOCUMENT', 'PRESENTATION', 'IMAGE', 'AUDIO', 'VIDEO', 'EXTERNAL_LINK', 'YOUTUBE', 'WORKSHEET', 'SAMPLE_PAPER', 'QUESTION_PAPER', 'ANSWER_KEY', 'NOTES', 'ASSIGNMENT', 'OTHER']);
const DANGEROUS_EXTENSIONS = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'js', 'mjs', 'ps1', 'sh', 'php', 'jar', 'scr', 'msi', 'html', 'svg']);

const clean = (value, max = 10000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = (value) => value ? new Date(value) : null;

const parseTargets = (body, errors) => {
  const audienceScope = clean(body.audienceScope, 40).toUpperCase()
    || (body.audienceMode === 'SELECTED_STUDENTS' ? 'SELECTED_STUDENTS' : 'SELECTED_SECTIONS');
  if (!AUDIENCE_SCOPES.has(audienceScope)) errors.push('Invalid audience scope');
  const source = Array.isArray(body.targets) && body.targets.length
    ? body.targets
    : audienceScope === 'WHOLE_SCHOOL'
      ? [{}]
      : audienceScope === 'SELECTED_STUDENTS' && Array.isArray(body.studentIds)
        ? body.studentIds.map(studentId => ({ classId: body.classId, sectionId: body.sectionId, subjectId: body.subjectId, chapterId: body.chapterId, studentId }))
        : [{ classId: body.classId, sectionId: body.sectionId, subjectId: body.subjectId, chapterId: body.chapterId }];
  const targets = source.slice(0, 250).map((target) => ({
    scope: audienceScope,
    classId: clean(target?.classId, 100) || null,
    sectionId: clean(target?.sectionId, 100) || null,
    subjectId: clean(target?.subjectId, 100) || null,
    chapterId: clean(target?.chapterId, 100) || null,
    studentId: clean(target?.studentId, 100) || null,
  }));
  if (!targets.length) errors.push('At least one audience target is required');
  if (audienceScope === 'WHOLE_SCHOOL' && targets.some(target => target.classId || target.sectionId || target.subjectId || target.chapterId || target.studentId)) errors.push('Whole-school targets cannot contain narrower audience identifiers');
  if (['SELECTED_CLASSES', 'ENTIRE_CLASS'].includes(audienceScope) && targets.some(target => !target.classId)) errors.push('Each class target requires classId');
  if (audienceScope === 'SELECTED_SECTIONS' && targets.some(target => !target.classId || !target.sectionId)) errors.push('Each section target requires classId and sectionId');
  if (audienceScope === 'SUBJECT_BASED' && targets.some(target => !target.classId || !target.subjectId)) errors.push('Each subject target requires classId and subjectId');
  if (audienceScope === 'CHAPTER_BASED' && targets.some(target => !target.classId || !target.subjectId || !target.chapterId)) errors.push('Each chapter target requires classId, subjectId, and chapterId');
  if (audienceScope === 'SELECTED_STUDENTS' && targets.some(target => !target.studentId)) errors.push('Each selected-student target requires studentId');
  const unique = new Map(targets.map(target => [[target.classId, target.sectionId, target.subjectId, target.chapterId, target.studentId].join(':'), target]));
  return { audienceScope, targets: [...unique.values()] };
};

export const parsePositiveInt = (value, fallback, { min = 0, max = 1000000 } = {}) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : NaN;
};

export const parseExternalLink = (entry) => {
  const value = typeof entry === 'string' ? { url: entry } : entry || {};
  try {
    const parsed = new URL(String(value.url || ''));
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    return { url: parsed.toString(), domain: parsed.hostname.toLowerCase(), label: clean(value.label, 120) || null };
  } catch {
    return null;
  }
};

export const validateAttachments = (attachments, settings = {}) => {
  if (!Array.isArray(attachments)) return { value: [], errors: ['attachments must be an array'] };
  const maxCount = settings.maximumAttachmentCount ?? 5;
  const maxBytes = settings.maximumUploadBytes ?? 10 * 1024 * 1024;
  const allowed = new Set(settings.allowedMimeTypes || []);
  const errors = [];
  if (attachments.length > maxCount) errors.push(`No more than ${maxCount} attachments are allowed`);
  const value = attachments.slice(0, maxCount).map((file, index) => {
    const originalName = clean(file?.originalName || file?.fileName, 255);
    const extension = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : '';
    const fileSize = Number(file?.fileSize);
    const mimeType = clean(file?.mimeType, 150).toLowerCase();
    if (!originalName || !clean(file?.fileUrl, 2000)) errors.push(`Attachment ${index + 1} is incomplete`);
    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > maxBytes) errors.push(`Attachment ${index + 1} has an invalid size`);
    if (DANGEROUS_EXTENSIONS.has(extension)) errors.push(`Attachment ${index + 1} uses a prohibited file type`);
    if (allowed.size && !allowed.has(mimeType)) errors.push(`Attachment ${index + 1} MIME type is not allowed`);
    return {
      fileName: clean(file?.fileName || originalName, 255), originalName,
      fileUrl: clean(file?.fileUrl, 2000), publicId: clean(file?.publicId, 500) || null,
      mimeType, fileSize, attachmentType: clean(file?.attachmentType || extension || 'FILE', 50).toUpperCase(),
    };
  });
  return { value, errors };
};

export const validateHomeworkInput = (body = {}, { partial = false } = {}) => {
  const errors = [];
  const required = ['academicSession', 'title'];
  if (!partial) required.forEach((key) => { if (!clean(body[key], key === 'title' ? 200 : 100)) errors.push(`${key} is required`); });
  const targeting = parseTargets(body, errors);
  const assignedAt = date(body.assignedAt) || new Date();
  const dueAt = date(body.dueAt);
  const scheduledAt = date(body.scheduledAt);
  if ((body.dueAt && Number.isNaN(dueAt?.getTime())) || (body.scheduledAt && Number.isNaN(scheduledAt?.getTime()))) errors.push('Dates must be valid ISO date-time values');
  if (dueAt && scheduledAt && dueAt < scheduledAt) errors.push('dueAt must be on or after scheduledAt');
  const maximumMarks = parsePositiveInt(body.maximumMarks, null);
  const passingMarks = parsePositiveInt(body.passingMarks, null);
  const estimatedMinutes = parsePositiveInt(body.estimatedMinutes, null, { min: 1, max: 14400 });
  const maximumAttempts = parsePositiveInt(body.maximumAttempts, 1, { min: 1, max: 20 });
  const maximumAttachments = parsePositiveInt(body.maximumAttachments, 5, { min: 0, max: 20 });
  if ([maximumMarks, passingMarks, estimatedMinutes, maximumAttempts, maximumAttachments].some(Number.isNaN)) errors.push('Numeric settings are outside their allowed range');
  if (maximumMarks !== null && passingMarks !== null && passingMarks > maximumMarks) errors.push('passingMarks cannot exceed maximumMarks');
  const status = clean(body.status, 30).toUpperCase() || 'DRAFT';
  const audienceMode = clean(body.audienceMode, 50).toUpperCase() || 'ENTIRE_SECTION';
  if (!CONTENT_STATUSES.has(status)) errors.push('Invalid homework status');
  if (!AUDIENCE_MODES.has(audienceMode)) errors.push('Invalid audience mode');
  if (audienceMode === 'SELECTED_STUDENTS' && !body.studentIds?.length) errors.push('At least one selected student is required');
  const links = (body.externalLinks || []).map(parseExternalLink);
  if (links.some((item) => !item)) errors.push('External links must be valid HTTP or HTTPS URLs');
  return { errors, value: {
    academicSession: clean(body.academicSession, 50), classId: clean(body.classId, 100), sectionId: clean(body.sectionId, 100),
    subjectId: clean(body.subjectId, 100), chapterId: clean(body.chapterId, 100) || null, title: clean(body.title, 200),
    description: clean(body.description) || null, instructions: clean(body.instructions) || null,
    homeworkType: HOMEWORK_TYPES.has(clean(body.homeworkType, 40).toUpperCase()) ? clean(body.homeworkType, 40).toUpperCase() : 'OTHER',
    priority: PRIORITIES.has(clean(body.priority, 20).toUpperCase()) ? clean(body.priority, 20).toUpperCase() : 'NORMAL',
    estimatedMinutes, maximumMarks, passingMarks, allowSubmission: body.allowSubmission !== false,
    allowLateSubmission: Boolean(body.allowLateSubmission), requiresAttachment: Boolean(body.requiresAttachment),
    textResponseEnabled: body.textResponseEnabled !== false, resubmissionAllowed: body.resubmissionAllowed !== false,
    maximumAttempts, maximumAttachments, allowedSubmissionTypes: Array.isArray(body.allowedSubmissionTypes) ? body.allowedSubmissionTypes.map(x => clean(x, 100)).filter(Boolean) : [],
    submissionInstructions: clean(body.submissionInstructions) || null, learningObjective: clean(body.learningObjective) || null,
    assignedAt, dueAt, scheduledAt, status, audienceMode, audienceScope: targeting.audienceScope,
    categoryId: clean(body.categoryId, 100) || null, contentTypeCode: clean(body.contentTypeCode || 'HOMEWORK', 80).toUpperCase(),
    tagNames: Array.isArray(body.tagNames) ? body.tagNames.map(value => clean(value, 60)).filter(Boolean).slice(0, 20) : [],
    parentVisibility: body.parentVisibility !== false, expiresAt: date(body.expiresAt), targets: targeting.targets,
    studentIds: [...new Set((body.studentIds || []).map(x => clean(x, 100)).filter(Boolean))],
    externalLinks: links.filter(Boolean), attachments: Array.isArray(body.attachments) ? body.attachments : [],
  }};
};

export const validateResourceInput = (body = {}) => {
  const errors = [];
  ['title'].forEach((key) => { if (!clean(body[key], 200)) errors.push(`${key} is required`); });
  const targeting = parseTargets(body, errors);
  const links = (body.externalLinks || (body.externalUrl ? [body.externalUrl] : [])).map(parseExternalLink);
  if (links.some((item) => !item)) errors.push('External links must be valid HTTP or HTTPS URLs');
  const resourceType = clean(body.resourceType, 50).toUpperCase() || 'OTHER';
  if (!RESOURCE_TYPES.has(resourceType)) errors.push('Invalid resource type');
  return { errors, value: { classId: clean(body.classId), sectionId: clean(body.sectionId), subjectId: clean(body.subjectId), chapterId: clean(body.chapterId) || null,
    academicSession: clean(body.academicSession, 50) || null, title: clean(body.title, 200), description: clean(body.description) || null,
    resourceType, status: CONTENT_STATUSES.has(clean(body.status).toUpperCase()) ? clean(body.status).toUpperCase() : 'DRAFT',
    scheduledAt: date(body.scheduledAt), expiresAt: date(body.expiresAt), isFeatured: Boolean(body.isFeatured), isDownloadable: body.isDownloadable !== false,
    audienceScope: targeting.audienceScope, targets: targeting.targets, parentVisibility: body.parentVisibility !== false,
    categoryId: clean(body.categoryId, 100) || null, contentTypeCode: clean(body.contentTypeCode || resourceType, 80).toUpperCase(),
    tagNames: Array.isArray(body.tagNames) ? body.tagNames.map(value => clean(value, 60)).filter(Boolean).slice(0, 20) : [],
    priority: PRIORITIES.has(clean(body.priority, 20).toUpperCase()) ? clean(body.priority, 20).toUpperCase() : 'NORMAL',
    language: clean(body.language, 80) || null, curriculumSource: clean(body.curriculumSource, 80) || null,
    difficultyLevel: clean(body.difficultyLevel, 40) || null, estimatedMinutes: parsePositiveInt(body.estimatedMinutes, null, { min: 1, max: 14400 }),
    links: links.filter(Boolean), attachments: Array.isArray(body.attachments) ? body.attachments : [] } };
};

export const academicValidationConstants = { CONTENT_STATUSES, RESOURCE_TYPES, DANGEROUS_EXTENSIONS, AUDIENCE_SCOPES };
