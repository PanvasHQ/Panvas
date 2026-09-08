import { useEffect } from 'react';

/** One scheduler for document choreography; work is limited to visible scenes. */
export function useLandingChoreography() {
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.querySelector<HTMLElement>('.panvas-site');
    if (!root) return;
    const scenes = [...root.querySelectorAll<HTMLElement>('[data-scroll-scene]')];
    const active = new Set<HTMLElement>();
    let frame = 0;
    const update = () => {
      frame = 0;
      for (const scene of active) {
        const bounds = scene.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (innerHeight - bounds.top) / (innerHeight + bounds.height)));
        const values = [...scene.querySelectorAll<HTMLElement>('[data-parallax]')];
        for (const el of values) {
          const distance = Number(el.dataset.parallax || 0);
          el.style.translate = reduced.matches ? 'none' : `0 ${(p - .5) * distance}px`;
        }
        scene.querySelectorAll<SVGPathElement>('.pl-flow-packet').forEach(path => { path.style.strokeDashoffset = String(-p * 2); });
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(entries => { entries.forEach(entry => { const scene = entry.target as HTMLElement; scene.dataset.visible = String(entry.isIntersecting); if (entry.isIntersecting) active.add(scene); else active.delete(scene); }); schedule(); }, { rootMargin: '120px' });
    scenes.forEach(scene => observer.observe(scene));
    window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule); reduced.addEventListener('change', schedule);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); reduced.removeEventListener('change', schedule); };
  }, []);
}

export function FlowPath({ d }: { d: string }) {
  return <><path className="pl-flow-track" d={d} /><path className="pl-flow-packet" d={d} pathLength={1} /><path className="pl-flow-tip" d={d} pathLength={1} /></>;
}
