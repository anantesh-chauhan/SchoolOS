import apiClient from './api';

export const schoolService = {
  list: async ({ page = 1, limit = 10, search = '' }) => {
    const response = await apiClient.get('/schools', { params: { page, limit, search } });
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/schools', payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/schools/${id}`);
    return response.data;
  },
};

export const classService = {
  list: async () => {
    const response = await apiClient.get('/classes');
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/classes', payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/classes/${id}`);
    return response.data;
  },
};

export const sectionService = {
  list: async (classId) => {
    const response = await apiClient.get('/sections', { params: classId ? { classId } : {} });
    return response.data;
  },
  createNext: async (payload) => {
    const response = await apiClient.post('/sections', payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/sections/${id}`);
    return response.data;
  },
};

export const subjectService = {
  list: async () => {
    const response = await apiClient.get('/subjects');
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/subjects', payload);
    return response.data;
  },
  update: async (id, payload) => {
    const response = await apiClient.put(`/subjects/${id}`, payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/subjects/${id}`);
    return response.data;
  },
  assignToClass: async (payload) => {
    const response = await apiClient.post('/subjects/assign-class', payload);
    return response.data;
  },
  assignToSection: async (payload) => {
    const response = await apiClient.post('/subjects/assign-section', payload);
    return response.data;
  },
  bulkAssignToClass: async (payload) => {
    const response = await apiClient.post('/subjects/assign-class/bulk', payload);
    return response.data;
  },
  unassignFromClass: async (payload) => {
    const response = await apiClient.post('/subjects/unassign-class', payload);
    return response.data;
  },
  unassignFromSection: async (payload) => {
    const response = await apiClient.post('/subjects/unassign-section', payload);
    return response.data;
  },
  classSubjects: async (classId) => {
    const response = await apiClient.get(`/subjects/class/${classId}`);
    return response.data;
  },
  sectionSubjects: async (sectionId) => {
    const response = await apiClient.get(`/subjects/section/${sectionId}`);
    return response.data;
  },
  mappings: async () => {
    const response = await apiClient.get('/subjects/mappings');
    return response.data;
  },
};

export const teacherService = {
  list: async ({ page = 1, limit = 10, search = '', subject = '' } = {}) => {
    const response = await apiClient.get('/teachers', {
      params: { page, limit, search, subject },
    });
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/teachers', payload);
    return response.data;
  },
  update: async (id, payload) => {
    const response = await apiClient.put(`/teachers/${id}`, payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/teachers/${id}`);
    return response.data;
  },
  workload: async (id) => {
    const response = await apiClient.get(`/teachers/${id}/workload`);
    return response.data;
  },
  sectionAssignmentTable: async ({ classId, sectionId }) => {
    const response = await apiClient.get('/teachers/assignments/section', {
      params: { classId, sectionId },
    });
    return response.data;
  },
  bulkSaveAssignments: async (payload) => {
    const response = await apiClient.post('/teachers/assignments/bulk', payload);
    return response.data;
  },
  summary: async (params = {}) => {
    const response = await apiClient.get('/teachers/assignments/summary', { params });
    return response.data;
  },
};
