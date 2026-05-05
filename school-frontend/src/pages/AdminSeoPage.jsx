import React from 'react';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient.js';

export const AdminSeoPage = () => {
  const [seo, setSeo] = React.useState({ siteTitle: '', siteDescription: '', siteKeywords: [], ogImage: '' });
  const [keywordsInput, setKeywordsInput] = React.useState('');

  React.useEffect(() => {
    apiClient.get('/settings').then((res) => {
      const value = res.data.data?.seo || seo;
      setSeo(value);
      setKeywordsInput((value.siteKeywords || []).join(', '));
    }).catch(() => null);
  }, []);

  const save = async (event) => {
    event.preventDefault();
    const payload = {
      ...seo,
      siteKeywords: keywordsInput.split(',').map((k) => k.trim()).filter(Boolean),
    };
    try {
      await apiClient.put('/settings/seo', payload);
      toast.success('SEO updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update SEO');
    }
  };

  return (
    <section className="bg-white rounded-xl border p-5">
      <h2 className="text-xl mb-4">SEO Manager</h2>
      <form className="grid md:grid-cols-2 gap-3" onSubmit={save}>
        <label className="text-sm md:col-span-2">Meta Title
          <input className="w-full border rounded-lg px-3 py-2" value={seo.siteTitle || ''} onChange={(e) => setSeo((p) => ({ ...p, siteTitle: e.target.value }))} />
        </label>
        <label className="text-sm md:col-span-2">Meta Description
          <textarea rows="4" className="w-full border rounded-lg px-3 py-2" value={seo.siteDescription || ''} onChange={(e) => setSeo((p) => ({ ...p, siteDescription: e.target.value }))} />
        </label>
        <label className="text-sm md:col-span-2">Meta Keywords (comma-separated)
          <input className="w-full border rounded-lg px-3 py-2" value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} />
        </label>
        <label className="text-sm md:col-span-2">OG Image URL
          <input className="w-full border rounded-lg px-3 py-2" value={seo.ogImage || ''} onChange={(e) => setSeo((p) => ({ ...p, ogImage: e.target.value }))} />
        </label>
        <div className="md:col-span-2">
          <button className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white">Save SEO</button>
        </div>
      </form>
    </section>
  );
};

export default AdminSeoPage;
