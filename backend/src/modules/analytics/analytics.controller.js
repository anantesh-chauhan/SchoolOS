import * as service from './analytics.service.js';
import { parseAnalyticsFilters, validateIntervention, validateSnapshot } from './analytics.validation.js';
import { createChapterReport, createInstitutionReport, createStudentCsv, createStudentPdf, createSubjectReport } from './analytics.report.service.js';

const meta = (data, filters = {}) => ({
  academicSessionId: filters.academicSessionId || null,
  generatedAt: data?.generatedAt || new Date().toISOString(),
  dataCoverage: data?.academicHealth?.dataCoverage ?? null,
  formulaVersion: data?.formulaVersion || null,
});
const ok = (res, message, data, filters, status = 200) => res.status(status).json({ success: true, message, data, meta: meta(data, filters) });
const fail = (res, error) => res.status(error.status || 500).json({
  success: false, message: error.message || 'Analytics request failed.',
  code: error.code || 'ANALYTICS_ERROR',
  ...(process.env.NODE_ENV === 'development' ? { error: error.stack } : {}),
});
const filtersFor = (req) => {
  const parsed = parseAnalyticsFilters(req.query);
  if (parsed.errors.length) {
    const error = new Error(parsed.errors.join(' ')); error.status = 422; throw error;
  }
  return parsed.value;
};

export const listStudents = async (req, res) => {
  try {
    const filters = filtersFor(req);
    return ok(res, 'Student analytics list retrieved successfully.', await service.getStudents({ user: req.user, query: filters }), filters);
  } catch (error) { return fail(res, error); }
};

export const studentOverview = async (req, res) => {
  try {
    const filters = filtersFor(req);
    const data = await service.getStudentOverview({ user: req.user, studentId: req.params.studentId, ...filters });
    return ok(res, 'Student analytics retrieved successfully.', data, filters);
  } catch (error) { return fail(res, error); }
};

export const studentSubjects = async (req, res) => {
  try {
    const filters = filtersFor(req);
    const data = await service.getStudentOverview({ user: req.user, studentId: req.params.studentId, ...filters });
    return ok(res, 'Student subject analytics retrieved successfully.', { student: data.student, subjects: data.subjects, formulaVersion: data.formulaVersion }, filters);
  } catch (error) { return fail(res, error); }
};

export const studentSubject = async (req, res) => {
  try {
    const filters = filtersFor(req);
    return ok(res, 'Subject analytics retrieved successfully.', await service.getStudentSubject({
      user: req.user, studentId: req.params.studentId, subjectId: req.params.subjectId, ...filters,
    }), filters);
  } catch (error) { return fail(res, error); }
};

export const studentChapter = async (req, res) => {
  try {
    const filters = filtersFor(req);
    let subjectId = req.params.subjectId;
    if (!subjectId) {
      const overview = await service.getStudentOverview({ user: req.user, studentId: req.params.studentId, ...filters });
      subjectId = overview.chapters.find((row) => row.id === req.params.chapterId)?.subjectId;
    }
    return ok(res, 'Chapter analytics retrieved successfully.', await service.getStudentChapter({
      user: req.user, studentId: req.params.studentId, subjectId, chapterId: req.params.chapterId, ...filters,
    }), filters);
  } catch (error) { return fail(res, error); }
};

export const studentTrends = async (req, res) => {
  try {
    const filters = filtersFor(req);
    const data = await service.getStudentOverview({ user: req.user, studentId: req.params.studentId, ...filters });
    return ok(res, 'Student trends retrieved successfully.', { performance: data.performanceTrend, attendance: data.attendance.trend, subjects: data.subjects.map(({ id, name, trend }) => ({ id, name, trend })), formulaVersion: data.formulaVersion }, filters);
  } catch (error) { return fail(res, error); }
};

export const studentRisk = async (req, res) => {
  try {
    const filters = filtersFor(req);
    const data = await service.getStudentOverview({ user: req.user, studentId: req.params.studentId, ...filters });
    return ok(res, 'Explainable student risk retrieved successfully.', { ...data.risk, formulaVersion: data.formulaVersion }, filters);
  } catch (error) { return fail(res, error); }
};

export const studentRecommendations = async (req, res) => {
  try {
    const filters = filtersFor(req);
    const data = await service.getStudentOverview({ user: req.user, studentId: req.params.studentId, ...filters });
    return ok(res, 'Student recommendations retrieved successfully.', { items: data.recommendations, formulaVersion: data.formulaVersion }, filters);
  } catch (error) { return fail(res, error); }
};

export const studentInterventions = async (req, res) => {
  try { return ok(res, 'Student interventions retrieved successfully.', await service.listInterventions({ user: req.user, studentId: req.params.studentId })); }
  catch (error) { return fail(res, error); }
};

export const configuration = async (req, res) => {
  try { return ok(res, 'Analytics configuration retrieved successfully.', await service.getAnalyticsConfiguration(req.user)); }
  catch (error) { return fail(res, error); }
};

export const updateConfiguration = async (req, res) => {
  try {
    const data = await service.updateAnalyticsConfiguration({
      user: req.user, body: req.body,
      requestMeta: { ip: req.ip, userAgent: req.get('user-agent') },
    });
    return ok(res, 'Analytics configuration updated successfully.', data);
  } catch (error) { return fail(res, error); }
};

export const createSnapshot = async (req, res) => {
  try {
    const parsed = validateSnapshot(req.body);
    if (parsed.errors.length) { const error = new Error(parsed.errors.join(' ')); error.status = 422; throw error; }
    return ok(res, 'Immutable analytics snapshot created successfully.', await service.createSnapshot({ user: req.user, body: parsed.value }), {}, 201);
  } catch (error) { return fail(res, error); }
};

export const createIntervention = async (req, res) => {
  try {
    const parsed = validateIntervention(req.body);
    if (parsed.errors.length) { const error = new Error(parsed.errors.join(' ')); error.status = 422; throw error; }
    return ok(res, 'Student intervention created successfully.', await service.createIntervention({ user: req.user, body: parsed.value }), {}, 201);
  } catch (error) { return fail(res, error); }
};

export const updateIntervention = async (req, res) => {
  try {
    const parsed = validateIntervention(req.body, true);
    if (parsed.errors.length) { const error = new Error(parsed.errors.join(' ')); error.status = 422; throw error; }
    return ok(res, 'Student intervention updated successfully.', await service.updateIntervention({ user: req.user, interventionId: req.params.id, body: parsed.value }));
  } catch (error) { return fail(res, error); }
};

export const classOverview = async (req, res) => {
  try {
    const filters = filtersFor(req);
    return ok(res, 'Class analytics retrieved successfully.', await service.getClassOrSectionOverview({ user: req.user, classId: req.params.classId, academicSessionId: filters.academicSessionId }), filters);
  } catch (error) { return fail(res, error); }
};

export const sectionOverview = async (req, res) => {
  try {
    const filters = filtersFor(req);
    const section = await import('../../config/prisma.client.js').then(({ default: prisma }) => prisma.section.findFirst({ where: { id: req.params.sectionId, schoolId: req.user.schoolId }, select: { classId: true } }));
    if (!section) { const error = new Error('Section not found.'); error.status = 404; throw error; }
    return ok(res, 'Section analytics retrieved successfully.', await service.getClassOrSectionOverview({ user: req.user, classId: section.classId, sectionId: req.params.sectionId, academicSessionId: filters.academicSessionId }), filters);
  } catch (error) { return fail(res, error); }
};

export const schoolOverview = async (req, res) => {
  try {
    const filters = filtersFor(req);
    return ok(res, 'School analytics retrieved successfully.', await service.getSchoolOverview({ user: req.user, academicSessionId: filters.academicSessionId }), filters);
  } catch (error) { return fail(res, error); }
};

export const studentReport = async (req, res) => {
  try {
    const filters = filtersFor(req);
    const format = req.params.format;
    if (!['csv', 'pdf'].includes(format)) { const error = new Error('Report format must be csv or pdf.'); error.status = 404; throw error; }
    const buffer = format === 'csv'
      ? await createStudentCsv({ user: req.user, studentId: req.params.studentId, filters })
      : await createStudentPdf({ user: req.user, studentId: req.params.studentId, filters });
    await service.auditReportExport({ user: req.user, entityType: 'Student', entityId: req.params.studentId, format, requestMeta: { ip: req.ip, userAgent: req.get('user-agent') } });
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="student-academic-analytics.${format}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(buffer);
  } catch (error) { return fail(res, error); }
};

export const recordResourceEngagement = async (req, res) => {
  try { return ok(res, 'Resource engagement processed successfully.', await service.recordResourceEngagement({ user: req.user, resourceId: req.params.resourceId, body: req.body }), {}, 201); }
  catch (error) { return fail(res, error); }
};

const sendReport = (res, buffer, format, name) => {
  res.setHeader('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.${format}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buffer);
};

export const subjectReport = async (req, res) => {
  try {
    const filters = filtersFor(req); const format = req.params.format;
    if (!['csv', 'pdf'].includes(format)) { const error = new Error('Report format must be csv or pdf.'); error.status = 404; throw error; }
    const buffer = await createSubjectReport({ user: req.user, studentId: req.params.studentId, subjectId: req.params.subjectId, filters, format });
    await service.auditReportExport({ user: req.user, entityType: 'SubjectAnalytics', entityId: `${req.params.studentId}:${req.params.subjectId}`, format, requestMeta: { ip: req.ip, userAgent: req.get('user-agent') } });
    return sendReport(res, buffer, format, 'student-subject-analytics');
  } catch (error) { return fail(res, error); }
};

export const chapterReport = async (req, res) => {
  try {
    const filters = filtersFor(req); const format = req.params.format;
    if (!['csv', 'pdf'].includes(format)) { const error = new Error('Report format must be csv or pdf.'); error.status = 404; throw error; }
    const buffer = await createChapterReport({ user: req.user, studentId: req.params.studentId, subjectId: req.params.subjectId, chapterId: req.params.chapterId, filters, format });
    await service.auditReportExport({ user: req.user, entityType: 'ChapterAnalytics', entityId: `${req.params.studentId}:${req.params.chapterId}`, format, requestMeta: { ip: req.ip, userAgent: req.get('user-agent') } });
    return sendReport(res, buffer, format, 'student-chapter-analytics');
  } catch (error) { return fail(res, error); }
};

export const institutionReport = async (req, res) => {
  try {
    const filters = filtersFor(req); const format = req.params.format;
    if (!['csv', 'pdf'].includes(format)) { const error = new Error('Report format must be csv or pdf.'); error.status = 404; throw error; }
    let classId = req.params.classId; const sectionId = req.params.sectionId;
    if (sectionId && !classId) {
      const section = await import('../../config/prisma.client.js').then(({ default: prisma }) => prisma.section.findFirst({ where: { id: sectionId, schoolId: req.user.schoolId }, select: { classId: true } }));
      if (!section) { const error = new Error('Section not found.'); error.status = 404; throw error; }
      classId = section.classId;
    }
    const name = classId ? (sectionId ? 'section-academic-analytics' : 'class-academic-analytics') : 'school-academic-analytics';
    const buffer = await createInstitutionReport({ user: req.user, classId, sectionId, academicSessionId: filters.academicSessionId, format });
    await service.auditReportExport({ user: req.user, entityType: sectionId ? 'SectionAnalytics' : classId ? 'ClassAnalytics' : 'SchoolAnalytics', entityId: sectionId || classId || req.user.schoolId, format, requestMeta: { ip: req.ip, userAgent: req.get('user-agent') } });
    return sendReport(res, buffer, format, name);
  } catch (error) { return fail(res, error); }
};

export const riskRules = async (req, res) => { try { return ok(res, 'Analytics risk rules retrieved successfully.', await service.listRiskRules(req.user)); } catch (error) { return fail(res, error); } };
export const saveRiskRule = async (req, res) => { try { return ok(res, 'Analytics risk rule saved successfully.', await service.saveRiskRule({ user: req.user, ruleId: req.params.id, body: req.body }), {}, 201); } catch (error) { return fail(res, error); } };
export const learningOutcomes = async (req, res) => { try { return ok(res, 'Learning outcomes retrieved successfully.', await service.getLearningOutcomes({ user: req.user, chapterId: req.params.chapterId })); } catch (error) { return fail(res, error); } };
export const saveLearningOutcome = async (req, res) => { try { return ok(res, 'Learning outcome saved successfully.', await service.saveLearningOutcome({ user: req.user, chapterId: req.params.chapterId, outcomeId: req.params.id, body: req.body }), {}, 201); } catch (error) { return fail(res, error); } };
export const saveAssessmentComponents = async (req, res) => { try { return ok(res, 'Assessment mapping saved successfully.', await service.saveAssessmentComponents({ user: req.user, assessmentId: req.params.assessmentId, body: req.body })); } catch (error) { return fail(res, error); } };
export const saveComponentScores = async (req, res) => { try { return ok(res, 'Component scores saved successfully.', await service.saveComponentScores({ user: req.user, assessmentId: req.params.assessmentId, body: req.body })); } catch (error) { return fail(res, error); } };
export const createStatusOverride = async (req, res) => { try { return ok(res, 'Analytics status override recorded successfully.', await service.createStatusOverride({ user: req.user, body: req.body }), {}, 201); } catch (error) { return fail(res, error); } };
export const runNotificationChecks = async (req, res) => { try { return ok(res, 'Analytics notification checks completed successfully.', await service.runAnalyticsNotificationChecks({ user: req.user })); } catch (error) { return fail(res, error); } };
