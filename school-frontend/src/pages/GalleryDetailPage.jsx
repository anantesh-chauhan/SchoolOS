import React from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

export const GalleryDetailPage = () => {
  const { slug } = useParams();
  const [album, setAlbum] = React.useState(null);
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    apiClient.get(`/gallery/${slug}`).then((res) => setAlbum(res.data.data)).catch(() => setAlbum(null));
  }, [slug]);

  if (!album) {
    return (
      <div>
        <Navbar />
        <PageHero title="Album not found" subtitle="Requested gallery album is unavailable." />
        <Footer />
      </div>
    );
  }

  const images = album.images || [];
  const current = images[index] || null;

  return (
    <div>
      <Seo title={album.metaTitle || album.title} description={album.metaDescription || album.description} keywords={['gallery', album.title]} />
      <Navbar />
      <PageHero title={album.title} subtitle={album.description} />

      <section className="pb-14">
        <div className="section-shell">
          <div className="glass-panel p-5 mb-4 text-sm text-[var(--color-muted)]">
            <p>This curated album captures key campus moments across academics, sports, arts, and student leadership initiatives.</p>
            <p className="mt-2">Click thumbnails to preview full images and use navigation controls for sequential browsing.</p>
          </div>
          {current ? (
            <div className="glass-panel p-4">
              <img src={current.url} alt={current.title || album.title} className="w-full h-[460px] object-cover rounded-xl" />
              <div className="mt-4 flex items-center justify-between">
                <button className="px-4 py-2 border rounded" onClick={() => setIndex((prev) => (prev - 1 + images.length) % images.length)}>Prev</button>
                <p className="text-sm text-[var(--color-muted)]">{index + 1} / {images.length}</p>
                <button className="px-4 py-2 border rounded" onClick={() => setIndex((prev) => (prev + 1) % images.length)}>Next</button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {images.map((image, i) => (
              <img key={image.url + i} src={image.url} alt={image.title || `Image ${i + 1}`} onClick={() => setIndex(i)} className={`h-24 w-full object-cover rounded-lg cursor-pointer ${i === index ? 'ring-2 ring-[var(--color-primary)]' : ''}`} />
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default GalleryDetailPage;
