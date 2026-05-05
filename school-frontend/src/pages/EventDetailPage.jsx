import React from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';
import { formatDate } from '../utils/formatters.js';

export const EventDetailPage = () => {
  const { slug } = useParams();
  const [item, setItem] = React.useState(null);

  React.useEffect(() => {
    apiClient.get(`/events/${slug}`).then((res) => setItem(res.data.data)).catch(() => setItem(null));
  }, [slug]);

  if (!item) {
    return (
      <div>
        <Navbar />
        <PageHero title="Event not found" subtitle="The requested event could not be loaded." />
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Seo title={item.metaTitle || item.title} description={item.metaDescription || item.description} keywords={['event', item.title]} />
      <Navbar />
      <PageHero title={item.title} subtitle={formatDate(item.startDate)} />

      <section className="pb-14">
        <div className="section-shell grid lg:grid-cols-3 gap-6">
          <article className="lg:col-span-2 glass-panel overflow-hidden">
            <img
              src={item.thumbnail || item.images?.[0] || 'https://via.placeholder.com/1000x560?text=Event'}
              alt={item.title}
              className="h-72 w-full object-cover"
            />
            <div className="p-6">
              <p className="text-sm text-[var(--color-muted)]">{item.description}</p>
              {item.content ? <p className="mt-4 text-sm text-[var(--color-muted)]">{item.content}</p> : null}

              <div className="mt-5 grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-black/10 p-4 bg-white/60">
                  <p className="font-semibold">What To Expect</p>
                  <p className="text-sm text-[var(--color-muted)] mt-1">Interactive sessions, curated student showcases, and guided participation for families and guests.</p>
                </div>
                <div className="rounded-xl border border-black/10 p-4 bg-white/60">
                  <p className="font-semibold">Participation Notes</p>
                  <p className="text-sm text-[var(--color-muted)] mt-1">Participants should report 30 minutes early. Dress code and check-in instructions are shared by coordinators.</p>
                </div>
              </div>
            </div>
          </article>

          <aside className="glass-panel p-6 text-sm text-[var(--color-muted)]">
            <p><span className="font-semibold text-[var(--color-ink)]">Date:</span> {formatDate(item.startDate)}</p>
            <p className="mt-2"><span className="font-semibold text-[var(--color-ink)]">Location:</span> {item.location || 'Campus'}</p>
            <p className="mt-2"><span className="font-semibold text-[var(--color-ink)]">Category:</span> {item.category || 'General'}</p>
          </aside>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default EventDetailPage;
