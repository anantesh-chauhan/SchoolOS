import apiClient from './api';

export const studentAcademicsService = {
  getDashboard: async () => (await apiClient.get('/student/dashboard')).data.data,
  getAttendance: async () => (await apiClient.get('/student/attendance/summary')).data.data,
  getAttendanceCalendar: async (year, month) => (await apiClient.get('/student/attendance/calendar', { params: { year, month } })).data.data,
  getSubjects: async () => (await apiClient.get('/student/subjects')).data.data,
  getSubject: async (subjectId) => (await apiClient.get(`/student/subjects/${subjectId}`)).data.data,
  getChapter: async (subjectId, chapterId) => (await apiClient.get(`/student/subjects/${subjectId}/chapters/${chapterId}`)).data.data,
  getPendingPolls: async () => (await apiClient.get('/student/polls/pending')).data.data,
  getSubmittedPolls: async () => (await apiClient.get('/student/polls/submitted')).data.data,
  getPoll: async (pollId, submitted = false) => (await apiClient.get(submitted ? `/student/polls/submitted/${pollId}` : `/student/polls/${pollId}`)).data.data,
  submitPoll: async (pollId, payload) => (await apiClient.post(`/student/polls/${pollId}/submit`, payload)).data.data,
  editPoll: async (submissionId, payload) => (await apiClient.patch(`/student/polls/submitted/${submissionId}`, payload)).data.data,
  getMyAcademics: async () => {
    const response = await apiClient.get('/students/me/academics');
    return response.data.data;
  },
};
