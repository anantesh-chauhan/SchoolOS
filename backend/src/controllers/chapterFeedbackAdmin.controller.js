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
import { VALID_POLL_STATUSES, ACTIVE_SUBMIT_STATUSES, MANAGER_ROLES, TEACHER_DIMENSIONS, STUDENT_DIMENSIONS, assertAdmin, rating, clean, responseIsLocked, pollAcceptsResponses, responseSnapshot, feedbackAuditData, auditFeedback, saveFeedbackAudits, getStudentForUser, getSectionStudents, pollInclude, notifyUsers, notifyPollAudience, summarizePoll, allowedSummaryFor } from "./chapterFeedback.shared.js";

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
