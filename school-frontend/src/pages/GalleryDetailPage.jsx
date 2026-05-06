import React from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import { galleryService } from '../services/galleryService.js';
import { useAuthStore } from '../context/authStore.js';

export const GalleryDetailPage = () => {
  const { groupId } = useParams();
  const authStore = useAuthStore();
  const schoolId = localStorage.getItem('schoolId') || authStore.user?.schoolId;
  const [photos, setPhotos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [index, setIndex] = React.useState(0);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const loadPhotos = async () => {
      if (!groupId || !schoolId) {
        setError('Gallery event not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await galleryService.listPublicPhotos(groupId, schoolId);
        setPhotos(response.data || []);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load gallery photos');
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    };

    loadPhotos();
  }, [groupId, schoolId]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="section-shell py-20">
          <div className="glass-panel p-12 text-center mx-auto max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
            <p>Loading photos...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || photos.length === 0) {
    return (
      <div>
        <Navbar />
        <PageHero title="Gallery Event" subtitle="Photos not available." />
        <section className="pb-14">
          <div className="section-shell">
            <div className="glass-panel p-12 text-center">
              <p>{error || 'No photos in this event.'}</p>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const current = photos[index];

  return (
    <div>
      <Seo 
        title={`Photos - Gallery Event`}
        description="School gallery photos and moments."
        keywords={['gallery', 'photos', 'school events']}
      />
      <Navbar />
      <PageHero 
        title={current.caption || 'Photo Gallery'} 
        subtitle="Click thumbnails to navigate through the collection"
      />

      <section className="pb-14">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <button 
              onClick={() => window.history.back()}
              className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
            >
              ← Back to gallery
            </button>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="glass-panel p-6 mb-6 text-sm text-[var(--color-muted)]">
            <p>High-resolution photos from school events. Use navigation or click thumbnails to browse.</p>
          </div>

          {/* Main Photo */}
          <div className="glass-panel p-6 mb-6">
            <img 
              src={current.imageUrl || current.imageUrlOptimized} 
              alt={current.caption || 'Event photo'}
              className="w-full h-[500px] md:h-[600px] object-contain rounded-xl shadow-2xl mx-auto max-w-4xl"
              loading="lazy"
            />
            {current.caption && (
              <p className="mt-4 text-center text-sm italic text-[var(--color-muted)] px-4">
                {current.caption}
              </p>
            )}
            <div className="mt-6 flex items-center justify-between">
              <button 
                className="px-6 py-3 border rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
                onClick={() => setIndex((prev) => (prev - 1 + photos.length) % photos.length)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <p className="text-lg font-semibold min-w-[100px] text-center">
                {index + 1} / {photos.length}
              </p>
              <button 
                className="px-6 py-3 border rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
                onClick={() => setIndex((prev) => (prev + 1) % photos.length)}
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Thumbnails */}
          <div className="glass-panel p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
              {photos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => setIndex(i)}
                  className={`h-20 w-full rounded-lg overflow-hidden cursor-pointer transition-all group relative ${
                    i === index 
                      ? 'ring-4 ring-[var(--color-primary)] ring-offset-2 ring-offset-white shadow-2xl' 
                      : 'hover:ring-2 hover:ring-slate-200'
                  }`}
                >
                  <img 
                    src={photo.imageUrl || photo.imageUrlOptimized} 
                    alt={`Thumbnail ${i + 1}`}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-200"
                    loading="lazy"
                  />
                  {i === index && (
                    <div className="absolute inset-0 bg-[var(--color-primary)]/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* <Footer /> */}
    </div>
  );
};

export default GalleryDetailPage;
