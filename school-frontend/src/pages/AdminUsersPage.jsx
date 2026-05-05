import React from 'react';
import toast from 'react-hot-toast';
import { FiMail, FiTrash2, FiUserPlus } from 'react-icons/fi';
import apiClient from '../utils/apiClient.js';

const defaultForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'content_editor',
  password: 'School@123',
};

export const AdminUsersPage = () => {
  const [users, setUsers] = React.useState([]);
  const [form, setForm] = React.useState(defaultForm);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    apiClient.get('/users').then((res) => setUsers(res.data.data || [])).catch(() => setUsers([]));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const createUser = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      await apiClient.post('/users', form);
      toast.success('User created');
      setForm(defaultForm);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create user');
    } finally {
      setLoading(false);
    }
  };

  const removeUser = async (userId) => {
    try {
      await apiClient.delete(`/users/${userId}`);
      toast.success('User removed');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const sendMessage = async (email) => {
    try {
      await apiClient.post('/messaging/send', {
        channel: 'email',
        recipients: [email],
        subject: 'School Portal Update',
        message: 'Hello, this is an important update from the school administration. Please check your dashboard for latest notices.',
      });
      toast.success('Notification queued');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Message failed');
    }
  };

  const filtered = users.filter((user) => (`${user.firstName} ${user.lastName} ${user.email}`).toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="space-y-6">
      <form className="admin-surface p-5 grid md:grid-cols-3 gap-3" onSubmit={createUser}>
        <h2 className="md:col-span-3 text-xl flex items-center gap-2"><FiUserPlus /> User Management</h2>
        <input required placeholder="First Name" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} className="border rounded-lg px-3 py-2" />
        <input required placeholder="Last Name" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} className="border rounded-lg px-3 py-2" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="border rounded-lg px-3 py-2" />
        <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="border rounded-lg px-3 py-2">
          <option value="content_editor">Content Editor</option>
          <option value="school_admin">School Admin</option>
        </select>
        <input required type="text" placeholder="Temporary Password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="border rounded-lg px-3 py-2" />
        <button disabled={loading} className="bg-[var(--color-primary)] text-white rounded-lg px-3 py-2">{loading ? 'Creating...' : 'Create User'}</button>
      </form>

      <div className="admin-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-lg">Registered Users</h3>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" className="border rounded-lg px-3 py-2 text-sm w-full md:w-72" />
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Email</th>
                <th className="text-left py-2">Role</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user._id} className="border-b">
                  <td className="py-2">{user.firstName} {user.lastName}</td>
                  <td className="py-2">{user.email}</td>
                  <td className="py-2 capitalize">{String(user.role).replace('_', ' ')}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={() => sendMessage(user.email)} className="px-2 py-1 border rounded text-sky-700 inline-flex items-center gap-1"><FiMail /> Message</button>
                      <button onClick={() => removeUser(user._id)} className="px-2 py-1 border rounded text-rose-700 inline-flex items-center gap-1"><FiTrash2 /> Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default AdminUsersPage;
