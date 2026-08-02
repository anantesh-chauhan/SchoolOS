import { hashKey, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        return failureCount < 2 && (!status || status === 429 || status >= 500);
      },
      retryDelay: (attempt) => Math.min(1000 * (2 ** attempt), 5000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      // Legacy feature queries are automatically isolated even before their
      // visible key is migrated to the factory below.
      queryKeyHashFn: (queryKey) => hashKey(
        queryKey?.[0] === 'schoolos' ? queryKey : workspaceQueryKey(...queryKey),
      ),
    },
    mutations: {
      retry: 0,
    },
  },
});

export const clearPrivateClientState = () => {
  queryClient.cancelQueries();
  queryClient.clear();
};

export const workspaceQueryKey = (...parts) => {
  let scope = ['public', 'anonymous', 'PUBLIC', 'public'];
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    scope = [
      user?.schoolId || 'platform',
      user?.id || user?.studentId || user?.email || 'anonymous',
      user?.activeRole?.role || user?.activeRole || user?.role || 'PUBLIC',
      user?.activeRoleAssignmentId || user?.activeRole?.assignmentId || 'default',
    ];
  } catch { scope = ['unknown', 'unknown', 'UNKNOWN', 'unknown']; }
  return ['schoolos', ...scope, ...parts];
};

export const queryKeys = {
  dashboard: () => workspaceQueryKey('dashboard', 'summary'),
  notifications: (filters = {}) => workspaceQueryKey('communication', 'notifications', filters),
  unreadNotifications: () => workspaceQueryKey('communication', 'notifications', 'unread-count'),
  conversations: (filters = {}) => workspaceQueryKey('communication', 'conversations', filters),
  analytics: (...parts) => workspaceQueryKey('analytics', ...parts),
  reference: (resource, params = {}) => workspaceQueryKey('reference', resource, params),
};
