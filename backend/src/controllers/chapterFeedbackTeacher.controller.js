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
