import apiClient from './api';

const data = (response) => response.data.data;
export const NOTIFICATIONS_CHANGED_EVENT = 'schoolos:notifications-changed';
const notificationsChanged = (result) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
  return result;
};
export const communicationService = {
  notifications: (params = {}, signal) => apiClient.get('/notifications', { params, signal }).then(data),
  unreadCount: (signal) => apiClient.get('/notifications/unread-count', { signal }).then(data),
  notification: (id) => apiClient.get(`/notifications/${id}`).then(data),
  read: (id) => apiClient.patch(`/notifications/${id}/read`).then(data).then(notificationsChanged),
  readAll: () => apiClient.patch('/notifications/read-all').then(data).then(notificationsChanged),
  acknowledge: (id, note = '') => apiClient.patch(`/notifications/${id}/acknowledge`, { note }).then(data).then(notificationsChanged),
  archive: (id) => apiClient.patch(`/notifications/${id}/archive`).then(data).then(notificationsChanged),
  announcements: (params = {}) => apiClient.get('/announcements', { params }).then(data),
  announcement: (id) => apiClient.get(`/announcements/${id}`).then(data),
  createAnnouncement: (payload) => apiClient.post('/announcements', payload).then(data),
  updateAnnouncement: (id, payload) => apiClient.patch(`/announcements/${id}`, payload).then(data),
  publishAnnouncement: (id) => apiClient.post(`/announcements/${id}/publish`).then(data),
  cancelAnnouncement: (id) => apiClient.post(`/announcements/${id}/cancel`).then(data),
  announcementAnalytics: (id) => apiClient.get(`/announcements/${id}/analytics`).then(data),
  conversations: (params = {}, signal) => apiClient.get('/conversations', { params, signal }).then(data),
  conversation: (id) => apiClient.get(`/conversations/${id}`).then(data),
  createConversation: (payload) => apiClient.post('/conversations', payload).then(data),
  sendMessage: (id, payload) => apiClient.post(`/conversations/${id}/messages`, payload).then(data),
  readConversation: (id) => apiClient.patch(`/conversations/${id}/read`).then(data).then(notificationsChanged),
  closeConversation: (id) => apiClient.post(`/conversations/${id}/close`).then(data),
  directory: (params = {}) => apiClient.get('/communication/recipients', { params }).then(data),
  audienceOptions: () => apiClient.get('/communication/audience-options').then(data),
  preferences: () => apiClient.get('/notification-preferences').then(data),
  updatePreferences: (preferences) => apiClient.patch('/notification-preferences', { preferences }).then(data),
  templates: () => apiClient.get('/notification-templates').then(data),
  policy: () => apiClient.get('/communication-policy').then(data),
  updatePolicy: (payload) => apiClient.patch('/communication-policy', payload).then(data),
  summary: () => apiClient.get('/admin/communication/summary').then(data),
  delivery: (params = {}) => apiClient.get('/admin/communication/delivery', { params }).then(data),
};
