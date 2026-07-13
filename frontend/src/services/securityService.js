import apiClient from './api';

export const securityService = {
  credentials: async (params = {}) => (await apiClient.get('/admin/users/credentials', { params })).data,
  resetPassword: async (accountKey, payload) => (await apiClient.post(`/admin/users/${encodeURIComponent(accountKey)}/reset-password`, payload)).data,
  unlock: async (accountKey) => (await apiClient.post(`/admin/users/${encodeURIComponent(accountKey)}/unlock`)).data,
  settings: async () => (await apiClient.get('/profile/security')).data,
  configureQuestions: async (payload) => (await apiClient.post('/profile/security-questions', payload)).data,
  startRecovery: async (identifier) => (await apiClient.post('/auth/recovery/start', { identifier })).data,
  verifyRecovery: async (payload) => (await apiClient.post('/auth/recovery/verify', payload)).data,
  completeRecovery: async (payload) => (await apiClient.post('/auth/recovery/reset-password', payload)).data,
};

export default securityService;
