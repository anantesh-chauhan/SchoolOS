import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { BrandingProvider } from './contexts/BrandingContext';
import { ThemeProvider } from './contexts/ThemeContext';

const queryClient = new QueryClient({
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrandingProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
