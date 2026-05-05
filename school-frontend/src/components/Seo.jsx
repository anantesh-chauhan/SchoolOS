import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { getSchoolConfig } from '../config/schoolConfig.js';

const school = getSchoolConfig();

export const Seo = ({ title, description, keywords = [] }) => {
  const location = useLocation();
  const origin = import.meta.env.VITE_SITE_URL || window.location.origin;
  const canonicalUrl = `${origin}${location.pathname}`;

  const defaultSeo = school.seo || {};
  const mergedTitle = title || defaultSeo.defaultTitle || school.name;
  const mergedDescription = description || defaultSeo.defaultDescription || school.description;
  const mergedKeywords = (keywords.length ? keywords : defaultSeo.defaultKeywords || []).join(', ');

  return (
    <Helmet>
      <title>{mergedTitle}</title>
      <meta name="description" content={mergedDescription} />
      <meta name="keywords" content={mergedKeywords} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={mergedTitle} />
      <meta property="og:description" content={mergedDescription} />
      <meta property="og:url" content={canonicalUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={mergedTitle} />
      <meta name="twitter:description" content={mergedDescription} />
    </Helmet>
  );
};

export default Seo;
