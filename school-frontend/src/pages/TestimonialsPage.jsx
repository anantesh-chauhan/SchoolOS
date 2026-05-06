import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import PageHero from '../components/PageHero.jsx';
import Seo from '../components/Seo.jsx';
import apiClient from '../utils/apiClient.js';

export const TestimonialsPage = () => {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    apiClient.get('/public/testimonials').then((res) => setItems(res.data.data || [])).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <Seo title="Testimonials" description="Hear from parents and students." keywords={['testimonials', 'school feedback']} />
      <Navbar />
      <PageHero title="Testimonials" subtitle="Parents and students share their learning experience." />
      <section className="py-6">
        <div className="section-shell">
          <div className="glass-panel p-6 text-sm text-[var(--color-muted)]">
            <p>Feedback is collected through parent meetings, alumni engagement forums, and student voice councils to continuously improve academic and campus outcomes.</p>
          </div>
        </div>
      </section>
      <section className="pb-14">
        <div className="section-shell grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article key={item._id} className="glass-panel p-6">
              <p className="text-sm text-[var(--color-muted)]">"{item.quote}"</p>
              <p className="mt-4 font-semibold">{item.name}</p>
              <p className="text-xs text-[var(--color-primary)]">{item.role}</p>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default TestimonialsPage;
