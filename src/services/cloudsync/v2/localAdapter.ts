import { defaultRemoteRecordLocalAdapter } from '../applyRemoteChanges.ts';
import { LocalSyncPayloadSource } from '../payloadSource.ts';
import type { SyncV2LocalAdapter, SyncV2LocalSource } from './types.ts';

const payloadSource = new LocalSyncPayloadSource();

export const syncV2LocalSource: SyncV2LocalSource = {
  beginCycle: () => payloadSource.beginCycle(),
  endCycle: () => payloadSource.endCycle(),
  listWorkspaceIds: () => payloadSource.listWorkspaceIds(),
  scanWorkspace: workspaceId => payloadSource.scanWorkspace(workspaceId),
};

export const syncV2LocalAdapter: SyncV2LocalAdapter = {
  applyRecord({ workspaceId, record, bytes }) {
    return defaultRemoteRecordLocalAdapter.applyRecord({
      workspaceId,
      pointer: {
        kind: record.kind,
        id: record.id,
        parentId: record.parentId,
        revision: 1,
        baseRevision: null,
        contentHash: record.hash ?? 'tombstone',
        tombstone: record.tombstone,
        encoding: record.encoding,
      },
      bytes,
    });
  },
};
