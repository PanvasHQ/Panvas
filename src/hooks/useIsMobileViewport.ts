import { useEffect, useState } from 'react';

/** Default phone query shared by the responsive shell; callers may opt into
 * the tablet breakpoint for compact composition decisions. */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 599px)';

export function useIsMobileViewport(maxWidth = 599): boolean {
  const mediaQuery = maxWidth === 599 ? MOBILE_VIEWPORT_QUERY : `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(mediaQuery).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(mediaQuery);
    const update = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [mediaQuery]);

  return isMobile;
}
