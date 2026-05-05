import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

export const AlumniPage = () => {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    apiClient.get('/alumni').then((res) => setItems(res.data.data || [])).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <Seo title="Alumni" description="Our alumni are making impact across industries." keywords={['alumni']} />
      <Navbar />
      <PageHero title="Alumni" subtitle="Celebrating graduates shaping the future." />
      <section className="py-6">
        <div className="section-shell">
          <div className="glass-panel p-6 text-sm text-[var(--color-muted)]">
            <p>Our alumni network contributes through mentorship sessions, scholarship support, internships, and university readiness workshops.</p>
          </div>
        </div>
      </section>
      <section className="pb-14">
        <div className="section-shell grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article key={item._id} className="glass-panel p-6">
              <img src={item.photo || 'https://via.placeholder.com/450x450?text=Alumni'} alt={item.name} className="h-44 w-full object-cover rounded-xl" />
              <h3 className="text-xl mt-3">{item.name}</h3>
              <p className="text-xs text-[var(--color-primary)]">Batch {item.batchYear}</p>
              <p className="text-sm mt-2 text-[var(--color-muted)]">{item.currentPosition} at {item.company}</p>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default AlumniPage;
