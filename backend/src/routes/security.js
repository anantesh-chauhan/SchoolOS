import express from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  adminResetPassword, completeRecovery, configureSecurityQuestions, getSecuritySettings,
  listCredentialAccounts, startRecovery, unlockAccount, verifyRecovery,
} from '../controllers/security.controller.js';

const router = express.Router();
const resetLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const recoveryLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many recovery attempts. Try again later.' } });

router.get('/admin/users/credentials', authMiddleware, requireRole('ADMIN', 'SCHOOL_OWNER'), listCredentialAccounts);
router.post('/admin/users/:accountKey/reset-password', resetLimiter, authMiddleware, requireRole('ADMIN', 'SCHOOL_OWNER'), adminResetPassword);
router.post('/admin/users/:accountKey/unlock', resetLimiter, authMiddleware, requireRole('ADMIN', 'SCHOOL_OWNER'), unlockAccount);
router.get('/profile/security', authMiddleware, getSecuritySettings);
router.put('/profile/security-questions', authMiddleware, configureSecurityQuestions);
router.post('/profile/security-questions', authMiddleware, configureSecurityQuestions);
router.post('/auth/recovery/start', recoveryLimiter, startRecovery);
router.post('/auth/recovery/verify', recoveryLimiter, verifyRecovery);
router.post('/auth/recovery/reset-password', recoveryLimiter, completeRecovery);

export default router;
