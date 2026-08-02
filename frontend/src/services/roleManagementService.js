import apiClient from './api';

export const roleManagementService = {
  listUsers: async () => (await apiClient.get('/users', { params: { limit: 100 } })).data.data,
  getRoles: async (userId) => (await apiClient.get(`/role-management/staff/${userId}/roles`)).data.data,
  saveRole: async (userId, values) => (await apiClient.put(`/role-management/staff/${userId}/roles`, values)).data,
  revokeRole: async (assignmentId) => (await apiClient.delete(`/role-management/assignments/${assignmentId}`)).data,
  getTemplates: async () => (await apiClient.get('/role-management/templates')).data.data,
  getPolicy: async () => (await apiClient.get('/role-management/separation-of-duties')).data.data,
  savePolicy: async (values) => (await apiClient.put('/role-management/separation-of-duties', values)).data,
};
