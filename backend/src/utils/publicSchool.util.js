const DEFAULT_ACCENT = '#f59e0b';

const toSlug = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'school';
};

const hashToHex = (value, salt = '') => {
  const source = `${value || ''}:${salt}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  const hex = (hash & 0xffffff).toString(16).padStart(6, '0');
  return `#${hex}`;
};

export const deriveSchoolSlug = (school = {}) => {
  if (school.slug) {
    return toSlug(school.slug);
  }

  if (school.schoolCode) {
    return toSlug(school.schoolCode);
  }

  return toSlug(school.schoolName);
};

export const buildSchoolTheme = (school = {}) => ({
  primaryColor: school.theme?.primaryColor || hashToHex(school.schoolCode || school.schoolName || 'school'),
  secondaryColor: school.theme?.secondaryColor || hashToHex(school.schoolCode || school.schoolName || 'school', 'secondary'),
  accentColor: school.theme?.accentColor || DEFAULT_ACCENT,
  fontFamily: school.theme?.fontFamily || 'Manrope',
});

export const buildDefaultSchoolConfig = (school = {}) => {
  const slug = deriveSchoolSlug(school);
  const theme = buildSchoolTheme(school);
  const schoolName = school.schoolName || 'School';
  const city = school.city || 'Your City';
  const state = school.state || 'Your State';
  const description = `${schoolName} is a future-ready learning community serving students in ${city}, ${state}.`;

  return {
    theme,
    pages: [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' },
      { name: 'Admissions', path: '/admissions' },
      { name: 'Events', path: '/events' },
      { name: 'Gallery', path: '/gallery' },
      { name: 'Contact', path: '/contact' },
    ],
    homepage: {
      title: `Welcome to ${schoolName}`,
      subtitle: `A dynamic school experience for families in ${city}.`,
    },
    sections: [
      {
        type: 'hero',
        data: {
          title: `Welcome to ${schoolName}`,
          subtitle: description,
          primaryCta: { label: 'Admissions', path: '/admissions' },
          secondaryCta: { label: 'Explore School', path: '/about' },
        },
      },
      {
        type: 'about',
        data: {
          title: `About ${schoolName}`,
          description,
          highlights: [
            `Serving learners in ${city}`,
            `Campus community in ${state}`,
            'Built from public school defaults',
          ],
        },
      },
      {
        type: 'contact',
        data: {
          title: 'Contact',
          description: 'Get in touch with the admissions office for school visits and enquiries.',
        },
      },
    ],
    seo: {
      defaultTitle: schoolName,
      defaultDescription: description,
      defaultKeywords: ['school', 'education', 'admissions'],
    },
    navigation: {
      links: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Admissions', href: '/admissions' },
        { label: 'Events', href: '/events' },
        { label: 'Gallery', href: '/gallery' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    contact: {
      address: school.address || `${schoolName} Campus`,
      city,
      state,
      phone: school.phone || '',
      email: school.email || '',
      googleMapsEmbed: `https://maps.google.com/maps?q=${encodeURIComponent(`${city}, ${state}`)}&t=&z=13&ie=UTF8&iwloc=&output=embed`,
    },
    slug,
  };
};

export const normalizeSchoolPayload = (school = {}) => ({
  id: school.id,
  name: school.schoolName,
  slug: deriveSchoolSlug(school),
  theme: buildSchoolTheme(school),
  config: school.config || buildDefaultSchoolConfig(school),
});
