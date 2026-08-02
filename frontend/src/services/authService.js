import apiClient from './api';
import { clearPrivateClientState } from '../lib/queryClient';

const roleRoutes = Object.fromEntries([
  'PLATFORM_OWNER', 'SCHOOL_OWNER', 'PRINCIPAL', 'EXAM_COORDINATOR', 'EXAM_CONTROLLER',
  'ADMIN', 'TEACHER', 'CLASS_TEACHER', 'PARENT', 'STUDENT', 'STAFF',
  'CURRICULUM_MANAGER', 'FEE_MANAGER', 'HR', 'HR_MANAGER',
].map((role) => [role, '/workspace/home']));

const persistSession = ({ token, accessToken, refreshToken, user }) => {
  localStorage.setItem('authToken', accessToken || token);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('schoolos:workspace-changed', { detail: user }));
  return { token: accessToken || token, refreshToken, user };
};

export const authService = {
  clearLocalSession: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('schoolosInstantAccounts');
    clearPrivateClientState();
  },

  login: async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email: String(email || '').trim().toLowerCase(), password });
      const { token, accessToken, refreshToken, user } = response.data.data;
      
      // Store token and user in localStorage
      return persistSession({ token, accessToken, refreshToken, user });
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  loginStudent: async (studentUserId, password) => {
    try {
      const response = await apiClient.post('/auth/login-student', { 
        email: String(studentUserId || '').trim().toLowerCase(),
        password 
      });
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

  loginParent: async (parentUserId, password) => {
    try {
      const response = await apiClient.post('/auth/login-parent', { 
        email: String(parentUserId || '').trim().toLowerCase(),
        password 
      });
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

  switchRole: async (roleAssignmentId, { setDefault = false } = {}) => {
    try {
      const response = await apiClient.post('/auth/switch-role', { roleAssignmentId, setDefault });
      const session = persistSession(response.data.data);
      clearPrivateClientState();
      return { ...session, message: response.data.message };
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getPostLoginRoute: (user) => {
    if (user?.requiresWorkspaceSelection && user?.availableRoles?.length > 1) return '/choose-workspace';
    return roleRoutes[String(user?.role || user?.activeRole?.role || '').trim().toUpperCase()] || '/login';
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
    return roleRoutes[String(role || '').trim().toUpperCase()] || '/login';
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

  getDemoAccounts: async () => {
    const response = await apiClient.get('/auth/demo-accounts');
    return response.data.data;
  },

  instantLogin: async (accountKey) => {
    try {
      const response = await apiClient.post('/auth/instant-login', { accountKey });
      const { token, accessToken, refreshToken, user } = response.data.data;
      return persistSession({ token, accessToken, refreshToken, user });
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};
