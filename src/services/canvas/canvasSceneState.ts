import { normalizeCanvasColor } from '../../components/canvas/canvasBackgrounds.ts';

export type CanvasEditorThemeMode = 'system' | 'light' | 'dark';

export const CANVAS_EDITOR_THEME_KEY = 'panvas.canvas.editorTheme';
export const PANVAS_CANVAS_DEFAULT_BACKGROUND = '#f7f1e3';

const PERSISTED_APP_STATE_KEYS = [
  'viewBackgroundColor', 'zoom', 'scrollX', 'scrollY', 'gridSize',
  'objectsSnapModeEnabled', 'isBindingEnabled', 'viewModeEnabled', 'zenModeEnabled', 'theme',
  'currentItemStrokeColor', 'currentItemBackgroundColor', 'currentItemFillStyle',
  'currentItemStrokeWidth', 'currentItemStrokeStyle', 'currentItemRoughness',
  'currentItemOpacity', 'currentItemFontFamily', 'currentItemFontSize',
  'currentItemTextAlign', 'currentItemStartArrowhead', 'currentItemEndArrowhead',
  'exportBackground', 'exportEmbedScene', 'exportWithDarkMode', 'exportScale',
] as const;

export function readCanvasEditorThemeMode(value: string | null): CanvasEditorThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveCanvasEditorTheme(mode: CanvasEditorThemeMode, panvasTheme: string): 'light' | 'dark' {
  return mode === 'system' ? (panvasTheme === 'dark' ? 'dark' : 'light') : mode;
}

/** Resolve document background without consulting application/editor theme. */
export function resolveCanvasDocumentBackground(appState: Record<string, unknown> = {}): string {
  const value = typeof appState.viewBackgroundColor === 'string'
    ? normalizeCanvasColor(appState.viewBackgroundColor)
    : null;
  return value ?? PANVAS_CANVAS_DEFAULT_BACKGROUND;
}

export function mergeCanvasAppStateForPersistence(previous: Record<string, unknown> = {}, current: Record<string, unknown> = {}) {
  const merged = { ...previous };
  for (const key of PERSISTED_APP_STATE_KEYS) {
    if (current[key] !== undefined) merged[key] = current[key];
  }
  return merged;
}

export function createCanvasInitialAppState(appState: Record<string, unknown> = {}, theme: 'light' | 'dark') {
  const { isLibraryOpen: _isLibraryOpen, isLibraryMenuDocked: _isLibraryMenuDocked, ...safeState } = appState;
  return {
    ...safeState,
    theme,
    viewBackgroundColor: resolveCanvasDocumentBackground(safeState),
  };
}

export function isSafeCanvasEmbedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isTrustedExcalidrawLibraryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.origin === 'https://libraries.excalidraw.com'
      && !url.username
      && !url.password
      && url.pathname.toLowerCase().endsWith('.excalidrawlib');
  } catch {
    return false;
  }
}

export function canvasDownloadName(name: string | null | undefined, extension: string): string {
  const base = (name || 'panvas-canvas').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'panvas-canvas';
  return `${base}.${extension}`;
}
