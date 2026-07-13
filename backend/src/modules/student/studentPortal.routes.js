import express from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import * as controller from './studentPortal.controller.js';
const router=express.Router(); router.use(authMiddleware,requireRole('STUDENT'));
router.get('/dashboard',controller.dashboard); router.get('/attendance/summary',controller.attendance); router.get('/attendance/monthly',controller.attendance); router.get('/attendance/calendar',controller.attendanceCalendar);
router.get('/attendance/months',controller.attendance); router.get('/attendance/month/:year/:month',controller.attendanceMonth); router.get('/attendance/date/:date',controller.attendanceDate);
router.get('/subjects',controller.subjects); router.get('/subjects/:subjectId',controller.subject); router.get('/subjects/:subjectId/chapters/:chapterId',controller.chapter);
router.get('/polls/pending',controller.pendingPolls); router.get('/polls/submitted',controller.submittedPolls); router.get('/polls/submitted/:pollId',controller.poll); router.patch('/polls/submitted/:submissionId',controller.editPoll); router.get('/polls/:pollId',controller.poll); router.post('/polls/:pollId/submit',controller.submitPoll);
export default router;
