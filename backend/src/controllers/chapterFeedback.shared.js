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

export const VALID_POLL_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'ACTIVE', 'OPEN', 'CLOSED', 'COMPILED', 'PUBLISHED', 'ARCHIVED', 'CANCELLED']);
export const ACTIVE_SUBMIT_STATUSES = new Set(['ACTIVE', 'OPEN']);
export const MANAGER_ROLES = new Set(['ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER']);
export const TEACHER_DIMENSIONS = ['understandingRating', 'participationRating', 'practiceRating', 'applicationRating', 'confidenceRating', 'improvementRating', 'independenceRating', 'consistencyRating'];
export const STUDENT_DIMENSIONS = ['understandingRating', 'teachingRating', 'paceRating', 'examplesRating', 'practiceRating', 'resourcesRating', 'confidenceRating', 'interestRating', 'doubtResolutionRating', 'testReadinessRating'];

export const assertAdmin = (user) => {
  if (!MANAGER_ROLES.has(user?.role)) {
    const error = new Error('Only school administrators or curriculum managers can manage chapter feedback.');
    error.statusCode = 403;
    throw error;
  }
};

export const rating = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
};

export const clean = (value, max = 2000) => value == null ? null : String(value).trim().slice(0, max) || null;
export const responseIsLocked = (row) => ['SUBMITTED', 'LOCKED', 'COMPILED'].includes(row?.state);
export const pollAcceptsResponses = (poll) => ACTIVE_SUBMIT_STATUSES.has(poll.status)
  && !poll.compiledAt
  && (!poll.startAt || poll.startAt <= new Date())
  && (!poll.endAt || poll.endAt > new Date());
export const responseSnapshot = (data) => JSON.parse(JSON.stringify(data));
export const feedbackAuditData = (req, action, entityType, entityId, { pollId = null, previous = null, current = null, reason = null } = {}) => ({
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
export const auditFeedback = (db, req, action, entityType, entityId, context = {}) =>
  db.feedbackAuditLog.create({ data: feedbackAuditData(req, action, entityType, entityId, context) });
export const saveFeedbackAudits = async (rows) => {
  if (!rows.length) return;
  try {
    await prisma.feedbackAuditLog.createMany({ data: rows });
  } catch (error) {
    // An audit transport failure must never roll back an already persisted response.
    console.error('Feedback audit write failed:', error.message);
  }
};

export const getStudentForUser = async (user) => {
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

export const getSectionStudents = async ({ schoolId, classId, sectionId }) => {
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

export const pollInclude = {
  class: { select: { id: true, className: true } },
  section: { select: { id: true, sectionName: true } },
  subject: { select: { id: true, subjectName: true } },
  chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
  teacher: { select: { id: true, teacherName: true } },
  summary: true,
};

export const notifyUsers = async ({ schoolId, where, title, body, type = 'INFO', link = null }) => {
  const users = await prisma.user.findMany({ where: { schoolId, isActive: true, ...where }, select: { id: true } });
  if (!users.length) return;
  await prisma.userWidgetNotification.createMany({
    data: users.map((user) => ({ schoolId, userId: user.id, title, body, type, link })),
  });
};

export const notifyPollAudience = async (poll, { notifyStudents = false, notifyTeacher = true } = {}) => {
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

export const summarizePoll = async (poll, user = null) => {
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

export const allowedSummaryFor = async (summary, user) => {
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
