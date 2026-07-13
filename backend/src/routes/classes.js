import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { createClass, deleteClass, listClasses } from '../controllers/class.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER'), listClasses);
router.post('/', requireRole('ADMIN', 'SCHOOL_OWNER'), createClass);
router.delete('/:id', requireRole('ADMIN', 'SCHOOL_OWNER'), deleteClass);

export default router;
