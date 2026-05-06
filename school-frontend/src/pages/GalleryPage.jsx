import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import { useGallery } from '../hooks/useGallery.js';
import { useAuthStore } from '../context/authStore.js';

export const GalleryPage = () => {
  const authStore = useAuthStore();
  const schoolId = localStorage.getItem('schoolId') || authStore.user?.schoolId;
  const {
    groups,
    photos,
    selectedGroup,
    loading,
    error,
    selectGroup
  } = useGallery(schoolId);

  if (error) {
    return (
      <div>
        <Navbar />
        <PageHero title="Gallery" subtitle="Gallery is temporarily unavailable." />
        <section className="pb-14">
          <div className="section-shell">
            <div className="glass-panel p-8 text-center text-[var(--color-muted)]">
              <p>{error}</p>
              <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-[var(--color-primary)] text-white rounded-full">
                Retry
              </button>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Seo title="Gallery" description="Campus galleries and school moments." keywords={['school gallery']} />
      <Navbar />
      <PageHero title="Gallery" subtitle="A visual journey through campus life." />

      <section className="pb-14">
        <div className="section-shell">
          {loading ? (
            <div className="glass-panel p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
              <p>Loading gallery...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="glass-panel p-12 text-center text-[var(--color-muted)]">
              <p>No gallery events published yet.</p>
              <p className="text-sm mt-2">Check back soon for school moments and celebrations.</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">Gallery Events</h2>
                <p className="text-[var(--color-muted)]">Click any event to explore photos</p>
              </div>

              {/* Groups Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    className="glass-panel overflow-hidden hover:shadow-lg transition-shadow group"
                    onClick={() => selectGroup(group)}
                  >
                    <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
                      {group.coverImageUrl ? (
                        <img 
                          src={group.coverImageUrl} 
                          alt={group.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-semibold mb-1 line-clamp-1">{group.title}</h3>
                      <p className="text-sm text-[var(--color-muted)] mb-3 line-clamp-2">{group.description}</p>
                      <p className="text-xs text-[var(--color-primary)] font-medium">
                        {group._count?.photos || 0} photos
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Group Photos */}
              {selectedGroup && (
                <>
                  <div className="mb-6 flex items-center gap-3">
                    <button 
                      onClick={() => selectGroup(null)}
                      className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
                    >
                      ← Back to events
                    </button>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold">{selectedGroup.title}</h3>
                    <p className="text-[var(--color-muted)]">{selectedGroup.description}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="glass-panel overflow-hidden rounded-lg cursor-pointer hover:shadow-md transition-shadow group">
                        <img 
                          src={photo.imageUrl || photo.imageUrlOptimized} 
                          alt={photo.caption || 'Photo'}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {photo.caption && (
                          <p className="p-3 text-xs text-[var(--color-muted)] line-clamp-2">{photo.caption}</p>
                        )}
                      </div>
                    ))}
                    {photos.length === 0 && (
                      <div className="glass-panel p-8 col-span-full text-center text-[var(--color-muted)]">
                        No photos in this event yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
      {/* <Footer /> */}
    </div>
  );
};

export default GalleryPage;
