import apiClient from './api';

export const galleryService = {
  listGroups: async (params = {}) => {
    const response = await apiClient.get('/gallery/groups', { params });
    return response.data;
  },
  createGroup: async (payload) => {
    const response = await apiClient.post('/gallery/groups', payload);
    return response.data;
  },
  updateGroup: async (id, payload) => {
    const response = await apiClient.put(`/gallery/groups/${id}`, payload);
    return response.data;
  },
  deleteGroup: async (id) => {
    const response = await apiClient.delete(`/gallery/groups/${id}`);
    return response.data;
  },
  reorderGroups: async (order) => {
    const response = await apiClient.patch('/gallery/groups/reorder', { order });
    return response.data;
  },
  listPhotos: async (groupId, params = {}) => {
    const response = await apiClient.get(`/gallery/groups/${groupId}/photos`, { params });
    return response.data;
  },
  createPhotos: async (groupId, photos) => {
    const response = await apiClient.post(`/gallery/groups/${groupId}/photos`, { photos });
    return response.data;
  },
  updatePhoto: async (id, payload) => {
    const response = await apiClient.put(`/gallery/photos/${id}`, payload);
    return response.data;
  },
  deletePhoto: async (id) => {
    const response = await apiClient.delete(`/gallery/photos/${id}`);
    return response.data;
  },
  reorderPhotos: async (groupId, order) => {
    const response = await apiClient.patch(`/gallery/groups/${groupId}/photos/reorder`, { order });
    return response.data;
  },
  listPublicGroups: async (schoolId) => {
    const response = await apiClient.get('/gallery/public/groups', { params: { schoolId } });
    return response.data;
  },
  listPublicPhotos: async (groupId, schoolId) => {
    const response = await apiClient.get(`/gallery/public/groups/${groupId}/photos`, { params: { schoolId } });
    return response.data;
  },
};
