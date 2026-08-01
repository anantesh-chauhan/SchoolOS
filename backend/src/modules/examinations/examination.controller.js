import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.client.js';
import { assignRanks, calculateStudent, DEFAULT_GRADE_RULES } from './examination.engine.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, message, details) => res.status(status).json({ success: false, message, details });
const schoolId = (req) => req.user?.schoolId || req.query.schoolId;
const actorId = (req) => req.user?.id || 'system';
const MANAGERS = new Set(['ADMIN', 'CURRICULUM_MANAGER', 'EXAM_COORDINATOR', 'EXAM_CONTROLLER']);
const APPROVERS = new Set(['PRINCIPAL', 'EXAM_COORDINATOR', 'EXAM_CONTROLLER']);
const DEFAULT_EXAM_COMPONENTS = [
  { name: 'Theory', code: 'THEORY', maximumMarks: 80, passingMarks: 26, weightage: 100, isMandatory: true },
  { name: 'Internal Assessment', code: 'INTERNAL', maximumMarks: 20, passingMarks: 7, weightage: 100, isMandatory: true },
];

const audit = (req, data) => prisma.examinationAuditLog.create({ data: {
  schoolId: schoolId(req), actorId: actorId(req), ipAddress: req.ip, userAgent: req.get('user-agent'), ...data,
} });

const findExam = (id, tenantId, include = {}) => prisma.examination.findFirst({ where: { id, schoolId: tenantId }, include });

const teacherForUser = async (req) => {
  if (!['TEACHER', 'CLASS_TEACHER'].includes(req.user.role)) return null;
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true, employeeId: true } });
  return prisma.teacher.findFirst({ where: { schoolId: req.user.schoolId, isActive: true, OR: [{ email: user?.email }, ...(user?.employeeId ? [{ employeeId: user.employeeId }] : [])] }, select: { id: true } });
};

const teacherScope = async (req) => {
  const teacher = await teacherForUser(req);
  if (!teacher) return { teacherId: null, classTeacherSectionIds: [] };
  const assignments = await prisma.sectionClassTeacherAssignment.findMany({ where: { schoolId: req.user.schoolId, teacherId: teacher.id, status: 'ACTIVE' }, select: { sectionId: true } });
  return { teacherId: teacher.id, classTeacherSectionIds: assignments.map((item) => item.sectionId) };
};

const assertTeacherSubject = async (req, examSubjectId) => {
  if (req.user.role !== 'TEACHER') return true;
  const teacher = await teacherForUser(req);
  const record = teacher && await prisma.examinationSubject.findFirst({ where: { id: examSubjectId, teacherId: teacher.id, examination: { schoolId: req.user.schoolId } } });
  if (!record) throw Object.assign(new Error('This subject is outside your teaching allocation'), { status: 403 });
  return true;
};

const rosterForCohort = async (cohort) => prisma.student.findMany({
  where: { schoolId: cohort.schoolId, isActive: true, className: cohort.class.className, section: cohort.section.sectionName, session: cohort.examination.academicSession.name },
  orderBy: [{ rollNumber: 'asc' }, { studentFirstName: 'asc' }],
  select: { id: true, admissionNo: true, rollNumber: true, studentFirstName: true, studentLastName: true, gender: true, category: true },
});

export const metadata = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const [sessions, classes, gradeScales, rules, allocationReadiness] = await Promise.all([
      prisma.academicSession.findMany({ where: { schoolId: tenantId }, orderBy: { startDate: 'desc' } }),
      prisma.class.findMany({ where: { schoolId: tenantId, deletedAt: null }, include: { sections: { where: { deletedAt: null }, orderBy: { sectionOrder: 'asc' } } }, orderBy: { classOrder: 'asc' } }),
      prisma.examinationGradeScale.findMany({ where: { schoolId: tenantId, isActive: true } }),
      prisma.examinationRuleSet.findMany({ where: { schoolId: tenantId, isActive: true } }),
      prisma.sectionSubjectAllocation.groupBy({
        by: ['academicSessionId', 'sectionId'],
        where: { schoolId: tenantId, status: { in: ['READY', 'TIMETABLED'] } },
        _count: true,
      }),
    ]);
    ok(res, { sessions, classes, gradeScales, rules, allocationReadiness: allocationReadiness.map((row) => ({ academicSessionId: row.academicSessionId, sectionId: row.sectionId, subjectCount: row._count })) });
  } catch (error) { next(error); }
};

export const roleDashboard = async (req, res, next) => {
  try {
    if (req.user.role === 'PLATFORM_OWNER') {
      const [schools, grouped, recent] = await Promise.all([
        prisma.school.count({ where: { status: 'ACTIVE' } }),
        prisma.examination.groupBy({ by: ['status'], _count: true }),
        prisma.examination.findMany({ take: 12, orderBy: { updatedAt: 'desc' }, include: { school: { select: { schoolName: true, schoolCode: true } }, academicSession: { select: { name: true } }, _count: { select: { cohorts: true, results: true } } } }),
      ]);
      return ok(res, { scope: 'PLATFORM', schools, statusCounts: Object.fromEntries(grouped.map((item) => [item.status, item._count])), recent });
    }
    const tenantId = schoolId(req);
    const teacherWorkspace = ['TEACHER', 'CLASS_TEACHER'].includes(req.user.role);
    const scope = teacherWorkspace ? await teacherScope(req) : null;
    const scopedCohorts = scope ? (req.user.role === 'CLASS_TEACHER'
      ? { sectionId: { in: scope.classTeacherSectionIds } }
      : { OR: [{ sectionId: { in: scope.classTeacherSectionIds } }, { subjects: { some: { teacherId: scope.teacherId } } }] }) : null;
    const examWhere = { schoolId: tenantId, ...(scope ? { cohorts: { some: scopedCohorts } } : {}) };
    const [grouped, exams, resultCount, reportCardCount] = await Promise.all([
      prisma.examination.groupBy({ by: ['status'], where: examWhere, _count: true }),
      prisma.examination.findMany({ where: examWhere, take: 8, orderBy: { updatedAt: 'desc' }, include: { academicSession: { select: { name: true } }, _count: { select: { cohorts: true, results: true } } } }),
      prisma.examinationStudentResult.count({ where: { schoolId: tenantId } }),
      prisma.examinationReportCard.count({ where: { examination: { schoolId: tenantId } } }),
    ]);
    let workQueue = [];
    if (teacherWorkspace) {
      const subjectQueue = req.user.role === 'TEACHER' ? await prisma.examinationSubject.findMany({ where: { teacherId: scope.teacherId, examination: { schoolId: tenantId, status: { in: ['MARK_ENTRY_OPEN', 'MARK_ENTRY_CLOSED'] } }, status: { in: ['PENDING', 'DRAFT', 'REJECTED', 'SUBMITTED'] } }, take: 50, orderBy: { examination: { startDate: 'asc' } }, include: { examination: { select: { id: true, name: true, status: true, endDate: true } }, subject: { select: { subjectName: true } }, cohort: { include: { class: { select: { className: true } }, section: { select: { sectionName: true } } } } } }) : [];
      const reviewQueue = await prisma.examinationCohort.findMany({ where: { schoolId: tenantId, sectionId: { in: scope.classTeacherSectionIds }, status: 'READY_FOR_CLASS_REVIEW' }, take: 30, include: { examination: { select: { id: true, name: true, status: true } }, class: { select: { className: true } }, section: { select: { sectionName: true } }, _count: { select: { subjects: true } } } });
      workQueue = [...subjectQueue.map((item) => ({ type: 'MARK_ENTRY', ...item })), ...reviewQueue.map((item) => ({ type: 'CLASS_REVIEW', ...item }))];
    } else {
      const statuses = req.user.role === 'PRINCIPAL' ? ['COORDINATOR_APPROVED'] : ['FORWARDED', 'REJECTED'];
      workQueue = await prisma.examinationCohort.findMany({ where: { schoolId: tenantId, status: { in: statuses } }, take: 50, orderBy: { updatedAt: 'asc' }, include: { examination: { select: { id: true, name: true, status: true } }, class: { select: { className: true } }, section: { select: { sectionName: true } }, subjects: { select: { status: true } } } });
    }
    ok(res, { scope: 'SCHOOL', statusCounts: Object.fromEntries(grouped.map((item) => [item.status, item._count])), exams, resultCount, reportCardCount, workQueue });
  } catch (error) { next(error); }
};

export const resultRegister = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const exam = await findExam(req.params.id, tenantId);
    if (!exam) return fail(res, 404, 'Examination not found');
    const latestVersion = (await prisma.examinationStudentResult.aggregate({ where: { examinationId: exam.id }, _max: { version: true } }))._max.version;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
    const search = String(req.query.search || '').trim();
    const where = { examinationId: exam.id, version: latestVersion || 1, ...(req.query.className ? { student: { className: req.query.className } } : {}), ...(req.query.section ? { student: { ...(req.query.className ? { className: req.query.className } : {}), section: req.query.section } } : {}), ...(search ? { student: { ...(req.query.className ? { className: req.query.className } : {}), ...(req.query.section ? { section: req.query.section } : {}), OR: [{ studentFirstName: { contains: search, mode: 'insensitive' } }, { studentLastName: { contains: search, mode: 'insensitive' } }, { admissionNo: { contains: search, mode: 'insensitive' } }, { rollNumber: { contains: search, mode: 'insensitive' } }] } } : {}) };
    const [total, rows] = await Promise.all([
      prisma.examinationStudentResult.count({ where }),
      prisma.examinationStudentResult.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ rank: 'asc' }, { student: { rollNumber: 'asc' } }], include: { student: { select: { id: true, admissionNo: true, rollNumber: true, studentFirstName: true, studentLastName: true, className: true, section: true } }, subjects: { include: { examSubject: { include: { subject: { select: { subjectName: true, subjectCode: true } } } } } } } }),
    ]);
    ok(res, { exam: { id: exam.id, name: exam.name, status: exam.status, publishedAt: exam.publishedAt }, version: latestVersion, rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

export const auditLogs = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const page = Math.max(1, Number(req.query.page || 1)); const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
    const where = { schoolId: tenantId, ...(req.query.examinationId ? { examinationId: req.query.examinationId } : {}), ...(req.query.action ? { action: req.query.action } : {}) };
    const [total, rows] = await Promise.all([prisma.examinationAuditLog.count({ where }), prisma.examinationAuditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } })]);
    const actorIds = [...new Set(rows.map((row) => row.actorId))];
    const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } });
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
    ok(res, { rows: rows.map((row) => ({ ...row, actor: actorMap.get(row.actorId) || null })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

export const saveGradeScale = async (req, res, next) => {
  try {
    const tenantId = schoolId(req); const rules = req.body.rules;
    if (!req.body.name || !req.body.code || !Array.isArray(rules) || !rules.length) return fail(res, 422, 'Name, code and at least one grade rule are required');
    if (rules.some((rule) => !Number.isFinite(Number(rule.min)) || !rule.grade)) return fail(res, 422, 'Every grade rule needs a numeric minimum and grade');
    const data = { schoolId: tenantId, name: String(req.body.name).trim(), code: String(req.body.code).trim().toUpperCase(), rules, isDefault: Boolean(req.body.isDefault), isActive: req.body.isActive !== false, createdById: actorId(req) };
    if (req.params.scaleId && !await prisma.examinationGradeScale.findFirst({ where: { id: req.params.scaleId, schoolId: tenantId } })) return fail(res, 404, 'Grade scale not found');
    const row = req.params.scaleId ? await prisma.examinationGradeScale.update({ where: { id: req.params.scaleId }, data: { name: data.name, code: data.code, rules, isDefault: data.isDefault, isActive: data.isActive } }) : await prisma.examinationGradeScale.create({ data });
    if (data.isDefault) await prisma.examinationGradeScale.updateMany({ where: { schoolId: tenantId, id: { not: row.id } }, data: { isDefault: false } });
    await audit(req, { action: 'GRADE_SCALE_SAVED', entityType: 'ExaminationGradeScale', entityId: row.id, newValue: data });
    ok(res, row, req.params.scaleId ? 200 : 201);
  } catch (error) { next(error); }
};

export const saveRuleSet = async (req, res, next) => {
  try {
    const tenantId = schoolId(req); const allowed = ['CALCULATION', 'RANKING', 'PROMOTION', 'GRACE', 'REMARK'];
    if (!req.body.name || !allowed.includes(req.body.type) || !req.body.config || typeof req.body.config !== 'object') return fail(res, 422, 'Valid name, type and configuration are required');
    const data = { schoolId: tenantId, name: String(req.body.name).trim(), type: req.body.type, config: req.body.config, isDefault: Boolean(req.body.isDefault), isActive: req.body.isActive !== false, createdById: actorId(req) };
    if (req.params.ruleId && !await prisma.examinationRuleSet.findFirst({ where: { id: req.params.ruleId, schoolId: tenantId } })) return fail(res, 404, 'Rule set not found');
    const row = req.params.ruleId ? await prisma.examinationRuleSet.update({ where: { id: req.params.ruleId }, data: { name: data.name, type: data.type, config: data.config, isDefault: data.isDefault, isActive: data.isActive } }) : await prisma.examinationRuleSet.create({ data });
    if (data.isDefault) await prisma.examinationRuleSet.updateMany({ where: { schoolId: tenantId, type: data.type, id: { not: row.id } }, data: { isDefault: false } });
    await audit(req, { action: 'RULE_SET_SAVED', entityType: 'ExaminationRuleSet', entityId: row.id, newValue: data });
    ok(res, row, req.params.ruleId ? 200 : 201);
  } catch (error) { next(error); }
};

export const list = async (req, res, next) => {
  try {
    const teacherWorkspace = ['TEACHER', 'CLASS_TEACHER'].includes(req.user.role);
    const scope = teacherWorkspace ? await teacherScope(req) : null;
    const cohortScope = scope && (req.user.role === 'CLASS_TEACHER'
      ? { sectionId: { in: scope.classTeacherSectionIds } }
      : { OR: [{ sectionId: { in: scope.classTeacherSectionIds } }, { subjects: { some: { teacherId: scope.teacherId } } }] });
    const where = { schoolId: schoolId(req), ...(req.query.status ? { status: req.query.status } : {}), ...(cohortScope ? { cohorts: { some: cohortScope } } : {}) };
    const exams = await prisma.examination.findMany({ where, orderBy: { startDate: 'desc' }, include: { academicSession: { select: { name: true } }, cohorts: { include: { class: { select: { className: true } }, section: { select: { sectionName: true } }, subjects: { select: { id: true, status: true } } } } } });
    ok(res, exams);
  } catch (error) { next(error); }
};

export const detail = async (req, res, next) => {
  try {
    let exam = await findExam(req.params.id, schoolId(req), { academicSession: true, cohorts: { include: { class: true, section: true, subjects: { include: { subject: true, components: { orderBy: { displayOrder: 'asc' } } } } } }, reviews: { orderBy: { createdAt: 'asc' } } });
    if (!exam) return fail(res, 404, 'Examination not found');
    if (['TEACHER', 'CLASS_TEACHER'].includes(req.user.role)) {
      const scope = await teacherScope(req);
      exam.cohorts = exam.cohorts.filter((cohort) => cohort.sectionId && (scope.classTeacherSectionIds.includes(cohort.sectionId) || (req.user.role === 'TEACHER' && cohort.subjects.some((subject) => subject.teacherId === scope.teacherId)))).map((cohort) => ({ ...cohort, subjects: scope.classTeacherSectionIds.includes(cohort.sectionId) ? cohort.subjects : cohort.subjects.filter((subject) => subject.teacherId === scope.teacherId) }));
      if (!exam.cohorts.length) return fail(res, 403, 'This examination is outside your allocation');
    }
    ok(res, exam);
  } catch (error) { next(error); }
};

export const create = async (req, res, next) => {
  try {
    if (!MANAGERS.has(req.user.role)) return fail(res, 403, 'Only examination managers can create examinations');
    const tenantId = schoolId(req);
    const { name, code, academicSessionId, startDate, endDate, resultDate, publicationDate, description, cohorts = [], calculationConfig, rankingConfig } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedName || !normalizedCode || !academicSessionId || !startDate || !endDate || !Array.isArray(cohorts) || !cohorts.length) return fail(res, 422, 'Name, code, session, dates and at least one section are required');

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    const parsedResultDate = resultDate ? new Date(resultDate) : null;
    const parsedPublicationDate = publicationDate ? new Date(publicationDate) : null;
    if ([parsedStartDate, parsedEndDate, parsedResultDate, parsedPublicationDate].filter(Boolean).some((date) => Number.isNaN(date.getTime()))) return fail(res, 422, 'One or more examination dates are invalid');
    if (parsedEndDate < parsedStartDate) return fail(res, 422, 'End date cannot be before start date');

    const sectionIds = cohorts.map((cohort) => cohort?.sectionId).filter(Boolean);
    if (sectionIds.length !== cohorts.length) return fail(res, 422, 'Every examination section needs a valid section identifier');
    if (new Set(sectionIds).size !== sectionIds.length) return fail(res, 422, 'The same section cannot be added to an examination more than once');

    // Resolve and validate the complete write graph before opening a transaction. This
    // avoids one database round trip per section/subject on production databases.
    const [session, sections, eligibleAllocations] = await Promise.all([
      prisma.academicSession.findFirst({ where: { id: academicSessionId, schoolId: tenantId }, select: { id: true } }),
      prisma.section.findMany({ where: { id: { in: sectionIds }, schoolId: tenantId, deletedAt: null }, select: { id: true, classId: true, sectionName: true } }),
      prisma.sectionSubjectAllocation.findMany({
        where: { schoolId: tenantId, academicSessionId, sectionId: { in: sectionIds }, status: { in: ['READY', 'TIMETABLED'] } },
        select: { sectionId: true, subjectId: true, teacherId: true },
      }),
    ]);
    if (!session) return fail(res, 422, 'Academic session does not belong to this school');

    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const allocationsBySection = new Map();
    for (const allocation of eligibleAllocations) {
      const sectionAllocations = allocationsBySection.get(allocation.sectionId) || [];
      sectionAllocations.push(allocation);
      allocationsBySection.set(allocation.sectionId, sectionAllocations);
    }

    // ExaminationSubject has required relations to both its cohort and examination.
    // Supplying the ID up front lets the atomic nested write satisfy both relations.
    const examinationId = randomUUID();
    const preparedCohorts = cohorts.map((cohortInput) => {
      const section = sectionById.get(cohortInput.sectionId);
      if (!section || section.classId !== cohortInput.classId) throw Object.assign(new Error('Invalid class or section selection'), { status: 422 });
      const available = allocationsBySection.get(section.id) || [];
      const availableBySubject = new Map(available.map((allocation) => [allocation.subjectId, allocation]));
      const requestedSubjects = Array.isArray(cohortInput.subjects) && cohortInput.subjects.length ? cohortInput.subjects : null;
      const requestedIds = requestedSubjects?.map((item) => item?.subjectId);
      if (requestedIds && (requestedIds.some((id) => !id) || new Set(requestedIds).size !== requestedIds.length)) throw Object.assign(new Error(`Subjects for section ${section.sectionName} must be valid and unique`), { status: 422 });
      if (requestedIds?.some((id) => !availableBySubject.has(id))) throw Object.assign(new Error(`One or more subjects are not allocated to section ${section.sectionName}`), { status: 422 });

      const subjects = (requestedSubjects || available).map((requested, index) => {
        const allocation = availableBySubject.get(requested.subjectId) || requested;
        const components = requested.components?.length ? requested.components : DEFAULT_EXAM_COMPONENTS;
        const componentCodes = new Set();
        const preparedComponents = components.map((component, position) => {
          const maximumMarks = Number(component.maximumMarks);
          const passingMarks = Number(component.passingMarks);
          const weightage = Number(component.weightage ?? 100);
          const componentName = String(component.name || '').trim();
          const componentCode = String(component.code || componentName).trim().toUpperCase().replace(/\W+/g, '_');
          if (!componentName || !componentCode || !Number.isFinite(maximumMarks) || maximumMarks <= 0 || !Number.isFinite(passingMarks) || passingMarks < 0 || passingMarks > maximumMarks || !Number.isFinite(weightage) || weightage <= 0) throw Object.assign(new Error(`Invalid marks component for section ${section.sectionName}`), { status: 422 });
          if (componentCodes.has(componentCode)) throw Object.assign(new Error(`Duplicate marks component ${componentCode} for section ${section.sectionName}`), { status: 422 });
          componentCodes.add(componentCode);
          return { name: componentName, code: componentCode, maximumMarks, passingMarks, weightage, isMandatory: component.isMandatory !== false, allowDecimal: Boolean(component.allowDecimal), displayOrder: position };
        });
        return { examinationId, subjectId: allocation.subjectId, teacherId: allocation.teacherId || null, displayOrder: index, isOptional: Boolean(requested.isOptional), components: { create: preparedComponents } };
      });
      if (!subjects.length) throw Object.assign(new Error(`No ready subject allocations found for section ${section.sectionName}`), { status: 422 });
      return { schoolId: tenantId, classId: cohortInput.classId, sectionId: section.id, subjects: { create: subjects } };
    });

    // A nested write is atomic in Prisma and avoids the five-second interactive
    // transaction timeout that the former sequential loop could exceed.
    const created = await prisma.examination.create({ data: {
      id: examinationId,
      schoolId: tenantId,
      academicSessionId,
      name: normalizedName,
      code: normalizedCode,
      description,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      resultDate: parsedResultDate,
      publicationDate: parsedPublicationDate,
      calculationConfig,
      rankingConfig,
      createdById: actorId(req),
      cohorts: { create: preparedCohorts },
    } });
    await audit(req, { examinationId: created.id, action: 'EXAM_CREATED', entityType: 'Examination', entityId: created.id, newValue: req.body });
    ok(res, created, 201);
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 409, 'An examination with this code already exists for the selected academic session');
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const exam = await findExam(req.params.id, schoolId(req));
    if (!exam) return fail(res, 404, 'Examination not found');
    if (exam.status !== 'DRAFT') return fail(res, 409, 'Only draft examinations can be edited');
    const allowed = ['name', 'description', 'startDate', 'endDate', 'resultDate', 'publicationDate', 'calculationConfig', 'rankingConfig'];
    const data = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, key.endsWith('Date') && req.body[key] ? new Date(req.body[key]) : req.body[key]]));
    const updated = await prisma.examination.update({ where: { id: exam.id }, data });
    await audit(req, { examinationId: exam.id, action: 'EXAM_UPDATED', entityType: 'Examination', entityId: exam.id, oldValue: exam, newValue: data });
    ok(res, updated);
  } catch (error) { next(error); }
};

const TRANSITIONS = { DRAFT: ['SCHEDULED'], SCHEDULED: ['MARK_ENTRY_OPEN'], MARK_ENTRY_OPEN: ['MARK_ENTRY_CLOSED'], MARK_ENTRY_CLOSED: ['VERIFICATION'], APPROVED: ['PUBLISHED'], PUBLISHED: ['ARCHIVED'] };
export const transition = async (req, res, next) => {
  try {
    const exam = await findExam(req.params.id, schoolId(req));
    if (!exam) return fail(res, 404, 'Examination not found');
    const target = req.body.status;
    if (!(TRANSITIONS[exam.status] || []).includes(target)) return fail(res, 409, `Cannot move from ${exam.status} to ${target}`);
    if (target === 'PUBLISHED' && !APPROVERS.has(req.user.role)) return fail(res, 403, 'Principal or examination coordinator publication authority is required');
    const data = { status: target, ...(target === 'PUBLISHED' ? { publishedAt: new Date(), publishedById: actorId(req) } : {}), ...(target === 'ARCHIVED' ? { archivedAt: new Date() } : {}) };
    const updated = await prisma.examination.update({ where: { id: exam.id }, data });
    await audit(req, { examinationId: exam.id, action: `STATUS_${target}`, entityType: 'Examination', entityId: exam.id, oldValue: { status: exam.status }, newValue: { status: target }, reason: req.body.reason });
    ok(res, updated);
  } catch (error) { next(error); }
};

export const markSheet = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const examSubject = await prisma.examinationSubject.findFirst({ where: { id: req.query.examSubjectId, examinationId: req.params.id, examination: { schoolId: tenantId } }, include: { examination: { include: { academicSession: true } }, cohort: { include: { class: true, section: true } }, subject: true, components: { orderBy: { displayOrder: 'asc' }, include: { marks: true } } } });
    if (!examSubject) return fail(res, 404, 'Examination subject not found');
    await assertTeacherSubject(req, examSubject.id);
    const students = await rosterForCohort({ ...examSubject.cohort, schoolId: tenantId, examination: examSubject.examination });
    const markMap = new Map(examSubject.components.flatMap((component) => component.marks.map((mark) => [`${component.id}:${mark.studentId}`, mark])));
    ok(res, { examSubject: { ...examSubject, components: examSubject.components.map(({ marks, ...component }) => component) }, students: students.map((student) => ({ ...student, marks: Object.fromEntries(examSubject.components.map((component) => [component.id, markMap.get(`${component.id}:${student.id}`) || null])) })) });
  } catch (error) { next(error); }
};

export const saveMarks = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const { examSubjectId, entries } = req.body;
    await assertTeacherSubject(req, examSubjectId);
    const subject = await prisma.examinationSubject.findFirst({ where: { id: examSubjectId, examinationId: req.params.id, examination: { schoolId: tenantId, status: 'MARK_ENTRY_OPEN' } }, include: { components: true, cohort: { include: { class: true, section: true } }, examination: { include: { academicSession: true } } } });
    if (!subject) return fail(res, 409, 'Mark entry is not open for this subject');
    if (!['PENDING', 'DRAFT', 'REJECTED'].includes(subject.status)) return fail(res, 409, 'Submitted marks are locked');
    if (!Array.isArray(entries) || entries.length > 1000) return fail(res, 422, 'Entries must be an array of at most 1000 rows');
    const roster = await rosterForCohort({ ...subject.cohort, schoolId: tenantId, examination: subject.examination });
    const studentIds = new Set(roster.map((student) => student.id));
    const components = new Map(subject.components.map((component) => [component.id, component]));
    const errors = [];
    const prepared = entries.map((entry, row) => {
      const component = components.get(entry.componentId);
      const status = entry.attendanceStatus || 'PRESENT';
      const marks = entry.marks === '' || entry.marks === null || entry.marks === undefined ? null : Number(entry.marks);
      if (!studentIds.has(entry.studentId)) errors.push({ row, studentId: entry.studentId, message: 'Student is not in this exam roster' });
      if (!component) errors.push({ row, componentId: entry.componentId, message: 'Invalid component' });
      if (status === 'PRESENT' && marks !== null && (!Number.isFinite(marks) || marks < 0 || marks > Number(component?.maximumMarks))) errors.push({ row, studentId: entry.studentId, message: `Marks must be between 0 and ${component?.maximumMarks}` });
      if (status !== 'PRESENT' && marks !== null) errors.push({ row, studentId: entry.studentId, message: 'Special attendance status cannot also have marks' });
      return { componentId: entry.componentId, studentId: entry.studentId, marks, attendanceStatus: status, teacherRemark: entry.teacherRemark || null };
    });
    if (errors.length) return fail(res, 422, 'Mark validation failed', errors);
    await prisma.$transaction(async (tx) => {
      for (const entry of prepared) await tx.examinationMark.upsert({ where: { componentId_studentId: { componentId: entry.componentId, studentId: entry.studentId } }, create: { schoolId: tenantId, examinationId: req.params.id, enteredById: actorId(req), ...entry }, update: { marks: entry.marks, attendanceStatus: entry.attendanceStatus, teacherRemark: entry.teacherRemark, enteredById: actorId(req), state: 'DRAFT' } });
      await tx.examinationSubject.update({ where: { id: subject.id }, data: { status: 'DRAFT' } });
      await tx.examinationCohort.update({ where: { id: subject.cohortId }, data: { status: 'MARKS_IN_PROGRESS' } });
    });
    await audit(req, { examinationId: req.params.id, action: 'MARKS_AUTOSAVED', entityType: 'ExaminationSubject', entityId: subject.id, newValue: { rows: prepared.length } });
    ok(res, { saved: prepared.length, savedAt: new Date() });
  } catch (error) { next(error); }
};

export const submitMarks = async (req, res, next) => {
  try {
    const subject = await prisma.examinationSubject.findFirst({ where: { id: req.params.examSubjectId, examinationId: req.params.id, examination: { schoolId: schoolId(req), status: 'MARK_ENTRY_OPEN' } }, include: { components: { include: { marks: true } }, cohort: { include: { class: true, section: true } }, examination: { include: { academicSession: true } } } });
    if (!subject) return fail(res, 404, 'Open examination subject not found');
    await assertTeacherSubject(req, subject.id);
    const roster = await rosterForCohort({ ...subject.cohort, schoolId: schoolId(req), examination: subject.examination });
    const missing = [];
    for (const student of roster) for (const component of subject.components) if (component.isMandatory && !component.marks.some((mark) => mark.studentId === student.id && (mark.marks !== null || mark.attendanceStatus !== 'PRESENT'))) missing.push({ studentId: student.id, rollNumber: student.rollNumber, component: component.name });
    if (missing.length) return fail(res, 422, 'Required marks are incomplete', missing.slice(0, 100));
    await prisma.$transaction([
      prisma.examinationSubject.update({ where: { id: subject.id }, data: { status: 'SUBMITTED', submittedById: actorId(req), submittedAt: new Date(), lockedAt: new Date() } }),
      prisma.examinationMark.updateMany({ where: { componentId: { in: subject.components.map((item) => item.id) } }, data: { state: 'SUBMITTED', submittedAt: new Date() } }),
    ]);
    const pending = await prisma.examinationSubject.count({ where: { cohortId: subject.cohortId, status: { notIn: ['SUBMITTED', 'LOCKED'] } } });
    if (!pending) await prisma.examinationCohort.update({ where: { id: subject.cohortId }, data: { status: 'READY_FOR_CLASS_REVIEW' } });
    await audit(req, { examinationId: req.params.id, action: 'MARKS_SUBMITTED', entityType: 'ExaminationSubject', entityId: subject.id });
    ok(res, { submitted: true });
  } catch (error) { next(error); }
};

export const review = async (req, res, next) => {
  try {
    const exam = await findExam(req.params.id, schoolId(req));
    if (!exam) return fail(res, 404, 'Examination not found');
    const { cohortId, level, decision, reason, classTeacherRemarks, principalRemarks, promotionRecommendation } = req.body;
    const cohort = cohortId && await prisma.examinationCohort.findFirst({ where: { id: cohortId, examinationId: exam.id } });
    if (cohortId && !cohort) return fail(res, 404, 'Exam section not found');
    if (level === 'CLASS_TEACHER') {
      if (req.user.role !== 'TEACHER') return fail(res, 403, 'Class teacher authority is required');
      const scope = await teacherScope(req);
      if (!cohort || !scope.classTeacherSectionIds.includes(cohort.sectionId)) return fail(res, 403, 'This section is outside your class-teacher allocation');
      if (cohort.status !== 'READY_FOR_CLASS_REVIEW') return fail(res, 409, 'All subjects must be submitted before forwarding');
    }
    if (level === 'PRINCIPAL' && req.user.role !== 'PRINCIPAL') return fail(res, 403, 'Principal approval authority is required');
    if (level === 'EXAM_COORDINATOR' && !['EXAM_COORDINATOR', 'EXAM_CONTROLLER', 'ADMIN'].includes(req.user.role)) return fail(res, 403, 'Coordinator authority is required');
    let cohortStatus;
    if (decision === 'REJECTED' || decision === 'CORRECTION_REQUESTED') cohortStatus = 'REJECTED';
    else if (level === 'CLASS_TEACHER') cohortStatus = 'FORWARDED';
    else if (level === 'EXAM_COORDINATOR') cohortStatus = 'COORDINATOR_APPROVED';
    else if (level === 'PRINCIPAL') cohortStatus = 'PRINCIPAL_APPROVED';
    await prisma.$transaction(async (tx) => {
      await tx.examinationReview.create({ data: { examinationId: exam.id, cohortId: cohortId || null, level, decision, reason, actorId: actorId(req) } });
      if (cohort) await tx.examinationCohort.update({ where: { id: cohort.id }, data: { status: cohortStatus, classTeacherRemarks, principalRemarks, promotionRecommendation, ...(level === 'CLASS_TEACHER' && decision === 'FORWARDED' ? { forwardedById: actorId(req), forwardedAt: new Date() } : {}) } });
      if (decision === 'REJECTED' && req.body.examSubjectId) await tx.examinationSubject.update({ where: { id: req.body.examSubjectId }, data: { status: 'REJECTED', lockedAt: null } });
    });
    if (level === 'PRINCIPAL' && decision === 'APPROVED') {
      const remaining = await prisma.examinationCohort.count({ where: { examinationId: exam.id, status: { notIn: ['PRINCIPAL_APPROVED', ...(exam.publishedAt ? ['PUBLISHED'] : [])] } } });
      if (!remaining) await prisma.examination.update({ where: { id: exam.id }, data: { status: 'APPROVED', approvedById: actorId(req), approvedAt: new Date() } });
    }
    await audit(req, { examinationId: exam.id, action: `${level}_${decision}`, entityType: cohort ? 'ExaminationCohort' : 'Examination', entityId: cohort?.id || exam.id, reason });
    ok(res, { decision, status: cohortStatus });
  } catch (error) { next(error); }
};

const loadGradeRules = async (tenantId, config) => {
  if (Array.isArray(config?.gradeRules)) return config.gradeRules;
  const scale = await prisma.examinationGradeScale.findFirst({ where: { schoolId: tenantId, isActive: true }, orderBy: { isDefault: 'desc' } });
  return Array.isArray(scale?.rules) ? scale.rules : DEFAULT_GRADE_RULES;
};

export const calculate = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const exam = await findExam(req.params.id, tenantId, { academicSession: true, cohorts: { include: { class: true, section: true, subjects: { include: { components: { include: { marks: true } } } } } } });
    if (!exam) return fail(res, 404, 'Examination not found');
    if (!['VERIFICATION', 'APPROVED'].includes(exam.status)) return fail(res, 409, 'Results can only be calculated during verification');
    const gradeRules = await loadGradeRules(tenantId, exam.calculationConfig);
    const currentVersion = (await prisma.examinationStudentResult.aggregate({ where: { examinationId: exam.id }, _max: { version: true } }))._max.version || 0;
    const version = exam.publishedAt && currentVersion ? currentVersion + 1 : (currentVersion || 1);
    const rows = [];
    for (const cohort of exam.cohorts) {
      const roster = await rosterForCohort({ ...cohort, schoolId: tenantId, examination: exam });
      const calculated = roster.map((student) => ({ studentId: student.id, ...calculateStudent({ gradeRules, graceConfig: exam.calculationConfig?.grace, promotionConfig: exam.calculationConfig?.promotion, subjects: cohort.subjects.map((subject) => ({ examSubjectId: subject.id, components: subject.components.map((component) => { const mark = component.marks.find((item) => item.studentId === student.id); return { ...component, marks: mark?.marks, attendanceStatus: mark?.attendanceStatus }; }) })) }) }));
      rows.push(...assignRanks(calculated));
    }
    await prisma.$transaction(async (tx) => {
      await tx.examinationSubjectResult.deleteMany({ where: { studentResult: { examinationId: exam.id, version } } });
      await tx.examinationStudentResult.deleteMany({ where: { examinationId: exam.id, version } });
      for (const row of rows) {
        const result = await tx.examinationStudentResult.create({ data: { schoolId: tenantId, examinationId: exam.id, studentId: row.studentId, version, totalObtained: row.totalObtained, totalMaximum: row.totalMaximum, percentage: row.percentage, grade: row.grade, gradePoint: row.gradePoint, rank: row.rank, sectionRank: row.sectionRank, resultStatus: row.resultStatus, promotionStatus: row.promotionStatus, graceMarks: row.graceMarks } });
        await tx.examinationSubjectResult.createMany({ data: row.subjectResults.map((subject) => ({ studentResultId: result.id, examSubjectId: subject.examSubjectId, studentId: row.studentId, obtainedMarks: subject.obtainedMarks, maximumMarks: subject.maximumMarks, percentage: subject.percentage, grade: subject.grade, passed: subject.passed, graceMarks: subject.graceMarks, attendanceStatus: subject.attendanceStatus, componentBreakdown: subject.componentBreakdown })) });
      }
    });
    await audit(req, { examinationId: exam.id, action: 'RESULTS_CALCULATED', entityType: 'Examination', entityId: exam.id, newValue: { students: rows.length, version } });
    ok(res, { students: rows.length, version });
  } catch (error) { next(error); }
};

export const publish = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const exam = await findExam(req.params.id, tenantId, { results: { include: { subjects: true } } });
    if (!exam) return fail(res, 404, 'Examination not found');
    if (exam.status !== 'APPROVED') return fail(res, 409, 'Only approved results can be published');
    if (!APPROVERS.has(req.user.role)) return fail(res, 403, 'Publication authority is required');
    if (!exam.results.length) return fail(res, 409, 'Calculate results before publication');
    const version = Math.max(...exam.results.map((result) => result.version));
    const snapshot = exam.results.filter((result) => result.version === version);
    await prisma.$transaction(async (tx) => {
      await tx.examinationResultVersion.upsert({ where: { examinationId_version: { examinationId: exam.id, version } }, create: { examinationId: exam.id, version, snapshot, reason: req.body.reason || 'Initial publication', createdById: actorId(req) }, update: {} });
      await tx.examinationReportCard.createMany({ data: snapshot.map((result) => ({ examinationId: exam.id, studentId: result.studentId, resultVersion: version, generatedById: actorId(req) })), skipDuplicates: true });
      await tx.examination.update({ where: { id: exam.id }, data: { status: 'PUBLISHED', publishedById: actorId(req), publishedAt: new Date() } });
      await tx.examinationCohort.updateMany({ where: { examinationId: exam.id }, data: { status: 'PUBLISHED' } });
      await tx.examinationMark.updateMany({ where: { examinationId: exam.id }, data: { state: 'LOCKED' } });
    });
    await audit(req, { examinationId: exam.id, action: 'RESULT_PUBLISHED', entityType: 'Examination', entityId: exam.id, newValue: { version, studentCount: snapshot.length }, reason: req.body.reason });
    ok(res, { published: true, version, studentCount: snapshot.length });
  } catch (error) { next(error); }
};

export const requestCorrection = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const exam = await findExam(req.params.id, tenantId);
    if (!exam || !exam.publishedAt) return fail(res, 409, 'Only a previously published result can enter correction workflow');
    if (!APPROVERS.has(req.user.role)) return fail(res, 403, 'Principal or examination coordinator authority is required');
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) return fail(res, 422, 'A correction reason of at least five characters is required');
    const subject = await prisma.examinationSubject.findFirst({ where: { id: req.body.examSubjectId, examinationId: exam.id } });
    if (!subject) return fail(res, 404, 'Affected examination subject not found');
    await prisma.$transaction([
      prisma.examinationReview.create({ data: { examinationId: exam.id, cohortId: subject.cohortId, level: 'CORRECTION', decision: 'CORRECTION_REQUESTED', reason, actorId: actorId(req) } }),
      prisma.examination.update({ where: { id: exam.id }, data: { status: 'MARK_ENTRY_OPEN' } }),
      prisma.examinationSubject.update({ where: { id: subject.id }, data: { status: 'REJECTED', lockedAt: null } }),
      prisma.examinationMark.updateMany({ where: { component: { examSubjectId: subject.id } }, data: { state: 'DRAFT' } }),
    ]);
    await audit(req, { examinationId: exam.id, action: 'CORRECTION_REQUESTED', entityType: 'ExaminationSubject', entityId: subject.id, reason, oldValue: { publishedVersionPreserved: true }, newValue: { workflow: 'MARK_ENTRY_OPEN' } });
    ok(res, { opened: true, examSubjectId: subject.id, previousPublicationPreserved: true });
  } catch (error) { next(error); }
};

const canViewStudent = (req, studentId) => ['STUDENT', 'PARENT'].includes(req.user.role) ? req.user.studentId === studentId : true;
export const studentResults = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.studentId;
    if (!studentId || !canViewStudent(req, studentId)) return fail(res, 403, 'You may only view your linked result');
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: schoolId(req) }, select: { id: true, studentFirstName: true, studentLastName: true, admissionNo: true, rollNumber: true, className: true, section: true, session: true } });
    if (!student) return fail(res, 404, 'Student not found');
    const allResults = await prisma.examinationStudentResult.findMany({ where: { studentId, schoolId: schoolId(req), examination: { publishedAt: { not: null } } }, orderBy: [{ examinationId: 'asc' }, { version: 'desc' }], include: { examination: { select: { id: true, name: true, resultDate: true, academicSession: { select: { name: true } } } }, subjects: { include: { examSubject: { include: { subject: true } } } } } });
    const results = [...new Map(allResults.map((result) => [result.examinationId, result])).values()];
    ok(res, { student, results });
  } catch (error) { next(error); }
};

export const analytics = async (req, res, next) => {
  try {
    const exam = await findExam(req.params.id, schoolId(req));
    if (!exam) return fail(res, 404, 'Examination not found');
    const rows = await prisma.examinationStudentResult.findMany({ where: { examinationId: exam.id }, include: { student: { select: { gender: true, category: true, className: true, section: true } }, subjects: { include: { examSubject: { include: { subject: true } } } } } });
    const latest = new Map(); rows.forEach((row) => { if (!latest.has(row.studentId) || latest.get(row.studentId).version < row.version) latest.set(row.studentId, row); });
    const data = [...latest.values()];
    const subjectMap = new Map();
    data.flatMap((row) => row.subjects).forEach((item) => { const key = item.examSubject.subject.subjectName; const old = subjectMap.get(key) || { total: 0, count: 0, pass: 0 }; old.total += Number(item.percentage); old.count += 1; old.pass += item.passed ? 1 : 0; subjectMap.set(key, old); });
    const distribution = data.reduce((acc, row) => ({ ...acc, [row.grade || 'NA']: (acc[row.grade || 'NA'] || 0) + 1 }), {});
    ok(res, { studentCount: data.length, averagePercentage: data.length ? data.reduce((sum, row) => sum + Number(row.percentage), 0) / data.length : 0, passPercentage: data.length ? data.filter((row) => row.resultStatus === 'PASS').length * 100 / data.length : 0, highestPercentage: data.length ? Math.max(...data.map((row) => Number(row.percentage))) : 0, gradeDistribution: distribution, subjectPerformance: [...subjectMap].map(([subject, value]) => ({ subject, average: value.total / value.count, passPercentage: value.pass * 100 / value.count })) });
  } catch (error) { next(error); }
};

export const reportCard = async (req, res, next) => {
  try {
    const tenantId = schoolId(req);
    const studentId = req.params.studentId;
    if (!canViewStudent(req, studentId)) return fail(res, 403, 'You may only download your linked report card');
    const card = await prisma.examinationReportCard.findFirst({ where: { examinationId: req.params.id, studentId, examination: { schoolId: tenantId, publishedAt: { not: null } } }, orderBy: { resultVersion: 'desc' }, include: { examination: { include: { school: true, academicSession: true } }, student: true } });
    if (!card) return fail(res, 404, 'Published report card not found');
    const result = await prisma.examinationStudentResult.findUnique({ where: { examinationId_studentId_version: { examinationId: req.params.id, studentId, version: card.resultVersion } }, include: { subjects: { include: { examSubject: { include: { subject: true } } } } } });
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/examinations/verify/${card.verificationId}`;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${card.student.admissionNo || studentId}-${card.examination.code}.pdf"`); doc.pipe(res);
    doc.fontSize(20).fillColor('#0f766e').text(card.examination.school.schoolName, { align: 'center' });
    doc.fontSize(14).fillColor('#0f172a').text(`${card.examination.name} · ${card.examination.academicSession.name}`, { align: 'center' }).moveDown();
    doc.fontSize(10).text(`Student: ${card.student.studentFirstName} ${card.student.studentLastName || ''}`).text(`Admission No: ${card.student.admissionNo || '—'}    Roll No: ${card.student.rollNumber || '—'}`).text(`Class: ${card.student.className} ${card.student.section || ''}`).moveDown();
    doc.font('Helvetica-Bold').text('Subject', 42, doc.y, { width: 180 }).text('Marks', 230, doc.y - 12, { width: 90 }).text('Percent', 330, doc.y - 12, { width: 80 }).text('Grade', 420, doc.y - 12, { width: 80 }); doc.moveDown();
    doc.font('Helvetica'); result.subjects.forEach((row) => { const y = doc.y; doc.text(row.examSubject.subject.subjectName, 42, y, { width: 180 }).text(`${Number(row.obtainedMarks).toFixed(1)} / ${Number(row.maximumMarks).toFixed(1)}`, 230, y, { width: 90 }).text(`${Number(row.percentage).toFixed(1)}%`, 330, y, { width: 80 }).text(row.grade || '—', 420, y, { width: 80 }); doc.moveDown(0.8); });
    doc.moveDown().font('Helvetica-Bold').text(`Overall: ${Number(result.percentage).toFixed(2)}%   Grade: ${result.grade || '—'}   Rank: ${result.rank || '—'}   Result: ${result.resultStatus}`).text(`Promotion: ${result.promotionStatus || '—'}`);
    doc.image(Buffer.from(qr.split(',')[1], 'base64'), 42, doc.y + 18, { width: 80 }); doc.font('Helvetica').fontSize(8).text(`Verification ID: ${card.verificationId}`, 132, doc.y + 48).text('Digitally generated by SchoolOS', 132, doc.y + 4); doc.end();
  } catch (error) { next(error); }
};

export const verify = async (req, res, next) => {
  try {
    const card = await prisma.examinationReportCard.findUnique({ where: { verificationId: req.params.verificationId }, include: { examination: { include: { school: { select: { schoolName: true } }, academicSession: { select: { name: true } } } }, student: { select: { studentFirstName: true, studentLastName: true, admissionNo: true } } } });
    if (!card || !card.examination.publishedAt) return fail(res, 404, 'Report card verification not found');
    ok(res, { valid: true, verificationId: card.verificationId, school: card.examination.school.schoolName, student: `${card.student.studentFirstName} ${card.student.studentLastName || ''}`.trim(), admissionNo: card.student.admissionNo, examination: card.examination.name, session: card.examination.academicSession.name, issuedAt: card.issuedAt });
  } catch (error) { next(error); }
};
