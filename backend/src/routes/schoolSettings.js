import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  getCurrentSchoolBranding,
  getPublicSchoolBranding,
  getSchoolSettingsBySchoolId,
  listSchoolSettings,
  updateSchoolSettingsBySchoolId,
} from '../controllers/schoolSettings.controller.js';

const router = express.Router();

router.get('/public/branding', getPublicSchoolBranding);

router.use(authMiddleware);

router.get('/branding/current', getCurrentSchoolBranding);

router.get('/', requireRole('PLATFORM_OWNER'), listSchoolSettings);
router.get('/:schoolId', requireRole('PLATFORM_OWNER'), getSchoolSettingsBySchoolId);
router.patch('/:schoolId', requireRole('PLATFORM_OWNER'), updateSchoolSettingsBySchoolId);

export default router;
