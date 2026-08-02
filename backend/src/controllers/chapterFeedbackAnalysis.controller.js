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
