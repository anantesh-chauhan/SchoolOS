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
const jsonSnapshot = (value) => JSON.parse(JSON.stringify(value));
const assertCanModify = (user, content, reason) => {
  if (user.role === 'TEACHER' && content.createdByUserId !== user.id) throw new HomeworkError('Teachers can only modify content they created', 403, 'NOT_CONTENT_OWNER');
  if (['ADMIN', 'SCHOOL_OWNER'].includes(user.role) && content.createdByUserId && content.createdByUserId !== user.id && !String(reason || '').trim()) {
    throw new HomeworkError('A reason is required when modifying another user’s content', 400, 'MODIFICATION_REASON_REQUIRED');
  }
};
const saveVersion = async (tx, user, type, id, snapshot, reason) => {
  const where = type === 'HOMEWORK' ? { homeworkId: id } : { resourceId: id };
  const version = await tx.resourceVersion.count({ where }) + 1;
  return tx.resourceVersion.create({ data: { schoolId: user.schoolId, ...where, version, snapshot: jsonSnapshot(snapshot), reason: String(reason || '').trim() || null, createdByUserId: user.id } });
};

export const validateCurriculumScope = async (user, scope, { requireManage = true } = {}) => {
  if (!user?.schoolId) throw new HomeworkError('School context is required', 403, 'TENANT_REQUIRED');
  if (!scope.classId || !scope.sectionId || !scope.subjectId) {
    if (requireManage && elevatedRoles.has(user.role)) return { section: null, subject: null, chapter: null, teacher: null, assignment: null };
    throw new HomeworkError('A teacher-managed target requires a class, section, and subject', 403, 'INCOMPLETE_TEACHER_SCOPE');
  }
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
  const [sessions, school, contentTypes, categories, settings] = await Promise.all([
    prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true }, distinct: ['session'], select: { session: true }, orderBy: { session: 'desc' } }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { config: true } }),
    prisma.academicContentType.findMany({ where: { schoolId: user.schoolId, active: true }, orderBy: { displayName: 'asc' } }),
    prisma.resourceCategory.findMany({ where: { schoolId: user.schoolId, active: true }, orderBy: { name: 'asc' } }),
    moduleSettings(user.schoolId),
  ]);
  const sessionValues = sessions.map(x => x.session);
  const configuredSession = school?.config && typeof school.config === 'object' ? school.config.academicSession : null;
  if (configuredSession && !sessionValues.includes(configuredSession)) sessionValues.unshift(configuredSession);
  const studentOr = scopes.map(scope => ({ className: scope.className, section: scope.sectionName }));
  const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, ...(user.role === 'TEACHER' ? { OR: studentOr.length ? studentOr : [{ id: '__none__' }] } : {}) },
    select: { id: true, studentFirstName: true, studentLastName: true, className: true, section: true, rollNumber: true }, orderBy: [{ className: 'asc' }, { section: 'asc' }, { rollNumber: 'asc' }], take: 1000 });
  return { scopes, chapters, sessions: sessionValues, students, contentTypes, categories, settings };
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

const validateTaxonomy = async (schoolId, value) => {
  const [contentType, category] = await Promise.all([
    value.contentTypeCode ? prisma.academicContentType.findFirst({ where: { schoolId, code: value.contentTypeCode, active: true } }) : null,
    value.categoryId ? prisma.resourceCategory.findFirst({ where: { schoolId, id: value.categoryId, active: true } }) : null,
  ]);
  if (value.categoryId && !category) throw new HomeworkError('The selected category is not active in this school', 400, 'INVALID_CATEGORY');
  if (contentType && value.audienceScope === 'WHOLE_SCHOOL' && !contentType.canBeSchoolWide) throw new HomeworkError('This content type cannot be published school-wide', 400, 'CONTENT_TYPE_SCOPE_FORBIDDEN');
  return contentType;
};

const attachTags = async (tx, user, kind, contentId, tagNames) => {
  for (const rawName of tagNames || []) {
    const name = String(rawName).trim().slice(0, 60); const normalizedName = name.toLowerCase().replace(/\s+/g, ' ');
    if (!normalizedName) continue;
    const tag = await tx.resourceTag.upsert({ where: { schoolId_normalizedName: { schoolId: user.schoolId, normalizedName } }, update: { name, active: true }, create: { schoolId: user.schoolId, name, normalizedName } });
    await tx.resourceTagAssignment.create({ data: { schoolId: user.schoolId, tagId: tag.id, ...(kind === 'HOMEWORK' ? { homeworkId: contentId } : { resourceId: contentId }) } });
  }
};

const validateContentTargets = async (user, audienceScope, targets) => {
  if (!elevatedRoles.has(user.role) && user.role !== 'TEACHER') throw new HomeworkError('You cannot manage academic content', 403);
  if (user.role === 'TEACHER' && ['WHOLE_SCHOOL', 'SELECTED_CLASSES', 'ENTIRE_CLASS'].includes(audienceScope)) {
    throw new HomeworkError('Teachers cannot publish to whole-school or class-wide audiences', 403, 'TEACHER_AUDIENCE_FORBIDDEN');
  }
  if (audienceScope === 'WHOLE_SCHOOL') {
    if (!elevatedRoles.has(user.role)) throw new HomeworkError('Only administrators and curriculum managers may publish school-wide content', 403);
    return { targets: [{ scope: 'WHOLE_SCHOOL', classId: null, sectionId: null, subjectId: null, chapterId: null, studentId: null }], anchor: {}, studentCount: await prisma.student.count({ where: { schoolId: user.schoolId, isActive: true } }) };
  }

  const normalized = [];
  const directStudentIds = [...new Set(targets.map((target) => target.studentId).filter(Boolean))];
  const directStudents = directStudentIds.length
    ? await prisma.student.findMany({ where: { id: { in: directStudentIds }, schoolId: user.schoolId, isActive: true }, select: { id: true, className: true, section: true } })
    : [];
  if (directStudents.length !== directStudentIds.length) throw new HomeworkError('A selected student is outside this school or inactive', 400, 'INVALID_TARGET_STUDENT');
  const studentById = new Map(directStudents.map((row) => [row.id, row]));
  const derivedClasses = directStudents.length
    ? await prisma.class.findMany({ where: { schoolId: user.schoolId, className: { in: [...new Set(directStudents.map((row) => row.className))] }, deletedAt: null }, select: { id: true, className: true } })
    : [];
  const derivedClassByName = new Map(derivedClasses.map((row) => [row.className, row]));
  const derivedSections = derivedClasses.length
    ? await prisma.section.findMany({ where: { schoolId: user.schoolId, classId: { in: derivedClasses.map((row) => row.id) }, sectionName: { in: [...new Set(directStudents.map((row) => row.section || ''))] }, deletedAt: null }, select: { id: true, classId: true, sectionName: true } })
    : [];
  const derivedSectionByScope = new Map(derivedSections.map((row) => [`${row.classId}:${row.sectionName}`, row]));
  const targetClassIds = [...new Set([...targets.map((target) => target.classId).filter(Boolean), ...derivedClasses.map((row) => row.id)])];
  const targetSectionIds = [...new Set([...targets.map((target) => target.sectionId).filter(Boolean), ...derivedSections.map((row) => row.id)])];
  const [validClasses, validSections] = await Promise.all([
    targetClassIds.length ? prisma.class.findMany({ where: { id: { in: targetClassIds }, schoolId: user.schoolId, deletedAt: null }, select: { id: true } }) : [],
    targetSectionIds.length ? prisma.section.findMany({ where: { id: { in: targetSectionIds }, schoolId: user.schoolId, deletedAt: null }, select: { id: true, classId: true } }) : [],
  ]);
  const validClassIds = new Set(validClasses.map((row) => row.id));
  const validSectionById = new Map(validSections.map((row) => [row.id, row]));
  for (const target of targets) {
    const row = { ...target, scope: audienceScope };
    if (target.studentId) {
      const student = studentById.get(target.studentId);
      const classRow = derivedClassByName.get(student.className);
      const sectionRow = classRow ? derivedSectionByScope.get(`${classRow.id}:${student.section || ''}`) : null;
      row.classId = row.classId || classRow?.id || null;
      row.sectionId = row.sectionId || sectionRow?.id || null;
    }
    if (row.classId) {
      if (!validClassIds.has(row.classId)) throw new HomeworkError('A target class does not belong to this school', 400, 'INVALID_TARGET_CLASS');
    }
    if (row.sectionId) {
      const section = validSectionById.get(row.sectionId);
      if (section?.classId !== row.classId) throw new HomeworkError('A target section does not belong to its class and school', 400, 'INVALID_TARGET_SECTION');
    }
    if (row.subjectId) {
      if (!row.sectionId && user.role === 'TEACHER') throw new HomeworkError('Teachers must choose each assigned section for subject content', 403, 'TEACHER_SECTION_REQUIRED');
      if (row.sectionId) await validateCurriculumScope(user, row);
      else {
        const subject = await prisma.subject.findFirst({ where: { id: row.subjectId, schoolId: user.schoolId, deletedAt: null } });
        const mapping = await prisma.classSubject.findFirst({ where: { classId: row.classId, subjectId: row.subjectId } });
        if (!subject || !mapping) throw new HomeworkError('A target subject is not assigned to its class', 400, 'INVALID_TARGET_SUBJECT');
        if (row.chapterId) {
          const chapter = await prisma.chapter.findFirst({ where: { id: row.chapterId, schoolId: user.schoolId, subjectId: row.subjectId, deletedAt: null } });
          if (!chapter) throw new HomeworkError('A target chapter does not belong to its subject', 400, 'INVALID_TARGET_CHAPTER');
        }
      }
    } else if (user.role === 'TEACHER') {
      throw new HomeworkError('Teacher targets require a subject assignment', 403, 'TEACHER_SUBJECT_REQUIRED');
    }
    normalized.push(row);
  }
  const anchor = normalized[0] || {};
  const audience = await studentsForTargetRows(user.schoolId, normalized);
  return { targets: normalized, anchor, studentCount: audience.length };
};

const studentsForTargetRows = async (schoolId, targets, academicSession) => {
  if (!targets?.length) return [];
  if (targets.some(target => target.scope === 'WHOLE_SCHOOL')) return prisma.student.findMany({ where: { schoolId, isActive: true, ...(academicSession ? { session: academicSession } : {}) }, select: { id: true, studentUserId: true, parentUserId: true } });
  const directIds = targets.map(target => target.studentId).filter(Boolean);
  const classIds = [...new Set(targets.map(target => target.classId).filter(Boolean))];
  const sectionIds = [...new Set(targets.map(target => target.sectionId).filter(Boolean))];
  const [classes, sections] = await Promise.all([
    classIds.length ? prisma.class.findMany({ where: { schoolId, id: { in: classIds } }, select: { id: true, className: true } }) : [],
    sectionIds.length ? prisma.section.findMany({ where: { schoolId, id: { in: sectionIds } }, select: { id: true, sectionName: true, classId: true } }) : [],
  ]);
  const classNames = new Map(classes.map(row => [row.id, row.className]));
  const sectionNames = new Map(sections.map(row => [row.id, row.sectionName]));
  const ors = targets.filter(target => !target.studentId).map(target => ({
    ...(target.classId ? { className: classNames.get(target.classId) || '__none__' } : {}),
    ...(target.sectionId ? { section: sectionNames.get(target.sectionId) || '__none__' } : {}),
  }));
  return prisma.student.findMany({ where: { schoolId, isActive: true, ...(academicSession ? { session: academicSession } : {}), OR: [
    ...(directIds.length ? [{ id: { in: directIds } }] : []), ...ors,
  ] }, distinct: ['id'], select: { id: true, studentUserId: true, parentUserId: true } });
};

const contentInclude = {
  class: { select: { id: true, className: true } }, section: { select: { id: true, sectionName: true } },
  subject: { select: { id: true, subjectName: true, subjectCode: true } }, chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
  creator: { select: { id: true, name: true } }, attachments: true, externalLinks: true, targets: true,
};

export const createHomework = async (user, body) => {
  if (!staffRoles.has(user.role)) throw new HomeworkError('Only authorized school staff can create homework', 403);
  const parsed = validateHomeworkInput(body);
  if (parsed.errors.length) throw new HomeworkError(parsed.errors.join('. '), 400, 'VALIDATION_ERROR');
  const settings = await moduleSettings(user.schoolId);
  const contentType = await validateTaxonomy(user.schoolId, parsed.value);
  if (!settings.enabled) throw new HomeworkError('The homework module is disabled for this school', 403, 'MODULE_DISABLED');
  const approvalRequired = user.role === 'TEACHER' && settings.moderationMode === 'APPROVAL_REQUIRED' && parsed.value.status === 'PUBLISHED';
  if (approvalRequired) parsed.value.status = 'DRAFT';
  if (parsed.value.audienceScope === 'WHOLE_SCHOOL' && parsed.value.status === 'PUBLISHED' && body.confirmWholeSchool !== true) throw new HomeworkError('Whole-school publication requires confirmWholeSchool=true', 409, 'WHOLE_SCHOOL_CONFIRMATION');
  const targeting = await validateContentTargets(user, parsed.value.audienceScope, parsed.value.targets);
  const scope = targeting.anchor.sectionId && targeting.anchor.subjectId ? await validateCurriculumScope(user, targeting.anchor) : { teacher: null, assignment: null };
  const checkedFiles = validateAttachments(parsed.value.attachments, { ...settings, maximumUploadBytes: contentType?.maximumFileBytes || settings.maximumUploadBytes,
    allowedMimeTypes: contentType?.allowedMimeTypes?.length ? contentType.allowedMimeTypes : settings.allowedMimeTypes });
  if (checkedFiles.errors.length) throw new HomeworkError(checkedFiles.errors.join('. '), 400, 'INVALID_ATTACHMENT');
  if (parsed.value.status === 'PUBLISHED') parsed.value.scheduledAt = null;
  if (parsed.value.status === 'SCHEDULED' && !parsed.value.scheduledAt) throw new HomeworkError('scheduledAt is required for scheduled homework');
  const data = { ...parsed.value };
  delete data.studentIds; delete data.externalLinks; delete data.attachments; delete data.targets; delete data.tagNames;
  data.classId = targeting.anchor.classId || null; data.sectionId = targeting.anchor.sectionId || null;
  data.subjectId = targeting.anchor.subjectId || null; data.chapterId = targeting.anchor.chapterId || null;
  data.audienceMode = parsed.value.audienceScope === 'SELECTED_STUDENTS' ? 'SELECTED_STUDENTS' : 'ENTIRE_SECTION';
  data.schoolId = user.schoolId; data.createdByUserId = user.id; data.createdByRole = user.role;
  data.teacherAssignmentId = scope.assignment?.id || null;
  data.publishedAt = data.status === 'PUBLISHED' ? now() : null;
  const result = await prisma.$transaction(async (tx) => {
    const homework = await tx.homework.create({ data });
    await tx.resourceTarget.createMany({ data: targeting.targets.map(target => ({ ...target, schoolId: user.schoolId, homeworkId: homework.id })) });
    const selectedStudentIds = targeting.targets.map(target => target.studentId).filter(Boolean);
    if (selectedStudentIds.length) await tx.homeworkAudience.createMany({ data: selectedStudentIds.map(studentId => ({ schoolId: user.schoolId, homeworkId: homework.id, studentId,
      kind: parsed.value.audienceMode === 'ENTIRE_SECTION_WITH_EXCLUSIONS' ? 'EXCLUDE' : 'INCLUDE' })) });
    if (checkedFiles.value.length) await tx.academicAttachment.createMany({ data: checkedFiles.value.map(file => ({ ...file, schoolId: user.schoolId, homeworkId: homework.id, uploadedByUserId: user.id })) });
    if (parsed.value.externalLinks.length) await tx.academicExternalLink.createMany({ data: parsed.value.externalLinks.map(link => ({ ...link, schoolId: user.schoolId, homeworkId: homework.id })) });
    await attachTags(tx, user, 'HOMEWORK', homework.id, parsed.value.tagNames);
    if (approvalRequired) await tx.resourceModeration.create({ data: { schoolId: user.schoolId, homeworkId: homework.id, status: 'PENDING_REVIEW', submittedByUserId: user.id } });
    await audit(tx, user, 'HOMEWORK_CREATED', 'HOMEWORK', homework.id, null, homework);
    return homework;
  });
  if (result.status === 'PUBLISHED') await notifyHomeworkAudience(result.id, user, 'HOMEWORK_PUBLISHED');
  return { ...(await prisma.homework.findUnique({ where: { id: result.id }, include: contentInclude })), audiencePreview: { studentCount: targeting.studentCount } };
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

const studentVisibilityWhere = async (student, parent = false) => {
  const classRow = await prisma.class.findFirst({ where: { schoolId: student.schoolId, className: student.className, deletedAt: null }, select: { id: true } });
  const sectionRow = classRow ? await prisma.section.findFirst({ where: { schoolId: student.schoolId, classId: classRow.id, sectionName: student.section || '', deletedAt: null }, select: { id: true } }) : null;
  const explicitSubjects = await prisma.studentSubjectEnrollment.findMany({ where: { schoolId: student.schoolId, studentId: student.id, academicSession: student.session, isActive: true,
    effectiveFrom: { lte: now() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, select: { subjectId: true } });
  const mappedSubjects = !explicitSubjects.length && classRow ? await prisma.subject.findMany({ where: { schoolId: student.schoolId, deletedAt: null, OR: [
    { classSubjects: { some: { classId: classRow.id } } }, ...(sectionRow ? [{ sectionSubjects: { some: { sectionId: sectionRow.id } } }] : []),
  ] }, select: { id: true } }) : [];
  const subjectIds = (explicitSubjects.length ? explicitSubjects : mappedSubjects).map(row => row.subjectId || row.id);
  const targetOr = [{ scope: 'WHOLE_SCHOOL' }, { studentId: student.id }, ...(classRow ? [
    { classId: classRow.id, sectionId: null, subjectId: null },
    ...(sectionRow ? [{ classId: classRow.id, sectionId: sectionRow.id, subjectId: null }] : []),
    ...(subjectIds.length ? [{ classId: classRow.id, sectionId: null, subjectId: { in: subjectIds } }, ...(sectionRow ? [{ classId: classRow.id, sectionId: sectionRow.id, subjectId: { in: subjectIds } }] : [])] : []),
  ] : [])];
  return {
    schoolId: student.schoolId, academicSession: student.session, status: 'PUBLISHED', deletedAt: null,
    publishedAt: { lte: now() }, AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] },
      ...(parent ? [{ parentVisibility: true }] : []),
      { OR: [
        { targets: { some: { OR: targetOr } } },
        { targets: { none: {} }, class: { className: student.className }, section: { sectionName: student.section || '' }, OR: [
          { audienceMode: 'ENTIRE_SECTION', audiences: { none: { studentId: student.id, kind: 'EXCLUDE' } } },
          { audienceMode: 'ENTIRE_SECTION_WITH_EXCLUSIONS', audiences: { none: { studentId: student.id, kind: 'EXCLUDE' } } },
          { audienceMode: 'SELECTED_STUDENTS', audiences: { some: { studentId: student.id, kind: 'INCLUDE' } } },
        ] },
      ] },
    ],
  };
};

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
    where = await studentVisibilityWhere(student, user.role === 'PARENT');
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
  if (['STUDENT', 'PARENT'].includes(user.role)) { student = await resolvePortalStudent(user, requestedStudentId); where = { ...where, ...(await studentVisibilityWhere(student, user.role === 'PARENT')) }; }
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
  assertCanModify(user, existing, body.reason);
  await validateCurriculumScope(user, existing);
  const parsed = validateHomeworkInput({ ...existing, ...body }, { partial: true });
  if (parsed.errors.length) throw new HomeworkError(parsed.errors.join('. '));
  if (existing.status === 'PUBLISHED' && body.dueAt && existing.dueAt && new Date(body.dueAt) < existing.dueAt && body.confirmEarlierDueDate !== true) throw new HomeworkError('Moving a published due date earlier requires confirmEarlierDueDate=true', 409, 'EARLIER_DUE_CONFIRMATION');
  const allowed = ['title','description','instructions','priority','estimatedMinutes','maximumMarks','passingMarks','allowLateSubmission','submissionInstructions','dueAt'];
  const data = Object.fromEntries(allowed.filter(key => body[key] !== undefined).map(key => [key, parsed.value[key]]));
  if (existing.status === 'PUBLISHED') data.updatedAfterPublish = true;
  const updated = await prisma.$transaction(async tx => { await saveVersion(tx, user, 'HOMEWORK', id, existing, body.reason); const row = await tx.homework.update({ where: { id }, data }); await audit(tx, user, 'HOMEWORK_UPDATED', 'HOMEWORK', id, existing, row); return row; });
  if (existing.status === 'PUBLISHED') await notifyHomeworkAudience(id, user, body.dueAt ? 'HOMEWORK_DUE_DATE_CHANGED' : 'HOMEWORK_UPDATED');
  return updated;
};

export const transitionHomework = async (user, id, action, options = {}) => {
  const existing = await prisma.homework.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null }, include: { _count: { select: { submissions: true } } } });
  if (!existing) throw new HomeworkError('Homework not found', 404);
  assertCanModify(user, existing, options.reason);
  await validateCurriculumScope(user, existing);
  const map = { publish: 'PUBLISHED', close: 'CLOSED', archive: 'ARCHIVED', cancel: 'CANCELLED' };
  const status = map[action]; if (!status) throw new HomeworkError('Invalid transition');
  if (status === 'PUBLISHED' && existing.audienceScope === 'WHOLE_SCHOOL' && options.confirmWholeSchool !== true) throw new HomeworkError('Whole-school publication requires confirmation', 409, 'WHOLE_SCHOOL_CONFIRMATION');
  const data = { status, ...(status === 'PUBLISHED' ? { publishedAt: now(), scheduledAt: null } : {}), ...(status === 'CLOSED' ? { closedAt: now() } : {}), ...(status === 'ARCHIVED' ? { archivedAt: now() } : {}) };
  const updated = await prisma.$transaction(async tx => { await saveVersion(tx, user, 'HOMEWORK', id, existing, options.reason); const row = await tx.homework.update({ where: { id }, data }); await audit(tx, user, `HOMEWORK_${status}`, 'HOMEWORK', id, existing, row); return row; });
  if (['PUBLISHED','CANCELLED'].includes(status)) await notifyHomeworkAudience(id, user, `HOMEWORK_${status}`);
  return updated;
};

export const deleteHomework = async (user, id, options = {}) => {
  const row = await prisma.homework.findFirst({ where: { id, schoolId: user.schoolId }, include: { _count: { select: { submissions: true } } } });
  if (!row) throw new HomeworkError('Homework not found', 404);
  assertCanModify(user, row, options.reason);
  await validateCurriculumScope(user, row);
  if (row._count.submissions || row.status !== 'DRAFT') throw new HomeworkError('Published homework or homework with submissions must be cancelled or archived', 409);
  await prisma.homework.update({ where: { id }, data: { deletedAt: now() } });
};

const audienceStudents = async (homework) => {
  const targets = homework.targets || await prisma.resourceTarget.findMany({ where: { schoolId: homework.schoolId, homeworkId: homework.id } });
  if (targets.length) return studentsForTargetRows(homework.schoolId, targets, homework.academicSession);
  if (!homework.class || !homework.section) return [];
  const base = { schoolId: homework.schoolId, className: homework.class.className, section: homework.section.sectionName, session: homework.academicSession, isActive: true };
  if (homework.audienceMode === 'SELECTED_STUDENTS') base.homeworkAudiences = { some: { homeworkId: homework.id, kind: 'INCLUDE' } };
  else base.homeworkAudiences = { none: { homeworkId: homework.id, kind: 'EXCLUDE' } };
  return prisma.student.findMany({ where: base, select: { id: true, studentUserId: true, parentUserId: true } });
};

export const notifyHomeworkAudience = async (homeworkId, actor, type) => {
  const homework = await prisma.homework.findFirst({ where: { id: homeworkId, schoolId: actor.schoolId }, include: { class: true, section: true, targets: true } });
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

const resourceVisibilityWhere = async (student, parent = false) => {
  const classRow = await prisma.class.findFirst({ where: { schoolId: student.schoolId, className: student.className, deletedAt: null }, select: { id: true } });
  const sectionRow = classRow ? await prisma.section.findFirst({ where: { schoolId: student.schoolId, classId: classRow.id, sectionName: student.section || '', deletedAt: null }, select: { id: true } }) : null;
  const explicitSubjects = await prisma.studentSubjectEnrollment.findMany({ where: { schoolId: student.schoolId, studentId: student.id, academicSession: student.session, isActive: true,
    effectiveFrom: { lte: now() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, select: { subjectId: true } });
  const mappedSubjects = !explicitSubjects.length && classRow ? await prisma.subject.findMany({ where: { schoolId: student.schoolId, deletedAt: null, OR: [
    { classSubjects: { some: { classId: classRow.id } } }, ...(sectionRow ? [{ sectionSubjects: { some: { sectionId: sectionRow.id } } }] : []),
  ] }, select: { id: true } }) : [];
  const subjectIds = (explicitSubjects.length ? explicitSubjects : mappedSubjects).map(row => row.subjectId || row.id);
  const targetOr = [{ scope: 'WHOLE_SCHOOL' }, { studentId: student.id }, ...(classRow ? [
    { classId: classRow.id, sectionId: null, subjectId: null }, ...(sectionRow ? [{ classId: classRow.id, sectionId: sectionRow.id, subjectId: null }] : []),
    ...(subjectIds.length ? [{ classId: classRow.id, sectionId: null, subjectId: { in: subjectIds } }, ...(sectionRow ? [{ classId: classRow.id, sectionId: sectionRow.id, subjectId: { in: subjectIds } }] : [])] : []),
  ] : [])];
  return { schoolId: student.schoolId, deletedAt: null, status: 'PUBLISHED', isVisibleToStudents: true, publishedAt: { lte: now() }, AND: [
    { OR: [{ academicSession: null }, { academicSession: student.session }] },
    { OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] },
    ...(parent ? [{ parentVisibility: true }] : []),
    { OR: [
      { targets: { some: { OR: targetOr } } },
      { targets: { none: {} }, class: { className: student.className }, section: { sectionName: student.section || '' } },
    ] },
  ] };
};

export const listResources = async (user, query = {}) => {
  const paging = pageArgs(query); let where = { schoolId: user.schoolId, deletedAt: null };
  if (['STUDENT','PARENT'].includes(user.role)) { if (user.role === 'PARENT' && !(await moduleSettings(user.schoolId)).parentVisibility) throw new HomeworkError('Parent resource visibility is disabled', 403); const student = await resolvePortalStudent(user, query.studentId); where = await resourceVisibilityWhere(student, user.role === 'PARENT'); }
  else { if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403); where = { ...where, ...(await teacherScopeFilter(user)) }; }
  if (query.subjectId) where.subjectId = query.subjectId; if (query.chapterId) where.chapterId = query.chapterId; if (query.resourceType) where.resourceType = query.resourceType;
  const include = { class: { select: { className: true } }, section: { select: { sectionName: true } }, subject: { select: { subjectName: true } }, chapter: { select: { chapterName: true } }, attachments: true, externalLinks: true, targets: true };
  const [items,total] = await Promise.all([prisma.sectionResource.findMany({ where, include, orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }], skip: paging.skip, take: paging.take }), prisma.sectionResource.count({ where })]);
  return { items, pagination: { page: paging.page, pageSize: paging.pageSize, total } };
};

export const createResource = async (user, body) => {
  const parsed = validateResourceInput(body); if (parsed.errors.length) throw new HomeworkError(parsed.errors.join('. '));
  if (parsed.value.audienceScope === 'WHOLE_SCHOOL' && parsed.value.status === 'PUBLISHED' && body.confirmWholeSchool !== true) throw new HomeworkError('Whole-school publication requires confirmWholeSchool=true', 409, 'WHOLE_SCHOOL_CONFIRMATION');
  if (parsed.value.status === 'SCHEDULED' && (!parsed.value.scheduledAt || Number.isNaN(parsed.value.scheduledAt.getTime()))) throw new HomeworkError('A valid scheduledAt is required for scheduled resources');
  const targeting = await validateContentTargets(user, parsed.value.audienceScope, parsed.value.targets);
  const scope = targeting.anchor.sectionId && targeting.anchor.subjectId ? await validateCurriculumScope(user, targeting.anchor) : { teacher: null };
  const settings = await moduleSettings(user.schoolId);
  const contentType = await validateTaxonomy(user.schoolId, parsed.value);
  const approvalRequired = user.role === 'TEACHER' && settings.moderationMode === 'APPROVAL_REQUIRED' && parsed.value.status === 'PUBLISHED';
  if (approvalRequired) parsed.value.status = 'DRAFT';
  const files = validateAttachments(parsed.value.attachments, { ...settings, maximumUploadBytes: contentType?.maximumFileBytes || settings.maximumUploadBytes,
    allowedMimeTypes: contentType?.allowedMimeTypes?.length ? contentType.allowedMimeTypes : settings.allowedMimeTypes }); if (files.errors.length) throw new HomeworkError(files.errors.join('. '));
  const { links, attachments, targets, tagNames, ...value } = parsed.value;
  value.classId = targeting.anchor.classId || null; value.sectionId = targeting.anchor.sectionId || null;
  value.subjectId = targeting.anchor.subjectId || null; value.chapterId = targeting.anchor.chapterId || null;
  const resource = await prisma.$transaction(async tx => { const row = await tx.sectionResource.create({ data: { ...value, schoolId: user.schoolId, teacherId: scope.teacher?.id || null,
    createdByUserId: user.id, createdByRole: user.role, isVisibleToStudents: value.status === 'PUBLISHED', publishedAt: value.status === 'PUBLISHED' ? now() : null } });
    await tx.resourceTarget.createMany({ data: targeting.targets.map(target => ({ ...target, schoolId: user.schoolId, resourceId: row.id })) });
    if (files.value.length) await tx.academicAttachment.createMany({ data: files.value.map(file => ({ ...file, schoolId: user.schoolId, resourceId: row.id, uploadedByUserId: user.id })) });
    if (links.length) await tx.academicExternalLink.createMany({ data: links.map(link => ({ ...link, schoolId: user.schoolId, resourceId: row.id })) });
    await attachTags(tx, user, 'RESOURCE', row.id, tagNames);
    if (approvalRequired) await tx.resourceModeration.create({ data: { schoolId: user.schoolId, resourceId: row.id, status: 'PENDING_REVIEW', submittedByUserId: user.id } });
    await audit(tx, user, 'RESOURCE_CREATED', 'RESOURCE', row.id, null, row); return row; });
  if (resource.status === 'PUBLISHED') await notifyResourceAudience(resource.id, user, 'RESOURCE_PUBLISHED');
  return { ...resource, audiencePreview: { studentCount: targeting.studentCount } };
};

const notifyResourceAudience = async (resourceId, actor, type) => {
  const resource = await prisma.sectionResource.findFirst({ where: { id: resourceId, schoolId: actor.schoolId }, include: { class: true, section: true, targets: true } });
  if (!resource) return;
  const students = resource.targets.length ? await studentsForTargetRows(actor.schoolId, resource.targets, resource.academicSession) : resource.class && resource.section
    ? await prisma.student.findMany({ where: { schoolId: actor.schoolId, className: resource.class.className, section: resource.section.sectionName,
      ...(resource.academicSession ? { session: resource.academicSession } : {}), isActive: true }, select: { id: true } }) : [];
  await createSystemNotification({ schoolId: actor.schoolId, type, category: 'RESOURCE', title: 'New learning resource', message: resource.title, actionUrl: '/homework', sourceModule: 'HOMEWORK', sourceEntityType: 'RESOURCE', sourceEntityId: resource.id, dedupeKey: `${type}:${resource.id}:${resource.updatedAt.getTime()}`, students: students.map((student) => student.id) });
};

export const getResource = async (user, id, requestedStudentId) => {
  let where = { id, schoolId: user.schoolId, deletedAt: null };
  if (['STUDENT','PARENT'].includes(user.role)) {
    const student = await resolvePortalStudent(user, requestedStudentId);
    where = { id, ...(await resourceVisibilityWhere(student, user.role === 'PARENT')) };
  }
  else if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
  const row = await prisma.sectionResource.findFirst({ where, include: { class: true, section: true, subject: true, chapter: true, attachments: true, externalLinks: true, targets: true } });
  if (!row) throw new HomeworkError('Resource not found', 404);
  if (staffRoles.has(user.role)) await validateCurriculumScope(user, row);
  return row;
};

export const updateResource = async (user, id, body) => {
  const existing = await prisma.sectionResource.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null } });
  if (!existing) throw new HomeworkError('Resource not found', 404);
  assertCanModify(user, existing, body.reason);
  await validateCurriculumScope(user, existing);
  const data = {};
  if (body.title !== undefined) { data.title = String(body.title).trim().slice(0, 200); if (!data.title) throw new HomeworkError('title is required'); }
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null;
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);
  if (body.isDownloadable !== undefined) data.isDownloadable = Boolean(body.isDownloadable);
  const updated = await prisma.$transaction(async tx => { await saveVersion(tx, user, 'RESOURCE', id, existing, body.reason); const row = await tx.sectionResource.update({ where: { id }, data }); await audit(tx, user, 'RESOURCE_UPDATED', 'RESOURCE', id, existing, row); return row; });
  return updated;
};

export const transitionResource = async (user, id, action, options = {}) => {
  const existing = await prisma.sectionResource.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null } });
  if (!existing) throw new HomeworkError('Resource not found', 404); assertCanModify(user, existing, options.reason); await validateCurriculumScope(user, existing);
  const status = action === 'publish' || action === 'restore' ? 'PUBLISHED' : action === 'archive' ? 'ARCHIVED' : null; if (!status) throw new HomeworkError('Invalid resource transition');
  if (action === 'publish' && existing.audienceScope === 'WHOLE_SCHOOL' && options.confirmWholeSchool !== true) throw new HomeworkError('Whole-school publication requires confirmation', 409, 'WHOLE_SCHOOL_CONFIRMATION');
  const updated = await prisma.$transaction(async tx => { await saveVersion(tx, user, 'RESOURCE', id, existing, options.reason); const row = await tx.sectionResource.update({ where: { id }, data: { status, isVisibleToStudents: status === 'PUBLISHED', archivedAt: status === 'ARCHIVED' ? now() : null, ...(status === 'PUBLISHED' ? { publishedAt: existing.publishedAt || now(), scheduledAt: null } : {}) } });
    await audit(tx, user, `RESOURCE_${status}`, 'RESOURCE', id, existing, row); return row; });
  if (status === 'PUBLISHED') await notifyResourceAudience(id, user, 'RESOURCE_PUBLISHED');
  return updated;
};

export const deleteResource = async (user, id, options = {}) => {
  const existing = await prisma.sectionResource.findFirst({ where: { id, schoolId: user.schoolId, deletedAt: null } });
  if (!existing) throw new HomeworkError('Resource not found', 404); assertCanModify(user, existing, options.reason); await validateCurriculumScope(user, existing);
  if (existing.status !== 'DRAFT') throw new HomeworkError('Published resources must be archived', 409);
  await prisma.sectionResource.update({ where: { id }, data: { deletedAt: now(), isVisibleToStudents: false } });
};

export const previewAudience = async (user, body) => {
  if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
  const parsed = validateResourceInput({ ...body, title: body.title || 'Audience preview', resourceType: body.resourceType || 'OTHER' });
  if (parsed.errors.length) throw new HomeworkError(parsed.errors.join('. '), 400, 'VALIDATION_ERROR');
  const result = await validateContentTargets(user, parsed.value.audienceScope, parsed.value.targets);
  const students = await studentsForTargetRows(user.schoolId, result.targets, body.academicSession);
  const parentKeys = new Set(students.filter(student => student.parentUserId).map(student => student.parentUserId));
  const familyLinks = students.length ? await prisma.feeFamilyLink.findMany({ where: { schoolId: user.schoolId, studentId: { in: students.map(student => student.id) }, active: true }, select: { parentUserId: true } }) : [];
  familyLinks.forEach(link => parentKeys.add(link.parentUserId));
  return { scope: parsed.value.audienceScope, targets: result.targets, studentCount: students.length, parentCount: body.parentVisibility === false ? 0 : parentKeys.size,
    requiresWholeSchoolConfirmation: parsed.value.audienceScope === 'WHOLE_SCHOOL' };
};

const contentRecord = async (user, kind, id, studentId) => {
  if (!['HOMEWORK','RESOURCE'].includes(kind)) throw new HomeworkError('Invalid content kind');
  return kind === 'HOMEWORK' ? getHomework(user, id, studentId) : getResource(user, id, studentId);
};

export const recordActivity = async (user, kind, id, activity, body = {}) => {
  const normalizedKind = String(kind || '').toUpperCase();
  const normalizedActivity = String(activity || '').toUpperCase();
  if (!['HOMEWORK','RESOURCE'].includes(normalizedKind)) throw new HomeworkError('Invalid content kind');
  if (!['VIEW','DOWNLOAD','BOOKMARK','ACKNOWLEDGMENT','COMPLETION','HELPFUL','BROKEN_LINK'].includes(normalizedActivity)) throw new HomeworkError('Invalid activity');
  if (user.role !== 'STUDENT') throw new HomeworkError('Student access required', 403);
  const student = await resolvePortalStudent(user); await contentRecord(user, normalizedKind, id);
  const contentKey = normalizedKind === 'HOMEWORK' ? { homeworkId: id, resourceId: null } : { resourceId: id, homeworkId: null };
  const existing = await prisma.resourceActivity.findFirst({ where: { schoolId: user.schoolId, studentId: student.id, kind: normalizedActivity, ...contentKey } });
  if (normalizedActivity === 'BOOKMARK' && body.active === false) {
    if (existing) await prisma.resourceActivity.delete({ where: { id: existing.id } });
    return { active: false };
  }
  const timestamp = now();
  const row = existing ? await prisma.resourceActivity.update({ where: { id: existing.id }, data: { count: { increment: normalizedActivity === 'VIEW' || normalizedActivity === 'DOWNLOAD' ? 1 : 0 }, lastAt: timestamp, metadata: body.metadata || undefined } })
    : await prisma.resourceActivity.create({ data: { schoolId: user.schoolId, studentId: student.id, kind: normalizedActivity, ...contentKey, metadata: body.metadata || undefined } });
  return { active: true, activity: row };
};

export const listVersions = async (user, kind, id) => {
  const normalizedKind = String(kind).toUpperCase(); await contentRecord(user, normalizedKind, id);
  if (!staffRoles.has(user.role)) throw new HomeworkError('Version history is available to authorized staff', 403);
  return prisma.resourceVersion.findMany({ where: { schoolId: user.schoolId, ...(normalizedKind === 'HOMEWORK' ? { homeworkId: id } : { resourceId: id }) }, orderBy: { version: 'desc' } });
};

export const createComment = async (user, kind, id, body) => {
  const normalizedKind = String(kind).toUpperCase();
  if (!['HOMEWORK','RESOURCE'].includes(normalizedKind)) throw new HomeworkError('Invalid content kind');
  const student = ['STUDENT','PARENT'].includes(user.role) ? await resolvePortalStudent(user, body.studentId) : null;
  await contentRecord(user, normalizedKind, id, student?.id);
  const text = String(body.body || '').trim().slice(0, 4000); if (!text) throw new HomeworkError('Question or reply text is required');
  return prisma.resourceComment.create({ data: { schoolId: user.schoolId, ...(normalizedKind === 'HOMEWORK' ? { homeworkId: id } : { resourceId: id }),
    studentId: student?.id || null, authorUserId: user.id || null, parentId: user.role === 'PARENT' ? user.id : null, body: text,
    isPrivate: body.isPrivate !== false, replyToId: body.replyToId || null, status: body.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN' } });
};

export const listComments = async (user, kind, id, requestedStudentId) => {
  const normalizedKind = String(kind).toUpperCase(); const student = ['STUDENT','PARENT'].includes(user.role) ? await resolvePortalStudent(user, requestedStudentId) : null;
  await contentRecord(user, normalizedKind, id, student?.id);
  const where = { schoolId: user.schoolId, ...(normalizedKind === 'HOMEWORK' ? { homeworkId: id } : { resourceId: id }),
    ...(student ? { OR: [{ isPrivate: false }, { studentId: student.id }] } : {}) };
  return prisma.resourceComment.findMany({ where, orderBy: { createdAt: 'asc' } });
};

export const getEngagement = async (user, kind, id) => {
  const normalizedKind = String(kind).toUpperCase(); const content = await contentRecord(user, normalizedKind, id);
  if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
  const key = normalizedKind === 'HOMEWORK' ? { homeworkId: id } : { resourceId: id };
  const targets = content.targets || await prisma.resourceTarget.findMany({ where: { schoolId: user.schoolId, ...key } });
  const students = await studentsForTargetRows(user.schoolId, targets, content.academicSession);
  const activity = await prisma.resourceActivity.groupBy({ by: ['kind'], where: { schoolId: user.schoolId, ...key }, _count: { _all: true }, _sum: { count: true } });
  const submissions = normalizedKind === 'HOMEWORK' ? await prisma.homeworkSubmission.groupBy({ by: ['status'], where: { schoolId: user.schoolId, homeworkId: id }, _count: { _all: true } }) : [];
  return { assignedStudents: students.length, activity, submissions };
};

export const duplicateResource = async (user, id, body = {}) => {
  const source = await getResource(user, id); if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
  const payload = { ...source, ...body, title: body.title || `${source.title} (copy)`, status: 'DRAFT', scheduledAt: null,
    targets: body.targets || source.targets.map(({ classId, sectionId, subjectId, chapterId, studentId }) => ({ classId, sectionId, subjectId, chapterId, studentId })),
    attachments: source.attachments.map(file => ({ fileName: file.fileName, originalName: file.originalName, fileUrl: file.fileUrl, publicId: file.publicId, mimeType: file.mimeType, fileSize: file.fileSize, attachmentType: file.attachmentType })),
    externalLinks: source.externalLinks.map(link => ({ label: link.label, url: link.url })) };
  return createResource(user, payload);
};

export const submitForModeration = async (user, kind, id) => {
  const normalizedKind = String(kind).toUpperCase(); const content = await contentRecord(user, normalizedKind, id);
  if (!staffRoles.has(user.role)) throw new HomeworkError('Forbidden', 403); assertCanModify(user, content);
  const key = normalizedKind === 'HOMEWORK' ? { homeworkId: id } : { resourceId: id };
  const active = await prisma.resourceModeration.findFirst({ where: { schoolId: user.schoolId, ...key, status: { in: ['PENDING_REVIEW','CHANGES_REQUESTED'] } }, orderBy: { createdAt: 'desc' } });
  if (active?.status === 'PENDING_REVIEW') throw new HomeworkError('This content is already pending review', 409, 'DUPLICATE_MODERATION_REQUEST');
  return prisma.resourceModeration.create({ data: { schoolId: user.schoolId, ...key, status: 'PENDING_REVIEW', submittedByUserId: user.id } });
};

export const listModeration = async (user, query = {}) => {
  if (!elevatedRoles.has(user.role)) throw new HomeworkError('Forbidden', 403);
  return prisma.resourceModeration.findMany({ where: { schoolId: user.schoolId, ...(query.status ? { status: String(query.status).toUpperCase() } : {}) },
    include: { homework: { select: { id: true, title: true, createdByUserId: true } }, resource: { select: { id: true, title: true, createdByUserId: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
};

export const reviewModeration = async (user, moderationId, body) => {
  if (!elevatedRoles.has(user.role)) throw new HomeworkError('Only administrators and curriculum managers can review content', 403);
  const moderation = await prisma.resourceModeration.findFirst({ where: { id: moderationId, schoolId: user.schoolId } });
  if (!moderation) throw new HomeworkError('Moderation request not found', 404);
  const status = String(body.status || '').toUpperCase();
  if (!['APPROVED','REJECTED','CHANGES_REQUESTED'].includes(status)) throw new HomeworkError('Invalid moderation decision');
  const reviewedAt = now();
  const result = await prisma.$transaction(async tx => {
    const row = await tx.resourceModeration.update({ where: { id: moderation.id }, data: { status, reviewedByUserId: user.id, reviewComment: String(body.reviewComment || '').trim() || null, reviewedAt } });
    if (status === 'APPROVED' && body.publish === true) {
      if (moderation.homeworkId) await tx.homework.update({ where: { id: moderation.homeworkId }, data: { status: 'PUBLISHED', publishedAt: reviewedAt, scheduledAt: null } });
      else await tx.sectionResource.update({ where: { id: moderation.resourceId }, data: { status: 'PUBLISHED', publishedAt: reviewedAt, scheduledAt: null, isVisibleToStudents: true } });
    }
    await audit(tx, user, `MODERATION_${status}`, moderation.homeworkId ? 'HOMEWORK' : 'RESOURCE', moderation.homeworkId || moderation.resourceId, moderation, row);
    return row;
  });
  if (status === 'APPROVED' && body.publish === true) {
    if (moderation.homeworkId) await notifyHomeworkAudience(moderation.homeworkId, user, 'HOMEWORK_PUBLISHED');
    else await notifyResourceAudience(moderation.resourceId, user, 'RESOURCE_PUBLISHED');
  }
  return result;
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
