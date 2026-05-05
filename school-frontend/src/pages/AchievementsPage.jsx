import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';
import { formatDate } from '../utils/formatters.js';

export const AchievementsPage = () => {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    const load = async () => {
      const response = await apiClient.get('/achievements');
      setItems(response.data.data || []);
    };
    load().catch(() => setItems([]));
  }, []);

  return (
    <div>
      <Seo title="Achievements" description="Student, teacher, and school achievements." keywords={['achievements']} />
      <Navbar />
      <PageHero title="Achievements" subtitle="Celebrating milestones, awards, and excellence." />

      <section className="pb-14">
        <div className="section-shell grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article key={item._id} className="glass-panel p-6">
              <p className="text-xs uppercase tracking-wide text-[var(--color-primary)]">{item.type}</p>
              <h3 className="text-xl mt-2">{item.title}</h3>
              <p className="text-sm text-[var(--color-muted)] mt-2">{item.description}</p>
              <p className="text-xs mt-3 text-[var(--color-muted)]">{formatDate(item.achievedDate)}</p>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default AchievementsPage;
