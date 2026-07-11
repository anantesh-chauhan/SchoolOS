import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  compileAdminChapterPoll,
  createIntervention,
  createAdminChapterPoll,
  createPollAssessment,
  getAdminChapterAnalysis,
  getAdminChapterCompletions,
  getAdminChapterPolls,
  getAdminRawStatus,
  getChapterAnalysis,
  getMyStudentMastery,
  getPollMasteryMatrix,
  getStudentNotifications,
  getStudentPolls,
  getTeacherPolls,
  patchTeacherChapterStatus,
  recalculatePollMastery,
  submitStudentVote,
  submitTeacherStudentEvaluations,
  updateAdminChapterAnalysis,
  updateAdminChapterPollStatus,
} from '../controllers/chapterFeedback.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.patch('/teacher/chapters/:chapterId/status', requireRole('TEACHER', 'ADMIN', 'SCHOOL_OWNER'), patchTeacherChapterStatus);
router.get('/teacher/polls', requireRole('TEACHER'), getTeacherPolls);
router.post('/teacher/polls/:pollId/student-evaluations', requireRole('TEACHER'), submitTeacherStudentEvaluations);
router.post('/teacher/polls/:pollId/assessments', requireRole('TEACHER'), createPollAssessment);
router.post('/teacher/polls/:pollId/recalculate-mastery', requireRole('TEACHER'), recalculatePollMastery);
router.get('/teacher/polls/:pollId/mastery-matrix', requireRole('TEACHER'), getPollMasteryMatrix);

router.get('/student/notifications', requireRole('STUDENT'), getStudentNotifications);
router.get('/student/polls', requireRole('STUDENT'), getStudentPolls);
router.get('/student/mastery', requireRole('STUDENT'), getMyStudentMastery);
router.post('/student/polls/:pollId/vote', requireRole('STUDENT'), submitStudentVote);

router.get('/admin/chapter-completions', requireRole('ADMIN', 'SCHOOL_OWNER'), getAdminChapterCompletions);
router.get('/admin/chapter-polls', requireRole('ADMIN', 'SCHOOL_OWNER'), getAdminChapterPolls);
router.post('/admin/chapter-polls', requireRole('ADMIN', 'SCHOOL_OWNER'), createAdminChapterPoll);
router.patch('/admin/chapter-polls/:pollId/status', requireRole('ADMIN', 'SCHOOL_OWNER'), updateAdminChapterPollStatus);
router.get('/admin/chapter-polls/:pollId/raw-status', requireRole('ADMIN', 'SCHOOL_OWNER'), getAdminRawStatus);
router.post('/admin/chapter-polls/:pollId/compile', requireRole('ADMIN', 'SCHOOL_OWNER'), compileAdminChapterPoll);
router.post('/admin/chapter-polls/:pollId/assessments', requireRole('ADMIN', 'SCHOOL_OWNER'), createPollAssessment);
router.post('/admin/chapter-polls/:pollId/recalculate-mastery', requireRole('ADMIN', 'SCHOOL_OWNER'), recalculatePollMastery);
router.get('/admin/chapter-polls/:pollId/mastery-matrix', requireRole('ADMIN', 'SCHOOL_OWNER'), getPollMasteryMatrix);
router.get('/admin/chapter-analysis/:pollId', requireRole('ADMIN', 'SCHOOL_OWNER'), getAdminChapterAnalysis);
router.patch('/admin/chapter-analysis/:summaryId', requireRole('ADMIN', 'SCHOOL_OWNER'), updateAdminChapterAnalysis);
router.post('/interventions', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), createIntervention);

router.get('/chapters/:chapterId/analysis', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT'), getChapterAnalysis);

export default router;
