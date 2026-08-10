// ============================================
// Panvas — Entry Point
// ============================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import '@/styles/index.css';
import '@/styles/blocks.css';

import { initAnalytics } from '@/lib/analytics';

// Initialize analytics
initAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
