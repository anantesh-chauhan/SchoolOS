import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
	createSchool,
	deleteSchool,
	getSchoolProfile,
	getMySchool,
	getPublicSchoolBySlug,
	listSchools,
	updateSchoolProfile,
	updateMySchoolBasicDetails,
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
router.delete('/:id', requireRole('PLATFORM_OWNER'), deleteSchool);

export default router;
