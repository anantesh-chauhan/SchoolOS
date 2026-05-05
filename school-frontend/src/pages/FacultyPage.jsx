import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

export const FacultyPage = () => {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    apiClient.get('/faculty').then((res) => setItems(res.data.data || [])).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <Seo title="Faculty" description="Meet our academic and leadership team." keywords={['faculty', 'teachers']} />
      <Navbar />
      <PageHero title="Faculty" subtitle="Experienced mentors committed to student success." />

      <section className="pb-14">
        <div className="section-shell grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article key={item._id} className="glass-panel p-6">
              <img src={item.photo || 'https://via.placeholder.com/500x500?text=Faculty'} alt={item.firstName} className="h-52 w-full object-cover rounded-xl" />
              <h3 className="text-xl mt-4">{item.firstName} {item.lastName}</h3>
              <p className="text-sm text-[var(--color-primary)]">{item.subject?.[0] || item.designation}</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">{item.qualification || 'Qualified educator'} | {item.experience || 0}+ years</p>
              <p className="text-sm mt-2 text-[var(--color-muted)]">{item.bio || 'Dedicated educator focused on student growth and learning excellence.'}</p>
              <Link to={`/faculty/${item.slug}`} className="inline-block mt-4 text-sm font-semibold text-[var(--color-primary)]">View profile</Link>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FacultyPage;
