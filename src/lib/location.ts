import { useBrowserLocation } from 'wouter/use-browser-location';
import { useHashLocation } from 'wouter/use-hash-location';

export const isDesktopEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.panvas ||
    window.location.protocol === 'file:' ||
    (typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent))
  );
};

export const isDesktop = isDesktopEnvironment();

// Adaptive location hook: HTML5 pushState on the web, hash-based on desktop Electron
export const usePanvasLocation = isDesktop ? useHashLocation : useBrowserLocation;

export const isPublicRoute = (route: string, desktop: boolean = isDesktop): boolean => {
  if (desktop) {
    return route === '/landing' || route === '/app/landing';
  }
  return (
    route === '/' ||
    route === '/landing' ||
    route === '/app/landing' ||
    route === '/download' ||
    route === '/privacy' ||
    route === '/terms' ||
    route === '/security' ||
    route === '/roadmap'
  );
};

export function normalizeBrowserHash(): void {
  if (isDesktop || typeof window === 'undefined') return;
  const hash = window.location.hash;
  if (hash.startsWith('#/')) {
    const cleanPath = hash.slice(1);
    window.history.replaceState(null, '', cleanPath + window.location.search);
  }

  // Handle incoming hash navigation on web dynamically
  window.addEventListener('hashchange', () => {
    const nextHash = window.location.hash;
    if (nextHash.startsWith('#/')) {
      const clean = nextHash.slice(1);
      window.history.replaceState(null, '', clean + window.location.search);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
}

