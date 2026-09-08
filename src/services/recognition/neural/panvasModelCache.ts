/**
 * Panvas model-asset lifecycle: a versioned, persistent cache for local ML
 * weights. Solves the user-verified failure where transformers.js re-downloaded
 * ~62 MB on every start — its default browser cache uses Cache Storage only,
 * which is `undefined` on insecure origins (plain-LAN http testing), and
 * private-browsing contexts, so every load missed.
 *
 * Storage tiers:
 *   1. Cache Storage under a versioned bucket (preferred, streaming-friendly).
 *   2. IndexedDB fallback (Response blobs) when Cache Storage is unavailable.
 *
 * Revisions: every entry URL carries the model revision
 * (panvas-handwriting-en-v1 → -v2 → …). A manifest records the active
 * revision; once a new revision is fully written, older-revision entries are
 * purged. Reads self-heal the manifest if the writer crashed mid-upgrade.
 * Persistence is requested once via navigator.storage.persist() — this
 * reduces eviction risk but is never absolute (site-data clearing and private
 * browsing can still remove it).
 */

export const MODEL_CACHE_NAME = 'panvas-model-cache-v1';
const MODEL_CACHE_IDB_NAME = 'panvas-model-cache';
const MODEL_CACHE_IDB_STORE = 'responses';
const MODEL_CACHE_IDB_VERSION = 1;
const MANIFEST_KEY = 'panvas:model-manifest';
const MANIFEST_META_KEY = `${MANIFEST_KEY}:meta`;
const PERSISTENCE_REQUESTED_KEY = 'panvas.model-persist-requested';

export interface RemoteCache {
  match(request: string | Request): Promise<Response | undefined>;
  put(request: string | Request, response: Response): Promise<void>;
}

export interface ModelManifest {
  revisions: string[];
  activeRevision: string | null;
}

interface StoredRecord {
  url: string;
  status: number;
  headers: Record<string, string>;
  blob: Blob;
}

function revisionFromUrl(url: string): string | null {
  const match = /panvas-handwriting-[a-z0-9.-]+/i.exec(url);
  return match ? match[0] : null;
}

function manifestFromResponse(response: Response, fallback: ModelManifest): ModelManifest {
  const header = response.headers?.get?.(MANIFEST_META_KEY) ?? null;
  const activeRevision = header ?? fallback.activeRevision;
  const revisions = new Set<string>(fallback.revisions);
  if (activeRevision) revisions.add(activeRevision);
  return { revisions: [...revisions], activeRevision };
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers?.forEach?.((value, key) => { result[key] = value; });
  return result;
}

/** Opens the IndexedDB fallback store; resolves null when unavailable. */
function openRecordStore(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(MODEL_CACHE_IDB_NAME, MODEL_CACHE_IDB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(MODEL_CACHE_IDB_STORE)) {
          database.createObjectStore(MODEL_CACHE_IDB_STORE, { keyPath: 'url' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Creates the transformers.js-compatible cache (Web-Cache `match`/`put`
 * interface). All tier failures degrade to a miss so the runtime re-downloads
 * rather than breaks.
 */
export function createPanasModelCache(): RemoteCache {
  const manifest: ModelManifest = { revisions: [], activeRevision: null };

  async function readThrough(url: string): Promise<Response | undefined> {
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(MODEL_CACHE_NAME);
        const hit = await cache.match(url);
        if (hit) {
          const healed = manifestFromResponse(hit, manifest);
          manifest.revisions = healed.revisions;
          manifest.activeRevision = healed.activeRevision;
          return hit;
        }
      } catch { /* fall through to IndexedDB */ }
    }
    const database = await openRecordStore();
    if (database) {
      try {
        const store = database.transaction(MODEL_CACHE_IDB_STORE, 'readonly').objectStore(MODEL_CACHE_IDB_STORE);
        const record = await requestAsPromise(store.get(url) as IDBRequest<StoredRecord | undefined>);
        if (record) {
          const healed = new Response(record.blob, { status: record.status, headers: record.headers });
          manifest.revisions = manifestFromResponse(healed, manifest).revisions;
          return healed;
        }
      } catch { /* treat as miss */ } finally {
        database.close();
      }
    }
    return undefined;
  }

  return {
    async match(request) {
      const url = typeof request === 'string' ? request : request.url;
      return readThrough(url);
    },

    async put(request, response) {
      const url = typeof request === 'string' ? request : request.url;
      const revision = revisionFromUrl(url);
      if (revision && !manifest.revisions.includes(revision)) manifest.revisions.push(revision);
      if (revision) manifest.activeRevision = revision;

      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(MODEL_CACHE_NAME);
          const stamped = new Response(await response.clone().blob(), {
            status: response.status,
            statusText: response.statusText,
            headers: (() => {
              const headers = new Headers(response.headers);
              if (revision) headers.set(MANIFEST_META_KEY, revision);
              return headers;
            })(),
          });
          await cache.put(url, stamped);
          return;
        } catch { /* fall through to IndexedDB */ }
      }
      const database = await openRecordStore();
      if (!database) return;
      try {
        const blob = await response.clone().blob();
        const store = database.transaction(MODEL_CACHE_IDB_STORE, 'readwrite').objectStore(MODEL_CACHE_IDB_STORE);
        await requestAsPromise(store.put({ url, status: response.status, headers: headersToObject(response.headers), blob }));
      } catch { /* best-effort persistence */ } finally {
        database.close();
      }
    },
  };
}

/**
 * Removes every cached entry belonging to a non-active revision. Called after
 * a new revision is fully usable; safe to run opportunistically.
 */
export async function purgeStaleModelRevisions(isActiveRevision: (revision: string) => boolean): Promise<void> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(MODEL_CACHE_NAME);
      const keys = await cache.keys();
      for (const request of keys) {
        const revision = revisionFromUrl(request.url);
        if (revision && !isActiveRevision(revision)) await cache.delete(request);
      }
    } catch { /* best-effort purge */ }
  }
  const database = await openRecordStore();
  if (!database) return;
  try {
    const store = database.transaction(MODEL_CACHE_IDB_STORE, 'readonly').objectStore(MODEL_CACHE_IDB_STORE);
    const records = await requestAsPromise(store.getAll() as IDBRequest<StoredRecord[]>);
    const stale = records.filter(record => {
      const revision = revisionFromUrl(record.url);
      return revision !== null && !isActiveRevision(revision);
    });
    if (stale.length === 0) return;
    const write = database.transaction(MODEL_CACHE_IDB_STORE, 'readwrite').objectStore(MODEL_CACHE_IDB_STORE);
    for (const record of stale) write.delete(record.url);
  } catch { /* best-effort purge */ } finally {
    database.close();
  }
}

/**
 * One-time persistent-storage request so eviction is less likely after the
 * first successful model download. Never throws; honest about being
 * best-effort (cleared site data still removes the model).
 */
export async function requestPersistentModelStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(PERSISTENCE_REQUESTED_KEY)) {
      return navigator.storage.persisted?.() ?? false;
    }
    const granted = await navigator.storage.persist();
    if (typeof localStorage !== 'undefined') localStorage.setItem(PERSISTENCE_REQUESTED_KEY, '1');
    return granted;
  } catch {
    return false;
  }
}
