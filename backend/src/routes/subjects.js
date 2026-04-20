import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
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
router.use(requireRole('ADMIN', 'SCHOOL_OWNER'));

router.get('/', listSubjects);
router.post('/', createSubject);
router.put('/:id', updateSubject);
router.delete('/:id', deleteSubject);

router.post('/assign-class', assignSubjectToClass);
router.post('/assign-section', assignSubjectToSection);
router.post('/assign-class/bulk', bulkAssignSubjectsToClass);
router.post('/unassign-class', removeSubjectFromClass);
router.post('/unassign-section', removeSubjectFromSection);
router.get('/class/:classId', listClassSubjects);
router.get('/section/:sectionId', listSectionSubjects);
router.get('/mappings', listSubjectMappings);

export default router;
