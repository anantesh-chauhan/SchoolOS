import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { createNextSection, deleteSection, listSections } from '../controllers/section.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('ADMIN', 'SCHOOL_OWNER'));

router.get('/', listSections);
router.post('/', createNextSection);
router.delete('/:id', deleteSection);

export default router;
