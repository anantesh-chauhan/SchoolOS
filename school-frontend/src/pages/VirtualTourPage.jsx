import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import PageHero from '../components/PageHero.jsx';
import Seo from '../components/Seo.jsx';
import { getSchoolConfig } from '../config/schoolConfig.js';

const school = getSchoolConfig();

export const VirtualTourPage = () => (
  <div>
    <Seo title="Virtual Tour" description="Explore campus virtually through video and image tour." keywords={['virtual tour', 'campus']} />
    <Navbar />
    <PageHero title="Virtual Campus Tour" subtitle="Explore our campus through video and curated image walkthrough." />
    <section className="pb-14">
      <div className="section-shell space-y-6">
        <div className="glass-panel p-6">
          <h2 className="text-2xl">Guided Campus Highlights</h2>
          <p className="text-sm text-[var(--color-muted)] mt-2">This tour covers academic blocks, STEM labs, sports arena, library, and student collaboration spaces so families can evaluate campus quality before visiting in person.</p>
          <ul className="text-sm text-[var(--color-muted)] mt-3 list-disc pl-5 space-y-1">
            <li>Innovation block with robotics and coding labs</li>
            <li>Library and supervised independent study zones</li>
            <li>Indoor and outdoor sports infrastructure</li>
            <li>Secure transport bays and parent pickup zones</li>
          </ul>
        </div>
        <div className="glass-panel p-4">
          <iframe
            title="Virtual tour video"
            src={school.virtualTour.videoUrl}
            className="w-full h-[420px] rounded-xl"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {school.virtualTour.gallery.map((image) => (
            <img key={image} src={image} alt="Campus tour" className="w-full h-64 object-cover rounded-xl" loading="lazy" />
          ))}
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default VirtualTourPage;
