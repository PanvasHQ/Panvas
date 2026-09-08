import React from 'react';
import ReactDOM from 'react-dom/client';
import { Router, Route, Switch } from 'wouter';
import { usePanvasLocation, isPublicRoute, isDesktop, normalizeBrowserHash } from '@/lib/location';
import { LandingPage } from '@/components/marketing/LandingPage';
import { PrivacyPolicyPage } from '@/components/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/legal/TermsOfServicePage';
import { SecurityPage } from '@/components/legal/SecurityPage';
import { RoadmapPage } from '@/components/marketing/RoadmapPage';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { initAnalytics } from '@/lib/analytics';
import '@/styles/index.css';

// The public page does not need editor engines, auth restoration, or sync startup.
// Keep the existing application intact and load it when the visitor enters it.
const WorkspaceApp = React.lazy(() => {
  const fonts = document.querySelector<HTMLLinkElement>('[data-panvas-editor-fonts]');
  if (fonts?.dataset.href && !fonts.href) {
    fonts.rel = 'stylesheet';
    fonts.href = fonts.dataset.href;
  }
  return Promise.all([import('@/app/App'), import('@/styles/blocks.css')])
    .then(([module]) => ({ default: module.App }));
});

function PublicSurface() {
  return (
    <Router hook={usePanvasLocation}>
      <Switch>
        <Route path="/privacy" component={PrivacyPolicyPage} />
        <Route path="/terms" component={TermsOfServicePage} />
        <Route path="/security" component={SecurityPage} />
        <Route path="/roadmap" component={RoadmapPage} />
        <Route path="/landing" component={LandingPage} />
        <Route path="/app/landing" component={LandingPage} />
        <Route path="/" component={LandingPage} />
        <Route component={LandingPage} />
      </Switch>
    </Router>
  );
}

function EntrySurface() {
  const [route] = usePanvasLocation();
  if (isPublicRoute(route, isDesktop)) {
    return <PublicSurface />;
  }
  return (
    <React.Suspense fallback={<div role="status" style={{ padding: 32 }}>Opening Panvas…</div>}>
      <WorkspaceApp />
    </React.Suspense>
  );
}

export function mountPanvas(): void {
  normalizeBrowserHash();
  // Apply the persisted theme before React paints. Restricted storage contexts
  // must still be able to start with the default theme.
  try {
    const persistedTheme = localStorage.getItem('panvas-theme');
    if (persistedTheme === 'light' || persistedTheme === 'dark' || persistedTheme === 'ink') {
      document.documentElement.classList.remove('dark', 'theme-ink');
      if (persistedTheme === 'dark') document.documentElement.classList.add('dark');
      if (persistedTheme === 'ink') document.documentElement.classList.add('theme-ink');
      void window.panvas?.settings?.setTheme(persistedTheme);
    }
  } catch (error) {
    console.warn('[Panvas] Persisted theme is unavailable:', error);
  }

  initAnalytics();

  // In development and on localhost, ensure service workers never intercept Vite HMR or cache stale code.
  if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      void navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      if ('caches' in window) {
        void caches.keys().then(keys => {
          for (const key of keys) {
            void caches.delete(key);
          }
        });
      }
    } else if (location.protocol === 'https:') {
      window.addEventListener('load', () => {
        void navigator.serviceWorker.register('./service-worker.js').catch(error => {
          console.warn('[Panvas] Offline shell registration failed:', error);
        });
      });
    }
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('Panvas root element is missing.');
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <EntrySurface />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
