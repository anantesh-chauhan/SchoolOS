import express from 'express';
import {
	getPublicPageBySlug,
	getPublicBootstrap,
	getPublicSchoolBySlug,
	listPublicEvents,
	listPublicNotices,
	listPublicTestimonials,
} from '../controllers/public.controller.js';
import { publicCache } from '../middleware/http-cache.middleware.js';

const router = express.Router();
router.use(publicCache({ maxAge: 60, staleWhileRevalidate: 300 }));

router.get('/:schoolSlug/bootstrap', getPublicBootstrap);
router.get('/schools/:slug', getPublicSchoolBySlug);
router.get('/pages/:slug', getPublicPageBySlug);
router.get('/events', listPublicEvents);
router.get('/notices', listPublicNotices);
router.get('/testimonials', listPublicTestimonials);

export default router;
