import apiClient from './api';

export const studentService = {
  allocationRoster: async (params = {}, signal) => (await apiClient.get('/students/allocation/roster', { params, signal })).data,
  allocate: async (id, payload) => (await apiClient.put(`/students/${id}/allocation`, payload)).data,
  remove: async (id) => (await apiClient.delete(`/students/${id}`)).data,
};
