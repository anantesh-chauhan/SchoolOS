import apiClient from './api';

export const widgetService = {
  catalog: async (params = {}) => {
    const response = await apiClient.get('/widgets/catalog', { params });
    return response.data;
  },
  dashboard: async (params = {}) => {
    const response = await apiClient.get('/widgets/dashboard', { params });
    return response.data;
  },
  savePreferences: async (payload) => {
    const response = await apiClient.put('/widgets/preferences', payload);
    return response.data;
  },
  pingLoginStreak: async (payload = {}) => {
    const response = await apiClient.post('/widgets/login-streak/ping', payload);
    return response.data;
  },
  listTodos: async () => {
    const response = await apiClient.get('/widgets/todos');
    return response.data;
  },
  createTodo: async (payload) => {
    const response = await apiClient.post('/widgets/todos', payload);
    return response.data;
  },
  updateTodo: async (id, payload) => {
    const response = await apiClient.patch(`/widgets/todos/${id}`, payload);
    return response.data;
  },
  deleteTodo: async (id) => {
    const response = await apiClient.delete(`/widgets/todos/${id}`);
    return response.data;
  },
  listNotes: async () => {
    const response = await apiClient.get('/widgets/notes');
    return response.data;
  },
  createNote: async (payload) => {
    const response = await apiClient.post('/widgets/notes', payload);
    return response.data;
  },
  updateNote: async (id, payload) => {
    const response = await apiClient.patch(`/widgets/notes/${id}`, payload);
    return response.data;
  },
  deleteNote: async (id) => {
    const response = await apiClient.delete(`/widgets/notes/${id}`);
    return response.data;
  },
  listBookmarks: async () => {
    const response = await apiClient.get('/widgets/bookmarks');
    return response.data;
  },
  createBookmark: async (payload) => {
    const response = await apiClient.post('/widgets/bookmarks', payload);
    return response.data;
  },
  updateBookmark: async (id, payload) => {
    const response = await apiClient.patch(`/widgets/bookmarks/${id}`, payload);
    return response.data;
  },
  deleteBookmark: async (id) => {
    const response = await apiClient.delete(`/widgets/bookmarks/${id}`);
    return response.data;
  },
  listNotifications: async () => {
    const response = await apiClient.get('/widgets/notifications');
    return response.data;
  },
  markNotificationRead: async (id) => {
    const response = await apiClient.patch(`/widgets/notifications/${id}/read`);
    return response.data;
  },
  listActivities: async () => {
    const response = await apiClient.get('/widgets/activity');
    return response.data;
  },
  listSystemContent: async () => {
    const response = await apiClient.get('/widgets/system-content');
    return response.data;
  },
  upsertSystemContent: async (payload, id = null) => {
    const response = await apiClient[id ? 'patch' : 'post'](
      id ? `/widgets/system-content/${id}` : '/widgets/system-content',
      payload
    );
    return response.data;
  },
  deleteSystemContent: async (id) => {
    const response = await apiClient.delete(`/widgets/system-content/${id}`);
    return response.data;
  },
};
