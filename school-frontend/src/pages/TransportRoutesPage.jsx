import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

export const TransportRoutesPage = () => {
  const [routes, setRoutes] = React.useState([]);

  React.useEffect(() => {
    apiClient.get('/transport-routes').then((res) => setRoutes(res.data.data || [])).catch(() => setRoutes([]));
  }, []);

  return (
    <div>
      <Seo title="Transport Routes" description="School bus routes, pickup points and timings." keywords={['school transport', 'bus routes']} />
      <Navbar />
      <PageHero title="Transport Routes" subtitle="Safe and reliable school commute network." />
      <section className="pb-14">
        <div className="section-shell grid md:grid-cols-2 gap-5">
          {routes.map((route) => (
            <article key={route._id} className="glass-panel p-6">
              <h3 className="text-xl">{route.routeName}</h3>
              <p className="text-sm mt-1 text-[var(--color-primary)]">{route.timing}</p>
              <ul className="mt-3 text-sm text-[var(--color-muted)] space-y-1">
                {(route.pickupPoints || []).map((point, idx) => (
                  <li key={`${route._id}-${idx}`}>{point.name} - {point.timing}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default TransportRoutesPage;
