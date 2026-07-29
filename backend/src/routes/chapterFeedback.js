import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  compileAdminChapterPoll,
  createIntervention,
  createAdminChapterPoll,
  createPollAssessment,
  duplicateAdminChapterPoll,
  getAdminChapterAnalysis,
  getAdminChapterCompletions,
  getAdminChapterPolls,
  getAdminRawStatus,
  getChapterAnalysis,
  getFeedbackAuditLog,
  getFeedbackTemplates,
  getMyStudentMastery,
  getPollMasteryMatrix,
  getStudentNotifications,
  getStudentPolls,
  getTeacherPolls,
  patchTeacherChapterStatus,
  recalculatePollMastery,
  saveStudentVoteDraft,
  saveFeedbackTemplate,
  saveTeacherEvaluationDraft,
  submitStudentVote,
  submitTeacherStudentEvaluations,
  updateAdminChapterAnalysis,
  updateAdminChapterPollStatus,
} from '../controllers/chapterFeedback.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.patch('/teacher/chapters/:chapterId/status', requireRole('TEACHER', 'ADMIN', 'SCHOOL_OWNER'), patchTeacherChapterStatus);
router.get('/teacher/polls', requireRole('TEACHER'), getTeacherPolls);
router.put('/teacher/polls/:pollId/student-evaluations/draft', requireRole('TEACHER'), saveTeacherEvaluationDraft);
router.post('/teacher/polls/:pollId/student-evaluations', requireRole('TEACHER'), submitTeacherStudentEvaluations);
router.post('/teacher/polls/:pollId/assessments', requireRole('TEACHER'), createPollAssessment);
router.post('/teacher/polls/:pollId/recalculate-mastery', requireRole('TEACHER'), recalculatePollMastery);
router.get('/teacher/polls/:pollId/mastery-matrix', requireRole('TEACHER'), getPollMasteryMatrix);

router.get('/student/notifications', requireRole('STUDENT'), getStudentNotifications);
router.get('/student/polls', requireRole('STUDENT'), getStudentPolls);
router.get('/student/mastery', requireRole('STUDENT'), getMyStudentMastery);
router.put('/student/polls/:pollId/draft', requireRole('STUDENT'), saveStudentVoteDraft);
router.post('/student/polls/:pollId/vote', requireRole('STUDENT'), submitStudentVote);

router.get('/admin/chapter-completions', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), getAdminChapterCompletions);
router.get('/admin/chapter-polls', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), getAdminChapterPolls);
router.post('/admin/chapter-polls', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), createAdminChapterPoll);
router.post('/admin/chapter-polls/:pollId/duplicate', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), duplicateAdminChapterPoll);
router.patch('/admin/chapter-polls/:pollId/status', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), updateAdminChapterPollStatus);
router.get('/admin/chapter-polls/:pollId/raw-status', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), getAdminRawStatus);
router.post('/admin/chapter-polls/:pollId/compile', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), compileAdminChapterPoll);
router.post('/admin/chapter-polls/:pollId/assessments', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), createPollAssessment);
router.post('/admin/chapter-polls/:pollId/recalculate-mastery', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), recalculatePollMastery);
router.get('/admin/chapter-polls/:pollId/mastery-matrix', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), getPollMasteryMatrix);
router.get('/admin/chapter-analysis/:pollId', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), getAdminChapterAnalysis);
router.patch('/admin/chapter-analysis/:summaryId', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), updateAdminChapterAnalysis);
router.get('/admin/feedback-templates', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), getFeedbackTemplates);
router.post('/admin/feedback-templates', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), saveFeedbackTemplate);
router.get('/admin/feedback-audit', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), getFeedbackAuditLog);
router.post('/interventions', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER', 'TEACHER'), createIntervention);

router.get('/chapters/:chapterId/analysis', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER', 'TEACHER', 'STUDENT'), getChapterAnalysis);

export default router;
