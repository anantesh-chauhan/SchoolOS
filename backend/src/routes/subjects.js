import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  assignSubjectToClass,
  assignSubjectToSection,
  bulkAssignSubjectsToClass,
  createSubject,
  deleteSubject,
  listClassSubjects,
  listSubjectMappings,
  listSectionSubjects,
  listSubjects,
  removeSubjectFromClass,
  removeSubjectFromSection,
  updateSubject,
} from '../controllers/subject.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', requirePermission(PERMISSIONS.SUBJECTS_VIEW), listSubjects);
router.post('/', requirePermission(PERMISSIONS.SUBJECTS_CREATE), createSubject);
router.put('/:id', requirePermission(PERMISSIONS.SUBJECTS_UPDATE), updateSubject);
router.delete('/:id', requirePermission(PERMISSIONS.SUBJECTS_DELETE), deleteSubject);

router.post('/assign-class', requirePermission(PERMISSIONS.CLASS_CURRICULUM_ASSIGN), assignSubjectToClass);
router.post('/assign-section', requirePermission(PERMISSIONS.SECTION_CURRICULUM_OVERRIDE), assignSubjectToSection);
router.post('/assign-class/bulk', requirePermission(PERMISSIONS.CLASS_CURRICULUM_ASSIGN), bulkAssignSubjectsToClass);
router.post('/unassign-class', requirePermission(PERMISSIONS.CLASS_CURRICULUM_ASSIGN), removeSubjectFromClass);
router.post('/unassign-section', requirePermission(PERMISSIONS.SECTION_CURRICULUM_OVERRIDE), removeSubjectFromSection);
router.get('/class/:classId', requirePermission(PERMISSIONS.SUBJECTS_VIEW), listClassSubjects);
router.get('/section/:sectionId', requirePermission(PERMISSIONS.SUBJECTS_VIEW), listSectionSubjects);
router.get('/mappings', requirePermission(PERMISSIONS.SUBJECTS_VIEW), listSubjectMappings);

export default router;
