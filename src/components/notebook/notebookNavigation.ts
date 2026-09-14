export type NotebookViewMode = 'edit' | 'read' | 'present';

const EDITABLE_OR_CONTROL_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable="true"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[data-notebook-navigation-ignore="true"]',
  '.ProseMirror',
].join(',');

export interface NotebookNavigationEvent {
  key: string;
  code?: string;
  defaultPrevented?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}

export function shouldNotebookHandleNavigationKey(event: NotebookNavigationEvent): boolean {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target as (EventTarget & { closest?: (selector: string) => unknown }) | null | undefined;
  if (!target || typeof target.closest !== 'function') return true;
  return target.closest(EDITABLE_OR_CONTROL_SELECTOR) === null;
}

export function resolveNotebookNavigationDelta(
  event: Pick<NotebookNavigationEvent, 'key' | 'code' | 'shiftKey'>,
  mode: NotebookViewMode,
  viewportHeight: number,
): number | null {
  const pageStep = Math.max(160, Math.round(viewportHeight * 0.86));
  if (mode === 'present') {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown') return pageStep;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp') return -pageStep;
    if (event.code === 'Space' || event.key === ' ') return event.shiftKey ? -pageStep : pageStep;
    return null;
  }
  if (event.key === 'ArrowDown') return 56;
  if (event.key === 'ArrowUp') return -56;
  if (event.key === 'PageDown') return pageStep;
  if (event.key === 'PageUp') return -pageStep;
  return null;
}
