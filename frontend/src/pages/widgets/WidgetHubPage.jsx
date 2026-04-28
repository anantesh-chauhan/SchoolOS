import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Building2, Check, Clock3, Flame, LayoutGrid, Plus, RefreshCw, Save, Trash2, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import WidgetRenderer from '../../components/widgets/WidgetRenderer';
import { widgetService } from '../../services/widgetService';
import { schoolService } from '../../services/managementService';

const initialTodo = { title: '', description: '', dueDate: '', priority: 'MEDIUM' };
const initialNote = { title: '', content: '', color: '#e0f2fe' };
const initialBookmark = { title: '', url: '', tag: '' };

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function WidgetHubPage() {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(user.schoolId || '');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState({ widgets: [], metrics: {} });
  const [todoForm, setTodoForm] = useState(initialTodo);
  const [noteForm, setNoteForm] = useState(initialNote);
  const [bookmarkForm, setBookmarkForm] = useState(initialBookmark);

  const loadDashboard = async (schoolId) => {
    if (user.role === 'PLATFORM_OWNER' && !schoolId) {
      return;
    }

    setLoading(true);
    try {
      const response = await widgetService.dashboard(schoolId ? { schoolId } : {});
      setDashboard(response.data || { widgets: [], metrics: {} });
      await widgetService.pingLoginStreak(user.role === 'PLATFORM_OWNER' && schoolId ? { schoolId } : {});
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load widgets';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role === 'PLATFORM_OWNER') {
      schoolService.list({ page: 1, limit: 200 }).then((response) => {
        const rows = response.data?.data || [];
        setSchools(rows);
        const fallbackSchoolId = selectedSchoolId || rows[0]?.id || '';
        if (fallbackSchoolId && fallbackSchoolId !== selectedSchoolId) {
          setSelectedSchoolId(fallbackSchoolId);
        }
      }).catch(() => {
        toast.error('Unable to load schools for widget hub');
      });
      return;
    }

    loadDashboard(selectedSchoolId);
  }, []);

  useEffect(() => {
    if (user.role === 'PLATFORM_OWNER' && selectedSchoolId) {
      loadDashboard(selectedSchoolId);
    }
  }, [selectedSchoolId]);

  const refresh = async () => {
    await loadDashboard(selectedSchoolId);
  };

  const withSchoolContext = (payload = {}) => (
    user.role === 'PLATFORM_OWNER' && selectedSchoolId
      ? { ...payload, schoolId: selectedSchoolId }
      : payload
  );

  const saveTodo = async (event) => {
    event.preventDefault();
    try {
      await widgetService.createTodo({
        ...withSchoolContext(),
        ...todoForm,
        dueDate: todoForm.dueDate || null,
      });
      toast.success('Todo saved');
      setTodoForm(initialTodo);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save todo');
    }
  };

  const saveNote = async (event) => {
    event.preventDefault();
    try {
      await widgetService.createNote(withSchoolContext(noteForm));
      toast.success('Note saved');
      setNoteForm(initialNote);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save note');
    }
  };

  const saveBookmark = async (event) => {
    event.preventDefault();
    try {
      await widgetService.createBookmark(withSchoolContext(bookmarkForm));
      toast.success('Bookmark saved');
      setBookmarkForm(initialBookmark);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save bookmark');
    }
  };

  const toggleTodo = async (todo) => {
    try {
      await widgetService.updateTodo(todo.id, { isCompleted: !todo.isCompleted });
      await refresh();
    } catch (error) {
      toast.error('Unable to update todo');
    }
  };

  const removeTodo = async (todo) => {
    try {
      await widgetService.deleteTodo(todo.id);
      await refresh();
    } catch (error) {
      toast.error('Unable to delete todo');
    }
  };

  const markNotificationRead = async (notification) => {
    try {
      await widgetService.markNotificationRead(notification.id);
      await refresh();
    } catch (error) {
      toast.error('Unable to update notification');
    }
  };

  const visibleWidgets = dashboard.widgets || [];
  const metrics = dashboard.metrics || {};
  const todos = dashboard.todos || [];
  const notes = dashboard.notes || [];
  const bookmarks = dashboard.bookmarks || [];
  const notifications = dashboard.notifications || [];
  const activities = dashboard.activities || [];
  const streak = dashboard.streak;

  return (
    <DashboardLayout role={user.role || 'ADMIN'}>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={itemVariants} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/80">
                <LayoutGrid size={14} />
                Universal Widget System
              </div>
              <h1 className="mt-4 text-3xl font-semibold">Widget Hub</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Curated widgets for your role, plus personal tools for tasks, notes, bookmarks, and login streak tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user.role === 'PLATFORM_OWNER' ? (
                <label className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white">
                  <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-white/60">School</span>
                  <select
                    value={selectedSchoolId}
                    onChange={(event) => setSelectedSchoolId(event.target.value)}
                    className="min-w-[240px] bg-transparent text-sm text-white outline-none"
                  >
                    <option value="">Select a school</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id} className="text-slate-900">
                        {school.schoolName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatPill icon={<Building2 size={16} />} label="Students" value={metrics.students || 0} />
          <StatPill icon={<UsersRound size={16} />} label="Teachers" value={metrics.teachers || 0} />
          <StatPill icon={<Clock3 size={16} />} label="Timetables" value={metrics.timetables || 0} />
          <StatPill icon={<Check size={16} />} label="Todos" value={todos.filter((todo) => !todo.isCompleted).length} />
          <StatPill icon={<Flame size={16} />} label="Streak" value={streak?.currentStreak || 0} />
        </motion.div>

        {loading ? (
          <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading widgets...
          </motion.div>
        ) : null}

        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {visibleWidgets.map((widget) => (
            <WidgetRenderer key={widget.key} widget={widget} />
          ))}
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Todos</h2>
                <p className="text-sm text-slate-500">Track small tasks from the hub.</p>
              </div>
              <Plus size={18} className="text-slate-400" />
            </div>

            <form onSubmit={saveTodo} className="space-y-3">
              <input value={todoForm.title} onChange={(event) => setTodoForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Task title" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
              <textarea value={todoForm.description} onChange={(event) => setTodoForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional details" rows="3" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={todoForm.dueDate} onChange={(event) => setTodoForm((prev) => ({ ...prev, dueDate: event.target.value }))} className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
                <select value={todoForm.priority} onChange={(event) => setTodoForm((prev) => ({ ...prev, priority: event.target.value }))} className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                <Save size={16} /> Save Todo
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {todos.map((todo) => (
                <div key={todo.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-medium ${todo.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{todo.title}</p>
                      {todo.description ? <p className="mt-1 text-sm text-slate-500">{todo.description}</p> : null}
                      <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                        {todo.priority} {todo.dueDate ? `• ${new Date(todo.dueDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleTodo(todo)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-white">
                        {todo.isCompleted ? 'Reopen' : 'Done'}
                      </button>
                      <button type="button" onClick={() => removeTodo(todo)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
              <p className="text-sm text-slate-500">Capture ideas and reminders.</p>
            </div>

            <form onSubmit={saveNote} className="space-y-3">
              <input value={noteForm.title} onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Note title" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
              <textarea value={noteForm.content} onChange={(event) => setNoteForm((prev) => ({ ...prev, content: event.target.value }))} placeholder="Write your note" rows="5" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
              <input type="color" value={noteForm.color} onChange={(event) => setNoteForm((prev) => ({ ...prev, color: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 bg-white p-2" />
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                <Save size={16} /> Save Note
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" style={{ borderLeftWidth: '6px', borderLeftColor: note.color || '#38bdf8' }}>
                  <p className="font-medium text-slate-900">{note.title}</p>
                  <p className="mt-1 text-sm text-slate-500 line-clamp-4">{note.content}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Bookmarks</h2>
              <p className="text-sm text-slate-500">Save important links and tools.</p>
            </div>

            <form onSubmit={saveBookmark} className="space-y-3">
              <input value={bookmarkForm.title} onChange={(event) => setBookmarkForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Bookmark title" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
              <input value={bookmarkForm.url} onChange={(event) => setBookmarkForm((prev) => ({ ...prev, url: event.target.value }))} placeholder="https://..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
              <input value={bookmarkForm.tag} onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tag: event.target.value }))} placeholder="Tag" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                <Save size={16} /> Save Bookmark
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {bookmarks.map((bookmark) => (
                <a key={bookmark.id} href={bookmark.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-sky-200 hover:bg-sky-50">
                  <p className="font-medium text-slate-900">{bookmark.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{bookmark.tag || 'Bookmark'}</p>
                </a>
              ))}
            </div>
          </section>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
                <p className="text-sm text-slate-500">Unread and recent alerts.</p>
              </div>
              <BellRing size={18} className="text-slate-400" />
            </div>

            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className={`rounded-2xl border px-4 py-3 ${notification.isRead ? 'border-slate-200 bg-slate-50' : 'border-sky-200 bg-sky-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{notification.body}</p>
                    </div>
                    {!notification.isRead ? (
                      <button type="button" onClick={() => markNotificationRead(notification)} className="rounded-lg border border-sky-200 px-2 py-1 text-xs text-sky-700 hover:bg-white">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-sm text-slate-500">Events captured by the widget system.</p>
            </div>

            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-medium text-slate-900">{activity.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{activity.summary || activity.activityKey}</p>
                </div>
              ))}
            </div>
          </section>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}

function StatPill({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

