import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
let isRefreshing = false;
let pendingRequests = [];

const clearSession = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

const subscribeTokenRefresh = (resolve, reject) => {
  pendingRequests.push({ resolve, reject });
};

const settlePendingRequests = (error, newToken) => {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newToken);
  });
  pendingRequests = [];
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Fee summaries and reports can take longer on a cold database connection.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      clearSession();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(
          (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject
        );
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        clearSession();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      const newToken = refreshResponse.data?.data?.accessToken;
      const newRefreshToken = refreshResponse.data?.data?.refreshToken;
      const refreshedUser = refreshResponse.data?.data?.user;

      if (!newToken || !newRefreshToken || !refreshedUser) {
        clearSession();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      localStorage.setItem('authToken', newToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      localStorage.setItem('user', JSON.stringify(refreshedUser));
      settlePendingRequests(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      settlePendingRequests(refreshError);
      clearSession();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Collapse identical concurrent reads into a single network request. This is
// intentionally in-flight only: mutations never risk receiving stale data.
const inFlightGets = new Map();
const originalGet = apiClient.get.bind(apiClient);

const stableSerialize = (value) => {
  if (value === undefined) return '';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(',')}}`;
};

apiClient.get = (url, config = {}) => {
  if (config.dedupe === false || config.signal) return originalGet(url, config);

  const token = localStorage.getItem('authToken') || '';
  const key = `${token}|${url}|${stableSerialize(config.params)}`;
  const existingRequest = inFlightGets.get(key);
  if (existingRequest) return existingRequest;

  const request = originalGet(url, config).finally(() => inFlightGets.delete(key));
  inFlightGets.set(key, request);
  return request;
};

export default apiClient;
