// ============================================
// Panvas — Keyboard Shortcut Manager
// ============================================

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  category?: string;
}

export function matchesShortcut(e: KeyboardEvent, shortcut: Shortcut): boolean {
  const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = shortcut.alt ? e.altKey : !e.altKey;
  const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

  return ctrlMatch && shiftMatch && altMatch && keyMatch;
}

export function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}
