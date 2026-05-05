import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

export const GalleryPage = () => {
  const [albums, setAlbums] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [activeCategory, setActiveCategory] = React.useState('all');

  React.useEffect(() => {
    Promise.all([apiClient.get('/gallery'), apiClient.get('/gallery/categories')])
      .then(([albumsRes, categoriesRes]) => {
        setAlbums(albumsRes.data.data || []);
        setCategories(categoriesRes.data.data || []);
      })
      .catch(() => {
        setAlbums([]);
        setCategories([]);
      });
  }, []);

  const filtered = activeCategory === 'all' ? albums : albums.filter((a) => a.category === activeCategory);

  return (
    <div>
      <Seo title="Gallery" description="Campus galleries and school moments." keywords={['school gallery']} />
      <Navbar />
      <PageHero title="Gallery" subtitle="A visual journey through campus life." />

      <section className="pb-14">
        <div className="section-shell">
          <div className="flex flex-wrap gap-2 mb-6">
            <button className={`px-4 py-2 rounded-full text-sm ${activeCategory === 'all' ? 'bg-[var(--color-primary)] text-white' : 'bg-white border'}`} onClick={() => setActiveCategory('all')}>All</button>
            {categories.map((category) => (
              <button key={category} className={`px-4 py-2 rounded-full text-sm ${activeCategory === category ? 'bg-[var(--color-primary)] text-white' : 'bg-white border'}`} onClick={() => setActiveCategory(category)}>{category}</button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((album) => (
              <article key={album._id} className="glass-panel overflow-hidden">
                <img src={album.thumbnail || album.images?.[0]?.url || 'https://via.placeholder.com/900x500?text=Gallery'} alt={album.title} loading="lazy" className="h-48 w-full object-cover" />
                <div className="p-5">
                  <p className="text-xs uppercase text-[var(--color-primary)]">{album.category}</p>
                  <h3 className="text-xl mt-1">{album.title}</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(album.images || []).slice(0, 3).map((img, idx) => (
                      <img key={`${album._id}-${idx}`} src={img.url} alt={`${album.title} preview`} className="h-14 w-full rounded-md object-cover" loading="lazy" />
                    ))}
                  </div>
                  <Link to={`/gallery/${album.slug}`} className="inline-block mt-4 text-sm font-semibold text-[var(--color-primary)]">View album</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default GalleryPage;
