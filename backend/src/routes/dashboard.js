import express from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller.js';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
const router = express.Router();
router.use(authMiddleware);
router.get('/summary', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'PARENT', 'STAFF'), getDashboardSummary);
export default router;
