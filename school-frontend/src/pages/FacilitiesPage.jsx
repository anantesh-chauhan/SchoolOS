import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import { getSchoolConfig } from '../config/schoolConfig.js';

const school = getSchoolConfig();

export const FacilitiesPage = () => (
  <div>
    <Seo
      title="Facilities"
      description="Explore our campus facilities including labs, libraries, sports arenas, and creative arts spaces."
      keywords={['school facilities', 'campus', 'labs', 'sports']}
    />
    <Navbar />
    <PageHero title="Facilities" subtitle="A modern campus designed for learning, creativity, and wellbeing." />

    <section className="pb-14">
      <div className="section-shell grid md:grid-cols-3 gap-5">
        {school.homepage.facilities.map((item) => (
          <article key={item.title} className="glass-panel p-6">
            <h3 className="text-xl">{item.title}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{item.description}</p>
          </article>
        ))}
      </div>

      <div className="section-shell mt-6 grid md:grid-cols-2 gap-5">
        <article className="glass-panel p-6">
          <h3 className="text-2xl">Infrastructure Highlights</h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Our campus is designed around safety, accessibility, and high-performance learning environments.</p>
          <ul className="mt-3 text-sm text-[var(--color-muted)] list-disc pl-5 space-y-1">
            <li>Digitally enabled classrooms with interactive display systems</li>
            <li>Dedicated robotics, language, and design-thinking labs</li>
            <li>Central library with digital catalog and research zones</li>
            <li>Indoor and outdoor sporting infrastructure with certified coaches</li>
          </ul>
        </article>
        <article className="glass-panel p-6">
          <h3 className="text-2xl">Student Support Services</h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Facilities are complemented by structured support systems for wellbeing, security, and transport reliability.</p>
          <ul className="mt-3 text-sm text-[var(--color-muted)] list-disc pl-5 space-y-1">
            <li>On-campus counsellor and health room support</li>
            <li>GPS-enabled transport and route attendance monitoring</li>
            <li>Smart card enabled visitor and access management</li>
            <li>Comprehensive emergency drills and response protocols</li>
          </ul>
        </article>
      </div>
    </section>
    <Footer />
  </div>
);

export default FacilitiesPage;
