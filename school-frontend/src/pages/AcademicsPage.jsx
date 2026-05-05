import React from 'react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

const defaultPrograms = {
  earlyYears: {
    curriculum: 'Experiential, play-based early learning with language and numeracy foundations.',
    activities: 'Story circles, phonics lab, art studio, music and movement.',
    facilities: 'Safe foundational block, activity studio, outdoor sensory zone.',
    outcomes: 'Confidence, communication readiness, social development, and curiosity.',
  },
  primarySchool: {
    curriculum: 'Balanced academics with conceptual learning in math, science, language and social studies.',
    activities: 'STEM clubs, reading labs, sports conditioning, arts integration.',
    facilities: 'Smart classrooms, library wing, supervised maker spaces.',
    outcomes: 'Strong fundamentals, expressive communication, and problem-solving skills.',
  },
  middleSchool: {
    curriculum: 'Interdisciplinary learning, project-based assessments, and research literacy.',
    activities: 'Olympiad prep, coding electives, debates, design projects.',
    facilities: 'Science labs, coding studio, collaboration hubs.',
    outcomes: 'Analytical thinking, teamwork, and leadership maturity.',
  },
  seniorSecondary: {
    curriculum: 'Board excellence programs with university and career readiness support.',
    activities: 'Career counselling, mock interviews, competitive exam tracks.',
    facilities: 'Advanced labs, seminar halls, mentorship cells.',
    outcomes: 'Academic distinction, decision confidence, and higher-education readiness.',
  },
};

export const AcademicsPage = () => {
  const [programs, setPrograms] = React.useState(defaultPrograms);
  const [activeProgram, setActiveProgram] = React.useState('earlyYears');

  React.useEffect(() => {
    apiClient.get('/settings').then((res) => {
      const remotePrograms = res.data.data?.programExplorer;
      if (remotePrograms) {
        setPrograms((prev) => ({ ...prev, ...remotePrograms }));
      }
    }).catch(() => null);
  }, []);

  const labels = {
    earlyYears: 'Early Years',
    primarySchool: 'Primary School',
    middleSchool: 'Middle School',
    seniorSecondary: 'Senior Secondary',
  };

  const current = programs[activeProgram] || defaultPrograms.earlyYears;

  return (
    <div>
      <Seo
        title="Academics"
        description="Explore curriculum and pedagogical approach across foundational, middle, and senior school levels."
        keywords={['academics', 'curriculum', 'school programs']}
      />
      <Navbar />
      <PageHero title="Program Explorer" subtitle="Interactive academic pathways from Early Years to Senior Secondary." />

      <section className="pb-14">
        <div className="section-shell">
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.keys(labels).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveProgram(key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold ${activeProgram === key ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-black/10'}`}
              >
                {labels[key]}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <article className="glass-panel p-6">
              <h3 className="text-2xl">Curriculum</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{current.curriculum}</p>
            </article>
            <article className="glass-panel p-6">
              <h3 className="text-2xl">Activities</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{current.activities}</p>
            </article>
            <article className="glass-panel p-6">
              <h3 className="text-2xl">Facilities</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{current.facilities}</p>
            </article>
            <article className="glass-panel p-6">
              <h3 className="text-2xl">Learning Outcomes</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{current.outcomes}</p>
            </article>
          </div>
        </div>

        <div className="section-shell mt-6 grid lg:grid-cols-2 gap-5">
          <article className="glass-panel p-6">
            <h3 className="text-2xl">Academic Pathways</h3>
            <p className="text-sm text-[var(--color-muted)] mt-2">Students follow curated pathways in STEM, humanities, commerce, and performing arts with mentor-led planning from middle school onward.</p>
            <ul className="text-sm text-[var(--color-muted)] mt-3 list-disc pl-5 space-y-1">
              <li>Olympiad and competitive exam foundation tracks</li>
              <li>Language proficiency and communication labs</li>
              <li>Capstone projects with interdisciplinary assessment</li>
            </ul>
          </article>
          <article className="glass-panel p-6">
            <h3 className="text-2xl">Assessment and Reporting</h3>
            <p className="text-sm text-[var(--color-muted)] mt-2">Assessment blends formative checkpoints, practical evaluation, and summative reports with data-informed parent communication.</p>
            <ul className="text-sm text-[var(--color-muted)] mt-3 list-disc pl-5 space-y-1">
              <li>Monthly progress dashboards and intervention notes</li>
              <li>Rubric-based evaluation for projects and presentations</li>
              <li>Personalized growth recommendations for each term</li>
            </ul>
          </article>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default AcademicsPage;
