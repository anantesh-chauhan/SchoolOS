/**
 * School Configuration
 * Multi-school template configuration
 */

import gvsConfig from './gvs-greenvalleyschool.js';

export const schoolConfig = {
  gvsGreenValleySchool: gvsConfig,
  ddPublicSchool: {
    ...gvsConfig,
    schoolId: 'dd-public-school',
    name: 'DD Public School',
    schoolName: 'DD Public School',
    tagline: 'Empowering Future Leaders',
    description:
      'A premium K-12 campus with academic rigor, global perspective, future-skills learning, and values at its core.',
    logo: '/images/dd-logo.png',
    favicon: '/images/dd-favicon.ico',
    contact: {
      phone: '+91-XXXXXXXXXX',
      email: 'info@ddpublicschool.com',
      address: 'Lucknow, India',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      country: 'India',
      googleMapsEmbed: 'https://maps.google.com/maps?q=lucknow&t=&z=13&ie=UTF8&iwloc=&output=embed',
    },
    socialLinks: {
      facebook: 'https://facebook.com/ddpublicschool',
      instagram: 'https://instagram.com/ddpublicschool',
      youtube: 'https://youtube.com/ddpublicschool',
      twitter: 'https://twitter.com/ddpublicschool',
    },
    theme: {
      primaryColor: '#8B0000',
      secondaryColor: '#FFD700',
      accentColor: '#000000',
      fontFamily: 'Lora',
    },
    domain: 'ddpublicschool.com',
    domains: ['ddpublicschool.com', 'www.ddpublicschool.com'],
    subdomain: 'dd-public-school',
    schoolOs: {
      baseUrl: 'https://schoolos.example.com',
      studentLoginUrl: 'https://schoolos.example.com/student/login?schoolId=dd-public-school',
      parentLoginUrl: 'https://schoolos.example.com/parent/login?schoolId=dd-public-school',
      staffLoginUrl: 'https://schoolos.example.com/staff/login?schoolId=dd-public-school',
    },
    navigation: {
      links: [
        { label: 'Home', href: '/' },
        {
          label: 'About',
          href: '/about',
          children: [
            { label: 'Vision & Mission', href: '/about#vision' },
            { label: 'Leadership', href: '/about#leadership' },
            { label: 'Infrastructure', href: '/about#infrastructure' },
          ],
        },
        {
          label: 'Academics',
          href: '/academics',
          children: [
            { label: 'Curriculum', href: '/academics#curriculum' },
            { label: 'Programs', href: '/academics#programs' },
            { label: 'Activities', href: '/academics#activities' },
          ],
        },
        { label: 'Faculty', href: '/faculty' },
        { label: 'Admissions', href: '/admissions' },
        { label: 'Events', href: '/events' },
        { label: 'Gallery', href: '/gallery' },
        { label: 'News', href: '/notices' },
        { label: 'Careers', href: '/careers' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    homepage: {
      hero: {
        title: 'Educating With Purpose, Leading With Values',
        subtitle:
          'An environment where scholarship, creativity, and discipline shape confident global citizens.',
        backgroundImage:
          'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1920&q=80',
        primaryCta: { label: 'Start Admissions', href: '/admissions' },
        secondaryCta: { label: 'Explore Campus', href: '/about' },
      },
      // Copy full homepage from original, customized if needed
      heroSlides: [
        {
          title: 'Future-Ready Learning In Modern Classrooms',
          subtitle: 'Personalized learning, digital pedagogy, and strong mentoring for every child.',
          image: 'https://res.cloudinary.com/demo/image/fetch/f_auto,q_auto,w_2000/https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=2200&q=90',
        },
        // ... other slides
      ],
      achievements: [
        { label: 'Board Excellence', value: '98.2%' },
        { label: 'University Offers', value: '400+' },
        { label: 'Faculty Mentors', value: '120+' },
        { label: 'Co-curricular Clubs', value: '32' },
      ],
      // ... other sections
    },
    seo: {
      defaultTitle: 'DD Public School',
      defaultDescription: 'DD Public School is a premium K-12 institution focused on academic excellence and holistic student development.',
      defaultKeywords: ['school', 'education', 'admissions', 'faculty', 'events', 'gallery'],
    },
    features: {
      enableAdmissions: true,
      enableGallery: true,
      enableEvents: true,
      enableNotices: true,
      enableFaculty: true,
      showFaculty: true,
      showGallery: true,
      showEvents: true,
      showCareers: true,
      enableAdmissionLeads: true,
    },
  },
};

const SCHOOL_ALIASES = {
  dps: 'ddPublicSchool',
  dps002: 'ddPublicSchool',
  ddpublicschool: 'ddPublicSchool',
  gvs: 'gvsGreenValleySchool',
  gvs001: 'gvsGreenValleySchool',
  greenvalley: 'gvsGreenValleySchool',
  vs: 'gvsGreenValleySchool',
};

export const getSchoolConfig = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const fromLocalStorage = typeof window !== 'undefined' ? localStorage.getItem('schoolId') : null;
  const fromSlug = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[0] : null;

  const byDomain = Object.values(schoolConfig).find((school) => {
    const domains = [school.domain, ...(school.domains || [])].filter(Boolean).map((item) => item.toLowerCase());
    return domains.includes(host);
  });

  if (byDomain) {
    return byDomain;
  }

  if (host && !['localhost', '127.0.0.1'].includes(host) && host.includes('.')) {
    const subdomain = host.split('.')[0];
    const bySubdomain = Object.values(schoolConfig).find((school) => school.subdomain === subdomain || school.schoolId === subdomain);
    if (bySubdomain) {
      return bySubdomain;
    }
  }

if (fromLocalStorage) {
  // Map slug aliases to config keys
  let lookupId = fromLocalStorage;
  lookupId = SCHOOL_ALIASES[String(lookupId).toLowerCase()] || lookupId;
  
  const byStoredSchool = Object.values(schoolConfig).find((school) => school.schoolId === lookupId);
  if (byStoredSchool) {
    return byStoredSchool;
  }
}

if (fromSlug) {
  const lookupSlug = SCHOOL_ALIASES[String(fromSlug).toLowerCase()] || fromSlug;
  const bySlug = Object.values(schoolConfig).find((school) => {
    const candidates = [school.schoolId, school.subdomain, school.slug, school.schoolCode]
      .filter(Boolean)
      .map((item) => String(item).toLowerCase());
    return candidates.includes(String(lookupSlug).toLowerCase());
  });

  if (bySlug) {
    return bySlug;
  }
}

  const activeKey = import.meta.env.VITE_SCHOOL_KEY || 'ddPublicSchool';
  return schoolConfig[activeKey] || schoolConfig.ddPublicSchool;
};

export default schoolConfig;

