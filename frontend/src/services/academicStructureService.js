import apiClient from './api';

export const ACADEMIC_STRUCTURE_QUERY_KEY = ['academic-structure'];

export const academicStructureService = {
  list: async () => {
    const response = await apiClient.get('/academic-structure');
    return response.data;
  },
  bootstrap: async () => {
    const response = await apiClient.post('/academic-structure/bootstrap');
    return response.data;
  },
  validate: async () => {
    const response = await apiClient.get('/academic-structure/validate');
    return response.data;
  },
};
