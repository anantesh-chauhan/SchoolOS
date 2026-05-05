import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';
import { formatDate, truncateText } from '../utils/formatters.js';

export const NoticesPage = () => {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    apiClient.get('/notices').then((res) => setItems(res.data.data || [])).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <Seo title="News & Notices" description="Official school announcements, circulars, and latest updates." keywords={['school news', 'school notices']} />
      <Navbar />
      <PageHero title="News & Notices" subtitle="Stay informed with latest announcements and school updates." />

      <section className="pb-14">
        <div className="section-shell grid md:grid-cols-2 gap-5">
          {items.map((item) => (
            <article key={item._id} className="glass-panel p-5">
              <p className="text-xs text-[var(--color-primary)]">{formatDate(item.publishDate || item.createdAt)}</p>
              <h3 className="text-xl mt-1">{item.title}</h3>
              <p className="text-sm mt-2 text-[var(--color-muted)]">{truncateText(item.description || item.content, 180)}</p>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default NoticesPage;
