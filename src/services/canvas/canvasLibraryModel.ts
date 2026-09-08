export const PERSONAL_LIBRARY_FILE = 'personal.excalidrawlib';
export const MAX_LIBRARY_ITEMS = 10_000;
export const MAX_LIBRARY_CHARACTERS = 25 * 1024 * 1024;

export interface CanvasLibraryRecord {
  fileName: string;
  name: string;
  libraryItems: readonly unknown[];
  updatedAt: number;
  size: number;
}

export interface ExcalidrawLibraryPayload {
  type: 'excalidrawlib';
  version: 2;
  source: 'panvas';
  libraryItems: readonly unknown[];
}

export function requireLibraryFileName(fileName: unknown): asserts fileName is string {
  if (
    typeof fileName !== 'string'
    || fileName.length > 160
    || !/^[A-Za-z0-9][A-Za-z0-9 _.-]*\.excalidrawlib$/i.test(fileName)
    || fileName.includes('..')
  ) {
    throw new Error('Invalid Excalidraw library file name.');
  }
}

export function parseExcalidrawLibrary(contents: string): readonly unknown[] {
  if (typeof contents !== 'string' || contents.length === 0 || contents.length > MAX_LIBRARY_CHARACTERS) {
    throw new Error('Invalid or oversized Excalidraw library.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  const libraryItems = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? ((parsed as { libraryItems?: unknown; library?: unknown }).libraryItems
        ?? (parsed as { library?: unknown }).library)
      : null;

  if (!Array.isArray(libraryItems) || libraryItems.length > MAX_LIBRARY_ITEMS) {
    throw new Error('The selected file is not a valid Excalidraw library.');
  }

  for (const item of libraryItems) {
    const validLegacyItem = Array.isArray(item);
    const validCurrentItem = Boolean(
      item
      && typeof item === 'object'
      && !Array.isArray(item)
      && Array.isArray((item as { elements?: unknown }).elements),
    );
    if (!validLegacyItem && !validCurrentItem) {
      throw new Error('The Excalidraw library contains an invalid item.');
    }
  }

  return libraryItems;
}

export function serializeExcalidrawLibrary(libraryItems: readonly unknown[]): string {
  if (!Array.isArray(libraryItems) || libraryItems.length > MAX_LIBRARY_ITEMS) {
    throw new Error('Invalid Excalidraw library items.');
  }
  const payload: ExcalidrawLibraryPayload = {
    type: 'excalidrawlib',
    version: 2,
    source: 'panvas',
    libraryItems,
  };
  const serialized = JSON.stringify(payload, null, 2);
  if (serialized.length > MAX_LIBRARY_CHARACTERS) throw new Error('Excalidraw library is too large.');
  return serialized;
}

export function libraryDisplayName(fileName: string): string {
  return fileName.replace(/\.excalidrawlib$/i, '').replace(/[-_]+/g, ' ').trim() || 'Library';
}
