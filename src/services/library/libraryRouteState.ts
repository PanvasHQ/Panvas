import type { LibraryView } from '@/components/library/libraryModel';

const LAST_APP_ROUTE_KEY = 'panvas.lastAppRoute';
const LAST_LIBRARY_VIEW_KEY = 'panvas.libraryView';
const INITIAL_LANDING_KEY = 'panvas.initialLandingHandled';

export type RestorableAppRoute = '/app' | '/app/library';

export function readLastAppRoute(): RestorableAppRoute {
  try {
    return window.localStorage.getItem(LAST_APP_ROUTE_KEY) === '/app/library' ? '/app/library' : '/app';
  } catch {
    return '/app';
  }
}

export function rememberAppRoute(location: string): void {
  if (location !== '/app' && location !== '/app/library') return;
  try {
    window.localStorage.setItem(LAST_APP_ROUTE_KEY, location);
  } catch {
    // Route restoration is best-effort in restricted browser contexts.
  }
}

export function readLastLibraryView(): LibraryView {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const isHandled = window.sessionStorage.getItem(INITIAL_LANDING_KEY) === 'true';
      if (!isHandled) {
        try {
          window.sessionStorage.setItem(INITIAL_LANDING_KEY, 'true');
        } catch {}
        return 'recent';
      }
    }
    const stored = window.localStorage.getItem(LAST_LIBRARY_VIEW_KEY);
    if (stored === 'recent' || stored === 'favorites' || stored === 'trash' || stored === 'cloud') return stored;
    if (stored === 'recent' || stored === 'favorites' || stored === 'trash' || stored === 'cloud' || stored === 'library') {
      return stored;
    }
  } catch {
    // Fall back to the ordinary Library projection.
    // Fall back to recent
  }
  return 'library';
  return 'recent';
}

export const writeLastLibraryView = rememberLibraryView;

export function rememberLibraryView(view: LibraryView): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(INITIAL_LANDING_KEY, 'true');
    }
    window.localStorage.setItem(LAST_LIBRARY_VIEW_KEY, view);
  } catch {
    // Browse-state restoration is best-effort.
  }
}

export function navigateToLibraryView(view: LibraryView): void {
  rememberLibraryView(view);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('panvas:set-library-view', { detail: view }));
  }
}
