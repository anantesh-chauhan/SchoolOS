import apiClient from './api';

export const curriculumService = {
  overview: async () => (await apiClient.get('/curriculum/overview')).data,
  curricula: async () => (await apiClient.get('/curriculum')).data,
  academicContext: async () => (await apiClient.get('/curriculum/academic-context')).data,
  createCurriculum: async (payload) => (await apiClient.post('/curriculum', payload)).data,
  publishers: async () => (await apiClient.get('/curriculum/publishers')).data,
  savePublisher: async (payload) => (await apiClient.post('/curriculum/publishers', payload)).data,
  books: async () => (await apiClient.get('/curriculum/books')).data,
  createBook: async (payload) => (await apiClient.post('/curriculum/books', payload)).data,
  createChapter: async (payload) => (await apiClient.post('/curriculum/chapters', payload)).data,
  chapters: async (params = {}) => (await apiClient.get('/curriculum/chapters', { params })).data,
  createUnit: async (payload) => (await apiClient.post('/curriculum/units', payload)).data,
  publish: async (versionId) => (await apiClient.post('/curriculum/publish', { versionId })).data,
  audit: async () => (await apiClient.get('/curriculum/audit')).data,
};

export default curriculumService;
