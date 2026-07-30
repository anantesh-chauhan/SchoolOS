import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { getGalleryUploadSignature, getSchoolLogoUploadSignature, getSectionResourceUploadSignature, getIssueScreenshotUploadSignature, getHomeworkUploadSignature, getAcademicContentUploadSignature } from '../controllers/upload.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/gallery-signature', requireRole('ADMIN', 'SCHOOL_OWNER'), getGalleryUploadSignature);
router.post('/school-logo-signature', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER'), getSchoolLogoUploadSignature);
router.post('/section-resource-signature', requireRole('TEACHER', 'CURRICULUM_MANAGER', 'ADMIN', 'SCHOOL_OWNER'), getSectionResourceUploadSignature);
router.post('/homework-signature', requireRole('STUDENT', 'TEACHER', 'CURRICULUM_MANAGER', 'ADMIN', 'SCHOOL_OWNER'), getHomeworkUploadSignature);
router.post('/academic-content-signature', requireRole('TEACHER', 'CURRICULUM_MANAGER', 'ADMIN', 'SCHOOL_OWNER'), getAcademicContentUploadSignature);
router.post('/issue-screenshot-signature', getIssueScreenshotUploadSignature);

export default router;
