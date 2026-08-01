import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  getAuditLog,
  getRoleTemplates,
  getSeparationPolicy,
  listStaffRoles,
  revokeStaffRole,
  saveSeparationPolicy,
  saveStaffRole,
} from '../controllers/roleManagement.controller.js';

const router = express.Router();
const managers = requireRole('SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN');

router.use(authMiddleware, managers);
router.get('/templates', getRoleTemplates);
router.get('/audit', getAuditLog);
router.get('/separation-of-duties', getSeparationPolicy);
router.put('/separation-of-duties', saveSeparationPolicy);
router.get('/staff/:userId/roles', listStaffRoles);
router.put('/staff/:userId/roles', saveStaffRole);
router.delete('/assignments/:assignmentId', revokeStaffRole);

export default router;
