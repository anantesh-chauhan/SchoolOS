import prisma from '../config/prisma.client.js';
import { buildChapterAnalysisSummary } from '../services/chapterAnalysis.service.js';
import {
  assertSameSchool,
  assertTeacherAssignedToSectionSubject,
  getTeacherForUser,
  isSchoolAdmin,
  requireSchoolAdminOrAssignedTeacher,
  sendAuthorizationError,
} from '../utils/teacherAuthorization.util.js';

const VALID_POLL_STATUSES = new Set(['DRAFT', 'ACTIVE', 'CLOSED', 'COMPILED', 'PUBLISHED']);
const ACTIVE_SUBMIT_STATUSES = new Set(['ACTIVE']);

const assertAdmin = (user) => {
  if (!isSchoolAdmin(user)) {
    const error = new Error('Only school admins can manage chapter analysis.');
    error.statusCode = 403;
    throw error;
  }
};

const rating = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
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

const summarizePoll = async (poll, user = null) => {
  const [studentCount, voteCount, evaluationCount] = await Promise.all([
    getSectionStudents(poll).then((students) => students.length),
    prisma.studentChapterVote.count({ where: { pollId: poll.id, schoolId: poll.schoolId } }),
    prisma.teacherStudentEvaluation.count({ where: { pollId: poll.id, schoolId: poll.schoolId } }),
  ]);

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
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
    counts: isSchoolAdmin(user) ? { totalStudents: studentCount, studentVotesSubmitted: voteCount, teacherEvaluationsSubmitted: evaluationCount } : undefined,
  };
};

const allowedSummaryFor = async (summary, user) => {
  if (!summary) return null;
  if (isSchoolAdmin(user)) return summary;

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
      include: { ...pollInclude, evaluations: { where: { teacherId: teacher.id }, select: { studentId: true } } },
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
        })),
        teacherEvaluation: {
          submitted: poll.evaluations.length,
          total: students.length,
          isPending: poll.status !== 'DRAFT' && poll.evaluations.length < students.length,
        },
      };
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load teacher polls', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const submitTeacherStudentEvaluations = async (req, res) => {
  try {
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    const { teacher } = await assertTeacherAssignedToSectionSubject(req.user, poll);
    if (poll.teacherId && poll.teacherId !== teacher.id) {
      return res.status(403).json({ success: false, message: 'This poll belongs to another assigned teacher.' });
    }
    if (!['ACTIVE', 'CLOSED'].includes(poll.status)) {
      return res.status(400).json({ success: false, message: 'Teacher evaluations are allowed only while poll is active or closed.' });
    }

    const evaluations = Array.isArray(req.body.evaluations) ? req.body.evaluations : [];
    if (!evaluations.length) return res.status(400).json({ success: false, message: 'evaluations array is required' });
    const students = await getSectionStudents(poll);
    const allowedStudentIds = new Set(students.map((student) => student.id));

    const tx = evaluations.map((item) => {
      if (!allowedStudentIds.has(item.studentId)) throw new Error('One or more students do not belong to this section.');
      const data = {
        pollId: poll.id,
        schoolId: poll.schoolId,
        classId: poll.classId,
        sectionId: poll.sectionId,
        subjectId: poll.subjectId,
        chapterId: poll.chapterId,
        teacherId: teacher.id,
        studentId: item.studentId,
        attentionRating: rating(item.attentionRating),
        participationRating: rating(item.participationRating),
        homeworkRating: rating(item.homeworkRating),
        conceptClarityRating: rating(item.conceptClarityRating),
        improvementNeedRating: rating(item.improvementNeedRating),
        strengths: item.strengths?.trim() || null,
        weaknesses: item.weaknesses?.trim() || null,
        recommendation: item.recommendation?.trim() || null,
        submittedAt: new Date(),
      };
      if (Object.entries(data).some(([key, value]) => key.endsWith('Rating') && !value)) {
        throw new Error('All ratings must be integers from 1 to 5.');
      }
      return prisma.teacherStudentEvaluation.upsert({
        where: { pollId_teacherId_studentId: { pollId: poll.id, teacherId: teacher.id, studentId: item.studentId } },
        create: data,
        update: data,
      });
    });

    const saved = await prisma.$transaction(tx);
    return res.status(201).json({ success: true, data: { submitted: saved.length } });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(400).json({ success: false, message: error.message || 'Failed to submit evaluations' });
  }
};

export const getStudentNotifications = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const polls = await getStudentPollRows(student, true);
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
      ...(activeOnly ? { status: 'ACTIVE' } : { status: { in: ['ACTIVE', 'COMPILED', 'PUBLISHED'] } }),
    },
    include: { ...pollInclude, votes: { where: { studentId: student.id }, select: { id: true, submittedAt: true } } },
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
      submitted: poll.votes.length > 0,
    })));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load student polls' });
  }
};

export const submitStudentVote = async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: student.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (!ACTIVE_SUBMIT_STATUSES.has(poll.status)) return res.status(400).json({ success: false, message: 'Poll is not active.' });

    const students = await getSectionStudents(poll);
    if (!students.some((item) => item.id === student.id)) {
      return res.status(403).json({ success: false, message: 'This poll is not for your class-section.' });
    }

    const data = {
      pollId: poll.id,
      schoolId: poll.schoolId,
      classId: poll.classId,
      sectionId: poll.sectionId,
      subjectId: poll.subjectId,
      chapterId: poll.chapterId,
      studentId: student.id,
      understandingRating: rating(req.body.understandingRating),
      difficultyRating: rating(req.body.difficultyRating),
      confidenceRating: rating(req.body.confidenceRating),
      teachingRating: rating(req.body.teachingRating),
      paceRating: rating(req.body.paceRating),
      clarityRating: rating(req.body.clarityRating),
      comment: req.body.comment?.trim() || null,
    };
    if (Object.entries(data).some(([key, value]) => key.endsWith('Rating') && !value)) {
      return res.status(400).json({ success: false, message: 'All ratings must be integers from 1 to 5.' });
    }

    const vote = await prisma.studentChapterVote.create({ data });
    return res.status(201).json({ success: true, data: { id: vote.id, submittedAt: vote.submittedAt } });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'You have already submitted this poll.' });
    return res.status(500).json({ success: false, message: 'Failed to submit vote' });
  }
};

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

    const poll = await prisma.chapterPoll.create({
      data: {
        schoolId: req.user.schoolId,
        classId,
        sectionId,
        subjectId,
        chapterId,
        teacherId: progress.teacherId || assignment?.teacherId || null,
        createdByAdminId: req.user.id,
        title: req.body.title?.trim() || `${progress.subject.subjectName} - ${progress.chapter.chapterName} feedback`,
        description: req.body.description?.trim() || null,
        status: req.body.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
        startAt: req.body.startAt ? new Date(req.body.startAt) : (req.body.status === 'ACTIVE' ? new Date() : null),
        endAt: req.body.endAt ? new Date(req.body.endAt) : null,
      },
      include: pollInclude,
    });

    await notifyUsers({
      schoolId: req.user.schoolId,
      where: { role: 'TEACHER' },
      title: 'Chapter poll created',
      body: 'A chapter feedback poll needs student evaluations.',
      type: 'CHAPTER_POLL',
    });

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

export const updateAdminChapterPollStatus = async (req, res) => {
  try {
    assertAdmin(req.user);
    const status = String(req.body.status || '').trim().toUpperCase();
    if (!VALID_POLL_STATUSES.has(status)) return res.status(400).json({ success: false, message: 'Invalid poll status' });
    const poll = await prisma.chapterPoll.findFirst({ where: { id: req.params.pollId, schoolId: req.user.schoolId } });
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    const data = {
      status,
      ...(status === 'ACTIVE' && !poll.startAt ? { startAt: new Date() } : {}),
      ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
    };
    const updated = await prisma.chapterPoll.update({ where: { id: poll.id }, data, include: pollInclude });
    if (status === 'ACTIVE') {
      await notifyUsers({
        schoolId: poll.schoolId,
        where: { role: 'STUDENT', classId: poll.classId, sectionId: poll.sectionId },
        title: 'Chapter feedback poll active',
        body: 'Please submit your chapter understanding feedback.',
        type: 'CHAPTER_POLL',
      });
    }
    if (status === 'PUBLISHED') {
      await prisma.chapterAnalysisSummary.updateMany({ where: { pollId: poll.id, schoolId: req.user.schoolId }, data: { isPublished: true } });
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
      prisma.studentChapterVote.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId }, select: { studentId: true } }),
      prisma.teacherStudentEvaluation.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId }, select: { studentId: true } }),
    ]);
    const voted = new Set(votes.map((vote) => vote.studentId));
    return res.json({
      success: true,
      data: {
        totalStudents: students.length,
        studentVotesSubmitted: votes.length,
        teacherEvaluationsSubmitted: evaluations.length,
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
    if (existing && !req.body.recompile) {
      return res.status(409).json({ success: false, message: 'Summary already exists. Pass recompile: true to update it.' });
    }

    const [students, votes, evaluations] = await Promise.all([
      getSectionStudents(poll),
      prisma.studentChapterVote.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId } }),
      prisma.teacherStudentEvaluation.findMany({ where: { pollId: poll.id, schoolId: req.user.schoolId } }),
    ]);
    const summaryData = buildChapterAnalysisSummary({
      poll,
      students,
      votes,
      evaluations,
      adminId: req.user.id,
      adminNotes: req.body.adminNotes?.trim() || existing?.adminNotes || null,
    });

    const summary = await prisma.chapterAnalysisSummary.upsert({
      where: { pollId: poll.id },
      create: summaryData,
      update: { ...summaryData, compiledAt: new Date() },
    });
    await prisma.chapterPoll.update({ where: { id: poll.id }, data: { status: 'COMPILED', compiledAt: new Date() } });

    return res.json({ success: true, data: summary });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to compile analysis' });
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
      await requireSchoolAdminOrAssignedTeacher(req.user, summary);
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
