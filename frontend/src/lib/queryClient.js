import { QueryClient } from '@tanstack/react-query';

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
