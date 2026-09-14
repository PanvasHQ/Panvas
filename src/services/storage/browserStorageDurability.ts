export type BrowserPersistenceState = 'checking' | 'already-persisted' | 'granted' | 'denied' | 'unsupported' | 'error';

export interface BrowserStorageEstimate {
  usage: number | null;
  quota: number | null;
}

export interface BrowserStorageDurabilityState {
  persistence: BrowserPersistenceState;
  estimate: BrowserStorageEstimate;
  editingEnabled: true;
  message: string;
}

interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

const INITIAL_STATE: BrowserStorageDurabilityState = {
  persistence: 'checking', estimate: { usage: null, quota: null }, editingEnabled: true,
  message: 'Checking browser storage durability.',
};

let state = INITIAL_STATE;
let initialization: Promise<BrowserStorageDurabilityState> | null = null;
const listeners = new Set<() => void>();

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

async function readEstimate(storage: StorageManagerLike | undefined): Promise<BrowserStorageEstimate> {
  if (!storage?.estimate) return { usage: null, quota: null };
  try {
    const estimate = await storage.estimate();
    return { usage: safeNumber(estimate.usage), quota: safeNumber(estimate.quota) };
  } catch {
    return { usage: null, quota: null };
  }
}

export async function evaluateBrowserStorageDurability(storage?: StorageManagerLike): Promise<BrowserStorageDurabilityState> {
  const estimate = await readEstimate(storage);
  if (!storage) return { persistence: 'unsupported', estimate, editingEnabled: true, message: 'Persistent browser storage is unavailable; data remains browser-managed.' };
  try {
    if (storage.persisted && await storage.persisted()) {
      return { persistence: 'already-persisted', estimate, editingEnabled: true, message: 'Persistent browser storage is enabled. Browser-mode data remains browser-managed.' };
    }
  } catch {
    // A rejected status probe must not prevent a supported persistence request.
  }
  if (!storage.persist) return { persistence: 'unsupported', estimate, editingEnabled: true, message: 'Persistent browser storage is unsupported; data remains browser-managed.' };
  try {
    const granted = await storage.persist();
    return granted
      ? { persistence: 'granted', estimate, editingEnabled: true, message: 'Panvas requested and received persistent browser storage. Browser-mode data remains browser-managed.' }
      : { persistence: 'denied', estimate, editingEnabled: true, message: 'Persistent browser storage was not granted. Keep backups or use the desktop app for filesystem storage.' };
  } catch {
    return { persistence: 'error', estimate, editingEnabled: true, message: 'Persistent browser storage could not be requested. Editing remains available; keep regular backups.' };
  }
}

export function getBrowserStorageDurabilityState(): BrowserStorageDurabilityState {
  return state;
}

export function subscribeBrowserStorageDurability(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initializeBrowserStorageDurability(): Promise<BrowserStorageDurabilityState> {
  if (initialization) return initialization;
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  initialization = evaluateBrowserStorageDurability(storage).then(result => {
    state = result;
    listeners.forEach(listener => listener());
    return result;
  });
  return initialization;
}

/** Test-only reset for deterministic module-state assertions. */
export function resetBrowserStorageDurabilityForTests(): void {
  state = INITIAL_STATE;
  initialization = null;
  listeners.clear();
}
