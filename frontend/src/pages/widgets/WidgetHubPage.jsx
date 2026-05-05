 import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Building2, Check, Clock3, Flame, LayoutGrid, Plus, RefreshCw, Save, Sparkles, Trash2, UsersRound } from 'lucide-react';
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
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
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
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 pb-12">
        {/* Premium Command Center Header */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-950 p-8 text-white shadow-2xl">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sky-500/10 blur-[100px]" />
          <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px]" />
          
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-sky-400">
                <Sparkles size={12} />
                Mission Control
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Widget Hub</h1>
              <p className="mt-2 max-w-2xl text-base text-slate-400 font-light">
                Synchronized intelligence and productivity tools for your institution's daily operations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user.role === 'PLATFORM_OWNER' ? (
                <label className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-5 py-2.5 transition-all hover:border-white/20 focus-within:ring-2 focus-within:ring-sky-500/40">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">Context School</span>
                  <select
                    value={selectedSchoolId}
                    onChange={(event) => setSelectedSchoolId(event.target.value)}
                    className="min-w-[200px] bg-transparent text-sm font-medium text-white outline-none pt-0.5"
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
                className="inline-flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-95"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Sync Data
              </button>
            </div>
          </div>
        </motion.div>

        {/* High-Contrast Analytics Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
          <StatPill icon={<Building2 size={16} />} label="Students" value={metrics.students || 0} />
          <StatPill icon={<UsersRound size={16} />} label="Teachers" value={metrics.teachers || 0} />
          <StatPill icon={<Clock3 size={16} />} label="Timetables" value={metrics.timetables || 0} />
          <StatPill icon={<Check size={16} />} label="Pending Tasks" value={todos.filter((todo) => !todo.isCompleted).length} />
          <StatPill icon={<Flame size={16} className="text-orange-500" />} label="Login Streak" value={streak?.currentStreak || 0} />
        </motion.div>

        {/* Dynamic Widget Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {visibleWidgets.map((widget) => (
            <WidgetRenderer key={widget.key} widget={widget} />
          ))}
        </motion.div>

        {/* Personal Productivity Suite */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="group rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Daily Tasks</h2>
                <p className="text-sm text-slate-500 font-medium">Capture immediate actions.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-500 transition-colors">
                <Check size={20} />
              </div>
            </div>

            <form onSubmit={saveTodo} className="space-y-4">
              <input value={todoForm.title} onChange={(event) => setTodoForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="What needs to be done?" className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm transition-all focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/5 outline-none" />
              <textarea value={todoForm.description} onChange={(event) => setTodoForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Context (optional)" rows="2" className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm transition-all focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/5 outline-none resize-none" />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={todoForm.dueDate} onChange={(event) => setTodoForm((prev) => ({ ...prev, dueDate: event.target.value }))} className="rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-3 text-sm outline-none focus:border-sky-500 focus:bg-white transition-all" />
                <select value={todoForm.priority} onChange={(event) => setTodoForm((prev) => ({ ...prev, priority: event.target.value }))} className="rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-3 text-sm outline-none focus:border-sky-500 focus:bg-white transition-all">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <button type="submit" className="w-full inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98]">
                <Plus size={18} /> Add Task
              </button>
            </form>

            <div className="mt-8 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {todos.map((todo) => (
                <div key={todo.id} className="group/item rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-sky-100 hover:bg-sky-50/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-bold ${todo.isCompleted ? 'text-slate-400 line-through font-normal' : 'text-slate-900'}`}>{todo.title}</p>
                      {todo.description ? <p className="mt-1 text-sm text-slate-500">{todo.description}</p> : null}
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {todo.priority} {todo.dueDate ? `• ${new Date(todo.dueDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => toggleTodo(todo)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase transition-all hover:border-sky-500 hover:text-sky-600">
                        {todo.isCompleted ? 'Undo' : 'Done'}
                      </button>
                      <button type="button" onClick={() => removeTodo(todo)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-rose-100 text-rose-500 transition-all hover:bg-rose-500 hover:text-white opacity-0 group-hover/item:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {todos.length === 0 && <p className="py-8 text-center text-sm text-slate-400 italic">Clear schedule for now.</p>}
            </div>
          </section>

          <section className="group rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Brain Dump</h2>
                <p className="text-sm text-slate-500 font-medium">Archive your thoughts.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                <Plus size={20} />
              </div>
            </div>

            <form onSubmit={saveNote} className="space-y-4">
              <input value={noteForm.title} onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Title" className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm transition-all focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/5 outline-none" />
              <textarea value={noteForm.content} onChange={(event) => setNoteForm((prev) => ({ ...prev, content: event.target.value }))} placeholder="Content..." rows="4" className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm transition-all focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/5 outline-none resize-none" />
              <div className="flex items-center gap-3">
                <input type="color" value={noteForm.color} onChange={(event) => setNoteForm((prev) => ({ ...prev, color: event.target.value }))} className="h-12 w-14 shrink-0 rounded-xl border-none bg-transparent cursor-pointer" />
                <button type="submit" className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white transition-all hover:bg-slate-800">
                  <Plus size={18} /> Create Note
                </button>
              </div>
            </form>

            <div className="mt-8 grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {notes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md" style={{ borderLeftWidth: '5px', borderLeftColor: note.color || '#38bdf8' }}>
                  <p className="text-sm font-bold text-slate-900">{note.title}</p>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-3">{note.content}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="py-8 text-center text-sm text-slate-400 italic">No notes created.</p>}
            </div>
          </section>

          <section className="group rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Knowledge Hub</h2>
                <p className="text-sm text-slate-500 font-medium">Quick access shortcuts.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                <Plus size={20} />
              </div>
            </div>

            <form onSubmit={saveBookmark} className="space-y-4">
              <input value={bookmarkForm.title} onChange={(event) => setBookmarkForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Shortcut Name" className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all" />
              <input value={bookmarkForm.url} onChange={(event) => setBookmarkForm((prev) => ({ ...prev, url: event.target.value }))} placeholder="https://resource-link.com" className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all" />
              <input value={bookmarkForm.tag} onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tag: event.target.value }))} placeholder="Category (e.g. Tools)" className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all" />
              <button type="submit" className="w-full inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-bold text-white transition-all hover:bg-slate-800">
                <Plus size={18} /> Pin Bookmark
              </button>
            </form>

            <div className="mt-8 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {bookmarks.map((bookmark) => (
                <a key={bookmark.id} href={bookmark.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-emerald-500 hover:bg-emerald-50/30 hover:-translate-y-0.5">
                  <p className="text-sm font-bold text-slate-900">{bookmark.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">{bookmark.tag || 'Bookmark'}</p>
                </a>
              ))}
              {bookmarks.length === 0 && <p className="py-8 text-center text-sm text-slate-400 italic">No bookmarks saved.</p>}
            </div>
          </section>
        </motion.div>

        {/* Activity & Notifications */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Notifications</h2>
                <p className="text-sm text-slate-500 font-medium">Recent security and academic alerts.</p>
              </div>
              <div className="relative">
                <BellRing size={24} className="text-slate-300" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-sky-500 ring-2 ring-white" />
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {notifications.map((notification) => (
                <div key={notification.id} className={`group rounded-3xl border p-5 transition-all ${notification.isRead ? 'border-slate-100 bg-slate-50/50 opacity-60' : 'border-sky-100 bg-sky-50/30'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-500 leading-relaxed">{notification.body}</p>
                    </div>
                    {!notification.isRead ? (
                      <button type="button" onClick={() => markNotificationRead(notification)} className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-sky-600 transition-all hover:bg-sky-600 hover:text-white">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <p className="py-12 text-center text-sm text-slate-400 font-medium">No new notifications.</p>}
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">System Pulse</h2>
                <p className="text-sm text-slate-500 font-medium">Live audit trail of platform events.</p>
              </div>
              <RefreshCw size={24} className="text-slate-300" />
            </div>

            <div className="mt-8 space-y-6">
              {activities.map((activity) => (
                <div key={activity.id} className="relative pl-6 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-slate-300">
                  <p className="text-sm font-bold text-slate-900">{activity.title}</p>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">{activity.summary || activity.activityKey}</p>
                </div>
              ))}
              {activities.length === 0 && <p className="py-12 text-center text-sm text-slate-400 font-medium">System idle.</p>}
            </div>
          </section>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}

function StatPill({ icon, label, value }) {
  return (
    <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-sky-200 hover:shadow-xl hover:shadow-sky-500/5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-all group-hover:bg-sky-500 group-hover:text-white group-hover:scale-110">{icon}</div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
