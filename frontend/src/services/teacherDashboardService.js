import apiClient from './api';

export const teacherDashboardService = {
  getDashboard: async () => {
    const response = await apiClient.get('/teacher/dashboard');
    return response.data.data;
  },

  getAssignments: async () => {
    const response = await apiClient.get('/teacher/assignments');
    return response.data.data;
  },

  getChapters: async ({ sectionId, subjectId }) => {
    const response = await apiClient.get(`/teacher/sections/${sectionId}/subjects/${subjectId}/chapters`);
    return response.data.data;
  },

  updateProgress: async (payload) => {
    const response = await apiClient.patch('/teacher/progress', payload);
    return response.data.data;
  },

  getResources: async (params = {}) => {
    const response = await apiClient.get('/teacher/resources', { params });
    return response.data.data;
  },

  createResource: async (payload) => {
    const response = await apiClient.post('/teacher/resources', payload);
    return response.data.data;
  },

  updateResource: async (resourceId, payload) => {
    const response = await apiClient.patch(`/teacher/resources/${resourceId}`, payload);
    return response.data.data;
  },

  deleteResource: async (resourceId) => {
    const response = await apiClient.delete(`/teacher/resources/${resourceId}`);
    return response.data;
  },
};
