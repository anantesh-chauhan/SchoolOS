import React from 'react';
import { schoolPath } from '../utils/schoolPath.js';

const SectionRenderer = ({ section, school, schoolSlug }) => {
  if (!section?.type) {
    return null;
  }

  if (section.type === 'hero') {
    const data = section.data || {};

    return (
      <article className="glass-panel p-8 md:p-10 bg-white/85">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-muted)]">Public Website</p>
        <h2 className="text-3xl md:text-5xl mt-3">{data.title || school.name}</h2>
        <p className="mt-4 text-[var(--color-muted)] max-w-3xl">{data.subtitle || school.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {data.primaryCta?.label ? <a href={schoolPath(data.primaryCta.path, schoolSlug)} className="brand-button">{data.primaryCta.label}</a> : null}
          {data.secondaryCta?.label ? <a href={schoolPath(data.secondaryCta.path, schoolSlug)} className="brand-outline text-[var(--color-ink)] border-black/10">{data.secondaryCta.label}</a> : null}
        </div>
      </article>
    );
  }

  if (section.type === 'about') {
    const data = section.data || {};

    return (
      <article className="glass-panel p-8">
        <h2 className="text-3xl">{data.title || `About ${school.name}`}</h2>
        <p className="mt-3 text-[var(--color-muted)]">{data.description || school.description}</p>
        {Array.isArray(data.highlights) && data.highlights.length > 0 ? (
          <ul className="mt-4 grid md:grid-cols-3 gap-3 text-sm text-[var(--color-muted)]">
            {data.highlights.map((item) => (
              <li key={item} className="rounded-xl border border-black/10 bg-white/50 p-4">{item}</li>
            ))}
          </ul>
        ) : null}
      </article>
    );
  }

  if (section.type === 'contact') {
    const data = section.data || {};

    return (
      <article className="glass-panel p-8">
        <h2 className="text-3xl">{data.title || 'Contact'}</h2>
        <p className="mt-3 text-[var(--color-muted)]">{data.description || 'Get in touch with the admissions office for school visits and enquiries.'}</p>
      </article>
    );
  }

  return null;
};

export default SectionRenderer;
