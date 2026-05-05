import React from 'react';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient.js';

export const AdminMessagingPage = () => {
  const [form, setForm] = React.useState({ channel: 'website', recipients: '', subject: '', message: '' });
  const [logs, setLogs] = React.useState([]);

  const load = React.useCallback(() => {
    apiClient.get('/messaging').then((res) => setLogs(res.data.data || [])).catch(() => setLogs([]));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const send = async (event) => {
    event.preventDefault();
    try {
      await apiClient.post('/messaging/send', {
        ...form,
        recipients: form.recipients.split(',').map((v) => v.trim()).filter(Boolean),
      });
      toast.success('Message queued/sent');
      setForm({ channel: 'website', recipients: '', subject: '', message: '' });
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send');
    }
  };

  return (
    <section className="space-y-6">
      <form className="admin-surface p-5 grid md:grid-cols-2 gap-3" onSubmit={send}>
        <h2 className="admin-section-title md:col-span-2">Messaging Center</h2>
        <label className="text-sm">Channel
          <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
            <option value="website">Website Notification</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="text-sm">Recipients (comma-separated)
          <input value={form.recipients} onChange={(e) => setForm((p) => ({ ...p, recipients: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm md:col-span-2">Subject
          <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm md:col-span-2">Message
          <textarea rows="5" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} className="w-full border rounded-lg px-3 py-2" required />
        </label>
        <div className="md:col-span-2"><button className="brand-button">Send</button></div>
      </form>

      <div className="admin-surface p-5">
        <h3 className="admin-section-title mb-3">Message Logs</h3>
        <div className="space-y-2">
          {logs.map((log) => (
            <article key={log._id} className="border rounded-lg p-3 text-sm">
              <p><strong>{log.channel.toUpperCase()}</strong> - {log.status}</p>
              <p className="text-gray-500">{log.subject}</p>
              <p className="text-gray-500">{log.message}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AdminMessagingPage;
