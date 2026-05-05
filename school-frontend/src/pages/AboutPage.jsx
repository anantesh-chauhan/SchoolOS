import React from 'react';
import { FiCompass, FiHeart, FiTarget, FiTrendingUp } from 'react-icons/fi';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import { getSchoolConfig } from '../config/schoolConfig.js';
import useThemeStore from '../context/themeStore.js';

const fallbackSchool = getSchoolConfig();

export const AboutPage = () => {
  const school = useThemeStore((state) => state.schoolConfig) || fallbackSchool;
  const contact = school.contact || fallbackSchool.contact || {};

  return (
    <div>
      <Seo
        title={`About ${school.name}`}
        description={`Learn about ${school.name}, our mission, values, and educational philosophy.`}
        keywords={['about school', 'school mission', 'school vision']}
      />
      <Navbar />
      <PageHero title={`About ${school.name}`} subtitle={school.description} />

      <section className="pb-12">
        <div className="section-shell grid lg:grid-cols-3 gap-5">
          <article className="glass-panel p-6 lg:col-span-2">
            <h2 className="text-2xl">Our Vision</h2>
            <p className="mt-3 text-[var(--color-muted)]">
              We shape responsible, curious, and future-ready learners through a balanced approach to academics,
              values, sports, and innovation.
            </p>
            <h2 className="text-2xl mt-8">Our Mission</h2>
            <p className="mt-3 text-[var(--color-muted)]">
              To provide an inclusive learning ecosystem where every student can discover their strengths and achieve
              excellence with integrity.
            </p>

            <h2 className="text-2xl mt-8">Principal's Message</h2>
            <p className="mt-3 text-[var(--color-muted)]">
              Our commitment is to cultivate not only high academic outcomes, but also empathy, leadership, and resilience.
              We work in partnership with families to build a safe and aspirational environment for every learner.
            </p>

            <h2 className="text-2xl mt-8">School History</h2>
            <p className="mt-3 text-[var(--color-muted)]">
              Established to serve a growing community of learners, our school has evolved into a future-focused institution
              known for balanced excellence across academics, arts, and sports.
            </p>

            <h2 className="text-2xl mt-8">Why Choose Our School</h2>
            <ul className="mt-3 text-[var(--color-muted)] list-disc pl-5 space-y-1">
              <li>Strong academic mentoring and student support systems</li>
              <li>Modern facilities with experiential learning opportunities</li>
              <li>Holistic development through co-curricular and leadership programs</li>
              <li>Safe campus with collaborative parent-school engagement</li>
            </ul>

            <div className="grid md:grid-cols-2 gap-4 mt-8">
              {[
                { icon: FiTarget, title: 'Outcome Focused', text: 'Each program maps learning outcomes to measurable growth in competence and confidence.' },
                { icon: FiCompass, title: 'Mentor Led', text: 'Dedicated mentor teachers track progress and guide students through milestones.' },
                { icon: FiHeart, title: 'Value Anchored', text: 'Integrity, respect, and empathy are integrated into classroom and campus life.' },
                { icon: FiTrendingUp, title: 'Future Ready', text: 'Career guidance, innovation projects, and interdisciplinary exposure from middle school onward.' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-black/10 p-4 bg-white/50">
                  <item.icon className="text-[var(--color-primary)]" />
                  <p className="font-semibold mt-2">{item.title}</p>
                  <p className="text-sm text-[var(--color-muted)] mt-1">{item.text}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="glass-panel p-6">
            <h3 className="text-xl">School Profile</h3>
            <ul className="mt-4 text-sm space-y-2 text-[var(--color-muted)]">
              <li>Name: {school.name}</li>
              <li>Tagline: {school.tagline}</li>
              <li>City: {contact.city}</li>
              <li>Contact: {contact.phone}</li>
              <li>Email: {contact.email}</li>
            </ul>
          </aside>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default AboutPage;
