import express from 'express';
import { login, loginStudent, loginParent, getMe, logout, logoutAllDevices, refreshSession, getDemoAccounts, instantLogin, switchRole } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/login-student', loginStudent);
router.post('/login-parent', loginParent);
router.post('/refresh', refreshSession);
router.get('/demo-accounts', getDemoAccounts);
router.post('/instant-login', instantLogin);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.post('/switch-role', authMiddleware, switchRole);
router.post('/logout', authMiddleware, logout);
router.post('/logout-all', authMiddleware, logoutAllDevices);

export default router;
