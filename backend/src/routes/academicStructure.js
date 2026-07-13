import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  createChapter,
  deleteChapter,
  getClassSectionDashboard,
  getChapterDashboard,
  getSubjectDashboard,
  updateChapter,
} from '../controllers/academicDashboard.controller.js';
import {
  assignTeacherComponentLoads,
  bootstrapAcademicStructure,
  enrollStudentInActivity,
  getDefaultAcademicTemplate,
  listAcademicStructure,
  listActivities,
  pushDefaultTemplateToSchool,
  upsertActivity,
  upsertPeriodStructure,
  validateAcademicRules,
} from '../controllers/academicStructure.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER'), listAcademicStructure);
router.get('/class-dashboard', requireRole('SCHOOL_OWNER', 'ADMIN'), getClassSectionDashboard);
router.get('/subject-dashboard', requireRole('SCHOOL_OWNER', 'ADMIN'), getSubjectDashboard);
router.get('/chapter-dashboard', requireRole('SCHOOL_OWNER', 'ADMIN'), getChapterDashboard);
router.get('/default-template', requireRole('PLATFORM_OWNER'), getDefaultAcademicTemplate);
router.post('/push-template', requireRole('PLATFORM_OWNER'), pushDefaultTemplateToSchool);
router.post('/bootstrap', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN'), bootstrapAcademicStructure);
router.post('/periods', requireRole('SCHOOL_OWNER', 'ADMIN'), upsertPeriodStructure);
router.get('/activities', requireRole('SCHOOL_OWNER', 'ADMIN', 'TEACHER'), listActivities);
router.post('/activities', requireRole('SCHOOL_OWNER', 'ADMIN'), upsertActivity);
router.post('/activities/enroll', requireRole('SCHOOL_OWNER', 'ADMIN'), enrollStudentInActivity);
router.post('/teacher-components/assign', requireRole('SCHOOL_OWNER', 'ADMIN'), assignTeacherComponentLoads);
router.get('/validate', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN'), validateAcademicRules);
router.post('/chapters', requireRole('SCHOOL_OWNER', 'ADMIN'), createChapter);
router.put('/chapters/:id', requireRole('SCHOOL_OWNER', 'ADMIN'), updateChapter);
router.delete('/chapters/:id', requireRole('SCHOOL_OWNER', 'ADMIN'), deleteChapter);

export default router;
