import apiClient from './api';

export const schoolSettingsService = {
  list: async (params = {}) => {
    const response = await apiClient.get('/school-settings', { params });
    return response.data;
  },
  getBySchoolId: async (schoolId) => {
    const response = await apiClient.get(`/school-settings/${schoolId}`);
    return response.data;
  },
  updateBySchoolId: async (schoolId, payload) => {
    const response = await apiClient.patch(`/school-settings/${schoolId}`, payload);
    return response.data;
  },
  getCurrentBranding: async () => {
    const response = await apiClient.get('/school-settings/branding/current');
    return response.data;
  },
  getPublicBranding: async (schoolId) => {
    const response = await apiClient.get('/school-settings/public/branding', { params: { schoolId } });
    return response.data;
  },
};
