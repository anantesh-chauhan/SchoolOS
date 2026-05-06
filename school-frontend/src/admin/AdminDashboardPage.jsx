import React from 'react';
import apiClient from '../utils/apiClient.js';
import { FiCalendar, FiClipboard, FiImage, FiMail, FiTarget, FiUsers } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import useSchoolStore from '../store/schoolStore.js';
import { schoolPath } from '../utils/schoolPath.js';

const cards = [
  { key: 'visitors', label: 'Total Visitors', endpoint: '/events', icon: FiTarget },
  { key: 'enquiries', label: 'Admission Enquiries', endpoint: '/admissions', icon: FiClipboard },
  { key: 'upcomingEvents', label: 'Upcoming Events', endpoint: '/events', icon: FiCalendar },
  { key: 'recentUpdates', label: 'Recent Updates', endpoint: '/notices', icon: FiMail },
  { key: 'faculty', label: 'Faculty Profiles', endpoint: '/faculty', icon: FiUsers },
  { key: 'gallery', label: 'Gallery Albums', endpoint: '/gallery', icon: FiImage },
];

export const AdminDashboardPage = () => {
  const [stats, setStats] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const schoolSlug = useSchoolStore((state) => state.schoolSlug);

  React.useEffect(() => {
    setLoading(true);

    apiClient
      .get('/platform/admin/summary')
      .then((res) => {
        setStats(res.data?.data || {});
      })
      .catch(() => {
        setStats({});
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <section>
      <div className="admin-surface p-5 mb-4">
        <h2 className="text-xl">CMS Performance Snapshot</h2>
        <p className="text-sm text-gray-500 mt-2">Track content velocity, admission demand, enquiry trends, and communication activity from one place.</p>
      </div>

      <div className="admin-surface p-5 mb-4">
        <h3 className="text-lg">Quick Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={schoolPath('/admin/pages', schoolSlug)} className="px-3 py-2 rounded-lg border border-black/10 text-sm">Pages</Link>
          <Link to={schoolPath('/admin/faculty', schoolSlug)} className="px-3 py-2 rounded-lg border border-black/10 text-sm">Faculty</Link>
          <Link to={schoolPath('/admin/events', schoolSlug)} className="px-3 py-2 rounded-lg border border-black/10 text-sm">Events</Link>
          <Link to={schoolPath('/admin/gallery', schoolSlug)} className="px-3 py-2 rounded-lg border border-black/10 text-sm">Gallery</Link>
          <Link to={schoolPath('/admin/media', schoolSlug)} className="px-3 py-2 rounded-lg border border-black/10 text-sm">Media</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <article key={card.key} className="admin-surface p-5">
            <card.icon className="text-[var(--color-primary)]" />
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl mt-2 font-semibold">{loading ? '...' : (stats[card.key] ?? 0)}</p>
          </article>
        ))}
      </div>

      <div className="admin-surface p-5 mt-5">
        <h3 className="text-lg mb-3">Recent Changes</h3>
        {(stats.recentChanges || []).length === 0 ? (
          <p className="text-sm text-gray-500">No recent CMS write activity found.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(stats.recentChanges || []).map((item) => (
              <li key={item._id} className="flex items-center justify-between border-b border-black/5 pb-2">
                <span className="capitalize">{item.action} {item.resource}</span>
                <span className="text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default AdminDashboardPage;
