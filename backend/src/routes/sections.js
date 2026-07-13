import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { createNextSection, deleteSection, listSections } from '../controllers/section.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), listSections);
router.post('/', requireRole('ADMIN', 'SCHOOL_OWNER'), createNextSection);
router.delete('/:id', requireRole('ADMIN', 'SCHOOL_OWNER'), deleteSection);

export default router;
