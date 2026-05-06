import React from 'react';
import { motion } from 'framer-motion';
import { FiAward, FiBookOpen, FiGlobe, FiUsers } from 'react-icons/fi';
import { Navbar } from '../components/Navbar.jsx';
import { Footer } from '../components/Footer.jsx';
import { HeroBanner } from '../components/HeroBanner.jsx';
import Seo from '../components/Seo.jsx';
import { getSchoolConfig } from '../config/schoolConfig.js';
import useSchoolStore from '../store/schoolStore.js';
import { schoolPath } from '../utils/schoolPath.js';
import SectionRenderer from '../components/SectionRenderer.jsx';

const fallbackSchool = getSchoolConfig();

export const HomePage = () => {
  const school = useSchoolStore((state) => ({
    name: state.name || fallbackSchool.name,
    description: state.config?.homepage?.subtitle || fallbackSchool.description,
    contact: state.config?.contact || fallbackSchool.contact || {},
    homepage: state.config?.homepage || fallbackSchool.homepage,
    config: state.config || fallbackSchool.config || {},
    slug: state.schoolSlug || fallbackSchool.slug,
    seo: state.config?.seo || fallbackSchool.seo,
  }));

  const testimonials = school.homepage?.testimonials || fallbackSchool.homepage.testimonials || [];

  const hero = {
    ...(fallbackSchool.homepage?.hero || {}),
    ...(school.homepage?.hero || {}),
  };

  const heroSlides = hero.slides || school.homepage?.heroSlides || fallbackSchool.homepage.heroSlides || [];

  return (
    <div>
      <Seo
        title={school.seo?.pages?.home?.title}
        description={school.seo?.pages?.home?.description}
        keywords={school.seo?.pages?.home?.keywords}
      />
      <Navbar />

      {(school.config?.sections || []).length > 0 ? (
        <section className="py-8">
          <div className="section-shell grid gap-5">
            {(school.config?.sections || []).map((section, index) => (
              <SectionRenderer key={`${section.type}-${index}`} section={section} school={school} schoolSlug={school.slug} />
            ))}
          </div>
        </section>
      ) : null}

      <HeroBanner
        title={hero.title}
        subtitle={hero.subtitle}
        backgroundImage={hero.backgroundImage}
        ctaPrimary={hero.primaryCta}
        ctaSecondary={hero.secondaryCta}
        slides={heroSlides}
      />

      <section className="py-14">
        <div className="section-shell">
          <div className="glass-panel p-7 mb-6">
            <h2 className="text-3xl">About School</h2>
            <p className="text-[var(--color-muted)] mt-3">{school.description}</p>
            <p className="text-[var(--color-muted)] mt-2">
              We combine deep academics, future-skills labs, international exposure, and character education to build confident learners ready for university and life.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {(school.homepage?.achievements || fallbackSchool.homepage.achievements || []).map((item) => (
              <div key={item.label} className="glass-panel p-6 text-center">
                <p className="text-3xl font-bold text-[var(--color-primary)]">{item.value}</p>
                <p className="text-sm text-[var(--color-muted)] mt-1">{item.label}</p>
              </div>
            ))}
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {[
              { icon: FiBookOpen, title: 'Academic Mentoring', text: 'Structured remediation and enrichment for each learner profile.' },
              { icon: FiUsers, title: 'Wellbeing Support', text: 'Counselling, SEL, and parent partnership for balanced growth.' },
              { icon: FiAward, title: 'Olympiad Culture', text: 'Competitive preparation pathways in STEM, language, and debate.' },
              { icon: FiGlobe, title: 'Global Exposure', text: 'Model UN, exchange programs, and interdisciplinary capstones.' },
            ].map((pillar) => (
              <article key={pillar.title} className="glass-panel p-5">
                <pillar.icon className="text-[var(--color-primary)] text-xl" />
                <h3 className="text-lg mt-3">{pillar.title}</h3>
                <p className="text-sm mt-2 text-[var(--color-muted)]">{pillar.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="section-shell">
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl">Facilities Built For Excellence</h2>
            <p className="text-[var(--color-muted)] mt-2">High-standard learning spaces that support academics and life skills.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {(school.homepage?.facilities || fallbackSchool.homepage.facilities || []).map((facility, index) => (
              <motion.article
                key={facility.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="glass-panel p-6"
              >
                <h3 className="text-xl mb-2">{facility.title}</h3>
                <p className="text-sm text-[var(--color-muted)]">{facility.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="section-shell">
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl">Events Preview</h2>
            <p className="text-[var(--color-muted)] mt-2">Upcoming milestones and celebrations.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {(school.config?.sections || [])
              .filter((section) => section.type === 'event')
              .slice(0, 3)
              .map((section, index) => {
                const event = section.data || {};
                return (
              <article key={event._id} className="glass-panel p-6">
                <h3 className="text-xl">{event.title || `Event ${index + 1}`}</h3>
                <p className="text-sm text-[var(--color-muted)] mt-2">{event.description || 'Latest school event update.'}</p>
                <a href={schoolPath(event.href || '/events', school.slug)} className="inline-block mt-4 text-sm font-semibold text-[var(--color-primary)]">
                  View Event
                </a>
              </article>
                );
              })}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="section-shell">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl md:text-4xl">Campus Moments</h2>
              <p className="text-[var(--color-muted)] mt-2">Snapshots of academics, sports, and co-curricular excellence.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {(school.homepage?.gallery || fallbackSchool.homepage.gallery || []).map((image) => (
              <img
                key={image}
                src={image}
                alt="Campus highlight"
                loading="lazy"
                className="h-64 w-full object-cover rounded-2xl shadow-md"
                onError={(event) => {
                  event.currentTarget.src = 'https://via.placeholder.com/800x600?text=School+Gallery';
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="section-shell">
          <div className="glass-panel p-8 md:p-10 bg-[var(--color-primary)] text-white">
            <h2 className="text-3xl md:text-4xl">Admissions Open For 2026-27</h2>
            <p className="mt-3 text-white/85 max-w-2xl">
              Enroll your child in a future-focused environment where academic achievement and character development move together.
            </p>
            <a href={schoolPath('/admissions', school.slug)} className="brand-outline mt-6">Begin Application</a>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="section-shell">
          <h2 className="text-3xl md:text-4xl mb-6">Voices From Our Community</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {testimonials.map((item, index) => (
              <motion.blockquote
                key={item.name}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="glass-panel p-7"
              >
                <p className="text-lg">"{item.quote}"</p>
                <footer className="mt-4 text-sm font-semibold text-[var(--color-primary)]">{item.name}</footer>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="section-shell">
          <div className="glass-panel p-8">
            <h2 className="text-3xl">Contact Section</h2>
            <p className="text-[var(--color-muted)] mt-2">{school.contact.address}, {school.contact.city} | {school.contact.phone} | {school.contact.email}</p>
            <p className="text-[var(--color-muted)] mt-2">Campus visits, classroom observation requests, scholarship counselling, and admissions consultations are available on weekdays and selected Saturdays.</p>
            <a href={schoolPath('/contact', school.slug)} className="brand-button mt-5">Contact Admissions Office</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
