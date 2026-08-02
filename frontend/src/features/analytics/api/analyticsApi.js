import api from '../../../services/api';

const data = (response) => response.data.data;
const query = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined));
const report = (path, params) => api.get(path, { params: query(params), responseType: 'blob' }).then((response) => response.data);

export const saveReport = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
};

export const analyticsApi = {
  students: (params) => api.get('/analytics/students', { params: query(params) }).then(data),
  student: (studentId, params, signal) => api.get(`/analytics/students/${studentId}/overview`, { params: query(params), signal }).then(data),
  subject: (studentId, subjectId, params, signal) => api.get(`/analytics/students/${studentId}/subjects/${subjectId}`, { params: query(params), signal }).then(data),
  chapter: (studentId, subjectId, chapterId, params, signal) => api.get(`/analytics/students/${studentId}/subjects/${subjectId}/chapters/${chapterId}`, { params: query(params), signal }).then(data),
  configuration: () => api.get('/analytics/configuration').then(data),
  updateConfiguration: (payload) => api.patch('/analytics/configuration', payload).then(data),
  createIntervention: (payload) => api.post('/analytics/interventions', payload).then(data),
  updateIntervention: (id, payload) => api.patch(`/analytics/interventions/${id}`, payload).then(data),
  createSnapshot: (payload) => api.post('/analytics/snapshots', payload).then(data),
  schoolOverview: (params) => api.get('/analytics/school/overview', { params: query(params) }).then(data),
  classOverview: (classId, params) => api.get(`/analytics/classes/${classId}`, { params: query(params) }).then(data),
  sectionOverview: (sectionId, params) => api.get(`/analytics/sections/${sectionId}`, { params: query(params) }).then(data),
  studentReport: (studentId, format, params) => report(`/analytics/reports/students/${studentId}.${format}`, params),
  subjectReport: (studentId, subjectId, format, params) => report(`/analytics/reports/students/${studentId}/subjects/${subjectId}.${format}`, params),
  chapterReport: (studentId, subjectId, chapterId, format, params) => report(`/analytics/reports/students/${studentId}/subjects/${subjectId}/chapters/${chapterId}.${format}`, params),
  schoolReport: (format, params) => report(`/analytics/reports/school.${format}`, params),
  classReport: (classId, format, params) => report(`/analytics/reports/classes/${classId}.${format}`, params),
  sectionReport: (sectionId, format, params) => report(`/analytics/reports/sections/${sectionId}.${format}`, params),
  riskRules: () => api.get('/analytics/risk-rules').then(data),
  updateRiskRule: (id, payload) => api.patch(`/analytics/risk-rules/${id}`, payload).then(data),
};
