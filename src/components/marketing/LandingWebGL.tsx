import { useEffect, useRef } from 'react';

/**
 * A lightweight, high-performance iridescent specular material layer for the hero stage.
 * Avoids creating a duplicate WebGL context in addition to Vanta Clouds, eliminating GPU stalls
 * and preserving 60fps scrolling while keeping the refined specular light moment.
 */
export function PanvasHeroMaterial() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(max-width: 900px)').matches
    ) {
      return;
    }

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let running = false;

    const startLoop = () => {
      if (running) return;
      running = true;
      const step = () => {
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
          currentX = targetX;
          currentY = targetY;
          el.style.setProperty('--sheen-x', `${currentX.toFixed(1)}px`);
          el.style.setProperty('--sheen-y', `${currentY.toFixed(1)}px`);
          running = false;
          frame = 0;
          return;
        }
        currentX += dx * 0.08;
        currentY += dy * 0.08;
        el.style.setProperty('--sheen-x', `${currentX.toFixed(1)}px`);
        el.style.setProperty('--sheen-y', `${currentY.toFixed(1)}px`);
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 20;
      targetY = ((e.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 20;
      startLoop();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return <div ref={ref} className="pl-hero-material pl-hero-sheen" aria-hidden="true" />;
}

