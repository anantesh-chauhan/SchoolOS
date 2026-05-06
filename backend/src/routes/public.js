import express from 'express';
import {
	getPublicPageBySlug,
	getPublicSchoolBySlug,
	listPublicEvents,
	listPublicNotices,
	listPublicTestimonials,
} from '../controllers/public.controller.js';

const router = express.Router();

router.get('/schools/:slug', getPublicSchoolBySlug);
router.get('/pages/:slug', getPublicPageBySlug);
router.get('/events', listPublicEvents);
router.get('/notices', listPublicNotices);
router.get('/testimonials', listPublicTestimonials);

export default router;
