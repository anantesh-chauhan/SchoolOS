import apiClient from './api';

const data = (response) => response.data.data;
export const homeworkService = {
  list: (params = {}) => apiClient.get('/homework', { params }).then(data),
  detail: (id, params = {}) => apiClient.get(`/homework/${id}`, { params }).then(data),
  create: (payload) => apiClient.post('/homework', payload).then(data),
  update: (id, payload) => apiClient.patch(`/homework/${id}`, payload).then(data),
  transition: (id, action) => apiClient.post(`/homework/${id}/${action}`).then(data),
  remove: (id) => apiClient.delete(`/homework/${id}`).then(data),
  context: () => apiClient.get('/homework/context').then(data),
  analytics: () => apiClient.get('/homework/analytics').then(data),
  saveDraft: (id, payload) => apiClient.post(`/homework/${id}/submissions/draft`, payload).then(data),
  submit: (id, payload) => apiClient.post(`/homework/${id}/submissions`, payload).then(data),
  submissions: (id, params = {}) => apiClient.get(`/homework/${id}/submissions`, { params }).then(data),
  review: (homeworkId, submissionId, payload) => apiClient.patch(`/homework/${homeworkId}/submissions/${submissionId}/review`, payload).then(data),
  resources: (params = {}) => apiClient.get('/resources', { params }).then(data),
  resource: (id, params = {}) => apiClient.get(`/resources/${id}`, { params }).then(data),
  createResource: (payload) => apiClient.post('/resources', payload).then(data),
  transitionResource: (id, action) => apiClient.post(`/resources/${id}/${action}`).then(data),
  children: () => apiClient.get('/parent/homework-children').then(data),
};

