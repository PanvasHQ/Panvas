import { useEffect, type RefObject } from 'react';

/**
 * Shared dismissal contract for small contextual panels that do not need a
 * modal focus trap. It keeps local controls predictable: Escape and an
 * outside pointer always return the user to the writing surface.
 */
export function useDismissibleLayer(open: boolean, ref: RefObject<HTMLElement>, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onDismiss, ref]);
}
