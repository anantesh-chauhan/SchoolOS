import apiClient from './api';
const data=(p)=>p.then(r=>r.data.data);
export const issueReportService={
  create:(payload)=>data(apiClient.post('/issue-reports',payload)), mine:(params)=>data(apiClient.get('/issue-reports/my',{params})), myById:(id)=>data(apiClient.get(`/issue-reports/my/${id}`)),
  all:(params)=>data(apiClient.get('/platform/issue-reports',{params})), byId:(id)=>data(apiClient.get(`/platform/issue-reports/${id}`)), analytics:()=>data(apiClient.get('/platform/issue-reports/analytics')),
  status:(id,status)=>data(apiClient.patch(`/platform/issue-reports/${id}/status`,{status})), priority:(id,priority)=>data(apiClient.patch(`/platform/issue-reports/${id}/priority`,{priority})), assign:(id,assignedToId)=>data(apiClient.patch(`/platform/issue-reports/${id}/assign`,{assignedToId})), resolve:(id,resolutionNote)=>data(apiClient.patch(`/platform/issue-reports/${id}/resolve`,{resolutionNote})),
  reply:(id,message)=>data(apiClient.post(`/issue-reports/${id}/messages`,{message})), internalNote:(id,note)=>data(apiClient.post(`/platform/issue-reports/${id}/internal-notes`,{note})), remove:(id)=>data(apiClient.delete(`/platform/issue-reports/${id}`)),
};
