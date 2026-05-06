import { PrismaClient } from '@prisma/client';
import { normalizeSchoolPayload } from '../utils/publicSchool.util.js';

const prisma = new PrismaClient();

const SCHOOL_ALIASES = {
  dps: 'DPS002',
  dps002: 'DPS002',
  ddpublicschool: 'DPS002',
  gvs: 'GVS001',
  gvs001: 'GVS001',
  greenvalley: 'GVS001',
  vs: 'GVS001',
};

const getAvailableSchoolColumns = async () => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'School' AND table_schema = 'public'"
  );
  return rows.map((row) => String(row.column_name));
};

const pickColumns = (availableColumns) => {
  const desiredColumns = ['id', 'schoolName', 'schoolCode', 'address', 'logoUrl', 'city', 'state', 'phone', 'email', 'slug', 'theme', 'config'];
  const availableSet = new Set(availableColumns.map((column) => String(column).toLowerCase()));
  return desiredColumns.filter((column) => availableSet.has(String(column).toLowerCase()));
};

const loadPublicSchoolRow = async (identifier) => {
  const slug = String(identifier || '').trim().toLowerCase();
  const lookupCode = SCHOOL_ALIASES[slug] || slug.toUpperCase();

  const availableColumns = await getAvailableSchoolColumns();
  const selectedColumns = pickColumns(availableColumns);
  const selectSql = selectedColumns.map((column) => `"${column}"`).join(', ');

  const schoolRows = await prisma.$queryRawUnsafe(
    `SELECT ${selectSql} FROM "School" WHERE lower("schoolCode") = $1 OR lower("schoolName") = $1 LIMIT 1`,
    String(lookupCode).toLowerCase()
  );

  return Array.isArray(schoolRows) ? schoolRows[0] : null;
};

const titleCase = (value) => String(value || '')
  .split(/[-_\s]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const buildPublicPagePayload = (school, pageSlug) => {
  const slug = String(pageSlug || '').trim().toLowerCase();
  const schoolName = school?.schoolName || 'School';
  const config = school?.config || {};
  const pageDefinition = Array.isArray(config.pages)
    ? config.pages.find((page) => String(page.path || '').replace(/^\//, '').toLowerCase() === slug)
    : null;

  const defaultBody = {
    home: `${schoolName} welcomes students, families, and visitors to a school experience built around learning and care.`,
    about: `${schoolName} serves its community with a balanced academic program, student support, and campus life.`,
    admissions: 'Admissions are handled by the school office. Please use the enquiry form to get started.',
    contact: 'Use the school contact details to reach the admissions office and main desk.',
    privacy: 'This school website uses your information only to respond to enquiries and manage admissions-related communication.',
    terms: 'By using this site, you agree to the school website usage terms and related policies.',
    disclaimer: 'All content is provided for general information and may change without notice.',
    'cookie-policy': 'Cookies may be used to improve performance, analytics, and user experience.',
  };

  const title = pageDefinition?.name || titleCase(slug || 'page');
  const content = pageDefinition?.content
    || pageDefinition?.description
    || defaultBody[slug]
    || `${schoolName} public page content for ${title}.`;

  return {
    id: `${school.id || schoolName}-${slug}`,
    slug,
    title,
    content,
    metaTitle: pageDefinition?.metaTitle || `${title} | ${schoolName}`,
    metaDescription: pageDefinition?.metaDescription || content,
    metaKeywords: pageDefinition?.metaKeywords || [schoolName, title, 'school'],
    headerData: {
      title,
      subtitle: pageDefinition?.subtitle || pageDefinition?.description || content,
    },
  };
};

const buildPublicCollection = (school, kind) => {
  const config = school?.config || {};
  const sections = Array.isArray(config.sections) ? config.sections : [];

  if (kind === 'events') {
    return sections
      .filter((section) => section.type === 'event')
      .map((section, index) => ({
        _id: `${school.id || 'school'}-event-${index + 1}`,
        title: section.data?.title || `Event ${index + 1}`,
        description: section.data?.description || 'School event update',
        startDate: section.data?.startDate || new Date().toISOString(),
        slug: section.data?.slug || `event-${index + 1}`,
        thumbnail: section.data?.thumbnail || null,
        images: section.data?.images || [],
      }));
  }

  if (kind === 'notices') {
    return sections
      .filter((section) => section.type === 'notice')
      .map((section, index) => ({
        _id: `${school.id || 'school'}-notice-${index + 1}`,
        title: section.data?.title || `Notice ${index + 1}`,
        description: section.data?.description || section.data?.content || 'School notice',
        content: section.data?.content || section.data?.description || 'School notice',
        publishDate: section.data?.publishDate || new Date().toISOString(),
      }));
  }

  if (kind === 'testimonials') {
    return Array.isArray(config.homepage?.testimonials)
      ? config.homepage.testimonials.map((item, index) => ({
          _id: `${school.id || 'school'}-testimonial-${index + 1}`,
          quote: item.quote || item.text || '',
          name: item.name || item.author || 'Parent',
          role: item.role || 'Community Member',
        }))
      : [];
  }

  return [];
};

export const getPublicSchoolBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'School slug is required',
      });
    }

    const school = await loadPublicSchoolRow(slug);

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    return res.json({
      success: true,
      data: normalizeSchoolPayload(school),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public school',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getPublicPageBySlug = async (req, res) => {
  try {
    const schoolSlug = String(req.headers['x-school-slug'] || req.query.schoolSlug || '').trim().toLowerCase();
    const pageSlug = String(req.params.slug || '').trim().toLowerCase();

    if (!schoolSlug) {
      return res.status(400).json({
        success: false,
        message: 'School slug is required',
      });
    }

    const school = await loadPublicSchoolRow(schoolSlug);
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    return res.json({
      success: true,
      data: buildPublicPagePayload(school, pageSlug),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public page',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listPublicEvents = async (req, res) => {
  try {
    const schoolSlug = String(req.headers['x-school-slug'] || req.query.schoolSlug || '').trim().toLowerCase();
    const school = await loadPublicSchoolRow(schoolSlug);

    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    return res.json({ success: true, data: buildPublicCollection(school, 'events') });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listPublicNotices = async (req, res) => {
  try {
    const schoolSlug = String(req.headers['x-school-slug'] || req.query.schoolSlug || '').trim().toLowerCase();
    const school = await loadPublicSchoolRow(schoolSlug);

    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    return res.json({ success: true, data: buildPublicCollection(school, 'notices') });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public notices',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listPublicTestimonials = async (req, res) => {
  try {
    const schoolSlug = String(req.headers['x-school-slug'] || req.query.schoolSlug || '').trim().toLowerCase();
    const school = await loadPublicSchoolRow(schoolSlug);

    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    return res.json({ success: true, data: buildPublicCollection(school, 'testimonials') });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public testimonials',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
