import Dexie, { type Table } from 'dexie';
import type { SyncV2ConflictStore, SyncV2MigrationConflict } from './types.ts';

class SyncV2ConflictDB extends Dexie {
  conflicts!: Table<SyncV2MigrationConflict>;

  constructor() {
    super('panvas-sync-v2');
    this.version(1).stores({ conflicts: 'conflictId, profileId, workspaceId, resolvedAt, createdAt' });
  }
}

const conflictDB = new SyncV2ConflictDB();

export const dexieSyncV2ConflictStore: SyncV2ConflictStore = {
  async preserve(conflict) {
    if (await conflictDB.conflicts.get(conflict.conflictId)) return 'present';
    await conflictDB.conflicts.put(conflict);
    return 'created';
  },
  async hasUnresolved(profileId) {
    return (await conflictDB.conflicts.where('profileId').equals(profileId).filter(item => item.resolvedAt === null).count()) > 0;
  },
};
