import apiClient from './api';

export const chapterFeedbackService = {
  getAdminCompletions: async () => {
    const response = await apiClient.get('/admin/chapter-completions');
    return response.data.data;
  },
  createPoll: async (payload) => {
    const response = await apiClient.post('/admin/chapter-polls', payload);
    return response.data.data;
  },
  getAdminPolls: async (params = {}) => {
    const response = await apiClient.get('/admin/chapter-polls', { params });
    return response.data.data;
  },
  updatePollStatus: async (pollId, status) => {
    const response = await apiClient.patch(`/admin/chapter-polls/${pollId}/status`, { status });
    return response.data.data;
  },
  getRawStatus: async (pollId) => {
    const response = await apiClient.get(`/admin/chapter-polls/${pollId}/raw-status`);
    return response.data.data;
  },
  compilePoll: async (pollId, payload = {}) => {
    const response = await apiClient.post(`/admin/chapter-polls/${pollId}/compile`, payload);
    return response.data.data;
  },
  getAdminAnalysis: async (pollId) => {
    const response = await apiClient.get(`/admin/chapter-analysis/${pollId}`);
    return response.data.data;
  },
  updateAnalysis: async (summaryId, payload) => {
    const response = await apiClient.patch(`/admin/chapter-analysis/${summaryId}`, payload);
    return response.data.data;
  },
  getTeacherPolls: async () => {
    const response = await apiClient.get('/teacher/polls');
    return response.data.data;
  },
  submitTeacherEvaluations: async (pollId, evaluations) => {
    const response = await apiClient.post(`/teacher/polls/${pollId}/student-evaluations`, { evaluations });
    return response.data.data;
  },
  getStudentNotifications: async () => {
    const response = await apiClient.get('/student/notifications');
    return response.data.data;
  },
  getStudentPolls: async () => {
    const response = await apiClient.get('/student/polls');
    return response.data.data;
  },
  submitStudentVote: async (pollId, payload) => {
    const response = await apiClient.post(`/student/polls/${pollId}/vote`, payload);
    return response.data.data;
  },
  getChapterAnalysis: async (chapterId) => {
    const response = await apiClient.get(`/chapters/${chapterId}/analysis`);
    return response.data.data;
  },
};
