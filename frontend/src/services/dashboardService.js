import apiClient from './api';
export const dashboardService = { summary: async ({ signal } = {}) => (await apiClient.get('/dashboard/summary', { signal })).data.data };
