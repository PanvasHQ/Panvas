import { useEffect } from 'react';

/** Keep the document and its tool dock above the software keyboard. */
export function useMobileVisualViewport(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      if (viewport.scale !== 1) return;
      root.style.setProperty('--panvas-visual-height', `${viewport.height}px`);
      root.style.setProperty('--panvas-keyboard-inset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.isContentEditable) {
        const box = focused.getBoundingClientRect();
        if (box.bottom > viewport.height - 110) focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--panvas-visual-height');
      root.style.removeProperty('--panvas-keyboard-inset');
    };
  }, [enabled]);
}
