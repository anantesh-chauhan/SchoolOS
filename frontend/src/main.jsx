import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { BrandingProvider } from './contexts/BrandingContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { queryClient } from './lib/queryClient';

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
