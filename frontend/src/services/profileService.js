import apiClient from './api';

export const profileService = {
  getMyProfile: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },
  updateMyProfile: async (payload) => {
    const response = await apiClient.put('/users/me', payload);
    return response.data;
  },
  changePassword: async (payload) => {
    const response = await apiClient.put('/users/change-password', payload);
    return response.data;
  },
};

export default profileService;
