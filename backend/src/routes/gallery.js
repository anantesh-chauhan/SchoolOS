import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  createGalleryGroup,
  createGalleryPhotos,
  deleteGalleryGroup,
  deleteGalleryPhoto,
  listGalleryGroups,
  listGalleryPhotosByGroup,
  listPublicGalleryGroups,
  listPublicGalleryPhotos,
  reorderGalleryGroups,
  reorderGalleryPhotos,
  updateGalleryGroup,
  updateGalleryPhoto,
} from '../controllers/gallery.controller.js';

const router = express.Router();

router.get('/public/groups', listPublicGalleryGroups);
router.get('/public/groups/:groupId/photos', listPublicGalleryPhotos);

router.use(authMiddleware);
router.use(requireRole('ADMIN', 'SCHOOL_OWNER'));

router.get('/groups', listGalleryGroups);
router.post('/groups', createGalleryGroup);
router.put('/groups/:id', updateGalleryGroup);
router.delete('/groups/:id', deleteGalleryGroup);
router.patch('/groups/reorder', reorderGalleryGroups);

router.get('/groups/:groupId/photos', listGalleryPhotosByGroup);
router.post('/groups/:groupId/photos', createGalleryPhotos);
router.patch('/groups/:groupId/photos/reorder', reorderGalleryPhotos);

router.put('/photos/:id', updateGalleryPhoto);
router.delete('/photos/:id', deleteGalleryPhoto);

export default router;
