import type { CloudWorkspaceBinding } from './types.ts';

const STORAGE_KEY = 'panvas.cloudWorkspaceBindings.v1';
const LEGACY_STORAGE_KEY = 'panvas.cloudWorkspaceBindings';

export interface BindingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): BindingStorage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; }
  catch { return null; }
}

function valid(value: unknown): value is CloudWorkspaceBinding {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CloudWorkspaceBinding>;
  return item.provider === 'googledrive'
    && typeof item.workspaceId === 'string' && item.workspaceId.startsWith('ws-')
    && item.remoteWorkspaceId === item.workspaceId
    && typeof item.providerAccountId === 'string' && item.providerAccountId.length > 0
    && typeof item.lastKnownRemoteRevision === 'number' && Number.isFinite(item.lastKnownRemoteRevision)
    && typeof item.attachedAt === 'number' && Number.isFinite(item.attachedAt);
}

export function loadWorkspaceBindings(storage: BindingStorage | null = defaultStorage()): CloudWorkspaceBinding[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch { return []; }
}

/** Canonicalize browser-profile binding metadata without changing workspace
 * identity. Older builds omitted remoteWorkspaceId/revision timestamps or
 * stored accountId under its pre-V1 name. Only rows for stable local IDs are
 * adopted; foreign-account history remains intact. */
export function reconcileWorkspaceBindings(
  providerAccountId: string,
  localWorkspaceIds: readonly string[],
  storage: BindingStorage | null = defaultStorage(),
  now = Date.now(),
  providerAccountAliases: readonly string[] = [],
): CloudWorkspaceBinding[] {
  if (!storage) return [];
  const local = new Set(localWorkspaceIds.filter(id => id.startsWith('ws-')));
  const candidates: unknown[] = [];
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? '[]');
      if (Array.isArray(parsed)) candidates.push(...parsed);
      else if (parsed && typeof parsed === 'object') candidates.push(...Object.values(parsed));
    } catch { /* malformed metadata is ignored; user content is untouched */ }
  }
  const canonical = new Map<string, CloudWorkspaceBinding>();
  for (const value of candidates) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    const workspaceId = typeof item.workspaceId === 'string' ? item.workspaceId : '';
    let account = typeof item.providerAccountId === 'string' ? item.providerAccountId
      : typeof item.accountId === 'string' ? item.accountId : '';
    if (providerAccountAliases.some(alias => alias && alias.toLowerCase() === account.toLowerCase())) account = providerAccountId;
    if (!local.has(workspaceId) || !account) continue;
    const remoteWorkspaceId = typeof item.remoteWorkspaceId === 'string' ? item.remoteWorkspaceId : workspaceId;
    if (remoteWorkspaceId !== workspaceId) continue;
    const revision = typeof item.lastKnownRemoteRevision === 'number' && Number.isFinite(item.lastKnownRemoteRevision)
      ? Math.max(0, item.lastKnownRemoteRevision) : 0;
    const attachedAt = typeof item.attachedAt === 'number' && Number.isFinite(item.attachedAt) ? item.attachedAt : now;
    canonical.set(`${workspaceId}:${account}`, { workspaceId, provider: 'googledrive', providerAccountId: account, remoteWorkspaceId: workspaceId, lastKnownRemoteRevision: revision, attachedAt });
  }
  for (const workspaceId of local) {
    const key = `${workspaceId}:${providerAccountId}`;
    const hasAnyAccountBinding = [...canonical.values()].some(binding => binding.workspaceId === workspaceId);
    if (!canonical.has(key) && !hasAnyAccountBinding) canonical.set(key, { workspaceId, provider: 'googledrive', providerAccountId, remoteWorkspaceId: workspaceId, lastKnownRemoteRevision: 0, attachedAt: now });
  }
  const next = [...canonical.values()];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function saveWorkspaceBinding(binding: CloudWorkspaceBinding, storage: BindingStorage | null = defaultStorage()): CloudWorkspaceBinding[] {
  // Preserve account ownership history so connecting Account B cannot silently
  // replace Account A's binding and make the same local data eligible for upload.
  const existing = loadWorkspaceBindings(storage).filter(item => !(
    item.provider === binding.provider
    && item.workspaceId === binding.workspaceId
    && item.providerAccountId === binding.providerAccountId
  ));
  const next = [...existing, { ...binding, remoteWorkspaceId: binding.workspaceId }];
  if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function workspaceHasBinding(bindings: readonly CloudWorkspaceBinding[], workspaceId: string): boolean {
  return bindings.some(item => item.provider === 'googledrive' && item.workspaceId === workspaceId);
}

export function workspaceIsBoundToOtherAccount(bindings: readonly CloudWorkspaceBinding[], workspaceId: string, providerAccountId: string): boolean {
  const workspaceBindings = bindings.filter(item => item.provider === 'googledrive' && item.workspaceId === workspaceId);
  return workspaceBindings.length > 0 && !workspaceBindings.some(item => item.providerAccountId === providerAccountId);
}

export function accountMigrationWorkspaceIds(
  bindings: readonly CloudWorkspaceBinding[],
  localWorkspaceIds: readonly string[],
  providerAccountId: string,
): string[] {
  return localWorkspaceIds.filter(workspaceId => workspaceIsBoundToOtherAccount(bindings, workspaceId, providerAccountId));
}

/** Explicit account move: replace local ownership metadata only after the
 * caller has completed safe publication/reconciliation in the new account.
 * This never touches files in either Google account. */
export function moveWorkspaceBinding(
  binding: CloudWorkspaceBinding,
  storage: BindingStorage | null = defaultStorage(),
): CloudWorkspaceBinding[] {
  const existing = loadWorkspaceBindings(storage).filter(item => !(
    item.provider === binding.provider && item.workspaceId === binding.workspaceId
  ));
  const next = [...existing, { ...binding, remoteWorkspaceId: binding.workspaceId }];
  if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function bindingsForAccount(bindings: readonly CloudWorkspaceBinding[], providerAccountId: string): CloudWorkspaceBinding[] {
  return bindings.filter(item => item.provider === 'googledrive' && item.providerAccountId === providerAccountId && item.remoteWorkspaceId === item.workspaceId);
}

export function attachedWorkspaceIds(bindings: readonly CloudWorkspaceBinding[], providerAccountId: string, localWorkspaceIds: readonly string[]): string[] {
  const local = new Set(localWorkspaceIds);
  return bindingsForAccount(bindings, providerAccountId).filter(item => local.has(item.workspaceId)).map(item => item.workspaceId);
}
