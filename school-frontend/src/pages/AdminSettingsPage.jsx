import React from 'react';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient.js';

export const AdminSettingsPage = () => {
  const [form, setForm] = React.useState({
    general: { schoolName: '', tagline: '' },
    contact: { phone: '', email: '', address: '' },
    features: { enableAdmissions: true, enableEvents: true, enableGallery: true },
  });

  React.useEffect(() => {
    apiClient.get('/settings').then((res) => setForm(res.data.data || form)).catch(() => null);
  }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      await apiClient.put('/settings', form);
      toast.success('Settings updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed');
    }
  };

  return (
    <section className="admin-surface p-5">
      <h2 className="text-xl mb-4">Settings</h2>
      <form className="space-y-4" onSubmit={save}>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">School Name
            <input className="w-full border rounded-lg px-3 py-2" value={form.general?.schoolName || ''} onChange={(e) => setForm((p) => ({ ...p, general: { ...(p.general || {}), schoolName: e.target.value } }))} />
          </label>
          <label className="text-sm">Tagline
            <input className="w-full border rounded-lg px-3 py-2" value={form.general?.tagline || ''} onChange={(e) => setForm((p) => ({ ...p, general: { ...(p.general || {}), tagline: e.target.value } }))} />
          </label>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm">Phone
            <input className="w-full border rounded-lg px-3 py-2" value={form.contact?.phone || ''} onChange={(e) => setForm((p) => ({ ...p, contact: { ...(p.contact || {}), phone: e.target.value } }))} />
          </label>
          <label className="text-sm">Email
            <input className="w-full border rounded-lg px-3 py-2" value={form.contact?.email || ''} onChange={(e) => setForm((p) => ({ ...p, contact: { ...(p.contact || {}), email: e.target.value } }))} />
          </label>
          <label className="text-sm">Address
            <input className="w-full border rounded-lg px-3 py-2" value={form.contact?.address || ''} onChange={(e) => setForm((p) => ({ ...p, contact: { ...(p.contact || {}), address: e.target.value } }))} />
          </label>
        </div>

        <button className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white">Save Settings</button>
      </form>

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <label className="text-sm">Admission Journey (JSON)
          <textarea
            rows={10}
            className="admin-input font-mono text-xs"
            value={JSON.stringify(form.admissionJourney || {
              steps: [],
              requiredDocuments: [],
            }, null, 2)}
            onChange={(e) => {
              try {
                setForm((prev) => ({ ...prev, admissionJourney: JSON.parse(e.target.value || '{}') }));
              } catch (_error) {
                // Keep previous valid state until JSON is corrected.
              }
            }}
          />
        </label>

        <label className="text-sm">Fee Config (JSON)
          <textarea
            rows={10}
            className="admin-input font-mono text-xs"
            value={JSON.stringify(form.feeConfig || {
              grades: {},
              transportAnnualFee: 0,
              activityAnnualFee: 0,
            }, null, 2)}
            onChange={(e) => {
              try {
                setForm((prev) => ({ ...prev, feeConfig: JSON.parse(e.target.value || '{}') }));
              } catch (_error) {
                // Keep previous valid state until JSON is corrected.
              }
            }}
          />
        </label>

        <label className="text-sm">Campus Visit Config (JSON)
          <textarea
            rows={10}
            className="admin-input font-mono text-xs"
            value={JSON.stringify(form.campusVisitConfig || {
              visitTypes: [],
              slots: [],
            }, null, 2)}
            onChange={(e) => {
              try {
                setForm((prev) => ({ ...prev, campusVisitConfig: JSON.parse(e.target.value || '{}') }));
              } catch (_error) {
                // Keep previous valid state until JSON is corrected.
              }
            }}
          />
        </label>

        <label className="text-sm">Program Explorer (JSON)
          <textarea
            rows={10}
            className="admin-input font-mono text-xs"
            value={JSON.stringify(form.programExplorer || {
              earlyYears: {},
              primarySchool: {},
              middleSchool: {},
              seniorSecondary: {},
            }, null, 2)}
            onChange={(e) => {
              try {
                setForm((prev) => ({ ...prev, programExplorer: JSON.parse(e.target.value || '{}') }));
              } catch (_error) {
                // Keep previous valid state until JSON is corrected.
              }
            }}
          />
        </label>
      </div>
    </section>
  );
};

export default AdminSettingsPage;
