import express from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import profileController from '../controllers/profile.controller.js';
import { createStaffUser, createTeacherUser } from '../controllers/user.controller.js';

const router = express.Router();

// GET my profile
router.get('/me', authMiddleware, profileController.getMyProfile);

router.post('/create-teacher', authMiddleware, requireRole('ADMIN', 'SCHOOL_OWNER', 'PLATFORM_OWNER'), createTeacherUser);
router.post('/create-staff', authMiddleware, requireRole('ADMIN', 'SCHOOL_OWNER', 'PLATFORM_OWNER'), createStaffUser);

// Update my profile - whitelist enforced in controller
router.put(
  '/me',
  authMiddleware,
  [
    body('alternateMobile').optional().isString(),
    body('profileImage').optional().isString(),
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
    body('address').optional().isString(),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  },
  profileController.updateMyProfile
);

// Change password
router.put(
  '/change-password',
  authMiddleware,
  [body('currentPassword').isString(), body('newPassword').isLength({ min: 6 })],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  },
  profileController.changePassword
);

// Admin routes
router.put('/:id', authMiddleware, requireRole('ADMIN'), profileController.adminUpdateUser);
router.get('/', authMiddleware, requireRole('ADMIN'), profileController.getUsers);

export default router;
