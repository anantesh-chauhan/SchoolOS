import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import apiClient from '../services/api.js';
import useSchoolStore from '../store/schoolStore.js';

const SchoolLayout = () => {
  const { schoolSlug } = useParams();
  const setSchool = useSchoolStore((state) => state.setSchool);
  const setSchoolSlug = useSchoolStore((state) => state.setSchoolSlug);
  const setTheme = useSchoolStore((state) => state.setTheme);
  const setConfig = useSchoolStore((state) => state.setConfig);
  const setStatus = useSchoolStore((state) => state.setStatus);
  const setError = useSchoolStore((state) => state.setError);
  const status = useSchoolStore((state) => state.status);
  const error = useSchoolStore((state) => state.error);

  React.useEffect(() => {
    if (!schoolSlug) {
      return;
    }

    let active = true;
    const normalizedSlug = schoolSlug.trim().toLowerCase();

    setSchoolSlug(normalizedSlug);
    localStorage.setItem('schoolSlug', normalizedSlug);
    setStatus('loading');

    const loadSchool = async () => {
      try {
        const response = await apiClient.get(`/public/schools/${normalizedSlug}`);
        const school = response.data?.data;

        if (!active || !school) {
          return;
        }

        setSchool({
          schoolId: school.id,
          schoolSlug: normalizedSlug,
          name: school.name,
          slug: school.slug,
          theme: school.theme,
          config: school.config,
          status: 'ready',
        });
        setTheme(school.theme);
        setConfig(school.config);
        setError(null);
        setStatus('ready');
      } catch (requestError) {
        if (!active) {
          return;
        }

        if (requestError.response?.status === 404) {
          setError('School not found');
          setStatus('not-found');
          return;
        }

        setError(requestError.message || 'Failed to load school');
        setStatus('error');
      }
    };

    loadSchool();

    return () => {
      active = false;
    };
  }, [schoolSlug, setConfig, setError, setSchool, setSchoolSlug, setStatus, setTheme]);

  if (status === 'loading') {
    return <div className="section-shell py-16 text-center text-[var(--color-muted)]">Loading school profile...</div>;
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="glass-panel max-w-xl w-full p-8 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-muted)]">404</p>
          <h1 className="text-4xl mt-2">School Not Found</h1>
          <p className="mt-3 text-[var(--color-muted)]">We could not find a school for the requested URL slug.</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Slug: {schoolSlug}</p>
        </div>
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="glass-panel max-w-xl w-full p-8 text-center">
          <h1 className="text-3xl">Unable to load school</h1>
          <p className="mt-3 text-[var(--color-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default SchoolLayout;
