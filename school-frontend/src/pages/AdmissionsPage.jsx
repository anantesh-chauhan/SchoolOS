import React from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import useSchoolStore from '../store/schoolStore.js';
import { schoolPath } from '../utils/schoolPath.js';
import { Navbar } from '../components/Navbar.jsx';
import { Footer } from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';

const sections = {
  process: ['Submit enquiry form', 'Admissions counselling call', 'Campus interaction / assessment', 'Admission confirmation'],
  eligibility: ['Age-appropriate entry as per class level', 'Previous academic records (where applicable)', 'Interaction readiness for selected grade'],
  documents: ['Birth Certificate', 'Previous Report Card', 'Transfer Certificate (if applicable)', 'Parent ID Proof', 'Address Proof'],
  dates: ['Admissions Open: January 10', 'Round 1 Closure: March 31', 'Round 2 Closure: June 15', 'Limited Mid-Session Intake: Subject to seats'],
};

export const AdmissionsPage = () => {
  const [loading, setLoading] = React.useState(false);
  const schoolSlug = useSchoolStore((state) => state.schoolSlug);
  const [form, setForm] = React.useState({
    studentName: '',
    parentName: '',
    email: '',
    phone: '',
    classApplying: '',
    message: '',
    acceptedPolicies: false,
  });

  const submit = async (event) => {
    event.preventDefault();

    if (!form.acceptedPolicies) {
      toast.error('Please accept Terms and Privacy Policy before submitting.');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/admissions', {
        studentName: form.studentName,
        parentName: form.parentName,
        email: form.email,
        phone: form.phone,
        classApplying: form.classApplying,
        message: form.message,
      });

      toast.success('Admissions enquiry submitted successfully.');
      setForm({
        studentName: '',
        parentName: '',
        email: '',
        phone: '',
        classApplying: '',
        message: '',
        acceptedPolicies: false,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit enquiry right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Seo title="Admissions" description="Admissions process, eligibility, and enquiry details." keywords={['school admissions', 'admission enquiry']} />
      <Navbar />
      <PageHero title="Admissions" subtitle="Begin your child's admission journey with a clear, guided process." />

      <section className="pb-14">
        <div className="section-shell grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <article className="glass-panel p-6">
              <h2 className="text-2xl">Admissions Overview</h2>
              <p className="text-sm text-[var(--color-muted)] mt-2">Our admissions process is transparent, parent-friendly, and focused on student readiness and school fit.</p>
            </article>

            <InfoBlock title="Admission Process" items={sections.process} />
            <InfoBlock title="Eligibility Criteria" items={sections.eligibility} />
            <InfoBlock title="Required Documents" items={sections.documents} />
            <InfoBlock title="Important Dates" items={sections.dates} />
          </div>

          <form className="lg:col-span-3 glass-panel p-6 space-y-4" onSubmit={submit}>
            <h2 className="text-2xl">Admission Enquiry Form</h2>
            <p className="text-sm text-[var(--color-muted)]">Complete this form and our admissions office will contact you within one business day.</p>

            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Student Name" value={form.studentName} onChange={(value) => setForm((prev) => ({ ...prev, studentName: value }))} required />
              <Field label="Parent Name" value={form.parentName} onChange={(value) => setForm((prev) => ({ ...prev, parentName: value }))} required />
              <Field label="Email" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} required />
              <Field label="Phone" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} required />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Class Applying For</label>
              <select
                value={form.classApplying}
                onChange={(e) => setForm((prev) => ({ ...prev, classApplying: e.target.value }))}
                className="w-full rounded-lg border border-black/10 px-4 py-2.5 bg-white"
                required
              >
                <option value="">Select class</option>
                {['Nursery', 'KG', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Message</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                className="w-full rounded-lg border border-black/10 px-4 py-2.5 bg-white"
                placeholder="Tell us a little about your child and admission preference"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
              <input type="checkbox" checked={Boolean(form.acceptedPolicies)} onChange={(e) => setForm((prev) => ({ ...prev, acceptedPolicies: e.target.checked }))} className="mt-1" />
              <span>
                I agree to the <Link className="text-[var(--color-primary)] font-semibold" to={schoolPath('/terms', schoolSlug)}>Terms</Link> and <Link className="text-[var(--color-primary)] font-semibold" to={schoolPath('/privacy', schoolSlug)}>Privacy Policy</Link>.
              </span>
            </label>

            <button className="brand-button" type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Enquiry'}</button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
};

const InfoBlock = ({ title, items }) => (
  <article className="glass-panel p-6">
    <h3 className="text-xl">{title}</h3>
    <ul className="mt-3 text-sm text-[var(--color-muted)] list-disc pl-5 space-y-1">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  </article>
);

const Field = ({ label, value, onChange, required = false, type = 'text' }) => (
  <label className="text-sm block">
    <span className="block mb-1 font-semibold">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-black/10 px-4 py-2.5 bg-white"
      required={required}
    />
  </label>
);

export default AdmissionsPage;
