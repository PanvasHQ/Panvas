import type { CloudWorkspaceBinding, ProviderConnectionInfo } from '../types.ts';
import { CloudOperationError } from '../errors.ts';
import type { SyncV2Catalog, SyncV2Profile, SyncV2ProfileState } from './types.ts';

/**
 * Pure plan for the explicit "Use this account" action.  Keeping the
 * validation and ownership rewrite plan free of storage/provider calls makes
 * the destructive boundary easy to test: callers persist the returned plan
 * only after the destination namespace has passed these checks.
 */
export interface AccountAdoptionPlanInput {
  connection: Pick<ProviderConnectionInfo, 'accountIdentifier' | 'email'>;
  remoteProfile: SyncV2Profile | null;
  remoteCatalog: SyncV2Catalog | null;
  localProfile: SyncV2ProfileState | null;
  localWorkspaceIds: readonly string[];
  legacyBindings: readonly CloudWorkspaceBinding[];
  now?: number;
}

export interface AccountAdoptionPlan {
  profile: SyncV2ProfileState;
  bindings: CloudWorkspaceBinding[];
  foreignWorkspaceIds: string[];
  /** The local profile belongs to another account or an older profile in the
   * same verified account, so its sync baselines must not be compared with
   * the destination account's records. */
  baselineResetRequired: boolean;
}

function sameAccount(binding: CloudWorkspaceBinding, accountIdentifier: string, email?: string | null): boolean {
  return binding.providerAccountId === accountIdentifier
    || Boolean(email && binding.providerAccountId.toLowerCase() === email.toLowerCase());
}

export function planAccountAdoption(input: AccountAdoptionPlanInput): AccountAdoptionPlan {
  const { connection, remoteProfile, remoteCatalog, localProfile } = input;
  const accountSwitch = Boolean(localProfile && localProfile.accountIdentifier !== connection.accountIdentifier);
  if (remoteProfile && remoteProfile.accountIdentifier !== connection.accountIdentifier) {
    throw new CloudOperationError('remote-account-conflict', {
      stage: 'profile-validation', operation: 'adopt', reason: 'remote-account-mismatch', retryable: false,
    });
  }
  // An existing profile owned by the selected Google identity is safe to
  // resume after an interrupted adoption. The V2 engine treats the remote
  // profile as canonical, preserves local divergence in recovery storage, and
  // never merges or deletes remote records blindly.
  if (!remoteProfile && remoteCatalog && remoteCatalog.workspaces.length > 0) {
    throw new CloudOperationError('remote-account-conflict', {
      stage: 'profile-validation', operation: 'adopt', reason: 'remote-account-ambiguous', retryable: false,
    });
  }
  // A profile mismatch is only a protected account conflict when the local
  // profile belongs to another Google account. The same Google identity can
  // legitimately have a profile created by an older browser/device. In that
  // case the remote profile is the canonical sync space; local baselines are
  // reset by the caller and divergent local records are preserved for review
  // during the first reconciliation.
  if (remoteProfile && localProfile && remoteProfile.profileId !== localProfile.profileId
    && localProfile.accountIdentifier !== connection.accountIdentifier) {
    throw new CloudOperationError('remote-account-conflict', {
      stage: 'profile-validation', operation: 'adopt', reason: 'profile-id-mismatch', retryable: false,
    });
  }

  const now = input.now ?? Date.now();
  const foreignWorkspaceIds: string[] = [];
  const next = new Map<string, CloudWorkspaceBinding>();
  const localWorkspaceIds = new Set(input.localWorkspaceIds);

  // Bindings for workspaces outside this device's current-user scope are
  // historical metadata and must remain untouched.  Local workspaces are
  // rebuilt below as one canonical row for the selected account so a stale
  // A-row cannot survive alongside the adopted B-row and poison a later
  // reconciliation.
  for (const binding of input.legacyBindings) {
    if (!localWorkspaceIds.has(binding.workspaceId)) next.set(`${binding.workspaceId}:${binding.providerAccountId}`, binding);
  }

  for (const workspaceId of localWorkspaceIds) {
    const rows = input.legacyBindings.filter(item => item.workspaceId === workspaceId);
    const compatible = rows.filter(item => sameAccount(item, connection.accountIdentifier, connection.email));
    const prior = compatible[0] ?? rows[0];
    if (compatible.length === 0 && rows.length > 0) foreignWorkspaceIds.push(workspaceId);

    // Even an unbound local workspace gets an explicit selected-account row
    // during adoption.  This keeps V1 migration metadata and the V2 profile
    // aligned across reloads; it does not touch any Drive data.
    next.set(`${workspaceId}:${connection.accountIdentifier}`, {
      workspaceId,
      provider: 'googledrive',
      providerAccountId: connection.accountIdentifier,
      remoteWorkspaceId: workspaceId,
      // A foreign row belongs to the old namespace; its revision cannot be
      // used as an optimistic-concurrency token in the selected account.
      lastKnownRemoteRevision: compatible.length > 0 ? (prior?.lastKnownRemoteRevision ?? 0) : 0,
      attachedAt: prior?.attachedAt ?? now,
    });
  }

  return {
    profile: {
      profileId: remoteProfile?.profileId ?? (accountSwitch ? crypto.randomUUID() : localProfile?.profileId ?? crypto.randomUUID()),
      accountIdentifier: connection.accountIdentifier,
    },
    bindings: [...next.values()],
    foreignWorkspaceIds,
    baselineResetRequired: accountSwitch || Boolean(remoteProfile && localProfile && remoteProfile.profileId !== localProfile.profileId),
  };
}
