import apiClient from './api';

const data = (request) => request.then((response) => response.data.data);
export const hrService = {
  dashboard: () => data(apiClient.get('/hr/dashboard')),
  employees: (params) => data(apiClient.get('/hr/employees', { params })),
  employee: (id) => data(apiClient.get(`/hr/employees/${id}`)),
  me: () => data(apiClient.get('/hr/employees/me')),
  createEmployee: (payload) => data(apiClient.post('/hr/employees', payload)),
  updateEmployee: (id, payload) => data(apiClient.patch(`/hr/employees/${id}`, payload)),
  attendance: (params) => data(apiClient.get('/hr/attendance', { params })),
  saveAttendance: (records) => data(apiClient.post('/hr/attendance/bulk', { records })),
  leaves: (params) => data(apiClient.get('/hr/leaves', { params })),
  applyLeave: (payload) => data(apiClient.post('/hr/leaves', payload)),
  reviewLeave: (id, payload) => data(apiClient.patch(`/hr/leaves/${id}/review`, payload)),
  policy: () => data(apiClient.get('/hr/policy')),
  savePolicy: (payload) => data(apiClient.put('/hr/policy', payload)),
  payroll: (month) => data(apiClient.get('/hr/payroll', { params: { month } })),
  generatePayroll: (payload) => data(apiClient.post('/hr/payroll/generate', payload)),
  updatePayroll: (id, payload) => data(apiClient.patch(`/hr/payroll/${id}`, payload)),
  payslipUrl: (id) => `/hr/payroll/${id}/payslip`,
  downloadPayslip: async (id, number) => { const response = await apiClient.get(`/hr/payroll/${id}/payslip`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = `${number}.pdf`; link.click(); URL.revokeObjectURL(url); },
  downloadReport: async (month) => { const response = await apiClient.get('/hr/reports/salary-register', { params: { month, format: 'csv' }, responseType: 'blob' }); const url=URL.createObjectURL(response.data); const link=document.createElement('a'); link.href=url; link.download=`salary-register-${month}.csv`; link.click(); URL.revokeObjectURL(url); },
};
