import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import { getSchoolConfig } from '../config/schoolConfig.js';
import apiClient from '../utils/apiClient.js';
import { Link } from 'react-router-dom';

const school = getSchoolConfig();

export const ContactPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '', acceptedPolicies: false });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.acceptedPolicies) {
      toast.error('Please accept Terms and Privacy Policy before submitting.');
      return;
    }
    try {
      setLoading(true);
      await apiClient.post('/contact', formData);
      toast.success('Message sent successfully');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '', acceptedPolicies: false });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Seo title="Contact" description="Contact school administration and admissions office." keywords={['contact school']} />
      <Navbar />
      <PageHero title="Contact Us" subtitle="We are here to support your queries and admissions guidance." />

      <section className="pb-14">
        <div className="section-shell grid lg:grid-cols-2 gap-6">
          <div className="glass-panel p-6 text-sm text-[var(--color-muted)]">
            <h2 className="text-2xl text-[var(--color-ink)]">School Information</h2>
            <p className="mt-3">{school.contact.address}, {school.contact.city}, {school.contact.state}</p>
            <p className="mt-1">Phone: {school.contact.phone}</p>
            <p className="mt-1">Email: {school.contact.email}</p>
            <p className="mt-3">Admissions Desk Hours: Mon-Sat, 9:00 AM to 4:30 PM</p>
            <p className="mt-1">Standard Response Time: Within 1 business day for all enquiries.</p>
            <div className="mt-4 rounded-xl overflow-hidden border">
              <iframe
                title="School map"
                src={school.contact.googleMapsEmbed}
                className="w-full h-64"
                loading="lazy"
              />
            </div>
          </div>

          <form className="glass-panel p-6 space-y-3" onSubmit={handleSubmit}>
            <h2 className="text-2xl">Send Enquiry</h2>
            <input required placeholder="Name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} className="w-full border rounded-lg px-4 py-2.5" />
            <input required type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} className="w-full border rounded-lg px-4 py-2.5" />
            <input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} className="w-full border rounded-lg px-4 py-2.5" />
            <input required placeholder="Subject" value={formData.subject} onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))} className="w-full border rounded-lg px-4 py-2.5" />
            <textarea required rows="5" placeholder="Message" value={formData.message} onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))} className="w-full border rounded-lg px-4 py-2.5" />
            <label className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
              <input type="checkbox" checked={Boolean(formData.acceptedPolicies)} onChange={(e) => setFormData((p) => ({ ...p, acceptedPolicies: e.target.checked }))} className="mt-1" />
              <span>I agree to the <Link className="text-[var(--color-primary)] font-semibold" to="/terms">Terms</Link> and <Link className="text-[var(--color-primary)] font-semibold" to="/privacy">Privacy Policy</Link>.</span>
            </label>
            <button className="brand-button" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Submit'}</button>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ContactPage;
