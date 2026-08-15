import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import { ClipboardProvider } from './contexts/ClipboardContext';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClipboardProvider>
          <App />
        </ClipboardProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
