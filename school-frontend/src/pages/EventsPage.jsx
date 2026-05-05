import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';
import { formatDate, truncateText } from '../utils/formatters.js';

export const EventsPage = () => {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    apiClient.get('/events').then((res) => setItems(res.data.data || [])).catch(() => setItems([]));
  }, []);

  const now = Date.now();
  const upcomingEvents = items.filter((item) => new Date(item.startDate).getTime() >= now);
  const pastEvents = items.filter((item) => new Date(item.startDate).getTime() < now);

  return (
    <div>
      <Seo title="Events" description="Upcoming and featured school events." keywords={['school events']} />
      <Navbar />
      <PageHero title="Events" subtitle="Stay updated with major school activities and celebrations." />

      <section className="pb-14">
        <div className="section-shell">
          <h2 className="text-2xl md:text-3xl mb-4">Upcoming Events</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcomingEvents.map((item) => (
              <article key={item._id} className="glass-panel overflow-hidden">
                <img
                  src={item.thumbnail || item.images?.[0] || 'https://via.placeholder.com/800x500?text=Event'}
                  alt={item.title}
                  loading="lazy"
                  className="h-48 w-full object-cover"
                />
                <div className="p-5">
                  <p className="text-xs text-[var(--color-primary)]">{formatDate(item.startDate)}</p>
                  <h3 className="text-xl mt-1">{item.title}</h3>
                  <p className="text-sm mt-2 text-[var(--color-muted)]">{truncateText(item.description, 110)}</p>
                  <Link to={`/events/${item.slug}`} className="inline-block mt-4 text-sm font-semibold text-[var(--color-primary)]">
                    Read details
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <h2 className="text-2xl md:text-3xl mt-10 mb-4">Past Events</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pastEvents.map((item) => (
              <article key={item._id} className="glass-panel overflow-hidden">
                <img
                  src={item.thumbnail || item.images?.[0] || 'https://via.placeholder.com/800x500?text=Event'}
                  alt={item.title}
                  loading="lazy"
                  className="h-48 w-full object-cover"
                />
                <div className="p-5">
                  <p className="text-xs text-[var(--color-primary)]">{formatDate(item.startDate)}</p>
                  <h3 className="text-xl mt-1">{item.title}</h3>
                  <p className="text-sm mt-2 text-[var(--color-muted)]">{truncateText(item.description, 110)}</p>
                  <Link to={`/events/${item.slug}`} className="inline-block mt-4 text-sm font-semibold text-[var(--color-primary)]">
                    Read details
                  </Link>
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

export default EventsPage;
