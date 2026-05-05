import React from 'react';
import apiClient from '../utils/apiClient.js';
import toast from 'react-hot-toast';

export const AdminCareerApplicationsPage = () => {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(10);
  const [pagination, setPagination] = React.useState({ total: 0, pages: 1 });
  const [updatingId, setUpdatingId] = React.useState('');

  const fetchApplications = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/careers/applications/all', {
        params: {
          page,
          limit,
          status,
          search: query,
        },
      });
      setItems(response.data.data || []);
      setPagination(response.data.pagination || { total: 0, pages: 1 });
    } catch (error) {
      setItems([]);
      setPagination({ total: 0, pages: 1 });
      toast.error(error.response?.data?.message || 'Unable to load applications');
    } finally {
      setLoading(false);
    }
  }, [page, limit, status, query]);

  React.useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleStatusUpdate = async (applicationId, nextStatus) => {
    try {
      setUpdatingId(applicationId);
      await apiClient.patch(`/careers/applications/${applicationId}/status`, { status: nextStatus });
      toast.success(`Status updated to ${labelFromStatus(nextStatus)}`);
      await fetchApplications();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Status update failed');
    } finally {
      setUpdatingId('');
    }
  };

  const totalPages = Math.max(1, pagination.pages || 1);

  return (
    <section className="admin-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl">Career Applications</h2>
          <p className="text-sm text-[var(--color-muted)]">Track applicant pipeline with quick status actions.</p>
        </div>
        <span className="text-sm rounded-full px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          Total: {pagination.total || 0}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search by applicant, email or phone"
          className="md:col-span-2 border border-black/15 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          className="border border-black/15 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interview_scheduled">Interview Scheduled</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="overflow-auto rounded-lg border border-black/10">
        <table className="w-full text-sm bg-white">
          <thead>
            <tr className="border-b bg-black/[0.02]">
              <th className="text-left py-2">Applicant</th>
              <th className="text-left py-2">Email</th>
              <th className="text-left py-2">Phone</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Resume</th>
              <th className="text-left py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-5 text-center text-[var(--color-muted)]">Loading applications...</td>
              </tr>
            ) : null}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-5 text-center text-[var(--color-muted)]">No applications found.</td>
              </tr>
            ) : null}
            {!loading && items.map((item) => (
              <tr key={item._id} className="border-b align-top">
                <td className="py-2 pr-2 font-medium">{item.applicantName}</td>
                <td className="py-2 pr-2">{item.email}</td>
                <td className="py-2 pr-2">{item.phone || '-'}</td>
                <td className="py-2 pr-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass(item.status)}`}>
                    {labelFromStatus(item.status)}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  {item.resumeUrl ? <a href={item.resumeUrl} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] underline">Open</a> : '-'}
                </td>
                <td className="py-2 pr-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={updatingId === item._id}
                      onClick={() => handleStatusUpdate(item._id, 'shortlisted')}
                      className="px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 disabled:opacity-50"
                    >
                      Shortlist
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item._id}
                      onClick={() => handleStatusUpdate(item._id, 'interview_scheduled')}
                      className="px-2.5 py-1 rounded-lg border border-sky-200 text-sky-700 bg-sky-50 disabled:opacity-50"
                    >
                      Interview
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item._id}
                      onClick={() => handleStatusUpdate(item._id, 'rejected')}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <p className="text-[var(--color-muted)]">Page {page} of {totalPages}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="px-3 py-1.5 rounded-lg border border-black/15 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="px-3 py-1.5 rounded-lg border border-black/15 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

const labelFromStatus = (status) => {
  if (status === 'interview_scheduled') return 'Interview Scheduled';
  if (status === 'shortlisted') return 'Shortlisted';
  if (status === 'rejected') return 'Rejected';
  if (status === 'reviewed') return 'Reviewed';
  return 'New';
};

const statusClass = (status) => {
  if (status === 'shortlisted') return 'bg-emerald-100 text-emerald-700';
  if (status === 'interview_scheduled') return 'bg-sky-100 text-sky-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  if (status === 'reviewed') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
};

export default AdminCareerApplicationsPage;
