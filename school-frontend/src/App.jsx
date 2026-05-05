import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useThemeStore from './context/themeStore.js';
import useAuthStore from './context/authStore.js';
import RequireAuth from './components/RequireAuth.jsx';
import apiClient from './utils/apiClient.js';
import './styles/index.css';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const AdmissionsPage = lazy(() => import('./pages/AdmissionsPage.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const AcademicsPage = lazy(() => import('./pages/AcademicsPage.jsx'));
const EventsPage = lazy(() => import('./pages/EventsPage.jsx'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage.jsx'));
const GalleryPage = lazy(() => import('./pages/GalleryPage.jsx'));
const GalleryDetailPage = lazy(() => import('./pages/GalleryDetailPage.jsx'));
const FacultyPage = lazy(() => import('./pages/FacultyPage.jsx'));
const FacultyDetailPage = lazy(() => import('./pages/FacultyDetailPage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));
const NoticesPage = lazy(() => import('./pages/NoticesPage.jsx'));
const CareersPage = lazy(() => import('./pages/CareersPage.jsx'));
const CmsContentPage = lazy(() => import('./pages/CmsContentPage.jsx'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage.jsx'));
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'));
const AdminDashboardPage = lazy(() => import('./admin/AdminDashboardPage.jsx'));
const AdminResourcePage = lazy(() => import('./admin/AdminResourcePage.jsx'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage.jsx'));
const AdminMediaUploadPage = lazy(() => import('./pages/AdminMediaUploadPage.jsx'));

/**
 * Main App Component
 * Routes and application layout
 */

function App() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const setSchoolConfig = useThemeStore((state) => state.setSchoolConfig);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  const idleTimeoutMs = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MS || 30 * 60 * 1000);

  // Apply theme colors as CSS variables
  React.useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', theme.primaryColor);
    document.documentElement.style.setProperty('--color-secondary', theme.secondaryColor);
    document.documentElement.style.setProperty('--color-accent', theme.accentColor);
    document.documentElement.style.setProperty('--font-family', theme.fontFamily);
  }, [theme]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const externalToken = params.get('schoolosToken') || params.get('token') || params.get('accessToken');
    const externalSchoolId = params.get('schoolId') || params.get('tenant');

    if (externalToken) {
      localStorage.setItem('accessToken', externalToken);
      localStorage.setItem('schoolosAccessToken', externalToken);
    }

    if (externalSchoolId) {
      localStorage.setItem('schoolId', externalSchoolId);
    }
  }, []);

  React.useEffect(() => {
    apiClient
      .get('/platform/context')
      .then((response) => {
        const payload = response.data?.data || {};
        const school = payload.school;
        if (!school) {
          return;
        }

        if (school.schoolId) {
          localStorage.setItem('schoolId', school.schoolId);
        }

        if (school.theme) {
          setTheme(school.theme);
        }

        setSchoolConfig((prev) => ({
          ...(prev || {}),
          schoolId: school.schoolId,
          name: school.schoolName,
          tagline: school.branding?.tagline,
          description: payload.settings?.general?.description,
          contact: school.contact,
          socialLinks: school.socialLinks,
          features: school.features,
          schoolOs: school.schoolOs,
          theme: school.theme,
        }));
      })
      .catch(() => null);
  }, [setTheme, setSchoolConfig]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let idleTimer = null;
    const resetIdleTimer = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }

      idleTimer = window.setTimeout(() => {
        logout();
        window.location.href = '/admin/login?session=expired';
      }, idleTimeoutMs);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [isAuthenticated, idleTimeoutMs, logout]);

  return (
    <Router>
      <Suspense fallback={<div className="section-shell py-10">Loading...</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/academics" element={<AcademicsPage />} />
          <Route path="/admissions" element={<AdmissionsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:slug" element={<EventDetailPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:slug" element={<GalleryDetailPage />} />
          <Route path="/faculty" element={<FacultyPage />} />
          <Route path="/faculty/:slug" element={<FacultyDetailPage />} />
          <Route path="/notices" element={<NoticesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/privacy" element={<CmsContentPage slug="privacy" fallbackTitle="Privacy Policy" />} />
          <Route path="/terms" element={<CmsContentPage slug="terms" fallbackTitle="Terms and Conditions" />} />
          <Route path="/disclaimer" element={<CmsContentPage slug="disclaimer" fallbackTitle="Disclaimer" />} />
          <Route path="/cookie-policy" element={<CmsContentPage slug="cookie-policy" fallbackTitle="Cookie Policy" />} />

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={(
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            )}
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="pages" element={<AdminResourcePage moduleKey="pages" />} />
            <Route path="menus" element={<AdminResourcePage moduleKey="menus" />} />
            <Route path="events" element={<AdminResourcePage moduleKey="events" />} />
            <Route path="notices" element={<AdminResourcePage moduleKey="notices" />} />
            <Route path="gallery" element={<AdminResourcePage moduleKey="gallery" />} />
            <Route path="faculty" element={<AdminResourcePage moduleKey="faculty" />} />
            <Route path="admissions" element={<AdminResourcePage moduleKey="admissions" />} />
            <Route path="careers" element={<AdminResourcePage moduleKey="careers" />} />
            <Route path="media" element={<><AdminMediaUploadPage /><AdminResourcePage moduleKey="media" /></>} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <Toaster position="top-right" />
    </Router>
  );
}

export default App;
