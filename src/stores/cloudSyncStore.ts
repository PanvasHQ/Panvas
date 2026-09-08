/** Optional local-first Cloud Sync coordination for Electron and browser/PWA. */
import { create } from 'zustand';
import type { CloudSyncProgress, CloudSyncProvider, CloudSyncStatus, CloudWorkspaceBinding, ProviderConnectionInfo, RemoteWorkspaceSummary, SafeCloudDiagnostic, WorkspaceCloudStatus } from '@/services/cloudsync/types';
import { GoogleDriveSyncProvider } from '@/services/cloudsync/googleDriveProvider';
import { finalizeAccountSync, runSyncCycle, type DeviceManifestState, type SyncEntryError } from '@/services/cloudsync/engine';
import { commitMigratedWorkspaceJournal, dexieSyncJournalStore, recoverStaleJournalMetadata, restoreWorkspaceJournalSnapshot } from '@/database/syncJournalDB';
import { LocalSyncPayloadSource } from '@/services/cloudsync/payloadSource';
import { applyRemoteChanges } from '@/services/cloudsync/applyRemoteChanges';
import { migrateWorkspaceToGoogleAccount } from '@/services/cloudsync/accountMigration';
import { attachWorkspaceReplica, replicateMissingRemoteWorkspaces } from '@/services/cloudsync/workspaceReplica';
import { accountMigrationWorkspaceIds, attachedWorkspaceIds, bindingsForAccount, loadWorkspaceBindings, moveWorkspaceBinding, reconcileWorkspaceBindings, saveWorkspaceBinding, workspaceHasBinding, workspaceIsBoundToOtherAccount } from '@/services/cloudsync/workspaceBindings';
import { CloudOperationError, logCloudDiagnostic, presentCloudError, publicCloudMessage } from '@/services/cloudsync/errors';
import { validateRemoteManifest } from '@/services/cloudsync/manifest';
import { preloadGis } from '@/services/cloudsync/browserGoogleAuth';
import { db } from '@/database/schema';
import { CLOUD_SYNC_V2_ENABLED } from '@/config/features';
import { runCloudSyncV2 } from '@/services/cloudsync/v2/engine';
import { LocalStorageSyncV2BaselineStore } from '@/services/cloudsync/v2/baselineStore';
import { GoogleDriveSyncV2Provider } from '@/services/cloudsync/v2/googleDriveV2Provider';
import { syncV2LocalAdapter, syncV2LocalSource } from '@/services/cloudsync/v2/localAdapter';
import { dexieSyncV2ConflictStore } from '@/services/cloudsync/v2/conflictStore';
import { SinglePendingRunner } from '@/services/cloudsync/v2/singlePendingRunner';

export type SyncProviderId = CloudSyncProvider['id'];

export interface SafeSyncMetrics {
  localEntitiesScanned: number; payloadsLoaded: number; objectsUploaded: number; objectsAlreadyPresent: number;
  manifestEntries: number; journalEntriesProcessed: number; remoteObjectsDownloaded: number; conflictsCreated: number;
  bytesUploaded: number; largeAssets: number; totalGoogleRequests: number; retries: number; backoffMs: number; timeouts: number;
  totalDurationMs: number; manifestReadMs: number; manifestWriteMs: number; manifestReadBackMs: number; hashingAndLoadMs: number; objectTransferMs: number;
}

interface CloudSyncState {
  statusByProvider: Record<SyncProviderId, CloudSyncStatus>;
  connectionByProvider: Record<SyncProviderId, ProviderConnectionInfo | null>;
  lastSyncedByProvider: Record<SyncProviderId, number | null>;
  workspaceStatusById: Record<string, WorkspaceCloudStatus>;
  lastSyncedByWorkspaceId: Record<string, number | null>;
  bindings: CloudWorkspaceBinding[];
  autoSync: boolean; isSyncing: boolean; lastError: string | null; lastDiagnostic: SafeCloudDiagnostic | null; lastMetrics: SafeSyncMetrics | null;
  progress: CloudSyncProgress | null; remoteWorkspaces: RemoteWorkspaceSummary[];
  migrationWorkspaceIds: string[];
  setAutoSync: (enabled: boolean) => void;
  initialize: () => Promise<void>;
  requestConnect: (provider: SyncProviderId, customClientId?: string) => Promise<boolean>;
  requestDisconnect: (provider: SyncProviderId) => Promise<void>;
  triggerSync: (workspaceId?: string) => Promise<void>;
  refreshRemoteWorkspaces: () => Promise<void>;
  attachRemoteWorkspace: (workspaceId: string) => Promise<boolean>;
  enableSyncForWorkspace: (workspaceId: string) => Promise<boolean>;
  moveSyncToCurrentGoogleAccount: (workspaceIds?: readonly string[]) => Promise<boolean>;
  openLocalWorkspace: (workspaceId: string) => Promise<boolean>;
}

const providers = ['onedrive', 'googledrive', 'dropbox'] as const;
const statuses = Object.fromEntries(providers.map(id => [id, 'disconnected'])) as Record<SyncProviderId, CloudSyncStatus>;
const connections = Object.fromEntries(providers.map(id => [id, null])) as Record<SyncProviderId, ProviderConnectionInfo | null>;
const lastSynced = Object.fromEntries(providers.map(id => [id, null])) as Record<SyncProviderId, number | null>;
const googleDriveProvider = new GoogleDriveSyncProvider();
const localPayloadSource = new LocalSyncPayloadSource();
const deviceStates = new Map<string, DeviceManifestState>();
let initialized = false;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
const v2SyncRunner = new SinglePendingRunner();

const emptyMetrics = (): SafeSyncMetrics => ({ localEntitiesScanned: 0, payloadsLoaded: 0, objectsUploaded: 0, objectsAlreadyPresent: 0, manifestEntries: 0, journalEntriesProcessed: 0, remoteObjectsDownloaded: 0, conflictsCreated: 0, bytesUploaded: 0, largeAssets: 0, totalGoogleRequests: 0, retries: 0, backoffMs: 0, timeouts: 0, totalDurationMs: 0, manifestReadMs: 0, manifestWriteMs: 0, manifestReadBackMs: 0, hashingAndLoadMs: 0, objectTransferMs: 0 });

function localDeviceId(): string {
  const key = 'panvas_cloud_device_id';
  try { const existing = localStorage.getItem(key); if (existing) return existing; const id = `device-${crypto.randomUUID()}`; localStorage.setItem(key, id); return id; }
  catch { return `device-${crypto.randomUUID()}`; }
}

async function localWorkspaceIds(): Promise<string[]> {
  if (typeof window !== 'undefined' && window.panvas) {
    const [active, trash] = await Promise.all([
      window.panvas.workspace.getAll(),
      window.panvas.trash.getAll(null),
    ]);
    return [...new Set([
      ...active.map(item => item.id),
      ...trash.workspaces.map(item => item.id),
    ])].filter(id => id !== 'default');
  }
  // Deleted roots remain in sync scope until their tombstones are published.
  // The normal Library projection still filters them out.
  return (await db.workspaces.toArray()).map(item => item.id).filter(id => id !== 'default');
}

function entryError(error: SyncEntryError, workspaceId: string): CloudOperationError {
  const code = error.errorClass === 'auth-expired' ? 'auth-expired'
    : error.errorClass === 'rate-limited' ? 'rate-limited'
      : error.errorClass === 'provider-conflict' || error.errorClass === 'conflict' ? 'conflict'
        : error.errorClass === 'payload-missing' || error.errorClass === 'initial-scan-empty' ? 'payload' : 'sync';
  return new CloudOperationError(code, {
    workspaceId,
    stage: error.stage,
    reason: error.providerReason ?? error.errorClass,
    status: error.providerStatus,
    entityKind: error.entityType,
    entityId: error.entityId,
    operation: error.operation,
    retryable: error.retryable ?? code === 'rate-limited',
  });
}

function bindingFor(workspaceId: string, connection: ProviderConnectionInfo, revision: number, bindings: readonly CloudWorkspaceBinding[]): CloudWorkspaceBinding {
  const prior = bindings.find(item => item.provider === 'googledrive' && item.workspaceId === workspaceId && item.providerAccountId === connection.accountIdentifier);
  return { workspaceId, provider: 'googledrive', providerAccountId: connection.accountIdentifier, remoteWorkspaceId: workspaceId, lastKnownRemoteRevision: revision, attachedAt: prior?.attachedAt ?? Date.now() };
}

function boundForCurrentAccount(state: CloudSyncState, workspaceId: string): boolean {
  const accountId = state.connectionByProvider.googledrive?.accountIdentifier;
  return Boolean(accountId && bindingsForAccount(state.bindings, accountId).some(item => item.workspaceId === workspaceId));
}

function logAccountSyncFailure(diagnostic: SafeCloudDiagnostic): void {
  if (typeof window !== 'undefined' && !window.panvas) {
    if ((import.meta as any).env?.DEV) console.warn('[CloudSync diagnostic]', {
      workspaceId: diagnostic.workspaceId,
      stage: diagnostic.stage,
      reason: diagnostic.reason,
      operation: diagnostic.operation,
    });
    return;
  }
  logCloudDiagnostic(diagnostic);
}

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  statusByProvider: statuses, connectionByProvider: connections, lastSyncedByProvider: lastSynced,
  workspaceStatusById: {}, lastSyncedByWorkspaceId: {}, bindings: CLOUD_SYNC_V2_ENABLED ? [] : loadWorkspaceBindings(),
  autoSync: true, isSyncing: false, lastError: null, lastDiagnostic: null, lastMetrics: null, progress: null, remoteWorkspaces: [], migrationWorkspaceIds: [],
  setAutoSync: enabled => set({ autoSync: enabled }),

  initialize: async () => {
    if (initialized) return; initialized = true;
    void preloadGis();
    try {
      const info = await googleDriveProvider.getAccountInfo();
      if (!info) return;
      const localIds = await localWorkspaceIds();
      if (CLOUD_SYNC_V2_ENABLED) {
        set(state => ({
          bindings: [], migrationWorkspaceIds: [],
          connectionByProvider: { ...state.connectionByProvider, googledrive: info },
          statusByProvider: { ...state.statusByProvider, googledrive: 'connected' },
          workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(localIds.map(id => [id, 'connected'])) },
        }));
        if (navigator.onLine && get().autoSync) void get().triggerSync();
        return;
      }
      let bindings = reconcileWorkspaceBindings(info.accountIdentifier, localIds, undefined, Date.now(), info.email ? [info.email] : []);
      for (const localId of localIds) {
        if (localId !== 'default' && !workspaceHasBinding(bindings, localId)) {
          bindings = saveWorkspaceBinding(bindingFor(localId, info, 0, bindings));
        }
      }
      const attached = attachedWorkspaceIds(bindings, info.accountIdentifier, localIds);
      const migrationWorkspaceIds = accountMigrationWorkspaceIds(bindings, localIds, info.accountIdentifier);
      const connectionStatus: CloudSyncStatus = migrationWorkspaceIds.length > 0 ? 'account-migration-required' : 'connected';
      set(state => ({
        bindings, migrationWorkspaceIds,
        connectionByProvider: { ...state.connectionByProvider, googledrive: info },
        statusByProvider: { ...state.statusByProvider, googledrive: connectionStatus },
        workspaceStatusById: {
          ...state.workspaceStatusById,
          ...Object.fromEntries(attached.map(id => [id, 'connected'])),
          ...Object.fromEntries(migrationWorkspaceIds.map(id => [id, 'account-migration-required'])),
        },
        lastError: migrationWorkspaceIds.length > 0 ? publicCloudMessage('account-migration-required') : null,
      }));
      if (navigator.onLine && get().autoSync) void get().triggerSync();
    } catch (error) { const shown = presentCloudError(error, 'initialize'); logCloudDiagnostic(shown.diagnostic); }
  },

  requestConnect: async provider => {
    if (provider !== 'googledrive') return false;
    set(state => ({ statusByProvider: { ...state.statusByProvider, googledrive: 'connecting' }, lastError: null, lastDiagnostic: null }));
    try {
      const connection = await googleDriveProvider.connect();
      const localIds = await localWorkspaceIds();
      if (CLOUD_SYNC_V2_ENABLED) {
        set(state => ({
          bindings: [], migrationWorkspaceIds: [],
          connectionByProvider: { ...state.connectionByProvider, googledrive: connection },
          statusByProvider: { ...state.statusByProvider, googledrive: 'connected' },
          workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(localIds.map(id => [id, 'connected'])) },
        }));
        void get().triggerSync();
        return true;
      }
      let bindings = reconcileWorkspaceBindings(connection.accountIdentifier, localIds, undefined, Date.now(), connection.email ? [connection.email] : []);
      for (const localId of localIds) {
        if (localId !== 'default' && !workspaceHasBinding(bindings, localId)) {
          bindings = saveWorkspaceBinding(bindingFor(localId, connection, 0, bindings));
        }
      }
      const attached = attachedWorkspaceIds(bindings, connection.accountIdentifier, localIds);
      const migrationWorkspaceIds = accountMigrationWorkspaceIds(bindings, localIds, connection.accountIdentifier);
      const connectionStatus: CloudSyncStatus = migrationWorkspaceIds.length > 0 ? 'account-migration-required' : 'connected';
      set(state => ({
        bindings, migrationWorkspaceIds,
        connectionByProvider: { ...state.connectionByProvider, googledrive: connection },
        statusByProvider: { ...state.statusByProvider, googledrive: connectionStatus },
        workspaceStatusById: {
          ...state.workspaceStatusById,
          ...Object.fromEntries(attached.map(id => [id, 'connected'])),
          ...Object.fromEntries(migrationWorkspaceIds.map(id => [id, 'account-migration-required'])),
        },
        lastError: migrationWorkspaceIds.length > 0 ? publicCloudMessage('account-migration-required') : null,
      }));
      void get().triggerSync();
      return true;
    } catch (error) {
      const shown = presentCloudError(error, 'authorization'); logCloudDiagnostic(shown.diagnostic);
      set(state => ({ statusByProvider: { ...state.statusByProvider, googledrive: shown.status }, lastError: shown.message, lastDiagnostic: shown.diagnostic })); return false;
    }
  },

  requestDisconnect: async provider => {
    if (provider !== 'googledrive') return;
    try { await googleDriveProvider.disconnect(); } catch { /* local data and bindings remain */ }
    const localIds = await localWorkspaceIds();
    set(state => ({ statusByProvider: { ...state.statusByProvider, googledrive: 'disconnected' }, connectionByProvider: { ...state.connectionByProvider, googledrive: null }, lastSyncedByProvider: { ...state.lastSyncedByProvider, googledrive: null }, workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(localIds.map(id => [id, 'local-only'])) }, lastError: null, lastDiagnostic: null, lastMetrics: null, progress: null, remoteWorkspaces: [], migrationWorkspaceIds: [] }));
  },

  refreshRemoteWorkspaces: async () => {
    if (CLOUD_SYNC_V2_ENABLED) return;
    if (!get().connectionByProvider.googledrive || !googleDriveProvider.listRemoteWorkspaces) return;
    try { set({ remoteWorkspaces: await googleDriveProvider.listRemoteWorkspaces() }); }
    catch (error) { const shown = presentCloudError(error, 'workspace_discovery'); logCloudDiagnostic(shown.diagnostic); set({ lastError: shown.message, lastDiagnostic: shown.diagnostic }); }
  },

  openLocalWorkspace: async workspaceId => {
    if (!(await localWorkspaceIds()).includes(workspaceId)) return false;
    const workspaceStore = await import('@/stores/workspaceStore');
    await workspaceStore.useWorkspaceStore.getState().loadWorkspaces();
    await workspaceStore.useWorkspaceStore.getState().setActiveWorkspace(workspaceId);
    return true;
  },

  attachRemoteWorkspace: async workspaceId => {
    if (CLOUD_SYNC_V2_ENABLED) return false;
    const connection = get().connectionByProvider.googledrive;
    if (!connection || get().isSyncing || workspaceId === 'default') return false;
    if (workspaceIsBoundToOtherAccount(get().bindings, workspaceId, connection.accountIdentifier)) return false;
    const localIds = await localWorkspaceIds();
    if (boundForCurrentAccount(get(), workspaceId) && localIds.includes(workspaceId)) return get().openLocalWorkspace(workspaceId);
    set(state => ({ isSyncing: true, statusByProvider: { ...state.statusByProvider, googledrive: 'syncing' }, workspaceStatusById: { ...state.workspaceStatusById, [workspaceId]: 'syncing' }, lastError: null, lastDiagnostic: null, progress: { stage: 'downloading', completed: 0, total: 1, message: 'Syncing workspace…' } }));
    try {
      const remote = await googleDriveProvider.readManifest(workspaceId);
      const manifest = remote.manifest ? validateRemoteManifest(remote.manifest) : null;
      if (!manifest || manifest.workspaceId !== workspaceId) throw new CloudOperationError('remote-workspace', { stage: 'workspace_attach', reason: 'manifest_unavailable', retryable: false });
      const result = await attachWorkspaceReplica({ workspaceId, records: manifest.records, remoteRevision: manifest.revision, hasLocalWorkspace: localIds.includes(workspaceId), provider: googleDriveProvider, journalStore: dexieSyncJournalStore, payloadSource: localPayloadSource, onProgress: (completed, total) => set({ progress: { stage: 'downloading', completed, total, message: `Syncing workspace ${completed} of ${total}…` } }) });
      if (result.errors > 0) throw new CloudOperationError('remote-workspace', { stage: 'workspace_reconstruction', reason: 'record_apply_failed', retryable: false });
      const bindings = saveWorkspaceBinding(bindingFor(workspaceId, connection, manifest.revision, get().bindings));
      deviceStates.set(workspaceId, { lastSeenRevision: manifest.revision });
      const status: WorkspaceCloudStatus = result.stagedConflicts > 0 ? 'conflict' : 'synced';
      const syncedAt = status === 'synced' ? Date.now() : null;
      set(state => ({ bindings, isSyncing: false, statusByProvider: { ...state.statusByProvider, googledrive: status === 'conflict' ? 'conflict' : 'synced' }, workspaceStatusById: { ...state.workspaceStatusById, [workspaceId]: status }, lastSyncedByWorkspaceId: { ...state.lastSyncedByWorkspaceId, [workspaceId]: syncedAt }, lastSyncedByProvider: { ...state.lastSyncedByProvider, googledrive: syncedAt ?? state.lastSyncedByProvider.googledrive }, lastError: status === 'conflict' ? publicCloudMessage('conflict') : null, progress: { stage: 'complete', completed: 1, total: 1, message: status === 'conflict' ? 'Synchronized with conflicts to review' : 'All changes synchronized' } }));
      const workspaceStore = await import('@/stores/workspaceStore');
      await workspaceStore.useWorkspaceStore.getState().loadWorkspaces();
      return true;
    } catch (error) {
      const shown = presentCloudError(error, 'workspace_attach'); logCloudDiagnostic(shown.diagnostic);
      const status: WorkspaceCloudStatus = shown.status === 'conflict' ? 'conflict' : shown.status === 'offline' ? 'offline' : shown.status === 'auth-expired' ? 'auth-expired' : shown.status === 'rate-limited' ? 'rate-limited' : 'error';
      set(state => ({ isSyncing: false, statusByProvider: { ...state.statusByProvider, googledrive: shown.status }, workspaceStatusById: { ...state.workspaceStatusById, [workspaceId]: status }, lastError: shown.message, lastDiagnostic: shown.diagnostic, progress: null })); return false;
    }
  },

  enableSyncForWorkspace: async workspaceId => {
    if (CLOUD_SYNC_V2_ENABLED) return false;
    const connection = get().connectionByProvider.googledrive;
    if (!connection || !(await localWorkspaceIds()).includes(workspaceId) || workspaceId === 'default') return false;
    if (workspaceIsBoundToOtherAccount(get().bindings, workspaceId, connection.accountIdentifier)) return false;
    if (boundForCurrentAccount(get(), workspaceId)) { await get().triggerSync(workspaceId); return get().workspaceStatusById[workspaceId] === 'synced'; }
    try {
      const remote = await googleDriveProvider.readManifest(workspaceId);
      if (remote.manifest) return get().attachRemoteWorkspace(workspaceId);
      const bindings = saveWorkspaceBinding(bindingFor(workspaceId, connection, 0, get().bindings));
      set(state => ({ bindings, workspaceStatusById: { ...state.workspaceStatusById, [workspaceId]: 'connected' } }));
      await get().triggerSync(workspaceId);
      return get().workspaceStatusById[workspaceId] === 'synced';
    } catch (error) {
      const shown = presentCloudError(error, 'workspace_enable'); logCloudDiagnostic(shown.diagnostic);
      set({ lastError: shown.message, lastDiagnostic: shown.diagnostic }); return false;
    }
  },

  moveSyncToCurrentGoogleAccount: async selectedWorkspaceIds => {
    if (CLOUD_SYNC_V2_ENABLED) return false;
    const connection = get().connectionByProvider.googledrive;
    if (!connection || get().isSyncing) return false;
    const localIds = await localWorkspaceIds();
    const selected = selectedWorkspaceIds ? new Set(selectedWorkspaceIds) : null;
    const candidates = accountMigrationWorkspaceIds(get().bindings, localIds, connection.accountIdentifier)
      .filter(id => !selected || selected.has(id));
    if (candidates.length === 0) return true;

    set(state => ({
      isSyncing: true, lastError: null, lastDiagnostic: null,
      statusByProvider: { ...state.statusByProvider, googledrive: 'syncing' },
      workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(candidates.map(id => [id, 'syncing'])) },
      progress: { stage: 'preparing', completed: 0, total: candidates.length, message: 'Moving sync to this Google account…' },
    }));

    let bindings = get().bindings;
    const outcomes = new Map<string, WorkspaceCloudStatus>();
    let completed = 0;
    let failedStatus: CloudSyncStatus | null = null;
    let firstDiagnostic: SafeCloudDiagnostic | null = null;
    let firstMessage: string | null = null;
    let migratedAny = false;
    let stopMigration = false;

    for (const candidate of candidates) {
      try {
        const migration = await migrateWorkspaceToGoogleAccount({
          workspaceId: candidate,
          deviceId: localDeviceId(),
          provider: googleDriveProvider,
          payloadSource: localPayloadSource,
          now: Date.now(),
          onProgress: value => set({
            progress: {
              ...value,
              completed,
              total: candidates.length,
              message: `Moving workspace ${completed + 1} of ${candidates.length}… (${value.message})`,
            },
          }),
        });

        if (migration.status !== 'synced') {
          const code = migration.status === 'conflict' ? 'conflict' : 'sync';
          const shown = migration.firstError
            ? presentCloudError(entryError(migration.firstError, candidate), 'account-migration')
            : presentCloudError(new CloudOperationError(code, { workspaceId: candidate, stage: 'account-migration', operation: 'reconcile', reason: migration.status === 'conflict' ? 'migration-conflict' : 'migration-failed', retryable: false }));
          failedStatus ??= migration.status === 'conflict' ? 'conflict' : shown.status;
          firstDiagnostic ??= shown.diagnostic;
          firstMessage ??= shown.message;
          outcomes.set(candidate, migration.status === 'conflict' ? 'conflict' : 'error');
          completed += 1;
          stopMigration = migration.firstError?.errorClass === 'auth-expired';
          if (stopMigration) break;
          continue;
        }

        const previousJournal = await commitMigratedWorkspaceJournal(candidate, migration.journalEntries);
        try {
          bindings = moveWorkspaceBinding(bindingFor(candidate, connection, migration.remoteRevision, bindings));
        } catch (error) {
          await restoreWorkspaceJournalSnapshot(candidate, previousJournal);
          throw error;
        }
        deviceStates.set(candidate, { lastSeenRevision: migration.remoteRevision });
        outcomes.set(candidate, 'synced');
        migratedAny = true;
      } catch (error) {
        const shown = presentCloudError(error, 'account-migration');
        failedStatus ??= shown.status;
        firstDiagnostic ??= shown.diagnostic;
        firstMessage ??= shown.message;
        outcomes.set(candidate, 'error');
        stopMigration = shown.status === 'auth-expired';
      }
      completed += 1;
      if (stopMigration) break;
      set({ progress: { stage: 'finalizing', completed, total: candidates.length, message: `Moved ${completed} of ${candidates.length} workspaces…` } });
    }

    const remaining = accountMigrationWorkspaceIds(bindings, localIds, connection.accountIdentifier);
    const finalStatus: CloudSyncStatus = failedStatus ?? (remaining.length > 0 ? 'account-migration-required' : 'synced');
    const syncedAt = finalStatus === 'synced' ? Date.now() : null;
    const migrationMessage = remaining.length > 0 ? publicCloudMessage('account-migration-required') : null;
    const diagnostic = firstDiagnostic ?? (remaining.length > 0
      ? new CloudOperationError('account-migration-required', { workspaceId: remaining[0], stage: 'workspace-account-isolation', operation: 'migrate', reason: 'workspace-bound-to-different-account', retryable: false }).diagnostic
      : null);
    const message = firstMessage ?? migrationMessage;
    if (diagnostic && finalStatus !== 'synced') logAccountSyncFailure(diagnostic);

    set(state => ({
      bindings, migrationWorkspaceIds: remaining, isSyncing: false,
      statusByProvider: { ...state.statusByProvider, googledrive: finalStatus },
      workspaceStatusById: {
        ...state.workspaceStatusById,
        ...Object.fromEntries(outcomes),
        ...Object.fromEntries(remaining.map(id => [id, 'account-migration-required'])),
      },
      lastSyncedByProvider: { ...state.lastSyncedByProvider, googledrive: syncedAt ?? state.lastSyncedByProvider.googledrive },
      lastError: message, lastDiagnostic: diagnostic,
      progress: finalStatus === 'synced' ? { stage: 'complete', completed: 1, total: 1, message: 'All changes synchronized' } : null,
    }));

    if (migratedAny) {
      const workspaceStore = await import('@/stores/workspaceStore');
      await workspaceStore.useWorkspaceStore.getState().loadWorkspaces();
    }
    return finalStatus === 'synced';
  },

  triggerSync: async workspaceId => {
    const connection = get().connectionByProvider.googledrive;
    if (!connection || (!CLOUD_SYNC_V2_ENABLED && get().isSyncing)) return;
    if (!navigator.onLine) {
      set(state => ({ statusByProvider: { ...state.statusByProvider, googledrive: 'offline' }, lastError: publicCloudMessage('offline') }));
      return;
    }

    set(state => ({ isSyncing: true, statusByProvider: { ...state.statusByProvider, googledrive: 'syncing' }, lastError: null, lastDiagnostic: null, progress: { stage: 'preparing', completed: 0, total: 1, message: 'Checking cloud…' } }));

    if (CLOUD_SYNC_V2_ENABLED) {
      await v2SyncRunner.request(async () => {
      try {
      const v2 = await runCloudSyncV2({
        accountIdentifier: connection.accountIdentifier,
        provider: new GoogleDriveSyncV2Provider(),
        source: syncV2LocalSource,
        adapter: syncV2LocalAdapter,
        baselines: new LocalStorageSyncV2BaselineStore(),
        conflictStore: dexieSyncV2ConflictStore,
        onProgress: message => set({ progress: { stage: message.startsWith('Uploading') ? 'uploading' : message.startsWith('Downloading') ? 'downloading' : message === 'Up to date' ? 'complete' : 'preparing', completed: message === 'Up to date' ? 1 : 0, total: 1, message } }),
      });
      const localIds = await localWorkspaceIds();
      const rerunPending = v2SyncRunner.hasPending;
      const finalStatus: CloudSyncStatus = v2.status === 'synced' ? 'synced' : v2.status === 'synced-review' ? 'synced-review' : v2.status === 'conflict' ? 'conflict' : v2.status === 'blocked' ? 'error' : v2.errorCode ? presentCloudError(new CloudOperationError(v2.errorCode, v2.diagnostic ?? { stage: 'sync-v2', reason: 'sync-failed' })).status : 'error';
      const status: CloudSyncStatus = rerunPending ? 'syncing' : finalStatus;
      const syncedAt = !rerunPending && (finalStatus === 'synced' || finalStatus === 'synced-review') ? Date.now() : null;
      const publicMessage = finalStatus === 'synced-review' ? publicCloudMessage('review') : finalStatus === 'synced' ? null : publicCloudMessage(v2.errorCode ?? (finalStatus === 'conflict' ? 'conflict' : 'sync'));
      if (v2.diagnostic && finalStatus !== 'synced' && finalStatus !== 'synced-review') logAccountSyncFailure(v2.diagnostic);
      set(state => ({
        isSyncing: rerunPending,
        statusByProvider: { ...state.statusByProvider, googledrive: status },
        workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(localIds.map(id => [id, status === 'synced' || status === 'synced-review' || status === 'conflict' || status === 'syncing' || status === 'offline' || status === 'auth-expired' || status === 'rate-limited' ? status : 'error'])) },
        lastSyncedByProvider: { ...state.lastSyncedByProvider, googledrive: syncedAt ?? state.lastSyncedByProvider.googledrive },
        lastSyncedByWorkspaceId: { ...state.lastSyncedByWorkspaceId, ...Object.fromEntries(localIds.map(id => [id, syncedAt ?? state.lastSyncedByWorkspaceId[id] ?? null])) },
        lastError: rerunPending ? null : publicMessage,
        lastDiagnostic: rerunPending ? null : v2.diagnostic ?? null,
        progress: rerunPending ? { stage: 'preparing', completed: 0, total: 1, message: 'Checking cloud...' } : finalStatus === 'synced' || finalStatus === 'synced-review' ? { stage: 'complete', completed: 1, total: 1, message: finalStatus === 'synced-review' ? 'Synced - changes need review' : 'Up to date' } : null,
        migrationWorkspaceIds: [],
      }));
      if (v2.downloaded > 0) {
        const workspaceStore = await import('@/stores/workspaceStore');
        await workspaceStore.useWorkspaceStore.getState().loadWorkspaces();
      }
      } catch (error) {
        const shown = presentCloudError(error, 'sync-v2');
        const rerunPending = v2SyncRunner.hasPending;
        logAccountSyncFailure(shown.diagnostic);
        set(state => ({
          isSyncing: rerunPending,
          statusByProvider: { ...state.statusByProvider, googledrive: rerunPending ? 'syncing' : shown.status },
          lastError: rerunPending ? null : shown.message,
          lastDiagnostic: rerunPending ? null : shown.diagnostic,
          progress: rerunPending ? { stage: 'preparing', completed: 0, total: 1, message: 'Checking cloud...' } : null,
        }));
      }
      });
      return;
    }

    let diagnosticWorkspaceId = workspaceId;
    try {
      let localIds = await localWorkspaceIds();
      let bindings = reconcileWorkspaceBindings(connection.accountIdentifier, localIds, undefined, Date.now(), connection.email ? [connection.email] : []);
      const replicatedWorkspaceIds = new Set<string>();

      // Auto-bind all normal local workspaces for this account
      for (const localId of localIds) {
        if (localId !== 'default' && !workspaceHasBinding(bindings, localId)) {
          bindings = saveWorkspaceBinding(bindingFor(localId, connection, 0, bindings));
        }
      }

      // Automatically discover remote workspaces and auto-replicate any that are missing locally on this device
      let newReplicasCreated = false;
      if (googleDriveProvider.listRemoteWorkspaces) {
        try {
          set({ progress: { stage: 'preparing', completed: 0, total: 1, message: 'Checking cloud...' } });
          const remoteList = await googleDriveProvider.listRemoteWorkspaces();
          set({ remoteWorkspaces: remoteList });
          const replicas = await replicateMissingRemoteWorkspaces({
            remoteWorkspaces: remoteList,
            localWorkspaceIds: localIds,
            provider: googleDriveProvider,
            journalStore: dexieSyncJournalStore,
            payloadSource: localPayloadSource,
            onWorkspace: (completed, total, remoteWorkspaceId) => {
              diagnosticWorkspaceId = remoteWorkspaceId;
              set({ progress: { stage: 'downloading', completed: completed - 1, total, message: `Syncing workspace ${completed} of ${total}...` } });
            },
            onRecordProgress: (workspaceNumber, workspaceTotal, completed, total, remoteWorkspaceId) => {
              diagnosticWorkspaceId = remoteWorkspaceId;
              set({ progress: { stage: 'downloading', completed, total, message: `Syncing workspace ${workspaceNumber} of ${workspaceTotal}... Downloading changes ${completed} of ${total}...` } });
            },
          });
          for (const replica of replicas) {
            bindings = saveWorkspaceBinding(bindingFor(replica.workspaceId, connection, replica.remoteRevision, bindings));
            deviceStates.set(replica.workspaceId, { lastSeenRevision: replica.remoteRevision });
            replicatedWorkspaceIds.add(replica.workspaceId);
            newReplicasCreated = true;
          }
        } catch (error) { throw error; }
      }

      if (newReplicasCreated) {
        localIds = await localWorkspaceIds();
        const workspaceStore = await import('@/stores/workspaceStore');
        await workspaceStore.useWorkspaceStore.getState().loadWorkspaces();
      }

      const migrationWorkspaceIds = accountMigrationWorkspaceIds(bindings, localIds, connection.accountIdentifier);
      const allBound = attachedWorkspaceIds(bindings, connection.accountIdentifier, localIds);
      const workspaceIds = (workspaceId ? (allBound.includes(workspaceId) ? [workspaceId] : []) : allBound)
        .filter(id => !replicatedWorkspaceIds.has(id));
      const workspaceOutcomes = new Map<string, WorkspaceCloudStatus>([...replicatedWorkspaceIds].map(id => [id, 'synced']));
      for (const id of migrationWorkspaceIds) workspaceOutcomes.set(id, 'account-migration-required');

      if (workspaceIds.length === 0) {
        if (migrationWorkspaceIds.length > 0) {
          const shown = presentCloudError(new CloudOperationError('account-migration-required', {
            workspaceId: migrationWorkspaceIds[0], stage: 'workspace-account-isolation', operation: 'discover',
            reason: 'workspace-bound-to-different-account', retryable: false,
          }));
          logAccountSyncFailure(shown.diagnostic);
          set(state => ({
            bindings, migrationWorkspaceIds, isSyncing: false,
            statusByProvider: { ...state.statusByProvider, googledrive: 'account-migration-required' },
            workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(workspaceOutcomes) },
            lastError: shown.message, lastDiagnostic: shown.diagnostic, progress: null,
          }));
          return;
        }
        const syncedAt = Date.now();
        set(state => ({ bindings, migrationWorkspaceIds: [], isSyncing: false, statusByProvider: { ...state.statusByProvider, googledrive: 'synced' }, workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(workspaceOutcomes) }, lastSyncedByProvider: { ...state.lastSyncedByProvider, googledrive: syncedAt }, lastError: null, progress: { stage: 'complete', completed: 1, total: 1, message: 'Up to date' } }));
        return;
      }

      set(state => ({ bindings, workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(workspaceIds.map(id => [id, 'syncing'])) } }));

      const metrics = emptyMetrics(); let errors = 0, conflicts = 0; let firstError: SyncEntryError | null = null; let firstErrorWorkspaceId: string | undefined;
      let firstConflict: { workspaceId: string; entityId: string; reason: string } | null = null;

      for (let idx = 0; idx < workspaceIds.length; idx++) {
        const activeWorkspaceId = workspaceIds[idx];
        diagnosticWorkspaceId = activeWorkspaceId;
        const progressPrefix = workspaceIds.length > 1 ? `Syncing workspace ${idx + 1} of ${workspaceIds.length}...` : undefined;
        const priorBinding = bindings.find(item => item.workspaceId === activeWorkspaceId && item.providerAccountId === connection.accountIdentifier);
        const deviceState = deviceStates.get(activeWorkspaceId) ?? { lastSeenRevision: priorBinding?.lastKnownRemoteRevision ?? 0 };
        deviceStates.set(activeWorkspaceId, deviceState);
        await recoverStaleJournalMetadata(activeWorkspaceId);

        const result = await runSyncCycle({
          workspaceId: activeWorkspaceId,
          deviceId: localDeviceId(),
          journalStore: dexieSyncJournalStore,
          provider: googleDriveProvider,
          payloadSource: localPayloadSource,
          deviceState,
          now: Date.now(),
          objectConcurrency: 4,
          onProgress: val => set({ progress: progressPrefix ? { ...val, message: `${progressPrefix} (${val.message})` } : val }),
        });

        metrics.localEntitiesScanned += result.localEntitiesScanned; metrics.payloadsLoaded += result.payloadsLoaded; metrics.objectsUploaded += result.objectsUploaded; metrics.objectsAlreadyPresent += result.objectsAlreadyPresent; metrics.manifestEntries += result.manifestEntries; metrics.journalEntriesProcessed += result.journalEntriesProcessed; metrics.conflictsCreated += result.conflictsCreated; metrics.bytesUploaded += result.bytesUploaded; metrics.largeAssets += result.largeAssets; metrics.totalGoogleRequests += result.providerRequests.requests; metrics.retries += result.providerRequests.retries; metrics.backoffMs += result.providerRequests.backoffMs; metrics.timeouts += result.providerRequests.timeouts; metrics.totalDurationMs += result.stageTimingsMs.total; metrics.manifestReadMs += result.stageTimingsMs.manifestRead; metrics.manifestWriteMs += result.stageTimingsMs.manifestWrite; metrics.manifestReadBackMs += result.stageTimingsMs.manifestReadBack; metrics.hashingAndLoadMs += result.stageTimingsMs.payloadLoadAndHash; metrics.objectTransferMs += result.stageTimingsMs.objectTransfer;

        let applyErrors = 0;
        let applyFirstError: SyncEntryError | undefined;

        if (result.recordsForDownload.length) {
          const applied = await applyRemoteChanges({
            workspaceId: activeWorkspaceId,
            records: result.recordsForDownload,
            provider: googleDriveProvider,
            journalStore: dexieSyncJournalStore,
            onProgress: (completed, total) => set({ progress: { stage: 'downloading', completed, total, message: `Downloading changes ${completed} of ${total}...` } }),
          });
          metrics.remoteObjectsDownloaded += applied.applied;
          applyErrors = applied.errors;
          applyFirstError = applied.firstError;
        }

        // Remote application can acknowledge journal rows after runSyncCycle
        // returns. Derive the account result from the post-apply journal, so a
        // resolved stale row cannot leave the card red while the header goes
        // green. Non-journal transport/apply failures remain counted.
        const unresolvedAfterApply = await dexieSyncJournalStore.listUnresolved!(activeWorkspaceId);
        const unresolvedErrorsAfterApply = unresolvedAfterApply.filter(entry => entry.state !== 'conflict');
        const intrinsicErrors = result.errors.filter(error => error.stage !== 'retry-backoff');
        const workspaceErrors = Math.max(intrinsicErrors.length + applyErrors, unresolvedErrorsAfterApply.length);
        errors += workspaceErrors;
        conflicts += result.conflicts.length;
        const currentError = intrinsicErrors[0] ?? applyFirstError ?? (unresolvedAfterApply.length > 0 ? result.errors[0] : undefined);
        if (!firstError && currentError) { firstError = currentError; firstErrorWorkspaceId = activeWorkspaceId; }
        if (!firstConflict && result.conflicts[0]) firstConflict = { workspaceId: activeWorkspaceId, ...result.conflicts[0] };
        const outcome: WorkspaceCloudStatus = result.conflicts.length ? 'conflict' : workspaceErrors ? 'error' : 'synced';
        workspaceOutcomes.set(activeWorkspaceId, outcome);
        if (outcome === 'synced') bindings = saveWorkspaceBinding(bindingFor(activeWorkspaceId, connection, deviceState.lastSeenRevision, bindings));
      }

      const finalized = finalizeAccountSync(errors, conflicts, firstError, Date.now(), migrationWorkspaceIds.length);
      const finalStatus = finalized.status;
      const syncedAt = finalized.lastSyncedAt;
      const shown = firstError
        ? presentCloudError(entryError(firstError, firstErrorWorkspaceId ?? diagnosticWorkspaceId ?? firstError.entityId), firstError.stage)
        : errors
          ? presentCloudError(new CloudOperationError('sync', { workspaceId: diagnosticWorkspaceId, stage: 'sync-cycle', operation: 'sync', reason: 'unresolved-entries', retryable: false }))
            : firstConflict
              ? presentCloudError(new CloudOperationError('conflict', { workspaceId: firstConflict.workspaceId, stage: 'conflict-resolution', operation: 'sync', reason: firstConflict.reason, entityId: firstConflict.entityId, retryable: false }))
              : finalStatus === 'account-migration-required'
                ? presentCloudError(new CloudOperationError('account-migration-required', { workspaceId: migrationWorkspaceIds[0], stage: 'workspace-account-isolation', operation: 'discover', reason: 'workspace-bound-to-different-account', retryable: false }))
                : null;
      if (shown) logAccountSyncFailure(shown.diagnostic);
      if ((import.meta as any).env?.DEV) console.info('[CloudSync metrics]', metrics);

      set(state => ({
        bindings, migrationWorkspaceIds,
        isSyncing: false,
        statusByProvider: { ...state.statusByProvider, googledrive: finalStatus },
        workspaceStatusById: { ...state.workspaceStatusById, ...Object.fromEntries(workspaceOutcomes) },
        lastSyncedByWorkspaceId: { ...state.lastSyncedByWorkspaceId, ...Object.fromEntries([...workspaceOutcomes].filter(([, status]) => status === 'synced').map(([id]) => [id, syncedAt])) },
        lastSyncedByProvider: { ...state.lastSyncedByProvider, googledrive: syncedAt ?? state.lastSyncedByProvider.googledrive },
        lastError: shown?.message ?? null,
        lastDiagnostic: shown?.diagnostic ?? null,
        lastMetrics: metrics,
        progress: finalStatus === 'synced' ? { stage: 'complete', completed: 1, total: 1, message: metrics.objectsUploaded ? 'All changes synchronized' : 'Up to date' } : null,
      }));
    } catch (error) {
      const base = presentCloudError(error, 'sync-cycle');
      const shown = diagnosticWorkspaceId && !base.diagnostic.workspaceId
        ? presentCloudError(new CloudOperationError(base.code, { ...base.diagnostic, workspaceId: diagnosticWorkspaceId, operation: base.diagnostic.operation ?? 'sync' }), base.diagnostic.stage)
        : base;
      logAccountSyncFailure(shown.diagnostic);
      set(state => ({ isSyncing: false, statusByProvider: { ...state.statusByProvider, googledrive: shown.status }, lastError: shown.message, lastDiagnostic: shown.diagnostic, progress: null }));
    }
  },
}));

export function scheduleAutoCloudSync(): void {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => { const state = useCloudSyncStore.getState(); if (state.autoSync && state.connectionByProvider.googledrive) void state.triggerSync(); }, 8_000);
}
