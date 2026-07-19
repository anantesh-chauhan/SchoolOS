import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import * as controller from './homework.controller.js';

const router = Router();
router.use(authMiddleware);
const staff = requireRole('TEACHER','CURRICULUM_MANAGER','ADMIN','SCHOOL_OWNER');

router.get('/homework/analytics', staff, controller.analytics);
router.get('/homework/context', staff, controller.creationContext);
router.post('/homework', staff, controller.createHomework);
router.get('/homework', controller.listHomework);
router.get('/homework/:id', controller.getHomework);
router.patch('/homework/:id', staff, controller.updateHomework);
router.post('/homework/:id/publish', staff, controller.publishHomework);
router.post('/homework/:id/close', staff, controller.closeHomework);
router.post('/homework/:id/archive', staff, controller.archiveHomework);
router.post('/homework/:id/cancel', staff, controller.cancelHomework);
router.delete('/homework/:id', staff, controller.deleteHomework);
router.post('/homework/:id/submissions/draft', requireRole('STUDENT'), controller.saveSubmissionDraft);
router.post('/homework/:id/submissions', requireRole('STUDENT'), controller.submitHomework);
router.get('/homework/:id/submissions', staff, controller.listSubmissions);
router.patch('/homework/:id/submissions/:submissionId/review', staff, controller.reviewSubmission);
router.post('/homework/:id/submissions/:submissionId/request-resubmission', staff, controller.requestResubmission);
router.get('/resources', controller.listResources);
router.post('/resources', staff, controller.createResource);
router.get('/resources/:id', controller.getResource);
router.patch('/resources/:id', staff, controller.updateResource);
router.post('/resources/:id/publish', staff, controller.publishResource);
router.post('/resources/:id/archive', staff, controller.archiveResource);
router.delete('/resources/:id', staff, controller.deleteResource);
router.post('/homework/jobs/publish-scheduled', requireRole('ADMIN','SCHOOL_OWNER'), controller.runScheduledPublishing);
router.post('/homework/jobs/reminders', requireRole('ADMIN','SCHOOL_OWNER'), controller.runReminders);

// Explicit role-prefixed aliases preserve the API shape described by the UI.
router.get('/student/homework', requireRole('STUDENT'), controller.listHomework);
router.get('/student/homework/:id', requireRole('STUDENT'), controller.getHomework);
router.get('/parent/children/:studentId/homework', requireRole('PARENT'), (req,res,next) => { req.query.studentId = req.params.studentId; return controller.listHomework(req,res,next); });
router.get('/parent/children/:studentId/resources', requireRole('PARENT'), (req,res,next) => { req.query.studentId = req.params.studentId; return controller.listResources(req,res,next); });
router.get('/parent/homework-children', requireRole('PARENT'), controller.linkedChildren);

export default router;
