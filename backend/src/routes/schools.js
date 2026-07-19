import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
	createSchool,
	deleteSchool,
	getSchoolProfile,
	getSchoolTenantDetails,
	getMySchool,
	getPublicSchoolBySlug,
	listSchools,
	updateSchoolProfile,
	updateMySchoolBasicDetails,
	initializeSchoolAcademicDefaults,
	updateSchoolByPlatform,
} from '../controllers/school.controller.js';

const router = express.Router();

router.get('/public/:slug', getPublicSchoolBySlug);

router.use(authMiddleware);

router.get('/my-school', requireRole('SCHOOL_OWNER'), getMySchool);
router.patch('/my-school/basic', requireRole('SCHOOL_OWNER'), updateMySchoolBasicDetails);
router.get('/profile', requireRole('SCHOOL_OWNER'), getSchoolProfile);
router.put('/profile', requireRole('SCHOOL_OWNER'), updateSchoolProfile);

router.get('/', requireRole('PLATFORM_OWNER'), listSchools);
router.post('/', requireRole('PLATFORM_OWNER'), createSchool);
router.get('/:id', requireRole('PLATFORM_OWNER'), getSchoolTenantDetails);
router.patch('/:id', requireRole('PLATFORM_OWNER'), updateSchoolByPlatform);
router.post('/:id/initialize-academics', requireRole('PLATFORM_OWNER'), initializeSchoolAcademicDefaults);
router.delete('/:id', requireRole('PLATFORM_OWNER'), deleteSchool);

export default router;
