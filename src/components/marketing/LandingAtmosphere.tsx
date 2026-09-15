import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Atmospheric background using Vanta.js 3D WebGL volumetric clouds.
 * Seamlessly blends with the warm paper tone and handles offscreen throttling,
 * reduced motion, and safe cleanup.
 */
export function LandingAtmosphere() {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || !hostRef.current) return;

    let effect: any = null;
    let cancelled = false;

    const initVanta = async () => {
      try {
        const [three, vantaModule] = await Promise.all([
          import('three'),
          import('vanta/dist/vanta.clouds.min'),
        ]);

        if (cancelled || !hostRef.current) return;

        (window as any).THREE = three;
        const vantaClouds = (vantaModule as any).default?.default || (vantaModule as any).default || vantaModule;

        if (typeof vantaClouds !== 'function') {
          console.warn('[Panvas] Vanta clouds factory is not a function');
          return;
        }

        effect = vantaClouds({
          el: hostRef.current,
          THREE: three,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          backgroundColor: 0xffffff,
          skyColor: 0x68b8d7,
          cloudColor: 0xadc1de,
          cloudShadowColor: 0x183550,
          sunColor: 0xff9919,
          sunGlareColor: 0xff6633,
          sunlightColor: 0xff9933,
          speed: 1.0,
        });

        // Set device pixel ratio reasonably to prevent GPU strain on lower-end devices
        if (effect && effect.renderer) {
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          effect.renderer.setPixelRatio(dpr);
        }
      } catch (err) {
        console.warn('[Panvas] Vanta clouds initialization error:', err);
      }
    };

    void initVanta();

    // Pause when offscreen or document is hidden to conserve GPU/CPU
    let isHeroVisible = true;
    const pause = () => {
      if (effect?.req) {
        window.cancelAnimationFrame(effect.req);
        effect.req = 0;
      }
    };
    const resume = () => {
      if (effect && !document.hidden && isHeroVisible && !effect.req) {
        effect.animationLoop();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) pause();
      else resume();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const heroEl = document.querySelector('.pl-hero');
    let observer: IntersectionObserver | null = null;
    if (heroEl) {
      observer = new IntersectionObserver(([entry]) => {
        isHeroVisible = entry.isIntersecting;
        if (!isHeroVisible) pause();
        else resume();
      }, { threshold: 0.05 });
      observer.observe(heroEl);
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observer?.disconnect();
      if (effect) {
        try {
          effect.destroy();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [reduceMotion]);

  return (
    <div className="pl-atmosphere" aria-hidden="true">
      <div ref={hostRef} className="pl-atmosphere-vanta" />
      <div className="pl-atmosphere-horizon" />
      <div className="pl-atmosphere-halftone" />
      <div className="pl-atmosphere-scrap" />
    </div>
  );
}
