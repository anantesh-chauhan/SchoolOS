const gvsConfig = {
  schoolId: 'gvs-greenvalleyschool',
  name: 'Green Valley School',
  schoolName: 'Green Valley School',
  tagline: 'Nurturing Green Minds for a Bright Future',
  description: 'Where nature meets nurture. Green Valley School blends eco-conscious learning with academic excellence in a serene valley campus.',
  
  logo: '/images/gvs-logo.png',
  favicon: '/images/gvs-favicon.ico',

  contact: {
    phone: '+91-XXXXXXXXXX',
    email: 'info@greenvalleyschool.com',
    address: 'Green Valley, Dehradun, India',
    city: 'Dehradun',
    state: 'Uttarakhand',
    country: 'India',
    googleMapsEmbed: 'https://maps.google.com/maps?q=dehradun&t=&z=13&ie=UTF8&iwloc=&output=embed',
  },

  socialLinks: {
    facebook: 'https://facebook.com/greenvalleyschool',
    instagram: 'https://instagram.com/greenvalleyschool',
    youtube: 'https://youtube.com/greenvalleyschool',
    twitter: 'https://twitter.com/greenvalleyschool',
  },

  theme: {
    primaryColor: '#10B981',
    secondaryColor: '#F3F4F6',
    accentColor: '#065F46',
    fontFamily: 'Inter',
  },

  domain: 'greenvalleyschool.com',
  domains: ['greenvalleyschool.com', 'www.greenvalleyschool.com'],
  subdomain: 'gvs',

  schoolOs: {
    baseUrl: 'https://schoolos.example.com',
    studentLoginUrl: 'https://schoolos.example.com/student/login?schoolId=gvs-greenvalleyschool',
    parentLoginUrl: 'https://schoolos.example.com/parent/login?schoolId=gvs-greenvalleyschool',
    staffLoginUrl: 'https://schoolos.example.com/staff/login?schoolId=gvs-greenvalleyschool',
  },

  navigation: {
    links: [
      { label: 'Home', href: '/' },
      {
        label: 'About',
        href: '/about',
        children: [
          { label: 'Our Philosophy', href: '/about#philosophy' },
          { label: 'Eco Campus', href: '/about#campus' },
          { label: 'Leadership', href: '/about#leadership' },
        ],
      },
      {
        label: 'Green Academics',
        href: '/academics',
        children: [
          { label: 'Nature Curriculum', href: '/academics#nature' },
          { label: 'Sustainability', href: '/academics#sustainability' },
        ],
      },
      { label: 'Faculty', href: '/faculty' },
      { label: 'Admissions', href: '/admissions' },
      { label: 'Events', href: '/events' },
      { label: 'Gallery', href: '/gallery' },
      { label: 'Notices', href: '/notices' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },

  homepage: {
    hero: {
      title: 'Learning in Harmony with Nature',
      subtitle: 'Green Valley School - where academic excellence meets environmental stewardship.',
      backgroundImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80',
      primaryCta: { label: 'Apply Now', href: '/admissions' },
      secondaryCta: { label: 'Virtual Tour', href: '/about' },
    },
    // ... other homepage sections similar to ddPublicSchool but eco-themed
    achievements: [
      { label: 'Green Certifications', value: '5+' },
      { label: 'Forest Cover', value: '12 acres' },
      { label: 'Eco Clubs', value: '15' },
      { label: 'Student Capacity', value: '800' },
    ],
  },

  seo: {
    defaultTitle: 'Green Valley School',
    defaultDescription: 'Eco-conscious K-12 school in Dehradun focused on sustainability and holistic education.',
    defaultKeywords: ['green school', 'eco education', 'dehradun school', 'sustainable learning'],
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
};

export default gvsConfig;

