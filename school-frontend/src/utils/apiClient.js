import axios from 'axios';
import { getSchoolConfig } from '../config/schoolConfig.js';

/**
 * API Configuration and Client
 * Centralized API communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api/v1';
const activeSchool = getSchoolConfig();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-school-id': localStorage.getItem('schoolId') || activeSchool.schoolId,
  },
  timeout: 10000,
});

const isAdminPath = () => {
  try {
    return String(window.location.pathname || '').startsWith('/admin');
  } catch {
    return false;
  }
};

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let refreshPromise = null;

const runSilentRefresh = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }

    const schoolId = localStorage.getItem('schoolId') || activeSchool.schoolId;
    const response = await refreshClient.post(
      '/auth/refresh-token',
      { refreshToken },
      { headers: { 'x-school-id': schoolId } }
    );

    const authData = response.data?.data || {};
    if (!authData.accessToken || !authData.refreshToken) {
      throw new Error('Refresh response missing tokens');
    }

    localStorage.setItem('accessToken', authData.accessToken);
    localStorage.setItem('schoolosAccessToken', authData.accessToken);
    localStorage.setItem('refreshToken', authData.refreshToken);
    if (authData.user) {
      localStorage.setItem('authUser', JSON.stringify(authData.user));
    }

    return authData.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

// Request interceptor - Add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('schoolosAccessToken');
  const schoolId = localStorage.getItem('schoolId') || activeSchool.schoolId;

  config.headers['x-school-id'] = schoolId;
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const requestUrl = String(error.config?.url || '');
    const isAuthAttempt = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register') || requestUrl.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !isAuthAttempt && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const nextAccessToken = await runSilentRefresh();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        return await apiClient(originalRequest);
      } catch {
        // Fall through to logout redirect below.
      }
    }

    if (error.response?.status === 401 && !isAuthAttempt) {
      // Handle unauthorized - clear token and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('schoolosAccessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      if (isAdminPath()) {
        window.location.href = '/admin/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
