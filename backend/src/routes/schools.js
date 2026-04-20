import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { createSchool, deleteSchool, listSchools } from '../controllers/school.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('PLATFORM_OWNER'));

router.get('/', listSchools);
router.post('/', createSchool);
router.delete('/:id', deleteSchool);

export default router;
