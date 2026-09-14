import { db } from '@/database/schema';
import { runMigrationCoordinator } from './migration-core';

const CANONICAL_DESTINATION_MARKER = 'panvas.dexieMigration.canonicalDestinations.v1';
let migrationRun: Promise<boolean> | null = null;

function canonicalMigrationCompleted(): boolean {
  try {
    return localStorage.getItem(CANONICAL_DESTINATION_MARKER) === 'true';
  } catch {
    return false;
  }
}

export function needsDexieToFsMigration(): boolean {
  return typeof window !== 'undefined' && Boolean(window.panvas) && !canonicalMigrationCompleted();
}

/**
 * Migrates data from Dexie (IndexedDB) to the local file system (via Electron IPC).
 * This migration is idempotent and does not delete Dexie data, ensuring safe rollback.
 */
export function migrateFromDexieToFs(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.panvas) {
    return Promise.resolve(false);
  }

  if (canonicalMigrationCompleted()) return Promise.resolve(true);

  // Startup, auto-sync, and a manual Sync now click can all arrive close
  // together. They must join the same migration instead of importing every
  // legacy workspace more than once in the same process.
  if (!migrationRun) {
    migrationRun = runMigrationCoordinator(
      db,
      bundle => window.panvas.migration.importWorkspace(bundle),
      localStorage,
    ).then(completed => {
      if (completed) {
        try { localStorage.setItem(CANONICAL_DESTINATION_MARKER, 'true'); }
        catch { /* A storage marker failure must not rewrite user data. */ }
      }
      return completed;
    });
  }

  return migrationRun;
}
