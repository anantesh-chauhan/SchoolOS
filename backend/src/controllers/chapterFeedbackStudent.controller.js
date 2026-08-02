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
