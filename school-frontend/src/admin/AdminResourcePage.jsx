import React from 'react';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient.js';
import { adminModuleConfigs } from './adminConfigs.js';

export const AdminResourcePage = ({ moduleKey }) => {
  const config = adminModuleConfigs[moduleKey];
  const [items, setItems] = React.useState([]);
  const [form, setForm] = React.useState(config.defaults);
  const [editingId, setEditingId] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const pageSize = 8;

  const load = React.useCallback(async () => {
    const response = await apiClient.get(config.endpoint);
    setItems(response.data.data || []);
  }, [config.endpoint]);

  React.useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiClient.put(`${config.endpoint}/${editingId}`, form);
        toast.success('Updated successfully');
      } else {
        await apiClient.post(config.endpoint, form);
        toast.success('Created successfully');
      }
      setForm(config.defaults);
      setEditingId(null);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const exportAdmissions = async () => {
    try {
      const response = await apiClient.get('/admissions/export/csv', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'admission-leads.csv';
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Admissions leads exported');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Export failed');
    }
  };

  const onEdit = (item) => {
    setEditingId(item[config.idKey]);
    setForm(config.fields.reduce((acc, field) => ({ ...acc, [field]: item[field] ?? '' }), { ...item }));
  };

  const onDelete = async (id) => {
    try {
      await apiClient.delete(`${config.endpoint}/${id}`);
      toast.success('Deleted');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const searched = items.filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));
  const paginated = searched.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(searched.length / pageSize));

  return (
    <section className="space-y-6">
      <div className="admin-surface p-5">
        <h2 className="admin-section-title mb-4">{config.label}</h2>
        <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-3">
          {config.fields.map((field) => (
            <label key={field} className="text-sm">
              <span className="block mb-1 capitalize">{field}</span>
              {typeof form[field] === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={Boolean(form[field])}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.checked }))}
                />
              ) : typeof form[field] === 'number' ? (
                <input
                  type="number"
                  value={form[field] ?? 0}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field]: Number(event.target.value || 0) }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              ) : typeof form[field] === 'object' ? (
                <textarea
                  rows={4}
                  value={JSON.stringify(form[field] || {}, null, 2)}
                  onChange={(event) => {
                    try {
                      const parsed = JSON.parse(event.target.value || '{}');
                      setForm((prev) => ({ ...prev, [field]: parsed }));
                    } catch (_error) {
                      // Ignore invalid JSON edits until parsable.
                    }
                  }}
                  className="w-full border rounded-lg px-3 py-2 font-mono text-xs"
                />
              ) : (
                <input
                  value={form[field] ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                  className="admin-input"
                />
              )}
            </label>
          ))}
          <div className="md:col-span-2 flex gap-2 mt-2">
            <button className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white" type="submit">
              {editingId ? 'Update' : 'Create'}
            </button>
            {editingId ? (
              <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => { setEditingId(null); setForm(config.defaults); }}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="admin-surface p-5">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
          <input
            placeholder="Search records"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm w-full md:w-72"
          />
          <div className="flex items-center gap-2">
            {moduleKey === 'admissions' ? (
              <button className="px-3 py-2 border rounded-lg text-sm" onClick={exportAdmissions}>Export CSV</button>
            ) : null}
            <div className="text-sm text-gray-500">{searched.length} records</div>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {config.fields.map((field) => <th key={field} className="text-left py-2 pr-3 capitalize">{field}</th>)}
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((item) => (
                <tr key={item[config.idKey]} className="border-b">
                  {config.fields.map((field) => <td key={field} className="py-2 pr-3">{String(item[field] ?? '-')}</td>)}
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 border rounded" onClick={() => onEdit(item)}>Edit</button>
                      <button className="px-2 py-1 border rounded text-red-600" onClick={() => onDelete(item[config.idKey])}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button className="px-3 py-1 border rounded" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="text-sm">{page} / {totalPages}</span>
          <button className="px-3 py-1 border rounded" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </section>
  );
};

export default AdminResourcePage;
