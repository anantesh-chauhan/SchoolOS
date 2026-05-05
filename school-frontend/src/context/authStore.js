import { create } from 'zustand';

const decodeTokenPayload = (token) => {
  if (!token) {
    return null;
  }

  try {
    const parts = String(token).split('.');
    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

const persistedToken = localStorage.getItem('accessToken') || localStorage.getItem('schoolosAccessToken') || null;
const persistedUser = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem('authUser') || 'null');
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    return null;
  }

  const payload = decodeTokenPayload(persistedToken);
  if (!payload?.role) {
    return null;
  }

  return { role: payload.role, id: payload.userId };
})();

/**
 * Auth Store
 * Manages authentication state globally
 */

export const useAuthStore = create((set) => ({
  user: persistedUser,
  accessToken: persistedToken,
  isAuthenticated: !!persistedToken,
  isLoading: false,

  setUser: (user) => {
    if (user) {
      localStorage.setItem('authUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('authUser');
    }

    set({ user: user || null });
  },

  setTokens: (accessToken, refreshToken, user = null) => {
    const payload = decodeTokenPayload(accessToken);
    const resolvedUser = user || (payload?.role ? { role: payload.role, id: payload.userId } : null);

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('schoolosAccessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }

    if (resolvedUser) {
      localStorage.setItem('authUser', JSON.stringify(resolvedUser));
    }

    set({ accessToken, isAuthenticated: true, user: resolvedUser });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('schoolosAccessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));

export default useAuthStore;
