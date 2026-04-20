import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { createClass, deleteClass, listClasses } from '../controllers/class.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('ADMIN', 'SCHOOL_OWNER'));

router.get('/', listClasses);
router.post('/', createClass);
router.delete('/:id', deleteClass);

export default router;
