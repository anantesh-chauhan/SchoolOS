import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import PageHero from '../components/PageHero.jsx';
import Seo from '../components/Seo.jsx';
import apiClient from '../utils/apiClient.js';
import { Link } from 'react-router-dom';
import useSchoolStore from '../store/schoolStore.js';
import { schoolPath } from '../utils/schoolPath.js';

export const CareersPage = () => {
  const [jobs, setJobs] = React.useState([]);
  const [forms, setForms] = useState({});
  const schoolSlug = useSchoolStore((state) => state.schoolSlug);

  React.useEffect(() => {
    apiClient.get('/careers').then((res) => setJobs(res.data.data || [])).catch(() => setJobs([]));
  }, []);

  const apply = async (careerId) => {
    if (!forms[careerId]?.acceptedPolicies) {
      toast.error('Please accept Terms and Privacy Policy before applying.');
      return;
    }
    try {
      await apiClient.post(`/careers/${careerId}/apply`, forms[careerId] || {});
      toast.success('Application submitted');
      setForms((prev) => ({ ...prev, [careerId]: {} }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Application failed');
    }
  };

  return (
    <div>
      <Seo title="Careers" description="Join our team of educators and school leaders." keywords={['school jobs', 'careers']} />
      <Navbar />
      <PageHero title="Careers" subtitle="Open positions for passionate educators and professionals." />

      <section className="py-6">
        <div className="section-shell">
          <div className="glass-panel p-6">
            <h2 className="text-2xl">Why Work With Us</h2>
            <p className="text-sm text-[var(--color-muted)] mt-2">Our teams work in a professionally managed environment with continuous learning, transparent appraisal systems, and strong instructional leadership support.</p>
            <ul className="text-sm text-[var(--color-muted)] mt-3 list-disc pl-5 space-y-1">
              <li>Structured onboarding with mentor shadowing</li>
              <li>Quarterly upskilling workshops and certification support</li>
              <li>Performance-linked growth pathways and leadership opportunities</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="pb-14">
        <div className="section-shell space-y-5">
          {jobs.map((job) => (
            <article key={job._id} className="glass-panel p-6">
              <h3 className="text-2xl">{job.position}</h3>
              <p className="text-sm text-[var(--color-muted)] mt-2">{job.description}</p>
              <p className="text-xs mt-2 text-[var(--color-muted)]">Qualification: {job.qualification || '-'} | Experience: {job.experience || '-'}</p>

              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <input placeholder="Applicant Name" className="border rounded-lg px-3 py-2" value={forms[job._id]?.applicantName || ''} onChange={(e) => setForms((p) => ({ ...p, [job._id]: { ...(p[job._id] || {}), applicantName: e.target.value } }))} />
                <input placeholder="Email" className="border rounded-lg px-3 py-2" value={forms[job._id]?.email || ''} onChange={(e) => setForms((p) => ({ ...p, [job._id]: { ...(p[job._id] || {}), email: e.target.value } }))} />
                <input placeholder="Phone" className="border rounded-lg px-3 py-2" value={forms[job._id]?.phone || ''} onChange={(e) => setForms((p) => ({ ...p, [job._id]: { ...(p[job._id] || {}), phone: e.target.value } }))} />
                <input placeholder="Resume URL" className="border rounded-lg px-3 py-2" value={forms[job._id]?.resumeUrl || ''} onChange={(e) => setForms((p) => ({ ...p, [job._id]: { ...(p[job._id] || {}), resumeUrl: e.target.value } }))} />
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-[var(--color-muted)]">
                <input type="checkbox" checked={Boolean(forms[job._id]?.acceptedPolicies)} onChange={(e) => setForms((p) => ({ ...p, [job._id]: { ...(p[job._id] || {}), acceptedPolicies: e.target.checked } }))} className="mt-1" />
                <span>I agree to the <Link className="text-[var(--color-primary)] font-semibold" to={schoolPath('/terms', schoolSlug)}>Terms</Link> and <Link className="text-[var(--color-primary)] font-semibold" to={schoolPath('/privacy', schoolSlug)}>Privacy Policy</Link>.</span>
              </label>
              <button className="brand-button mt-4" onClick={() => apply(job._id)}>Apply Now</button>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CareersPage;
