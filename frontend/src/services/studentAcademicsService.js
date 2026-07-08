import apiClient from './api';

export const studentAcademicsService = {
  getMyAcademics: async () => {
    const response = await apiClient.get('/students/me/academics');
    return response.data.data;
  },
};
