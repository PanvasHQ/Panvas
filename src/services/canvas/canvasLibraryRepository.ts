import {
  libraryDisplayName,
  parseExcalidrawLibrary,
  requireLibraryFileName,
  serializeExcalidrawLibrary,
  type CanvasLibraryRecord,
} from './canvasLibraryModel';

const STORAGE_PREFIX = 'panvas:canvas-libraries:';

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

function readBrowserLibraries(workspaceId: string): CanvasLibraryRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(workspaceId)) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBrowserLibraries(workspaceId: string, records: CanvasLibraryRecord[]): void {
  localStorage.setItem(storageKey(workspaceId), JSON.stringify(records));
}

export async function getCanvasLibraries(workspaceId: string): Promise<CanvasLibraryRecord[]> {
  if (window.panvas?.library) return window.panvas.library.getAll(workspaceId);
  return readBrowserLibraries(workspaceId);
}

export async function saveCanvasLibrary(
  workspaceId: string,
  fileName: string,
  libraryItems: readonly unknown[],
): Promise<CanvasLibraryRecord> {
  requireLibraryFileName(fileName);
  const contents = serializeExcalidrawLibrary(libraryItems);
  if (window.panvas?.library) return window.panvas.library.import(workspaceId, fileName, contents);

  const record: CanvasLibraryRecord = {
    fileName,
    name: libraryDisplayName(fileName),
    libraryItems: parseExcalidrawLibrary(contents),
    updatedAt: Date.now(),
    size: contents.length,
  };
  const records = readBrowserLibraries(workspaceId).filter((item) => item.fileName !== fileName);
  records.push(record);
  writeBrowserLibraries(workspaceId, records);
  return record;
}

export async function importCanvasLibrary(
  workspaceId: string,
  fileName: string,
  contents: string,
): Promise<CanvasLibraryRecord> {
  requireLibraryFileName(fileName);
  const items = parseExcalidrawLibrary(contents);
  return saveCanvasLibrary(workspaceId, fileName, items);
}

export async function deleteCanvasLibrary(workspaceId: string, fileName: string): Promise<void> {
  requireLibraryFileName(fileName);
  if (window.panvas?.library) {
    await window.panvas.library.delete(workspaceId, fileName);
    return;
  }
  writeBrowserLibraries(
    workspaceId,
    readBrowserLibraries(workspaceId).filter((item) => item.fileName !== fileName),
  );
}
