import apiClient from './api';
export const dashboardService = { summary: async () => (await apiClient.get('/dashboard/summary')).data.data };
