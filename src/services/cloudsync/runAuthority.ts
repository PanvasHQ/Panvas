/** Cancels commits from an obsolete connection or local user without deleting data. */
export class SyncRunAuthority {
  private generation = 0;
  invalidate(): void { this.generation += 1; }
  capture(identityStillCurrent: () => boolean = () => true): () => void {
    const generation = this.generation;
    return () => {
      if (generation !== this.generation || !identityStillCurrent()) {
        throw new StaleSyncRunError();
      }
    };
  }
}

export class StaleSyncRunError extends Error {
  constructor() { super('Sync superseded by a connection or user change.'); this.name = 'StaleSyncRunError'; }
}

/** Preserve adapter signatures while checking both sides of every async boundary. */
export function guardSyncCalls<T extends object>(target: T, assertCurrent: () => void): T {
  return new Proxy(target, {
    get(object, key) {
      const value = Reflect.get(object, key, object);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        assertCurrent();
        const result = value.apply(object, args);
        if (result && typeof result.then === 'function') return result.then((resolved: unknown) => { assertCurrent(); return resolved; });
        assertCurrent(); return result;
      };
    },
  });
}
