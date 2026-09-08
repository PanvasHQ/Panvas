import type { SyncV2BaselineRecord, SyncV2BaselineStore, SyncV2ProfileState } from './types.ts';

const PROFILE_KEY = 'panvas.cloudSync.v2.profile';
const BASELINE_PREFIX = 'panvas.cloudSync.v2.baseline.';
const DB_NAME = 'panvas-sync-v2-baselines';
const DB_STORE = 'state';

export interface AsyncStringStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

class IndexedDbStringStorage implements AsyncStringStorage {
  private database: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    this.database = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable.')); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
      request.onblocked = () => reject(new Error('IndexedDB open blocked.'));
    });
    return this.database;
  }

  async getItem(key: string): Promise<string | null> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'));
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted.'));
    });
  }
}

function parse<T>(value: string | null): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export class LocalStorageSyncV2BaselineStore implements SyncV2BaselineStore {
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
  private readonly durable: AsyncStringStorage | null;

  constructor(
    storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    durable: AsyncStringStorage | null = typeof indexedDB === 'undefined' ? null : new IndexedDbStringStorage(),
  ) {
    this.storage = storage;
    this.durable = durable;
  }

  private async read(key: string): Promise<string | null> {
    if (this.durable) {
      try {
        const value = await this.durable.getItem(key);
        if (value !== null) return value;
      } catch { /* Fall back to legacy localStorage when IndexedDB is unavailable. */ }
    }
    return this.storage.getItem(key);
  }

  private async write(key: string, value: string): Promise<void> {
    if (this.durable) {
      try { await this.durable.setItem(key, value); return; }
      catch { /* A real failure is still surfaced if the fallback also fails. */ }
    }
    this.storage.setItem(key, value);
  }

  async loadProfile(): Promise<SyncV2ProfileState | null> {
    const value = parse<SyncV2ProfileState>(await this.read(PROFILE_KEY));
    return value && typeof value.profileId === 'string' && typeof value.accountIdentifier === 'string' ? value : null;
  }

  async saveProfile(profile: SyncV2ProfileState): Promise<void> { await this.write(PROFILE_KEY, JSON.stringify(profile)); }

  async loadWorkspace(workspaceId: string): Promise<SyncV2BaselineRecord[]> {
    const value = parse<SyncV2BaselineRecord[]>(await this.read(`${BASELINE_PREFIX}${workspaceId}`));
    return Array.isArray(value) ? value : [];
  }

  async saveWorkspace(workspaceId: string, records: SyncV2BaselineRecord[]): Promise<void> {
    await this.write(`${BASELINE_PREFIX}${workspaceId}`, JSON.stringify(records));
  }
}
