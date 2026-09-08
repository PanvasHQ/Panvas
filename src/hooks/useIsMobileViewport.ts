import { useEffect, useState } from 'react';

/**
 * Mobile viewport threshold shared by the responsive shell work. Phones
 * only — desktop and tablet layouts must never see this become true, so
 * keep the value aligned with the max-[599px] Tailwind variants.
 */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 599px)';

export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}
