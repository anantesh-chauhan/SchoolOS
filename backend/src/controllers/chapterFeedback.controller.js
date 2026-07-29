import prisma from '../config/prisma.client.js';
import { buildChapterAnalysisSummary } from '../services/chapterAnalysis.service.js';
import {
  getSectionStudentsForContext,
  recalculateMasteryForPoll,
  saveAssessmentWithResults,
} from '../services/masteryCalculation.service.js';
import {
  assertSameSchool,
  assertTeacherAssignedToSectionSubject,
  getTeacherForUser,
  isSchoolAdmin,
  requireSchoolAdminOrAssignedTeacher,
  sendAuthorizationError,
} from '../utils/teacherAuthorization.util.js';

const VALID_POLL_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'ACTIVE', 'OPEN', 'CLOSED', 'COMPILED', 'PUBLISHED', 'ARCHIVED', 'CANCELLED']);
const ACTIVE_SUBMIT_STATUSES = new Set(['ACTIVE', 'OPEN']);
const MANAGER_ROLES = new Set(['ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER']);
const TEACHER_DIMENSIONS = ['understandingRating', 'participationRating', 'practiceRating', 'applicationRating', 'confidenceRating', 'improvementRating', 'independenceRating', 'consistencyRating'];
const STUDENT_DIMENSIONS = ['understandingRating', 'teachingRating', 'paceRating', 'examplesRating', 'practiceRating', 'resourcesRating', 'confidenceRating', 'interestRating', 'doubtResolutionRating', 'testReadinessRating'];

const assertAdmin = (user) => {
  if (!MANAGER_ROLES.has(user?.role)) {
    const error = new Error('Only school administrators or curriculum managers can manage chapter feedback.');
    error.statusCode = 403;
    throw error;
  }
};

const rating = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
};

const clean = (value, max = 2000) => value == null ? null : String(value).trim().slice(0, max) || null;
const responseIsLocked = (row) => ['SUBMITTED', 'LOCKED', 'COMPILED'].includes(row?.state);
const pollAcceptsResponses = (poll) => ACTIVE_SUBMIT_STATUSES.has(poll.status)
  && !poll.compiledAt
  && (!poll.startAt || poll.startAt <= new Date())
  && (!poll.endAt || poll.endAt > new Date());
const responseSnapshot = (data) => JSON.parse(JSON.stringify(data));
const feedbackAuditData = (req, action, entityType, entityId, { pollId = null, previous = null, current = null, reason = null } = {}) => ({
  schoolId: req.user.schoolId,
  pollId,
  // Student and parent portal principals live in Student, while actorId references User.
  actorId: ['STUDENT', 'PARENT'].includes(req.user.role) ? null : req.user.id,
  actorRole: req.user.role,
  action,
  entityType,
  entityId,
  previous: previous ? responseSnapshot(previous) : undefined,
  current: current ? responseSnapshot(current) : undefined,
  reason: clean(reason, 500),
  ipAddress: req.ip,
  userAgent: clean(req.get('user-agent'), 500),
});
const auditFeedback = (db, req, action, entityType, entityId, context = {}) =>
  db.feedbackAuditLog.create({ data: feedbackAuditData(req, action, entityType, entityId, context) });
const saveFeedbackAudits = async (rows) => {
  if (!rows.length) return;
  try {
    await prisma.feedbackAuditLog.createMany({ data: rows });
  } catch (error) {
    // An audit transport failure must never roll back an already persisted response.
    console.error('Feedback audit write failed:', error.message);
  }
};

const getStudentForUser = async (user) => {
  if (user?.role !== 'STUDENT') return null;
  return prisma.student.findFirst({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      OR: [
        { id: user.studentId || user.id },
        ...(user.email ? [{ studentUserId: user.email }] : []),
      ],
    },
  });
};

const getSectionStudents = async ({ schoolId, classId, sectionId }) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId, classId, deletedAt: null },
    include: { class: true },
  });
  if (!section) return [];
  return prisma.student.findMany({
    where: {
      schoolId,
      className: section.class.className,
      section: section.sectionName,
      isActive: true,
    },
    orderBy: [{ rollNumber: 'asc' }, { studentFirstName: 'asc' }],
  });
};

const pollInclude = {
  class: { select: { id: true, className: true } },
  section: { select: { id: true, sectionName: true } },
  subject: { select: { id: true, subjectName: true } },
  chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
  teacher: { select: { id: true, teacherName: true } },
  summary: true,
};

const notifyUsers = async ({ schoolId, where, title, body, type = 'INFO', link = null }) => {
  const users = await prisma.user.findMany({ where: { schoolId, isActive: true, ...where }, select: { id: true } });
  if (!users.length) return;
  await prisma.userWidgetNotification.createMany({
    data: users.map((user) => ({ schoolId, userId: user.id, title, body, type, link })),
  });
};

const notifyPollAudience = async (poll, { notifyStudents = false, notifyTeacher = true } = {}) => {
  const context = await prisma.chapterPoll.findUnique({ where: { id: poll.id }, include: { subject: { select: { subjectName: true } }, chapter: { select: { chapterName: true } }, teacher: { select: { email: true, employeeId: true } } } });
  if (!context) return;
  const body = `${context.subject.subjectName}: ${context.chapter.chapterName}`;
  if (notifyTeacher && context.teacher) {
    await notifyUsers({ schoolId: context.schoolId, where: { role: 'TEACHER', OR: [{ email: context.teacher.email }, { contactEmail: context.teacher.email }, { employeeId: context.teacher.employeeId }] }, title: 'Chapter poll assigned', body: `${body} needs your student evaluations.`, type: 'CHAPTER_POLL', link: '/dashboard/teacher' });
  }
  if (notifyStudents) {
    const students = await getSectionStudents(context);
    const loginIds = students.map((student) => student.studentUserId).filter(Boolean);
    if (loginIds.length) await notifyUsers({ schoolId: context.schoolId, where: { role: 'STUDENT', email: { in: loginIds } }, title: 'New chapter feedback poll', body: `${body}. Share your understanding feedback.`, type: 'CHAPTER_POLL', link: '/dashboard/student' });
  }
};

const summarizePoll = async (poll, user = null) => {
  const [studentCount, voteCount, evaluationCount] = await Promise.all([
    getSectionStudents(poll).then((students) => students.length),
    prisma.studentChapterVote.count({ where: { pollId: poll.id, schoolId: poll.schoolId, state: { in: ['SUBMITTED', 'LOCKED', 'COMPILED'] } } }),
    prisma.teacherStudentEvaluation.count({ where: { pollId: poll.id, schoolId: poll.schoolId, state: { in: ['SUBMITTED', 'LOCKED', 'COMPILED'] } } }),
  ]);

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    pollType: poll.pollType,
    instructions: poll.instructions,
    respondentTypes: poll.respondentTypes,
    anonymousToTeacher: poll.anonymousToTeacher,
    teacherVisibleToStudents: poll.teacherVisibleToStudents,
    allowClassTeacher: poll.allowClassTeacher,
    commentsRequired: poll.commentsRequired,
    minimumResponsePercentage: poll.minimumResponsePercentage,
    enabledTeacherDimensions: poll.enabledTeacherDimensions,
    enabledStudentDimensions: poll.enabledStudentDimensions,
    status: poll.status,
    startAt: poll.startAt,
    endAt: poll.endAt,
    compiledAt: poll.compiledAt,
    publishedAt: poll.publishedAt,
    class: poll.class,
    section: poll.section,
    subject: poll.subject,
    chapter: poll.chapter,
    teacher: poll.teacher,
    summaryPublished: Boolean(poll.summary?.isPublished),
    counts: MANAGER_ROLES.has(user?.role) ? { totalStudents: studentCount, studentVotesSubmitted: voteCount, teacherEvaluationsSubmitted: evaluationCount } : undefined,
  };
};

const allowedSummaryFor = async (summary, user) => {
  if (!summary) return null;
  if (MANAGER_ROLES.has(user?.role)) return summary;

  const base = {
    id: summary.id,
    pollId: summary.pollId,
    overallUnderstandingScore: summary.overallUnderstandingScore,
    overallTeachingScore: summary.overallTeachingScore,
    classStrengths: summary.classStrengths,
    classWeaknesses: summary.classWeaknesses,
    recommendations: summary.recommendations,
    isPublished: summary.isPublished,
    compiledAt: summary.compiledAt,
    updatedAt: summary.updatedAt,
  };

  if (user.role === 'TEACHER') {
    return {
      ...base,
      teacherStrengths: summary.teacherStrengths,
      teacherImprovementAreas: summary.teacherImprovementAreas,
      studentInsight: {
        riskCount: Array.isArray(summary.riskStudents) ? summary.riskStudents.length : 0,
        highPerformerCount: Array.isArray(summary.topperStudents) ? summary.topperStudents.length : 0,
      },
    };
  }

  if (user.role === 'STUDENT') {
    const student = await getStudentForUser(user);
    const ownSummary = Array.isArray(summary.studentSummaries)
      ? summary.studentSummaries.find((item) => item.studentId === student?.id)
      : null;
    return {
      ...base,
      ownRecommendation: ownSummary
        ? {
            combinedScore: ownSummary.combinedScore,
            strengths: ownSummary.strengths,
            weaknesses: ownSummary.weaknesses,
            recommendation: ownSummary.recommendation,
          }
        : null,
    };
  }

  return base;
};

export const patchTeacherChapterStatus = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const status = String(req.body.status || '').trim().toUpperCase();
    if (!['ONGOING', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be ONGOING or COMPLETED' });
    }

    const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, schoolId: req.user.schoolId, deletedAt: null } });
    if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found' });

    const classId = req.body.classId || chapter.classId;
    const sectionId = req.body.sectionId || chapter.sectionId;
    const subjectId = req.body.subjectId || chapter.subjectId;
    if (!classId || !sectionId || !subjectId) {
      return res.status(400).json({ success: false, message: 'classId, sectionId and subjectId are required for shared chapters' });
    }

    const permission = await requireSchoolAdminOrAssignedTeacher(req.user, { schoolId: req.user.schoolId, classId, sectionId, subjectId });
    const progress = await prisma.chapterProgress.upsert({
      where: { schoolId_classId_sectionId_subjectId_chapterId: { schoolId: req.user.schoolId, classId, sectionId, subjectId, chapterId } },
      create: {
        schoolId: req.user.schoolId,
        classId,
        sectionId,
        subjectId,
        chapterId,
        teacherId: permission.teacher?.id || null,
        status,
        remarks: req.body.remarks?.trim() || null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      update: {
        teacherId: permission.teacher?.id || null,
        status,
        remarks: req.body.remarks?.trim() || null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });

    if (status === 'COMPLETED') {
      await notifyUsers({
        schoolId: req.user.schoolId,
        where: { role: { in: ['ADMIN', 'SCHOOL_OWNER'] } },
        title: 'Chapter completed',
        body: `${req.user.name} marked a chapter complete. A feedback poll can now be created.`,
        type: 'CHAPTER_COMPLETED',
      });
    }

    return res.json({ success: true, data: progress });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update chapter status' });
  }
};

export const getTeacherPolls = async (req, res) => {
  try {
    const teacher = await getTeacherForUser(req.user);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found' });

    const polls = await prisma.chapterPoll.findMany({
      where: { schoolId: req.user.schoolId, teacherId: teacher.id },
      include: { ...pollInclude, evaluations: { where: { teacherId: teacher.id } } },
      orderBy: { updatedAt: 'desc' },
    });

    const data = await Promise.all(polls.map(async (poll) => {
      const students = await getSectionStudents(poll);
      const item = await summarizePoll(poll, req.user);
      return {
        ...item,
        students: students.map((student) => ({
          id: student.id,
          name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
          rollNumber: student.rollNumber,
          admissionNumber: student.admissionNo,
          photo: student.profilePicture || null,
          evaluation: (() => {
            const row = poll.evaluations.find((item) => item.studentId === student.id);
            if (!row) return null;
            const legacy = row.understandingRating == null && row.applicationRating == null;
            const value = (current, fallback) => current ?? (legacy && fallback != null ? fallback * 2 : fallback);
            return {
              ...row,
              understandingRating: value(row.understandingRating, row.conceptClarityRating),
              participationRating: legacy && row.participationRating != null ? row.participationRating * 2 : row.participationRating,
              practiceRating: value(row.practiceRating, row.homeworkRating),
              applicationRating: value(row.applicationRating, row.conceptClarityRating),
              confidenceRating: value(row.confidenceRating, row.conceptClarityRating),
              improvementRating: row.improvementRating ?? (row.improvementNeedRating == null ? null : (6 - row.improvementNeedRating) * (legacy ? 2 : 1)),
              independenceRating: value(row.independenceRating, row.attentionRating),
              consistencyRating: value(row.consistencyRating, row.homeworkRating),
            };
          })(),
        })),
        teacherEvaluation: {
          submitted: poll.evaluations.filter((row) => responseIsLocked(row)).length,
          drafted: poll.evaluations.filter((row) => !responseIsLocked(row)).length,
          total: students.length,
          isPending: poll.status !== 'DRAFT' && poll.evaluations.filter((row) => responseIsLocked(row)).length < students.length,
        },
      };
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load teacher polls', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

const saveTeacherEvaluations = async (req, res, submitFinal) => {
  try {
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    const { teacher } = await assertTeacherAssignedToSectionSubject(req.user, poll);
    if (poll.teacherId && poll.teacherId !== teacher.id) {
      return res.status(403).json({ success: false, message: 'This poll belongs to another assigned teacher.' });
    }
    if (!pollAcceptsResponses(poll)) return res.status(409).json({ success: false, message: 'This poll is not currently accepting responses.' });

    const evaluations = Array.isArray(req.body.evaluations) ? req.body.evaluations : [];
    if (!evaluations.length) return res.status(400).json({ success: false, message: 'evaluations array is required' });
    const students = await getSectionStudents(poll);
    const allowedStudentIds = new Set(students.map((student) => student.id));
    const enabled = Array.isArray(poll.enabledTeacherDimensions) ? poll.enabledTeacherDimensions : TEACHER_DIMENSIONS;
    if (enabled.length < 4) return res.status(409).json({ success: false, message: 'A valid poll must enable at least four teacher rating dimensions.' });

    const submittedStudentIds = evaluations.map((item) => item.studentId);
    if (new Set(submittedStudentIds).size !== submittedStudentIds.length) {
      return res.status(400).json({ success: false, message: 'Each student may appear only once in an evaluation save.' });
    }
    if (submittedStudentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
      return res.status(400).json({ success: false, message: 'One or more students do not belong to this section.' });
    }

    const existingRows = await prisma.teacherStudentEvaluation.findMany({
      where: { pollId: poll.id, teacherId: teacher.id, studentId: { in: submittedStudentIds } },
    });
    const existingByStudent = new Map(existingRows.map((row) => [row.studentId, row]));
    const now = new Date();
    const prepared = evaluations.map((item) => {
      const existing = existingByStudent.get(item.studentId) || null;
      if (responseIsLocked(existing)) {
        if (submitFinal) return { item, existing, payload: null };
        throw new Error('Submitted teacher feedback is read-only.');
      }
      const dimensions = Object.fromEntries(TEACHER_DIMENSIONS.map((key) => [key, item[key] == null || item[key] === '' ? null : rating(item[key])]));
      if (Object.entries(dimensions).some(([key, value]) => item[key] != null && item[key] !== '' && value == null)) throw new Error('Ratings must be whole numbers from 1 to 5.');
      if (submitFinal && enabled.some((key) => !dimensions[key])) throw new Error('Complete every enabled rating before final submission.');
      const values = enabled.map((key) => dimensions[key]).filter(Boolean);
      const payload = {
        ...dimensions,
        // Populate legacy evidence columns for existing analytics during transition.
        attentionRating: dimensions.participationRating,
        homeworkRating: dimensions.practiceRating,
        conceptClarityRating: dimensions.understandingRating,
        improvementNeedRating: dimensions.improvementRating ? 6 - dimensions.improvementRating : null,
        overallScore: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null,
        remark: clean(item.remark, 500),
        strengths: clean(item.strengths, 500),
        weaknesses: clean(item.weaknesses, 500),
        recommendation: clean(item.recommendation, 500),
        state: submitFinal ? 'SUBMITTED' : 'DRAFT_SAVED',
        lastSavedAt: now,
        submittedAt: submitFinal ? now : null,
        submittedById: submitFinal ? req.user.id : null,
        lockedAt: submitFinal ? now : null,
        version: (existing?.version || 0) + 1,
      };
      if (submitFinal) payload.snapshot = responseSnapshot({ ...payload, pollId: poll.id, teacherId: teacher.id, studentId: item.studentId });
      return { item, existing, payload };
    });

    const writes = prepared.filter((row) => row.payload).map(({ item, existing, payload }) => existing
      ? prisma.teacherStudentEvaluation.updateMany({
          where: { id: existing.id, state: { notIn: ['SUBMITTED', 'LOCKED', 'COMPILED'] } },
          data: payload,
        })
      : prisma.teacherStudentEvaluation.create({
          data: { ...payload, pollId: poll.id, schoolId: poll.schoolId, classId: poll.classId, sectionId: poll.sectionId, subjectId: poll.subjectId, chapterId: poll.chapterId, teacherId: teacher.id, studentId: item.studentId },
        }));
    // Batch transactions do not depend on a long-lived interactive transaction ID.
    if (writes.length) await prisma.$transaction(writes);

    const saved = await prisma.teacherStudentEvaluation.findMany({
      where: { pollId: poll.id, teacherId: teacher.id, studentId: { in: submittedStudentIds } },
    });
    const savedByStudent = new Map(saved.map((row) => [row.studentId, row]));
    await saveFeedbackAudits(prepared.filter((row) => row.payload).map(({ item, existing }) => {
      const row = savedByStudent.get(item.studentId);
      return feedbackAuditData(req, submitFinal ? 'TEACHER_RESPONSE_SUBMITTED' : 'TEACHER_DRAFT_SAVED', 'TeacherStudentEvaluation', row?.id, {
        pollId: poll.id,
        previous: existing,
        current: { state: row?.state, version: row?.version },
      });
    }));
    return res.status(submitFinal ? 201 : 200).json({
      success: true,
      data: {
        saved: saved.length,
        state: submitFinal ? 'SUBMITTED' : 'DRAFT_SAVED',
        lastSavedAt: saved[0]?.lastSavedAt,
        responses: saved.map((row) => ({
          id: row.id,
          studentId: row.studentId,
          state: row.state,
          version: row.version,
          lastSavedAt: row.lastSavedAt,
          submittedAt: row.submittedAt,
        })),
      },
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to save evaluations',
      ...(error.currentVersion != null ? { data: { currentVersion: error.currentVersion, studentId: error.studentId } } : {}),
    });
  }
};

export const saveTeacherEvaluationDraft = (req, res) => saveTeacherEvaluations(req, res, false);
export const submitTeacherStudentEvaluations = (req, res) => saveTeacherEvaluations(req, res, true);

export const getStudentNotifications = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const polls = (await getStudentPollRows(student, true)).filter(pollAcceptsResponses);
    return res.json({
      success: true,
      data: polls.map((poll) => ({
        id: poll.id,
        title: poll.title,
        body: `${poll.subject.subjectName}: ${poll.chapter.chapterName}`,
        type: 'CHAPTER_POLL',
        dueAt: poll.endAt,
        isSubmitted: poll.votes.length > 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
};

const getStudentPollRows = async (student, activeOnly = false) => {
  const classRow = await prisma.class.findFirst({ where: { schoolId: student.schoolId, className: student.className, deletedAt: null } });
  const section = classRow
    ? await prisma.section.findFirst({ where: { schoolId: student.schoolId, classId: classRow.id, sectionName: student.section || '', deletedAt: null } })
    : null;
  if (!classRow || !section) return [];
  return prisma.chapterPoll.findMany({
    where: {
      schoolId: student.schoolId,
      classId: classRow.id,
      sectionId: section.id,
      ...(activeOnly ? { status: { in: ['ACTIVE', 'OPEN'] } } : { status: { in: ['ACTIVE', 'OPEN', 'CLOSED', 'COMPILED', 'PUBLISHED', 'ARCHIVED', 'CANCELLED'] } }),
    },
    include: { ...pollInclude, votes: { where: { studentId: student.id } } },
    orderBy: { updatedAt: 'desc' },
  });
};

export const getStudentPolls = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const polls = await getStudentPollRows(student);
    const data = await Promise.all(polls.map(async (poll) => ({
      ...(await summarizePoll(poll, req.user)),
      response: poll.votes[0] || null,
      submitted: responseIsLocked(poll.votes[0]),
      editable: pollAcceptsResponses(poll) && !responseIsLocked(poll.votes[0]),
    })));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load student polls' });
  }
};

const saveStudentResponse = async (req, res, submitFinal) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: student.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (!pollAcceptsResponses(poll)) return res.status(409).json({ success: false, message: 'This poll is not currently accepting responses.' });

    const students = await getSectionStudents(poll);
    if (!students.some((item) => item.id === student.id)) {
      return res.status(403).json({ success: false, message: 'This poll is not for your class-section.' });
    }

    const existing = await prisma.studentChapterVote.findUnique({ where: { pollId_studentId: { pollId: poll.id, studentId: student.id } } });
    if (responseIsLocked(existing)) return res.status(409).json({ success: false, message: 'Submitted feedback is read-only.' });
    const enabled = Array.isArray(poll.enabledStudentDimensions) ? poll.enabledStudentDimensions : STUDENT_DIMENSIONS;
    const dimensions = Object.fromEntries(STUDENT_DIMENSIONS.map((key) => [key, req.body[key] == null || req.body[key] === '' ? null : rating(req.body[key])]));
    if (Object.entries(dimensions).some(([key, value]) => req.body[key] != null && req.body[key] !== '' && value == null)) return res.status(400).json({ success: false, message: 'Ratings must be whole numbers from 1 to 5.' });
    if (submitFinal && enabled.some((key) => !dimensions[key])) return res.status(400).json({ success: false, message: 'Complete every required rating before final submission.' });
    if (submitFinal && poll.commentsRequired && !clean(req.body.suggestion || req.body.comment)) return res.status(400).json({ success: false, message: 'A comment is required for this poll.' });
    const now = new Date();
    const payload = {
      ...dimensions,
      // Keep legacy fields populated for existing reports.
      difficultyRating: req.body.difficultyRating == null ? null : rating(req.body.difficultyRating),
      clarityRating: dimensions.teachingRating,
      difficultArea: clean(req.body.difficultArea, 100),
      helpfulMethod: clean(req.body.helpfulMethod, 100),
      supportNeeded: Array.isArray(req.body.supportNeeded) ? req.body.supportNeeded.map((item) => clean(item, 100)).filter(Boolean).slice(0, 10) : [],
      difficultTopic: clean(req.body.difficultTopic, 500),
      helpfulExplanation: clean(req.body.helpfulExplanation, 500),
      explainAgain: clean(req.body.explainAgain, 500),
      suggestion: clean(req.body.suggestion, 1000),
      comment: clean(req.body.comment || req.body.suggestion, 1000),
      state: submitFinal ? 'SUBMITTED' : 'DRAFT_SAVED',
      version: (existing?.version || 0) + 1,
      lastSavedAt: now,
      submittedAt: submitFinal ? now : null,
      submittedById: submitFinal ? req.user.id : null,
      lockedAt: submitFinal ? now : null,
    };
    if (submitFinal) payload.snapshot = responseSnapshot({ ...payload, pollId: poll.id, studentId: student.id });
    let vote;
    if (existing) {
      const updated = await prisma.studentChapterVote.updateMany({
        where: { id: existing.id, state: { notIn: ['SUBMITTED', 'LOCKED', 'COMPILED'] } },
        data: payload,
      });
      if (!updated.count) throw Object.assign(new Error('Submitted feedback is read-only.'), { statusCode: 409 });
      vote = await prisma.studentChapterVote.findUnique({ where: { id: existing.id } });
    } else {
      vote = await prisma.studentChapterVote.create({ data: { ...payload, pollId: poll.id, schoolId: poll.schoolId, classId: poll.classId, sectionId: poll.sectionId, subjectId: poll.subjectId, chapterId: poll.chapterId, studentId: student.id } });
    }
    await saveFeedbackAudits([
      feedbackAuditData(req, submitFinal ? 'STUDENT_RESPONSE_SUBMITTED' : 'STUDENT_DRAFT_SAVED', 'StudentChapterVote', vote.id, {
        pollId: poll.id,
        previous: existing,
        current: { state: vote.state, version: vote.version },
      }),
    ]);
    return res.status(submitFinal ? 201 : 200).json({ success: true, data: { id: vote.id, state: vote.state, version: vote.version, lastSavedAt: vote.lastSavedAt, submittedAt: vote.submittedAt } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to save feedback' });
  }
};

export const saveStudentVoteDraft = (req, res) => saveStudentResponse(req, res, false);
export const submitStudentVote = (req, res) => saveStudentResponse(req, res, true);

export const getAdminChapterCompletions = async (req, res) => {
  try {
    assertAdmin(req.user);
    assertSameSchool(req.user, req.user.schoolId);
    const [rows, polls] = await Promise.all([
      prisma.chapterProgress.findMany({
        where: {
          schoolId: req.user.schoolId,
          status: 'COMPLETED',
          chapter: { deletedAt: null },
        },
        include: {
          class: { select: { id: true, className: true } },
          section: { select: { id: true, sectionName: true } },
          subject: { select: { id: true, subjectName: true } },
          chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
          teacher: { select: { id: true, teacherName: true } },
        },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.chapterPoll.findMany({
        where: { schoolId: req.user.schoolId },
        select: { classId: true, sectionId: true, subjectId: true, chapterId: true },
      }),
    ]);
    const existingKeys = new Set(polls.map((poll) => [poll.classId, poll.sectionId, poll.subjectId, poll.chapterId].join(':')));
    const data = rows.filter((row) => !existingKeys.has([row.classId, row.sectionId, row.subjectId, row.chapterId].join(':')));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load completion queue' });
  }
};

export const createAdminChapterPoll = async (req, res) => {
  try {
    assertAdmin(req.user);
    const { classId, sectionId, subjectId, chapterId } = req.body;
    const progress = await prisma.chapterProgress.findFirst({
      where: { schoolId: req.user.schoolId, classId, sectionId, subjectId, chapterId, status: 'COMPLETED' },
      include: { chapter: true, subject: true },
    });
    if (!progress) return res.status(400).json({ success: false, message: 'Chapter must be completed before creating a poll.' });

    const assignment = await prisma.teacherAssignment.findFirst({
      where: { schoolId: req.user.schoolId, classId, sectionId, subjectId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    const template = req.body.templateId ? await prisma.feedbackTemplate.findFirst({ where: { id: req.body.templateId, schoolId: req.user.schoolId, isActive: true } }) : null;
    if (req.body.templateId && !template) return res.status(404).json({ success: false, message: 'Feedback template not found' });
    const teacherSource = req.body.enabledTeacherDimensions ?? template?.teacherDimensions;
    const studentSource = req.body.enabledStudentDimensions ?? template?.studentDimensions;
    const teacherDimensions = Array.isArray(teacherSource) ? teacherSource.filter((key) => TEACHER_DIMENSIONS.includes(key)) : TEACHER_DIMENSIONS;
    const studentDimensions = Array.isArray(studentSource) ? studentSource.filter((key) => STUDENT_DIMENSIONS.includes(key)) : STUDENT_DIMENSIONS;
    if (teacherDimensions.length < 4) return res.status(400).json({ success: false, message: 'At least four teacher rating dimensions are required.' });
    const minimumResponsePercentage = Number(req.body.minimumResponsePercentage ?? template?.minimumResponsePercentage ?? 60);
    if (!Number.isInteger(minimumResponsePercentage) || minimumResponsePercentage < 0 || minimumResponsePercentage > 100) {
      return res.status(400).json({ success: false, message: 'Minimum response percentage must be from 0 to 100.' });
    }
    const requestedStatus = String(req.body.status || 'DRAFT').toUpperCase();
    const startAt = req.body.startAt ? new Date(req.body.startAt) : null;
    const status = requestedStatus === 'OPEN' || requestedStatus === 'ACTIVE'
      ? 'OPEN'
      : requestedStatus === 'SCHEDULED' || (startAt && startAt > new Date()) ? 'SCHEDULED' : 'DRAFT';
    const poll = await prisma.$transaction(async (tx) => {
      const created = await tx.chapterPoll.create({ data: {
        schoolId: req.user.schoolId,
        academicSessionId: req.body.academicSessionId || progress.academicSessionId || null,
        classId,
        sectionId,
        subjectId,
        chapterId,
        teacherId: progress.teacherId || assignment?.teacherId || null,
        createdByAdminId: req.user.id,
        title: req.body.title?.trim() || `${progress.subject.subjectName} - ${progress.chapter.chapterName} feedback`,
        description: req.body.description?.trim() || null,
        pollType: req.body.pollType || template?.pollType || 'CHAPTER_COMPLETION',
        respondentTypes: Array.isArray(req.body.respondentTypes) ? req.body.respondentTypes : template?.respondentTypes || ['SUBJECT_TEACHER', 'STUDENT'],
        instructions: clean(req.body.instructions ?? template?.instructions),
        anonymousToTeacher: req.body.anonymousToTeacher ?? template?.anonymousToTeacher ?? true,
        teacherVisibleToStudents: req.body.teacherVisibleToStudents ?? template?.teacherVisibleToStudents ?? false,
        allowClassTeacher: Boolean(req.body.allowClassTeacher),
        commentsRequired: req.body.commentsRequired ?? template?.commentsRequired ?? false,
        minimumResponsePercentage,
        enabledTeacherDimensions: teacherDimensions,
        enabledStudentDimensions: studentDimensions,
        status,
        startAt: startAt || (status === 'OPEN' ? new Date() : null),
        endAt: req.body.endAt ? new Date(req.body.endAt) : null,
      }, include: pollInclude });
      await auditFeedback(tx, req, 'POLL_CREATED', 'ChapterPoll', created.id, { pollId: created.id, current: { title: created.title, status: created.status } });
      return created;
    });

    await notifyPollAudience(poll, { notifyStudents: ACTIVE_SUBMIT_STATUSES.has(poll.status), notifyTeacher: true });

    return res.status(201).json({ success: true, data: await summarizePoll(poll, req.user) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'A poll already exists for this chapter.' });
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to create poll' });
  }
};

export const getAdminChapterPolls = async (req, res) => {
  try {
    assertAdmin(req.user);
    const polls = await prisma.chapterPoll.findMany({
      where: { schoolId: req.user.schoolId, ...(req.query.status ? { status: String(req.query.status).toUpperCase() } : {}) },
      include: pollInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const data = await Promise.all(polls.map((poll) => summarizePoll(poll, req.user)));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load chapter polls' });
  }
};

export const duplicateAdminChapterPoll = async (req, res) => {
  try {
    assertAdmin(req.user);
    const source = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!source) return res.status(404).json({ success: false, message: 'Source poll not found' });
    const copy = await prisma.$transaction(async (tx) => {
      const row = await tx.chapterPoll.create({
        data: {
          schoolId: source.schoolId, academicSessionId: req.body.academicSessionId || source.academicSessionId,
          classId: req.body.classId || source.classId, sectionId: req.body.sectionId || source.sectionId,
          subjectId: req.body.subjectId || source.subjectId, chapterId: req.body.chapterId || source.chapterId,
          teacherId: req.body.teacherId || source.teacherId, createdByAdminId: req.user.id,
          title: clean(req.body.title, 300) || `Copy of ${source.title}`, description: source.description,
          pollType: source.pollType, respondentTypes: source.respondentTypes, instructions: source.instructions,
          anonymousToTeacher: source.anonymousToTeacher, teacherVisibleToStudents: source.teacherVisibleToStudents,
          allowClassTeacher: source.allowClassTeacher, commentsRequired: source.commentsRequired,
          minimumResponsePercentage: source.minimumResponsePercentage,
          enabledTeacherDimensions: source.enabledTeacherDimensions, enabledStudentDimensions: source.enabledStudentDimensions,
          status: 'DRAFT',
        },
        include: pollInclude,
      });
      await auditFeedback(tx, req, 'POLL_DUPLICATED', 'ChapterPoll', row.id, { pollId: row.id, current: { sourcePollId: source.id, title: row.title } });
      return row;
    });
    return res.status(201).json({ success: true, data: await summarizePoll(copy, req.user) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to duplicate poll' });
  }
};

export const getFeedbackTemplates = async (req, res) => {
  try {
    assertAdmin(req.user);
    const rows = await prisma.feedbackTemplate.findMany({ where: { schoolId: req.user.schoolId, ...(req.query.includeInactive === 'true' ? {} : { isActive: true }) }, orderBy: { name: 'asc' } });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load templates' });
  }
};

export const saveFeedbackTemplate = async (req, res) => {
  try {
    assertAdmin(req.user);
    const teacherDimensions = Array.isArray(req.body.teacherDimensions) ? req.body.teacherDimensions.filter((key) => TEACHER_DIMENSIONS.includes(key)) : [];
    if (teacherDimensions.length < 4) return res.status(400).json({ success: false, message: 'Templates require at least four teacher dimensions.' });
    const studentDimensions = Array.isArray(req.body.studentDimensions) ? req.body.studentDimensions.filter((key) => STUDENT_DIMENSIONS.includes(key)) : STUDENT_DIMENSIONS;
    const minimum = Number(req.body.minimumResponsePercentage ?? 60);
    if (!clean(req.body.name, 150) || !Number.isInteger(minimum) || minimum < 0 || minimum > 100) return res.status(400).json({ success: false, message: 'Valid name and response threshold are required.' });
    const row = await prisma.feedbackTemplate.upsert({
      where: { schoolId_name: { schoolId: req.user.schoolId, name: clean(req.body.name, 150) } },
      create: { schoolId: req.user.schoolId, createdById: req.user.id, name: clean(req.body.name, 150), pollType: req.body.pollType || 'CHAPTER_COMPLETION', instructions: clean(req.body.instructions), respondentTypes: req.body.respondentTypes || ['SUBJECT_TEACHER', 'STUDENT'], teacherDimensions, studentDimensions, anonymousToTeacher: req.body.anonymousToTeacher !== false, teacherVisibleToStudents: Boolean(req.body.teacherVisibleToStudents), commentsRequired: Boolean(req.body.commentsRequired), minimumResponsePercentage: minimum },
      update: { pollType: req.body.pollType || 'CHAPTER_COMPLETION', instructions: clean(req.body.instructions), respondentTypes: req.body.respondentTypes || ['SUBJECT_TEACHER', 'STUDENT'], teacherDimensions, studentDimensions, anonymousToTeacher: req.body.anonymousToTeacher !== false, teacherVisibleToStudents: Boolean(req.body.teacherVisibleToStudents), commentsRequired: Boolean(req.body.commentsRequired), minimumResponsePercentage: minimum, isActive: req.body.isActive !== false },
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to save template' });
  }
};

export const getFeedbackAuditLog = async (req, res) => {
  try {
    assertAdmin(req.user);
    const rows = await prisma.feedbackAuditLog.findMany({ where: { schoolId: req.user.schoolId, ...(req.query.pollId ? { pollId: req.query.pollId } : {}) }, orderBy: { createdAt: 'desc' }, take: Math.min(500, Number(req.query.limit) || 100) });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load feedback audit log' });
  }
};

export const updateAdminChapterPollStatus = async (req, res) => {
  try {
    assertAdmin(req.user);
    const status = String(req.body.status || '').trim().toUpperCase();
    if (!VALID_POLL_STATUSES.has(status)) return res.status(400).json({ success: false, message: 'Invalid poll status' });
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (poll.compiledAt || poll.status === 'COMPILED') return res.status(409).json({ success: false, message: 'Compiled polls are immutable and cannot be reopened or changed.' });
    if (['COMPILED', 'PUBLISHED'].includes(status)) return res.status(400).json({ success: false, message: 'Use the compile workflow to finalize a poll.' });
    const data = {
      status,
      ...(ACTIVE_SUBMIT_STATUSES.has(status) && !poll.startAt ? { startAt: new Date() } : {}),
      ...(req.body.endAt ? { endAt: new Date(req.body.endAt) } : {}),
    };
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.chapterPoll.update({ where: { id: poll.id }, data, include: pollInclude });
      await auditFeedback(tx, req, status === 'OPEN' || status === 'ACTIVE' ? 'POLL_OPENED' : `POLL_${status}`, 'ChapterPoll', poll.id, { pollId: poll.id, previous: { status: poll.status, endAt: poll.endAt }, current: { status: saved.status, endAt: saved.endAt }, reason: req.body.reason });
      return saved;
    });
    if (ACTIVE_SUBMIT_STATUSES.has(status)) {
      await notifyPollAudience(updated, { notifyStudents: true, notifyTeacher: poll.status !== 'ACTIVE' });
    }
    return res.json({ success: true, data: await summarizePoll(updated, req.user) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update poll status' });
  }
};

export const getAdminRawStatus = async (req, res) => {
  try {
    assertAdmin(req.user);
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    const students = await getSectionStudents(poll);
    const [votes, evaluations] = await Promise.all([
      prisma.studentChapterVote.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId }, select: { studentId: true, state: true } }),
      prisma.teacherStudentEvaluation.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId }, select: { studentId: true, state: true } }),
    ]);
    const submittedVotes = votes.filter(responseIsLocked);
    const submittedEvaluations = evaluations.filter(responseIsLocked);
    const voted = new Set(submittedVotes.map((vote) => vote.studentId));
    const responsePercentage = students.length ? Math.round((submittedVotes.length / students.length) * 1000) / 10 : 0;
    return res.json({
      success: true,
      data: {
        totalStudents: students.length,
        studentVotesSubmitted: submittedVotes.length,
        teacherEvaluationsSubmitted: submittedEvaluations.length,
        responsePercentage,
        minimumResponsePercentage: poll.minimumResponsePercentage,
        thresholdMet: responsePercentage >= poll.minimumResponsePercentage,
        incompleteDrafts: votes.filter((row) => !responseIsLocked(row)).length + evaluations.filter((row) => !responseIsLocked(row)).length,
        deadlinePassed: Boolean(poll.endAt && poll.endAt <= new Date()),
        pendingStudents: students.filter((student) => !voted.has(student.id)).map((student) => ({
          id: student.id,
          name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
          rollNumber: student.rollNumber,
        })),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load raw status' });
  }
};

export const compileAdminChapterPoll = async (req, res) => {
  try {
    assertAdmin(req.user);
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    const existing = await prisma.chapterAnalysisSummary.findUnique({ where: { pollId: poll.id } });
    if (existing || poll.compiledAt || poll.status === 'COMPILED') return res.status(409).json({ success: false, message: 'This poll has already been compiled and is permanently locked.' });

    const [students, votes, evaluations, assessmentResults] = await Promise.all([
      getSectionStudents(poll),
      prisma.studentChapterVote.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId, state: { in: ['SUBMITTED', 'LOCKED'] } } }),
      prisma.teacherStudentEvaluation.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId, state: { in: ['SUBMITTED', 'LOCKED'] } } }),
      prisma.chapterAssessmentResult.findMany({ where: { schoolId: req.user.schoolId, classId: poll.classId, sectionId: poll.sectionId, subjectId: poll.subjectId, chapterId: poll.chapterId } }),
    ]);
    const responsePercentage = students.length ? (votes.length / students.length) * 100 : 0;
    const summaryData = buildChapterAnalysisSummary({
      poll,
      students,
      votes,
      evaluations,
      assessmentResults,
      adminId: req.user.id,
      adminNotes: req.body.adminNotes?.trim() || existing?.adminNotes || null,
    });

    const summary = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const created = await tx.chapterAnalysisSummary.create({ data: summaryData });
      await tx.studentChapterVote.updateMany({ where: { pollId: poll.id, schoolId: req.user.schoolId, state: { in: ['SUBMITTED', 'LOCKED'] } }, data: { state: 'COMPILED', lockedAt: now } });
      await tx.studentChapterVote.updateMany({ where: { pollId: poll.id, schoolId: req.user.schoolId, state: { in: ['IN_PROGRESS', 'DRAFT_SAVED'] } }, data: { state: 'LOCKED', lockedAt: now } });
      await tx.teacherStudentEvaluation.updateMany({ where: { pollId: poll.id, schoolId: req.user.schoolId, state: { in: ['SUBMITTED', 'LOCKED'] } }, data: { state: 'COMPILED', lockedAt: now } });
      await tx.teacherStudentEvaluation.updateMany({ where: { pollId: poll.id, schoolId: req.user.schoolId, state: { in: ['IN_PROGRESS', 'DRAFT_SAVED'] } }, data: { state: 'LOCKED', lockedAt: now } });
      await tx.chapterPoll.update({ where: { id: poll.id }, data: { status: 'COMPILED', compiledAt: now } });
      await auditFeedback(tx, req, 'POLL_COMPILED', 'ChapterPoll', poll.id, { pollId: poll.id, previous: { status: poll.status }, current: { status: 'COMPILED', responsePercentage, thresholdMet: responsePercentage >= poll.minimumResponsePercentage }, reason: req.body.adminNotes });
      return created;
    });
    await recalculateMasteryForPoll(poll);

    return res.json({ success: true, data: summary });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to compile analysis' });
  }
};

export const createPollAssessment = async (req, res) => {
  try {
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    let teacherId = null;
    if (req.user.role === 'TEACHER') {
      const { teacher } = await assertTeacherAssignedToSectionSubject(req.user, poll);
      teacherId = teacher.id;
      if (poll.teacherId && poll.teacherId !== teacher.id) {
        return res.status(403).json({ success: false, message: 'This poll belongs to another assigned teacher.' });
      }
    } else {
      assertAdmin(req.user);
    }

    const assessment = await saveAssessmentWithResults({ poll, teacherId, payload: req.body });
    return res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to save assessment results' });
  }
};

export const recalculatePollMastery = async (req, res) => {
  try {
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (!MANAGER_ROLES.has(req.user.role)) await requireSchoolAdminOrAssignedTeacher(req.user, poll);
    const rows = await recalculateMasteryForPoll(poll);
    return res.json({ success: true, data: { calculated: rows.length } });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to recalculate mastery' });
  }
};

export const getPollMasteryMatrix = async (req, res) => {
  try {
    const poll = await prisma.chapterPoll.findFirst({
      where: { id: req.params.pollId, schoolId: req.user.schoolId },
      include: {
        class: { select: { id: true, className: true } },
        section: { select: { id: true, sectionName: true } },
        subject: { select: { id: true, subjectName: true } },
        chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
      },
    });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (!MANAGER_ROLES.has(req.user.role)) await requireSchoolAdminOrAssignedTeacher(req.user, poll);

    const students = await getSectionStudentsForContext(poll);
    const masteries = await prisma.studentChapterMastery.findMany({
      where: { schoolId: poll.schoolId, classId: poll.classId, sectionId: poll.sectionId, subjectId: poll.subjectId, chapterId: poll.chapterId },
    });
    const masteryByStudent = new Map(masteries.map((mastery) => [mastery.studentId, mastery]));

    return res.json({
      success: true,
      data: {
        poll: {
          id: poll.id,
          status: poll.status,
          class: poll.class,
          section: poll.section,
          subject: poll.subject,
          chapter: poll.chapter,
        },
        students: students.map((student) => {
          const mastery = masteryByStudent.get(student.id);
          return {
            id: student.id,
            name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
            rollNumber: student.rollNumber,
            mastery: mastery
              ? {
                  id: mastery.id,
                  score: mastery.score,
                  masteryLevel: mastery.masteryLevel,
                  confidence: mastery.confidence,
                  componentBreakdown: mastery.componentBreakdown,
                  dataCompleteness: mastery.dataCompleteness,
                  summary: mastery.summary,
                }
              : null,
          };
        }),
      },
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load mastery matrix' });
  }
};

export const getMyStudentMastery = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const rows = await prisma.studentChapterMastery.findMany({
      where: { schoolId: student.schoolId, studentId: student.id },
      include: {
        subject: { select: { id: true, subjectName: true } },
        chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
      },
      orderBy: [{ calculatedAt: 'desc' }],
    });
    return res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        subject: row.subject,
        chapter: row.chapter,
        score: row.score,
        masteryLevel: row.masteryLevel,
        confidence: row.confidence,
        componentBreakdown: row.componentBreakdown,
        dataCompleteness: row.dataCompleteness,
        summary: row.summary,
        calculatedAt: row.calculatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load student mastery' });
  }
};

export const createIntervention = async (req, res) => {
  try {
    const mastery = await prisma.studentChapterMastery.findFirst({
      where: { id: req.body.masteryId, schoolId: req.user.schoolId },
    });
    if (!mastery) return res.status(404).json({ success: false, message: 'Mastery row not found' });
    const permission = MANAGER_ROLES.has(req.user.role) ? { isAdmin: true, teacher: null } : await requireSchoolAdminOrAssignedTeacher(req.user, mastery);

    const intervention = await prisma.learningIntervention.create({
      data: {
        schoolId: mastery.schoolId,
        classId: mastery.classId,
        sectionId: mastery.sectionId,
        subjectId: mastery.subjectId,
        chapterId: mastery.chapterId,
        studentId: mastery.studentId,
        assignedTeacherId: permission.teacher?.id || null,
        reason: req.body.reason?.trim() || mastery.summary || 'Additional support recommended.',
        recommendedAction: req.body.recommendedAction?.trim() || 'Targeted revision and reassessment',
        status: req.body.status || 'PLANNED',
        startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        notes: req.body.notes?.trim() || null,
        beforeScore: mastery.score,
      },
    });

    return res.status(201).json({ success: true, data: intervention });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to create intervention' });
  }
};

export const getAdminChapterAnalysis = async (req, res) => {
  try {
    assertAdmin(req.user);
    const summary = await prisma.chapterAnalysisSummary.findFirst({ where: { pollId: req.params.pollId, schoolId: req.user.schoolId } });
    if (!summary) return res.status(404).json({ success: false, message: 'Compiled analysis not found' });
    return res.json({ success: true, data: summary });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load analysis' });
  }
};

export const updateAdminChapterAnalysis = async (req, res) => {
  try {
    assertAdmin(req.user);
    const summary = await prisma.chapterAnalysisSummary.findFirst({ where: { id: req.params.summaryId, schoolId: req.user.schoolId } });
    if (!summary) return res.status(404).json({ success: false, message: 'Analysis summary not found' });
    const updated = await prisma.chapterAnalysisSummary.update({
      where: { id: summary.id },
      data: {
        ...(req.body.adminNotes !== undefined ? { adminNotes: String(req.body.adminNotes || '').trim() || null } : {}),
        ...(req.body.recommendations !== undefined ? { recommendations: req.body.recommendations } : {}),
        ...(req.body.isPublished !== undefined ? { isPublished: Boolean(req.body.isPublished) } : {}),
      },
    });
    if (req.body.isPublished === true) {
      await prisma.chapterPoll.update({ where: { id: summary.pollId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update analysis' });
  }
};

export const getChapterAnalysis = async (req, res) => {
  try {
    const summary = await prisma.chapterAnalysisSummary.findFirst({
      where: {
        chapterId: req.params.chapterId,
        schoolId: req.user.schoolId,
        ...(isSchoolAdmin(req.user) ? {} : { isPublished: true }),
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!summary) return res.status(404).json({ success: false, message: 'Published analysis not found' });
    if (req.user.role === 'TEACHER') {
      if (!MANAGER_ROLES.has(req.user.role)) await requireSchoolAdminOrAssignedTeacher(req.user, summary);
    }
    if (req.user.role === 'STUDENT') {
      const student = await getStudentForUser(req.user);
      const students = await getSectionStudents(summary);
      if (!student || !students.some((item) => item.id === student.id)) {
        return res.status(403).json({ success: false, message: 'You cannot access this chapter analysis.' });
      }
    }
    return res.json({ success: true, data: await allowedSummaryFor(summary, req.user) });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load chapter analysis' });
  }
};
