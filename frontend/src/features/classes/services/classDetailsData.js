import apiClient from '../../../services/api';

export const classDetailsDataService = {
  async getDashboardPayload({ classId, sectionId }) {
    const response = await apiClient.get('/academic-structure/class-dashboard', {
      params: { classId, sectionId },
    });

    return response.data?.data || { meta: null, subjects: [], students: [] };
  },
};

