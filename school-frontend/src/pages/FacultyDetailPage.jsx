import React from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

export const FacultyDetailPage = () => {
  const { slug } = useParams();
  const [item, setItem] = React.useState(null);

  React.useEffect(() => {
    apiClient.get(`/faculty/${slug}`).then((res) => setItem(res.data.data)).catch(() => setItem(null));
  }, [slug]);

  if (!item) {
    return (
      <div>
        <Navbar />
        <PageHero title="Faculty profile not found" subtitle="Requested faculty profile is unavailable." />
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Seo title={`${item.firstName} ${item.lastName}`} description={item.bio || item.designation} keywords={['faculty profile']} />
      <Navbar />
      <PageHero title={`${item.firstName} ${item.lastName}`} subtitle={item.designation} />

      <section className="pb-14">
        <div className="section-shell grid md:grid-cols-3 gap-6">
          <img src={item.photo || 'https://via.placeholder.com/500x500?text=Faculty'} alt={item.firstName} className="w-full h-80 object-cover rounded-2xl" />
          <article className="md:col-span-2 glass-panel p-6 text-sm text-[var(--color-muted)]">
            <p><span className="font-semibold text-[var(--color-ink)]">Designation:</span> {item.designation}</p>
            <p className="mt-2"><span className="font-semibold text-[var(--color-ink)]">Qualification:</span> {item.qualification || '-'}</p>
            <p className="mt-2"><span className="font-semibold text-[var(--color-ink)]">Experience:</span> {item.experience || 0} years</p>
            <p className="mt-4">{item.bio || 'Profile details will be updated soon.'}</p>

            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <div className="rounded-xl border border-black/10 p-4 bg-white/60">
                <p className="font-semibold text-[var(--color-ink)]">Pedagogical Focus</p>
                <p className="mt-1">Concept clarity, student questioning, and applied learning through projects and assessments.</p>
              </div>
              <div className="rounded-xl border border-black/10 p-4 bg-white/60">
                <p className="font-semibold text-[var(--color-ink)]">Mentor Responsibilities</p>
                <p className="mt-1">Individual academic mentoring, parent connect, and enrichment guidance for performance growth.</p>
              </div>
            </div>
          </article>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FacultyDetailPage;
