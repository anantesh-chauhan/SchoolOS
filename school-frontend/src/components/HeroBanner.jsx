import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const HeroBanner = ({ title, subtitle, backgroundImage, ctaPrimary, ctaSecondary, slides = [] }) => {
  const resolvedSlides = React.useMemo(() => {
    if (Array.isArray(slides) && slides.length > 0) {
      return slides;
    }

    return [
      {
        title,
        subtitle,
        image: backgroundImage,
      },
    ];
  }, [slides, title, subtitle, backgroundImage]);

  const [activeSlide, setActiveSlide] = React.useState(0);

  React.useEffect(() => {
    if (resolvedSlides.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % resolvedSlides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [resolvedSlides.length]);

  const current = resolvedSlides[activeSlide] || resolvedSlides[0];
  const isVideoSlide = Boolean(current?.video);

  return (
    <section
      className="relative min-h-[78vh] md:min-h-[86vh] flex items-center overflow-hidden"
      style={!isVideoSlide ? {
        backgroundImage: `linear-gradient(110deg, rgba(15,10,10,0.74), rgba(15,10,10,0.38)), url(${current.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'background-image 800ms ease-in-out',
      } : undefined}
    >
      {isVideoSlide ? (
        <>
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={current.video}
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/30" />
        </>
      ) : null}

      <div className="absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-[var(--color-secondary)]/30 blur-3xl" />
      <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[var(--color-primary)]/30 blur-3xl" />

      <div className="section-shell relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="max-w-3xl text-white"
        >
          <p className="uppercase tracking-[0.2em] text-xs text-white/75 mb-4">Distinction In School Education</p>
          <h1 className="text-4xl md:text-6xl leading-tight font-semibold">{current.title}</h1>
          <p className="text-base md:text-xl text-white/85 mt-5">{current.subtitle}</p>

          <div className="mt-9 flex flex-wrap gap-4">
            {ctaPrimary ? (
              <Link to={ctaPrimary.href} className="brand-button">
                {ctaPrimary.label}
              </Link>
            ) : null}
            {ctaSecondary ? (
              <Link to={ctaSecondary.href} className="brand-outline">
                {ctaSecondary.label}
              </Link>
            ) : null}
          </div>

          {resolvedSlides.length > 1 ? (
            <div className="mt-8 flex items-center gap-2">
              {resolvedSlides.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => setActiveSlide(index)}
                  className={`h-2.5 rounded-full transition-all ${activeSlide === index ? 'w-8 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            </div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroBanner;
