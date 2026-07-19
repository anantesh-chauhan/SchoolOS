import prisma from '../../config/prisma.client.js';
import { createSystemNotification } from '../communication/communication.service.js';
import { getTeacherForUser } from '../../utils/teacherAuthorization.util.js';
import { validateAttachments, validateHomeworkInput, validateResourceInput } from './homework.validation.js';

export class HomeworkError extends Error {
  constructor(message, statusCode = 400, code = 'HOMEWORK_ERROR') { super(message); this.statusCode = statusCode; this.code = code; }
}

const elevatedRoles = new Set(['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER']);
const staffRoles = new Set([...elevatedRoles, 'TEACHER']);
const now = () => new Date();
const pageArgs = (query) => {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '20', 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};
const audit = (tx, user, action, entityType, entityId, before, after) => tx.academicContentAudit.create({ data: {
  schoolId: user.schoolId, actorUserId: staffRoles.has(user.role) ? user.id : null, action, entityType, entityId, before, after,
} });

const moduleSettings = (schoolId) => prisma.homeworkModuleSetting.upsert({ where: { schoolId }, create: { schoolId }, update: {} });

export const validateCurriculumScope = async (user, scope, { requireManage = true } = {}) => {
  if (!user?.schoolId) throw new HomeworkError('School context is required', 403, 'TENANT_REQUIRED');
  const section = await prisma.section.findFirst({ where: { id: scope.sectionId, classId: scope.classId, schoolId: user.schoolId, deletedAt: null }, include: { class: true } });
  if (!section) throw new HomeworkError('Section does not belong to the selected class and school', 400, 'INVALID_SECTION_CLASS');
  const subject = await prisma.subject.findFirst({ where: { id: scope.subjectId, schoolId: user.schoolId, deletedAt: null } });
  if (!subject) throw new HomeworkError('Subject does not belong to this school', 400, 'INVALID_SUBJECT');
  const mapping = await prisma.sectionSubject.findFirst({ where: { sectionId: scope.sectionId, subjectId: scope.subjectId } })
    || await prisma.classSubject.findFirst({ where: { classId: scope.classId, subjectId: scope.subjectId } });
  if (!mapping) throw new HomeworkError('Subject is not assigned to the selected class or section', 400, 'INVALID_SUBJECT_SECTION');
  let chapter = null;
  if (scope.chapterId) {
    chapter = await prisma.chapter.findFirst({ where: { id: scope.chapterId, schoolId: user.schoolId, subjectId: scope.subjectId, deletedAt: null,
      OR: [{ classId: null }, { classId: scope.classId }], AND: [{ OR: [{ sectionId: null }, { sectionId: scope.sectionId }] }] } });
    if (!chapter) throw new HomeworkError('Chapter does not belong to the selected subject and curriculum scope', 400, 'INVALID_CHAPTER_SUBJECT');
  }
  let teacher = null; let assignment = null;
  if (requireManage && user.role === 'TEACHER') {
    teacher = await getTeacherForUser(user);
    if (!teacher) throw new HomeworkError('Teacher profile not found', 403);
    assignment = await prisma.teacherAssignment.findFirst({ where: { schoolId: user.schoolId, teacherId: teacher.id, classId: scope.classId,
      sectionId: scope.sectionId, subjectId: scope.subjectId, isActive: true, effectiveFrom: { lte: now() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] } });
    if (!assignment) throw new HomeworkError('You are not actively assigned to this section and subject', 403, 'UNASSIGNED_TEACHER');
  } else if (requireManage && !elevatedRoles.has(user.role)) throw new HomeworkError('You cannot manage academic content', 403);
  return { section, subject, chapter, teacher, assignment };
};

export const getCreationContext = async (user) => {
  if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
  let mappings;
  if (user.role === 'TEACHER') {
    const teacher = await getTeacherForUser(user);
    mappings = teacher ? await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, isActive: true,
      effectiveFrom: { lte: now() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, include: { class: true, section: true, subject: true } }) : [];
  } else {
    mappings = await prisma.sectionSubject.findMany({ where: { section: { schoolId: user.schoolId, deletedAt: null }, subject: { deletedAt: null } },
      include: { section: { include: { class: true } }, subject: true } });
    mappings = mappings.map(row => ({ id: row.id, classId: row.section.classId, sectionId: row.sectionId, subjectId: row.subjectId, class: row.section.class, section: row.section, subject: row.subject }));
  }
  const scopes = mappings.map(row => ({ assignmentId: row.id, classId: row.classId, className: row.class.className, sectionId: row.sectionId,
    sectionName: row.section.sectionName, subjectId: row.subjectId, subjectName: row.subject.subjectName }));
  const chapters = scopes.length ? await prisma.chapter.findMany({ where: { schoolId: user.schoolId, deletedAt: null,
    OR: scopes.map(scope => ({ subjectId: scope.subjectId, OR: [{ classId: null }, { classId: scope.classId }], AND: [{ OR: [{ sectionId: null }, { sectionId: scope.sectionId }] }] })) },
    select: { id: true, classId: true, sectionId: true, subjectId: true, chapterName: true, chapterNumber: true }, orderBy: { chapterNumber: 'asc' } }) : [];
  const [sessions, school] = await Promise.all([
    prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true }, distinct: ['session'], select: { session: true }, orderBy: { session: 'desc' } }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { config: true } }),
  ]);
  const sessionValues = sessions.map(x => x.session);
  const configuredSession = school?.config && typeof school.config === 'object' ? school.config.academicSession : null;
  if (configuredSession && !sessionValues.includes(configuredSession)) sessionValues.unshift(configuredSession);
  return { scopes, chapters, sessions: sessionValues };
};

export const listLinkedChildren = async (user) => {
  if (user.role !== 'PARENT') throw new HomeworkError('Parent access required', 403);
  const ids = new Set([user.studentId].filter(Boolean));
  const links = await prisma.feeFamilyLink.findMany({ where: { schoolId: user.schoolId, parentUserId: user.email, active: true }, select: { studentId: true } });
  links.forEach(link => ids.add(link.studentId));
  return prisma.student.findMany({ where: { id: { in: [...ids] }, schoolId: user.schoolId, isActive: true }, select: { id: true, studentFirstName: true, studentLastName: true, className: true, section: true, rollNumber: true } });
};

const validateAudienceStudents = async (schoolId, section, studentIds) => {
  if (!studentIds.length) return [];
  const students = await prisma.student.findMany({ where: { id: { in: studentIds }, schoolId, className: section.class.className, section: section.sectionName, isActive: true }, select: { id: true } });
  if (students.length !== studentIds.length) throw new HomeworkError('One or more audience students are outside the selected section', 400, 'INVALID_AUDIENCE');
  return students;
};

const contentInclude = {
  class: { select: { id: true, className: true } }, section: { select: { id: true, sectionName: true } },
  subject: { select: { id: true, subjectName: true, subjectCode: true } }, chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
  creator: { select: { id: true, name: true } }, attachments: true, externalLinks: true,
};

export const createHomework = async (user, body) => {
  if (!staffRoles.has(user.role)) throw new HomeworkError('Only authorized school staff can create homework', 403);
  const parsed = validateHomeworkInput(body);
  if (parsed.errors.length) throw new HomeworkError(parsed.errors.join('. '), 400, 'VALIDATION_ERROR');
  const settings = await moduleSettings(user.schoolId);
  if (!settings.enabled) throw new HomeworkError('The homework module is disabled for this school', 403, 'MODULE_DISABLED');
  const scope = await validateCurriculumScope(user, parsed.value);
  await validateAudienceStudents(user.schoolId, scope.section, parsed.value.studentIds);
  const checkedFiles = validateAttachments(parsed.value.attachments, settings);
  if (checkedFiles.errors.length) throw new HomeworkError(checkedFiles.errors.join('. '), 400, 'INVALID_ATTACHMENT');
  if (parsed.value.status === 'PUBLISHED') parsed.value.scheduledAt = null;
  if (parsed.value.status === 'SCHEDULED' && !parsed.value.scheduledAt) throw new HomeworkError('scheduledAt is required for scheduled homework');
  const data = { ...parsed.value };
  delete data.studentIds; delete data.externalLinks; delete data.attachments;
  data.schoolId = user.schoolId; data.createdByUserId = user.id; data.createdByRole = user.role;
  data.teacherAssignmentId = scope.assignment?.id || null;
  data.publishedAt = data.status === 'PUBLISHED' ? now() : null;
  const result = await prisma.$transaction(async (tx) => {
    const homework = await tx.homework.create({ data });
    if (parsed.value.studentIds.length) await tx.homeworkAudience.createMany({ data: parsed.value.studentIds.map(studentId => ({ schoolId: user.schoolId, homeworkId: homework.id, studentId,
      kind: parsed.value.audienceMode === 'ENTIRE_SECTION_WITH_EXCLUSIONS' ? 'EXCLUDE' : 'INCLUDE' })) });
    if (checkedFiles.value.length) await tx.academicAttachment.createMany({ data: checkedFiles.value.map(file => ({ ...file, schoolId: user.schoolId, homeworkId: homework.id, uploadedByUserId: user.id })) });
    if (parsed.value.externalLinks.length) await tx.academicExternalLink.createMany({ data: parsed.value.externalLinks.map(link => ({ ...link, schoolId: user.schoolId, homeworkId: homework.id })) });
    await audit(tx, user, 'HOMEWORK_CREATED', 'HOMEWORK', homework.id, null, homework);
    return homework;
  });
  if (result.status === 'PUBLISHED') await notifyHomeworkAudience(result.id, user, 'HOMEWORK_PUBLISHED');
  return prisma.homework.findUnique({ where: { id: result.id }, include: contentInclude });
};

const teacherScopeFilter = async (user) => {
  if (elevatedRoles.has(user.role)) return {};
  const teacher = await getTeacherForUser(user);
  if (!teacher) return { id: '__none__' };
  const assignments = await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, isActive: true,
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, select: { classId: true, sectionId: true, subjectId: true } });
  return assignments.length ? { OR: assignments.map(x => ({ classId: x.classId, sectionId: x.sectionId, subjectId: x.subjectId })) } : { id: '__none__' };
};

const resolvePortalStudent = async (user, requestedId) => {
  if (!['STUDENT', 'PARENT'].includes(user.role)) throw new HomeworkError('Student portal access required', 403);
  const studentId = requestedId || user.studentId;
  if (!studentId) throw new HomeworkError('Student identity is missing', 403);
  if (user.role === 'STUDENT' && studentId !== user.studentId) throw new HomeworkError('You cannot view another student', 403);
  if (user.role === 'PARENT' && studentId !== user.studentId) {
    const link = await prisma.feeFamilyLink.findFirst({ where: { schoolId: user.schoolId, parentUserId: user.email, studentId, active: true } });
    if (!link) throw new HomeworkError('This child is not linked to your account', 403, 'UNLINKED_CHILD');
  }
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: user.schoolId, isActive: true } });
  if (!student) throw new HomeworkError('Student not found', 404);
  return student;
};

const studentVisibilityWhere = (student) => ({
  schoolId: student.schoolId, academicSession: student.session, status: 'PUBLISHED', deletedAt: null,
  publishedAt: { lte: now() }, class: { className: student.className }, section: { sectionName: student.section || '' },
  OR: [
    { audienceMode: 'ENTIRE_SECTION', audiences: { none: { studentId: student.id, kind: 'EXCLUDE' } } },
    { audienceMode: 'ENTIRE_SECTION_WITH_EXCLUSIONS', audiences: { none: { studentId: student.id, kind: 'EXCLUDE' } } },
    { audienceMode: 'SELECTED_STUDENTS', audiences: { some: { studentId: student.id, kind: 'INCLUDE' } } },
  ],
});

const displayState = (homework, submissions) => {
  const latest = submissions?.[0];
  if (latest?.status === 'GRADED') return 'GRADED';
  if (latest?.status === 'RESUBMISSION_REQUESTED') return 'RESUBMISSION_REQUESTED';
  if (latest?.submittedAt) return latest.isLate ? 'SUBMITTED_LATE' : 'SUBMITTED';
  if (homework.status === 'CLOSED') return 'CLOSED';
  if (!homework.dueAt) return latest ? 'IN_PROGRESS' : 'NOT_STARTED';
  const remaining = new Date(homework.dueAt).getTime() - Date.now();
  if (remaining < 0) return 'OVERDUE';
  if (remaining <= 24 * 60 * 60 * 1000) return remaining <= 12 * 60 * 60 * 1000 ? 'DUE_TODAY' : 'DUE_SOON';
  return latest ? 'IN_PROGRESS' : 'NOT_STARTED';
};

const portalSubmissionSelect = { id: true, attemptNumber: true, textResponse: true, submittedAt: true, status: true, isLate: true, reviewedAt: true,
  marksAwarded: true, feedback: true, marksReleasedAt: true, returnedAt: true, resubmissionRequestedAt: true, createdAt: true, updatedAt: true };
const visibleSubmission = (submission, settings) => ({ ...submission,
  marksAwarded: settings.marksVisible && submission.marksReleasedAt ? submission.marksAwarded : null,
  feedback: settings.feedbackVisible && submission.reviewedAt ? submission.feedback : null,
});

export const listHomework = async (user, query = {}) => {
  const paging = pageArgs(query); let where; let student = null;
  if (['STUDENT', 'PARENT'].includes(user.role)) {
    student = await resolvePortalStudent(user, query.studentId);
    if (user.role === 'PARENT' && !(await moduleSettings(user.schoolId)).parentVisibility) throw new HomeworkError('Parent homework visibility is disabled', 403);
    where = studentVisibilityWhere(student);
  } else {
    if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
    where = { schoolId: user.schoolId, deletedAt: null, ...(await teacherScopeFilter(user)) };
  }
  if (query.status && !student) where.status = String(query.status).toUpperCase();
  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.sectionId) where.sectionId = query.sectionId;
  if (query.chapterId) where.chapterId = query.chapterId;
  if (query.search) where.AND = [...(where.AND || []), { title: { contains: String(query.search), mode: 'insensitive' } }];
  const include = { ...contentInclude, audiences: true, ...(student ? { submissions: { where: { studentId: student.id }, select: portalSubmissionSelect, orderBy: { attemptNumber: 'desc' }, take: 1 } } : { _count: { select: { submissions: true, audiences: true } } }) };
  const [items, total] = await Promise.all([prisma.homework.findMany({ where, include, orderBy: query.sort === 'oldest' ? { createdAt: 'asc' } : [{ dueAt: 'asc' }, { createdAt: 'desc' }], skip: paging.skip, take: paging.take }), prisma.homework.count({ where })]);
  const settings = student ? await moduleSettings(user.schoolId) : null;
  return { items: student ? items.map(item => ({ ...item, submissions: item.submissions.map(row => visibleSubmission(row, settings)), displayState: displayState(item, item.submissions) })) : items, pagination: { page: paging.page, pageSize: paging.pageSize, total, pages: Math.ceil(total / paging.pageSize) } };
};

export const getHomework = async (user, id, requestedStudentId) => {
  let where = { id, schoolId: user.schoolId, deletedAt: null }; let student = null;
  if (['STUDENT', 'PARENT'].includes(user.role)) { student = await resolvePortalStudent(user, requestedStudentId); where = { ...where, ...studentVisibilityWhere(student) }; }
  else if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
  const homework = await prisma.homework.findFirst({ where, include: { ...contentInclude, audiences: true, submissions: student ? { where: { studentId: student.id }, select: { ...portalSubmissionSelect, attachments: true }, orderBy: { attemptNumber: 'desc' } } : false } });
  if (!homework) throw new HomeworkError('Homework not found', 404);
  if (user.role === 'TEACHER') await validateCurriculumScope(user, homework);
  if (!student) return homework;
  const settings = await moduleSettings(user.schoolId);
  return { ...homework, submissions: homework.submissions.map(row => visibleSubmission(row, settings)), displayState: displayState(homework, homework.submissions) };
};

export const updateHomework = async (user, id, body) => {
  const existing = await prisma.homework.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null } });
  if (!existing) throw new HomeworkError('Homework not found', 404);
  await validateCurriculumScope(user, existing);
  const parsed = validateHomeworkInput({ ...existing, ...body }, { partial: true });
  if (parsed.errors.length) throw new HomeworkError(parsed.errors.join('. '));
  if (existing.status === 'PUBLISHED' && body.dueAt && existing.dueAt && new Date(body.dueAt) < existing.dueAt && body.confirmEarlierDueDate !== true) throw new HomeworkError('Moving a published due date earlier requires confirmEarlierDueDate=true', 409, 'EARLIER_DUE_CONFIRMATION');
  const allowed = ['title','description','instructions','priority','estimatedMinutes','maximumMarks','passingMarks','allowLateSubmission','submissionInstructions','dueAt'];
  const data = Object.fromEntries(allowed.filter(key => body[key] !== undefined).map(key => [key, parsed.value[key]]));
  if (existing.status === 'PUBLISHED') data.updatedAfterPublish = true;
  const updated = await prisma.$transaction(async tx => { const row = await tx.homework.update({ where: { id }, data }); await audit(tx, user, 'HOMEWORK_UPDATED', 'HOMEWORK', id, existing, row); return row; });
  if (existing.status === 'PUBLISHED') await notifyHomeworkAudience(id, user, body.dueAt ? 'HOMEWORK_DUE_DATE_CHANGED' : 'HOMEWORK_UPDATED');
  return updated;
};

export const transitionHomework = async (user, id, action) => {
  const existing = await prisma.homework.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null }, include: { _count: { select: { submissions: true } } } });
  if (!existing) throw new HomeworkError('Homework not found', 404);
  await validateCurriculumScope(user, existing);
  const map = { publish: 'PUBLISHED', close: 'CLOSED', archive: 'ARCHIVED', cancel: 'CANCELLED' };
  const status = map[action]; if (!status) throw new HomeworkError('Invalid transition');
  const data = { status, ...(status === 'PUBLISHED' ? { publishedAt: now(), scheduledAt: null } : {}), ...(status === 'CLOSED' ? { closedAt: now() } : {}), ...(status === 'ARCHIVED' ? { archivedAt: now() } : {}) };
  const updated = await prisma.$transaction(async tx => { const row = await tx.homework.update({ where: { id }, data }); await audit(tx, user, `HOMEWORK_${status}`, 'HOMEWORK', id, existing, row); return row; });
  if (['PUBLISHED','CANCELLED'].includes(status)) await notifyHomeworkAudience(id, user, `HOMEWORK_${status}`);
  return updated;
};

export const deleteHomework = async (user, id) => {
  const row = await prisma.homework.findFirst({ where: { id, schoolId: user.schoolId }, include: { _count: { select: { submissions: true } } } });
  if (!row) throw new HomeworkError('Homework not found', 404);
  await validateCurriculumScope(user, row);
  if (row._count.submissions || row.status !== 'DRAFT') throw new HomeworkError('Published homework or homework with submissions must be cancelled or archived', 409);
  await prisma.homework.update({ where: { id }, data: { deletedAt: now() } });
};

const audienceStudents = async (homework) => {
  const base = { schoolId: homework.schoolId, className: homework.class.className, section: homework.section.sectionName, session: homework.academicSession, isActive: true };
  if (homework.audienceMode === 'SELECTED_STUDENTS') base.homeworkAudiences = { some: { homeworkId: homework.id, kind: 'INCLUDE' } };
  else base.homeworkAudiences = { none: { homeworkId: homework.id, kind: 'EXCLUDE' } };
  return prisma.student.findMany({ where: base, select: { id: true, studentUserId: true, parentUserId: true } });
};

export const notifyHomeworkAudience = async (homeworkId, actor, type) => {
  const homework = await prisma.homework.findFirst({ where: { id: homeworkId, schoolId: actor.schoolId }, include: { class: true, section: true } });
  if (!homework) return;
  const students = await audienceStudents(homework);
  const title = type === 'HOMEWORK_PUBLISHED' ? 'New homework' : type === 'HOMEWORK_CANCELLED' ? 'Homework cancelled' : 'Homework updated';
  await createSystemNotification({ schoolId: homework.schoolId, type, category: 'HOMEWORK', priority: homework.priority === 'URGENT' ? 'URGENT' : 'NORMAL', title, message: homework.title, actionUrl: '/homework', sourceModule: 'HOMEWORK', sourceEntityType: 'HOMEWORK', sourceEntityId: homework.id, dedupeKey: `${type}:${homework.id}:${homework.updatedAt.getTime()}`, students: students.map((student) => student.id) });
};

export const saveSubmission = async (user, homeworkId, body, draft = false) => {
  if (user.role !== 'STUDENT') throw new HomeworkError('Only students can submit homework', 403);
  const student = await resolvePortalStudent(user); const homework = await getHomework(user, homeworkId);
  if (!homework.allowSubmission) throw new HomeworkError('This homework does not require a submission', 409);
  if (homework.status !== 'PUBLISHED') throw new HomeworkError('Homework is not open for submission', 409);
  const submittedAt = draft ? null : now(); const late = Boolean(submittedAt && homework.dueAt && submittedAt > homework.dueAt);
  if (late && !homework.allowLateSubmission) throw new HomeworkError('The deadline has passed and late submissions are disabled', 409, 'LATE_DISABLED');
  const attempts = await prisma.homeworkSubmission.findMany({ where: { homeworkId, studentId: student.id }, orderBy: { attemptNumber: 'desc' }, take: 1 });
  const latest = attempts[0];
  if (latest?.submittedAt && latest.status !== 'RESUBMISSION_REQUESTED') throw new HomeworkError('A final submission already exists', 409, 'DUPLICATE_SUBMISSION');
  const attemptNumber = latest?.status === 'RESUBMISSION_REQUESTED' ? latest.attemptNumber + 1 : latest?.attemptNumber || 1;
  if (attemptNumber > homework.maximumAttempts) throw new HomeworkError('Maximum submission attempts reached', 409);
  const settings = await moduleSettings(user.schoolId); const checkedFiles = validateAttachments(body.attachments || [], { ...settings, maximumAttachmentCount: homework.maximumAttachments });
  if (checkedFiles.errors.length) throw new HomeworkError(checkedFiles.errors.join('. '));
  if (!draft && homework.requiresAttachment && !checkedFiles.value.length) throw new HomeworkError('An attachment is required');
  if (!draft && !String(body.textResponse || '').trim() && !checkedFiles.value.length) throw new HomeworkError('Add a text response or attachment');
  const result = await prisma.$transaction(async tx => {
    const submission = latest && !latest.submittedAt ? await tx.homeworkSubmission.update({ where: { id: latest.id }, data: { textResponse: String(body.textResponse || '').trim() || null, submittedAt, isLate: late, status: draft ? 'IN_PROGRESS' : late ? 'LATE_SUBMITTED' : 'SUBMITTED' } })
      : await tx.homeworkSubmission.create({ data: { schoolId: user.schoolId, homeworkId, studentId: student.id, attemptNumber, textResponse: String(body.textResponse || '').trim() || null, submittedAt, isLate: late, status: draft ? 'IN_PROGRESS' : late ? 'LATE_SUBMITTED' : attemptNumber > 1 ? 'RESUBMITTED' : 'SUBMITTED' } });
    if (checkedFiles.value.length) await tx.academicAttachment.createMany({ data: checkedFiles.value.map(file => ({ ...file, schoolId: user.schoolId, submissionId: submission.id })) });
    return submission;
  });
  if (!draft && homework.createdByUserId) await createSystemNotification({ schoolId: user.schoolId, type: 'SUBMISSION_RECEIVED', category: 'HOMEWORK', title: 'Homework submitted', message: homework.title, actionUrl: '/homework', sourceModule: 'HOMEWORK', sourceEntityType: 'HOMEWORK_SUBMISSION', sourceEntityId: result.id, dedupeKey: `SUBMISSION_RECEIVED:${result.id}`, userIds: [homework.createdByUserId], roles: [] });
  return result;
};

export const listSubmissions = async (user, homeworkId, query = {}) => {
  const homework = await prisma.homework.findFirst({ where: { id: homeworkId, schoolId: user.schoolId, deletedAt: null } });
  if (!homework) throw new HomeworkError('Homework not found', 404); await validateCurriculumScope(user, homework);
  const paging = pageArgs(query); const where = { schoolId: user.schoolId, homeworkId, ...(query.status ? { status: query.status } : {}), ...(query.late !== undefined ? { isLate: query.late === 'true' } : {}) };
  const [items, total] = await Promise.all([prisma.homeworkSubmission.findMany({ where, include: { student: { select: { id: true, studentFirstName: true, studentLastName: true, rollNumber: true } }, attachments: true }, orderBy: { submittedAt: 'desc' }, skip: paging.skip, take: paging.take }), prisma.homeworkSubmission.count({ where })]);
  return { items, pagination: { page: paging.page, pageSize: paging.pageSize, total }, summary: await prisma.homeworkSubmission.groupBy({ by: ['status'], where: { schoolId: user.schoolId, homeworkId }, _count: true }) };
};

export const reviewSubmission = async (user, homeworkId, submissionId, body) => {
  const homework = await prisma.homework.findFirst({ where: { id: homeworkId, schoolId: user.schoolId } });
  if (!homework) throw new HomeworkError('Homework not found', 404); await validateCurriculumScope(user, homework);
  const submission = await prisma.homeworkSubmission.findFirst({ where: { id: submissionId, homeworkId, schoolId: user.schoolId } });
  if (!submission) throw new HomeworkError('Submission not found', 404);
  const marks = body.marksAwarded === '' || body.marksAwarded === undefined ? null : Number(body.marksAwarded);
  if (marks !== null && (!Number.isInteger(marks) || marks < 0 || (homework.maximumMarks !== null && marks > homework.maximumMarks))) throw new HomeworkError('Marks are outside the allowed range');
  const status = body.requestResubmission ? 'RESUBMISSION_REQUESTED' : marks !== null ? 'GRADED' : 'RETURNED'; const reviewedAt = now();
  const updated = await prisma.$transaction(async tx => { const row = await tx.homeworkSubmission.update({ where: { id: submissionId }, data: { marksAwarded: marks,
    feedback: String(body.feedback || '').trim() || null, privateTeacherNote: String(body.privateTeacherNote || '').trim() || null, status, reviewedAt,
    reviewedByUserId: user.id, returnedAt: status === 'RETURNED' ? reviewedAt : null, resubmissionRequestedAt: status === 'RESUBMISSION_REQUESTED' ? reviewedAt : null,
    marksReleasedAt: body.releaseMarks && marks !== null ? reviewedAt : null } }); await audit(tx, user, status, 'HOMEWORK_SUBMISSION', row.id, submission, row); return row; });
  await createSystemNotification({ schoolId: user.schoolId, type: status, category: 'HOMEWORK', title: status === 'RESUBMISSION_REQUESTED' ? 'Resubmission requested' : 'Homework reviewed', message: homework.title, actionUrl: '/homework', sourceModule: 'HOMEWORK', sourceEntityType: 'HOMEWORK_SUBMISSION', sourceEntityId: submission.id, dedupeKey: `${status}:${submission.id}:${reviewedAt.getTime()}`, students: [submission.studentId] });
  return updated;
};

export const listResources = async (user, query = {}) => {
  const paging = pageArgs(query); let where = { schoolId: user.schoolId, deletedAt: null };
  if (['STUDENT','PARENT'].includes(user.role)) { const student = await resolvePortalStudent(user, query.studentId); where = { ...where, academicSession: student.session,
    status: 'PUBLISHED', isVisibleToStudents: true, publishedAt: { lte: now() }, class: { className: student.className }, section: { sectionName: student.section || '' } }; }
  else where = { ...where, ...(await teacherScopeFilter(user)) };
  if (query.subjectId) where.subjectId = query.subjectId; if (query.chapterId) where.chapterId = query.chapterId; if (query.resourceType) where.resourceType = query.resourceType;
  const include = { class: { select: { className: true } }, section: { select: { sectionName: true } }, subject: { select: { subjectName: true } }, chapter: { select: { chapterName: true } }, attachments: true, externalLinks: true };
  const [items,total] = await Promise.all([prisma.sectionResource.findMany({ where, include, orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }], skip: paging.skip, take: paging.take }), prisma.sectionResource.count({ where })]);
  return { items, pagination: { page: paging.page, pageSize: paging.pageSize, total } };
};

export const createResource = async (user, body) => {
  const parsed = validateResourceInput(body); if (parsed.errors.length) throw new HomeworkError(parsed.errors.join('. '));
  const scope = await validateCurriculumScope(user, parsed.value); const settings = await moduleSettings(user.schoolId);
  const files = validateAttachments(parsed.value.attachments, settings); if (files.errors.length) throw new HomeworkError(files.errors.join('. '));
  const { links, attachments, ...value } = parsed.value;
  const resource = await prisma.$transaction(async tx => { const row = await tx.sectionResource.create({ data: { ...value, schoolId: user.schoolId, teacherId: scope.teacher?.id || null,
    createdByUserId: user.id, createdByRole: user.role, isVisibleToStudents: value.status === 'PUBLISHED', publishedAt: value.status === 'PUBLISHED' ? now() : null } });
    if (files.value.length) await tx.academicAttachment.createMany({ data: files.value.map(file => ({ ...file, schoolId: user.schoolId, resourceId: row.id, uploadedByUserId: user.id })) });
    if (links.length) await tx.academicExternalLink.createMany({ data: links.map(link => ({ ...link, schoolId: user.schoolId, resourceId: row.id })) });
    await audit(tx, user, 'RESOURCE_CREATED', 'RESOURCE', row.id, null, row); return row; });
  if (resource.status === 'PUBLISHED') await notifyResourceAudience(resource.id, user, 'RESOURCE_PUBLISHED');
  return resource;
};

const notifyResourceAudience = async (resourceId, actor, type) => {
  const resource = await prisma.sectionResource.findFirst({ where: { id: resourceId, schoolId: actor.schoolId }, include: { class: true, section: true } });
  if (!resource) return;
  const students = await prisma.student.findMany({ where: { schoolId: actor.schoolId, className: resource.class.className, section: resource.section.sectionName,
    ...(resource.academicSession ? { session: resource.academicSession } : {}), isActive: true }, select: { id: true } });
  await createSystemNotification({ schoolId: actor.schoolId, type, category: 'RESOURCE', title: 'New learning resource', message: resource.title, actionUrl: '/homework', sourceModule: 'HOMEWORK', sourceEntityType: 'RESOURCE', sourceEntityId: resource.id, dedupeKey: `${type}:${resource.id}:${resource.updatedAt.getTime()}`, students: students.map((student) => student.id) });
};

export const getResource = async (user, id, requestedStudentId) => {
  let where = { id, schoolId: user.schoolId, deletedAt: null };
  if (['STUDENT','PARENT'].includes(user.role)) {
    const student = await resolvePortalStudent(user, requestedStudentId);
    where = { ...where, academicSession: student.session, status: 'PUBLISHED', isVisibleToStudents: true, publishedAt: { lte: now() }, class: { className: student.className }, section: { sectionName: student.section || '' } };
  }
  const row = await prisma.sectionResource.findFirst({ where, include: { class: true, section: true, subject: true, chapter: true, attachments: true, externalLinks: true } });
  if (!row) throw new HomeworkError('Resource not found', 404);
  if (staffRoles.has(user.role)) await validateCurriculumScope(user, row);
  return row;
};

export const updateResource = async (user, id, body) => {
  const existing = await prisma.sectionResource.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null } });
  if (!existing) throw new HomeworkError('Resource not found', 404);
  await validateCurriculumScope(user, existing);
  const data = {};
  if (body.title !== undefined) { data.title = String(body.title).trim().slice(0, 200); if (!data.title) throw new HomeworkError('title is required'); }
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null;
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);
  if (body.isDownloadable !== undefined) data.isDownloadable = Boolean(body.isDownloadable);
  const updated = await prisma.$transaction(async tx => { const row = await tx.sectionResource.update({ where: { id }, data }); await audit(tx, user, 'RESOURCE_UPDATED', 'RESOURCE', id, existing, row); return row; });
  return updated;
};

export const transitionResource = async (user, id, action) => {
  const existing = await prisma.sectionResource.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null } });
  if (!existing) throw new HomeworkError('Resource not found', 404); await validateCurriculumScope(user, existing);
  const status = action === 'publish' ? 'PUBLISHED' : action === 'archive' ? 'ARCHIVED' : null; if (!status) throw new HomeworkError('Invalid resource transition');
  const updated = await prisma.$transaction(async tx => { const row = await tx.sectionResource.update({ where: { id }, data: { status, isVisibleToStudents: status === 'PUBLISHED', ...(status === 'PUBLISHED' ? { publishedAt: now(), scheduledAt: null } : {}) } });
    await audit(tx, user, `RESOURCE_${status}`, 'RESOURCE', id, existing, row); return row; });
  if (status === 'PUBLISHED') await notifyResourceAudience(id, user, 'RESOURCE_PUBLISHED');
  return updated;
};

export const deleteResource = async (user, id) => {
  const existing = await prisma.sectionResource.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null } });
  if (!existing) throw new HomeworkError('Resource not found', 404); await validateCurriculumScope(user, existing);
  if (existing.status !== 'DRAFT') throw new HomeworkError('Published resources must be archived', 409);
  await prisma.sectionResource.update({ where: { id }, data: { deletedAt: now(), isVisibleToStudents: false } });
};

export const getAnalytics = async (user) => {
  if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403); const scope = await teacherScopeFilter(user); const where = { schoolId: user.schoolId, deletedAt: null, ...scope };
  const [active, overdue, pendingReviews, resources, byStatus, totalSubmissions, lateSubmissions] = await Promise.all([
    prisma.homework.count({ where: { ...where, status: 'PUBLISHED' } }), prisma.homework.count({ where: { ...where, status: 'PUBLISHED', dueAt: { lt: now() } } }),
    prisma.homeworkSubmission.count({ where: { schoolId: user.schoolId, homework: where, status: { in: ['SUBMITTED','LATE_SUBMITTED','RESUBMITTED'] } } }),
    prisma.sectionResource.count({ where: { schoolId: user.schoolId, deletedAt: null, ...scope } }), prisma.homework.groupBy({ by: ['status'], where, _count: true }),
    prisma.homeworkSubmission.count({ where: { schoolId: user.schoolId, homework: where, submittedAt: { not: null } } }), prisma.homeworkSubmission.count({ where: { schoolId: user.schoolId, homework: where, isLate: true } }),
  ]);
  return { activeHomework: active, overdueHomework: overdue, pendingReviews, resources, contentStatus: byStatus, totalSubmissions, lateSubmissionRate: totalSubmissions ? Math.round(lateSubmissions / totalSubmissions * 100) : 0 };
};

export const publishScheduledContent = async () => {
  const timestamp = now(); const homework = await prisma.homework.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: timestamp }, deletedAt: null } });
  await prisma.homework.updateMany({ where: { id: { in: homework.map(x => x.id) } }, data: { status: 'PUBLISHED', publishedAt: timestamp } });
  const scheduledResources = await prisma.sectionResource.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: timestamp }, deletedAt: null }, select: { id: true, schoolId: true } });
  const resources = await prisma.sectionResource.updateMany({ where: { id: { in: scheduledResources.map(x => x.id) } }, data: { status: 'PUBLISHED', publishedAt: timestamp, isVisibleToStudents: true } });
  await Promise.all(homework.map(row => notifyHomeworkAudience(row.id, { schoolId: row.schoolId }, 'HOMEWORK_PUBLISHED')));
  await Promise.all(scheduledResources.map(row => notifyResourceAudience(row.id, { schoolId: row.schoolId }, 'RESOURCE_PUBLISHED')));
  return { homework: homework.length, resources: resources.count };
};

export const processHomeworkReminders = async () => {
  const timestamp = now(); const tomorrow = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.homework.findMany({ where: { status: 'PUBLISHED', deletedAt: null, dueAt: { not: null, lte: tomorrow } }, include: { class: true, section: true }, take: 500 });
  let created = 0;
  for (const homework of rows) {
    const students = await audienceStudents(homework);
    const completed = await prisma.homeworkSubmission.findMany({ where: { schoolId: homework.schoolId, homeworkId: homework.id, studentId: { in: students.map(x => x.id) },
      status: { in: ['SUBMITTED','LATE_SUBMITTED','RESUBMITTED','UNDER_REVIEW','RETURNED','GRADED','EXCUSED'] } }, distinct: ['studentId'], select: { studentId: true } });
    const done = new Set(completed.map(x => x.studentId)); const overdue = homework.dueAt < timestamp; const type = overdue ? 'HOMEWORK_OVERDUE' : 'HOMEWORK_DUE_SOON';
    const day = timestamp.toISOString().slice(0, 10); const pending = students.filter(student => !done.has(student.id));
    if (pending.length) {
      const result = await createSystemNotification({ schoolId: homework.schoolId, type, category: 'HOMEWORK', priority: overdue ? 'HIGH' : 'NORMAL', title: overdue ? 'Homework overdue' : 'Homework due soon', message: homework.title, actionUrl: '/homework', sourceModule: 'HOMEWORK', sourceEntityType: 'HOMEWORK', sourceEntityId: homework.id, dedupeKey: `${type}:${homework.id}:${day}`, students: pending.map((student) => student.id) }); created += result?.resolvedRecipientCount || 0;
    }
  }
  return { scanned: rows.length, created };
};
