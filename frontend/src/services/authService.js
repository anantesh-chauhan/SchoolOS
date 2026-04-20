import apiClient from './api';

const roleRoutes = {
  PLATFORM_OWNER: '/dashboard/platform',
  SCHOOL_OWNER: '/dashboard/school',
  ADMIN: '/dashboard/admin',
  TEACHER: '/dashboard/teacher',
  PARENT: '/dashboard/parent',
  STUDENT: '/dashboard/student',
  STAFF: '/dashboard/staff',
};

export const authService = {
  clearLocalSession: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  login: async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, accessToken, refreshToken, user } = response.data.data;
      
      // Store token and user in localStorage
      localStorage.setItem('authToken', accessToken || token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { token: accessToken || token, refreshToken, user };
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      authService.clearLocalSession();
    }
  },

  getMe: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    try {
      return user ? JSON.parse(user) : null;
    } catch (error) {
      localStorage.removeItem('user');
      return null;
    }
  },

  getToken: () => {
    return localStorage.getItem('authToken');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('authToken') && !!localStorage.getItem('user');
  },

  getDashboardRouteByRole: (role) => {
    return roleRoutes[role] || '/login';
  },

  validateSession: async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return null;
    }

    try {
      const me = await authService.getMe();
      localStorage.setItem('user', JSON.stringify(me));
      return me;
    } catch (error) {
      authService.clearLocalSession();
      throw error;
    }
  },
};
