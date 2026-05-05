import React from 'react';
import { motion } from 'framer-motion';

export const PageHero = ({ title, subtitle }) => {
  return (
    <section className="pt-16 pb-10">
      <div className="section-shell">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 md:p-10"
        >
          <h1 className="text-4xl md:text-5xl">{title}</h1>
          {subtitle ? <p className="mt-3 text-[var(--color-muted)] max-w-3xl">{subtitle}</p> : null}
        </motion.div>
      </div>
    </section>
  );
};

export default PageHero;
