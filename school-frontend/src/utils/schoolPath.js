import useSchoolStore from '../store/schoolStore.js';

const isExternalPath = (value) => /^(https?:)?\/\//i.test(value) || value.startsWith('mailto:') || value.startsWith('tel:');

export const schoolPath = (path = '/', schoolSlug = null) => {
  if (!path) {
    return '/';
  }

  if (path.startsWith('#') || isExternalPath(path)) {
    return path;
  }

  const activeSlug = schoolSlug || useSchoolStore.getState().schoolSlug;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!activeSlug) {
    return normalizedPath;
  }

  const slugPrefix = `/${activeSlug}`;
  if (normalizedPath === slugPrefix || normalizedPath.startsWith(`${slugPrefix}/`)) {
    return normalizedPath;
  }

  return `${slugPrefix}${normalizedPath}`;
};
