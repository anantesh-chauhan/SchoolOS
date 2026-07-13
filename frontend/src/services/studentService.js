import apiClient from './api';

export const studentService = {
  allocationRoster: async () => (await apiClient.get('/students/allocation/roster')).data,
  allocate: async (id, payload) => (await apiClient.put(`/students/${id}/allocation`, payload)).data,
  remove: async (id) => (await apiClient.delete(`/students/${id}`)).data,
};
