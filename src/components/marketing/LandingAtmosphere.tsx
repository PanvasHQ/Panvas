import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type NavigatorWithHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

export function LandingAtmosphere() {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [enhanced, setEnhanced] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 899px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 899px)');
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const nav = navigator as NavigatorWithHints;
    const skipWebGl = reduceMotion
      || nav.connection?.saveData
      || compact
      || !hasWebGl();

    setEnhanced(false);
    if (skipWebGl || !hostRef.current) return;

    let effect: import('vanta/dist/vanta.clouds.min').VantaCloudsInstance | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        const [three, cloudsModule] = await Promise.all([
          import('three'),
          import('vanta/dist/vanta.clouds.min'),
        ]);
        if (cancelled || !hostRef.current) return;

        effect = cloudsModule.default({
          el: hostRef.current,
          THREE: three,
          backgroundColor: 0xe8f4f8,
          skyColor: 0x60b0d4,
          cloudColor: 0xbcd0e8,
          cloudShadowColor: 0x647f9a,
          sunColor: 0xffefd0,
          sunGlareColor: 0xffe9be,
          sunlightColor: 0xfff3db,
          speed: 0.3,
          scale: 2.2,
          scaleMobile: 3.0,
          mouseControls: false,
          touchControls: false,
          gyroControls: false,
        });
        if (effect && (effect as any).renderer) {
          const lowPower = navigator.hardwareConcurrency <= 4 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
          (effect as any).renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 0.7 : 1));
        }
        setEnhanced(true);
        if (document.hidden || !isHeroVisible) pause();
      } catch (error) {
        console.warn('[Panvas] Atmospheric WebGL enhancement unavailable; using CSS fallback.', error);
      }
    };

    // Let the actual product capture decode before loading the decorative scene.
    const startTimer = window.setTimeout(() => { void start(); }, 1600);

    let isHeroVisible = true;
    const pause = () => {
      if (!effect) return;
      if (effect.req) {
        window.cancelAnimationFrame(effect.req);
        effect.req = 0;
      }
    };

    const resume = () => {
      if (!effect) return;
      if (!document.hidden && isHeroVisible && !effect.req) {
        effect.animationLoop();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) pause();
      else resume();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    let heroObserver: IntersectionObserver | null = null;
    const heroEl = document.querySelector('.pl-hero');
    if (heroEl) {
      heroObserver = new IntersectionObserver(([entry]) => {
        isHeroVisible = entry.isIntersecting;
        if (!isHeroVisible) pause();
        else resume();
      }, { threshold: 0.05 });
      heroObserver.observe(heroEl);
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      heroObserver?.disconnect();
      window.clearTimeout(startTimer);
      effect?.destroy();
    };
  }, [reduceMotion, compact]);

  return (
    <div className={'pl-atmosphere' + (enhanced ? ' is-enhanced' : '')} aria-hidden="true">
      <div ref={hostRef} className="pl-atmosphere-vanta" />
      <div className="pl-atmosphere-fallback" />
      <div className="pl-atmosphere-sun" />
      <div className="pl-atmosphere-horizon" />
      <div className="pl-atmosphere-halftone" />
      <div className="pl-atmosphere-scrap" />
    </div>
  );
}
