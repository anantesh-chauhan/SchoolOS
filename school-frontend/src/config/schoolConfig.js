/**
 * School Configuration
 * Multi-school template configuration
 */

export const schoolConfig = {
  ddPublicSchool: {
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
      heroSlides: [
        {
          title: 'Future-Ready Learning In Modern Classrooms',
          subtitle: 'Personalized learning, digital pedagogy, and strong mentoring for every child.',
          image: 'https://res.cloudinary.com/demo/image/fetch/f_auto,q_auto,w_2000/https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=2200&q=90',
        },
        {
          title: 'Sporting Excellence With Character Building',
          subtitle: 'Structured athletics programs that develop discipline, teamwork, and resilience.',
          image: 'https://res.cloudinary.com/demo/image/fetch/f_auto,q_auto,w_2000/https://images.unsplash.com/photo-1461897104016-0b3b00cc81ee?auto=format&fit=crop&w=2200&q=90',
        },
        {
          title: 'A Vibrant, Safe, And Inspiring Campus',
          subtitle: 'World-class infrastructure designed for holistic growth and creativity.',
          image: 'https://res.cloudinary.com/demo/image/fetch/f_auto,q_auto,w_2000/https://images.unsplash.com/photo-1596496181848-3091d4878b24?auto=format&fit=crop&w=2200&q=90',
        },
        {
          title: 'Culture, Arts, And Student Expression',
          subtitle: 'Performance, music, and arts programs that build confidence and leadership.',
          image: 'https://res.cloudinary.com/demo/image/fetch/f_auto,q_auto,w_2000/https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=2200&q=90',
        },
      ],
      achievements: [
        { label: 'Board Excellence', value: '98.2%' },
        { label: 'University Offers', value: '400+' },
        { label: 'Faculty Mentors', value: '120+' },
        { label: 'Co-curricular Clubs', value: '32' },
      ],
      facilities: [
        { title: 'Innovation Labs', description: 'Robotics, AI, and maker spaces for practical learning and project prototyping.' },
        { title: 'Performing Arts', description: 'Music, dance, and theatre studios with performance-focused mentorship.' },
        { title: 'Athletic Excellence', description: 'Structured coaching across indoor and outdoor sports with fitness tracking.' },
      ],
      testimonials: [
        {
          quote: 'The culture here balances discipline with empathy. Our child has grown in confidence and curiosity.',
          name: 'Parent Community',
        },
        {
          quote: 'Teachers challenge us to think independently, not just score marks.',
          name: 'Senior Student Council',
        },
      ],
      gallery: [
        'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=2200&q=90',
        'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=2200&q=90',
        'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=2200&q=90',
        'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=2200&q=90',
      ],
    },

    seo: {
      defaultTitle: 'DD Public School',
      defaultDescription:
        'DD Public School is a premium K-12 institution focused on academic excellence and holistic student development.',
      defaultKeywords: ['school', 'education', 'admissions', 'faculty', 'events', 'gallery'],
      pages: {
        home: {
          title: 'DD Public School | Empowering Future Leaders',
          description:
            'Explore academics, campus life, achievements, and admissions at DD Public School.',
          keywords: ['dd public school', 'school campus', 'school achievements', 'top school'],
        },
      },
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

export const getSchoolConfig = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const fromLocalStorage = typeof window !== 'undefined' ? localStorage.getItem('schoolId') : null;

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
    const byStoredSchool = Object.values(schoolConfig).find((school) => school.schoolId === fromLocalStorage);
    if (byStoredSchool) {
      return byStoredSchool;
    }
  }

  const activeKey = import.meta.env.VITE_SCHOOL_KEY || 'ddPublicSchool';
  return schoolConfig[activeKey] || schoolConfig.ddPublicSchool;
};

export default schoolConfig;
