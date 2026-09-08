import type { RecordPointer, SyncEntityKind } from '../types.ts';
import type { ScannedSyncEntity } from '../engine.ts';

export interface SyncV2Profile {
  format: 'panvas-sync-v2-profile';
  schemaVersion: 2;
  profileId: string;
  accountIdentifier: string;
}

export interface SyncV2CatalogEntry {
  workspaceId: string;
  manifestRevision: number;
}

export interface SyncV2Catalog {
  format: 'panvas-sync-v2-catalog';
  schemaVersion: 2;
  revision: number;
  workspaces: SyncV2CatalogEntry[];
}

export interface SyncV2Record {
  kind: SyncEntityKind;
  id: string;
  parentId: string | null;
  hash: string | null;
  baseHash: string | null;
  tombstone: boolean;
  encoding?: RecordPointer['encoding'];
}

export interface SyncV2Manifest {
  format: 'panvas-sync-v2-manifest';
  schemaVersion: 2;
  workspaceId: string;
  revision: number;
  records: SyncV2Record[];
}

export interface SyncV2BaselineRecord {
  entityId: string;
  entityKind: SyncEntityKind;
  baseHash: string | null;
  localHash: string | null;
  remoteHash: string | null;
  remoteRevision: number;
  tombstone: boolean;
}

export interface SyncV2ProfileState {
  profileId: string;
  accountIdentifier: string;
}

type Awaitable<T> = T | Promise<T>;

export interface SyncV2BaselineStore {
  loadProfile(): Awaitable<SyncV2ProfileState | null>;
  saveProfile(profile: SyncV2ProfileState): Awaitable<void>;
  loadWorkspace(workspaceId: string): Awaitable<SyncV2BaselineRecord[]>;
  saveWorkspace(workspaceId: string, records: SyncV2BaselineRecord[]): Awaitable<void>;
}

export interface SyncV2MigrationConflict {
  conflictId: string;
  profileId: string;
  workspaceId: string;
  entityKind: SyncEntityKind;
  entityId: string;
  parentId: string | null;
  localHash: string;
  remoteHash: string;
  localBytes: Uint8Array;
  createdAt: number;
  resolvedAt: number | null;
}

export interface SyncV2ConflictStore {
  preserve(conflict: SyncV2MigrationConflict): Promise<'created' | 'present'>;
  hasUnresolved(profileId: string): Promise<boolean>;
}

export interface SyncV2RemoteRead<T> { value: T | null; etag: string | null }

export interface SyncV2Provider {
  readProfile(): Promise<SyncV2RemoteRead<SyncV2Profile>>;
  writeProfile(profile: SyncV2Profile, ifMatch: string | null): Promise<{ etag: string }>;
  readCatalog(): Promise<SyncV2RemoteRead<SyncV2Catalog>>;
  writeCatalog(catalog: SyncV2Catalog, ifMatch: string | null): Promise<{ etag: string }>;
  readManifest(workspaceId: string): Promise<SyncV2RemoteRead<SyncV2Manifest>>;
  writeManifest(workspaceId: string, manifest: SyncV2Manifest, ifMatch: string | null): Promise<{ etag: string }>;
  getObject(hash: string): Promise<Uint8Array>;
  putObjectIfAbsent(hash: string, bytes: Uint8Array): Promise<'uploaded' | 'present'>;
  getObjectMetadata(hash: string): Promise<{ size: number } | null>;
}

export interface SyncV2LocalSource {
  beginCycle?(): void;
  endCycle?(): void;
  listWorkspaceIds(): Promise<string[]>;
  scanWorkspace(workspaceId: string): Promise<ScannedSyncEntity[]>;
}

export interface SyncV2LocalAdapter {
  applyRecord(input: { workspaceId: string; record: SyncV2Record; bytes: Uint8Array | null }): Promise<void>;
}
