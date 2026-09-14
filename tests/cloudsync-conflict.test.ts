import assert from 'node:assert/strict';
import test from 'node:test';
import { decideConflict } from '../src/services/cloudsync/conflict.ts';
import { finalizeAccountSync } from '../src/services/cloudsync/engine.ts';
import { presentCloudError } from '../src/services/cloudsync/errors.ts';
import { AuthExpiredError, GoogleDriveApiError, GoogleDriveTimeoutError, RateLimitedError } from '../src/services/cloudsync/googleDriveProvider.ts';
import { getCloudSyncPresentation, mergeWorkspaceCloudStatuses } from '../src/services/cloudsync/presentation.ts';

test('conflict decisions preserve equal data, publish proven local descendants, and retain divergent copies', () => {
  const remote = { revision: 8, baseRevision: 7, contentHash: 'remote-hash', tombstone: false };
  assert.deepEqual(decideConflict({ baseRevision: 8, contentHash: 'remote-hash', tombstone: false }, remote), { kind: 'coalesce' }, 'equal content coalesces even when revisions differ');
  assert.deepEqual(decideConflict({ baseRevision: 8, contentHash: 'local-newer', tombstone: false }, remote), { kind: 'replace-base' }, 'a local edit based on the current remote head may publish');
  assert.deepEqual(decideConflict({ baseRevision: 7, contentHash: 'stale-local', tombstone: false }, remote), { kind: 'conflict', reason: 'concurrent-edit-edit' }, 'a remote advance never silently discards divergent local content');
  assert.deepEqual(decideConflict({ baseRevision: null, contentHash: 'local-create', tombstone: false }, null), { kind: 'publish-local' });
});

test('provider failures map to deterministic reconnect, retry, offline, and permanent-error states', () => {
  const auth = presentCloudError(new AuthExpiredError(), 'manifest-read');
  const rate = presentCloudError(new RateLimitedError(), 'manifest-write');
  const offline = presentCloudError(new GoogleDriveTimeoutError('object-download'), 'object-download');
  const retryable = presentCloudError(new GoogleDriveApiError({ stage: 'drive', status: 503, reason: 'backend', message: 'temporary' }), 'drive');
  const permanent = presentCloudError(new GoogleDriveApiError({ stage: 'drive', status: 403, reason: 'forbidden', message: 'denied' }), 'drive');
  assert.deepEqual([auth.status, rate.status, offline.status], ['auth-expired', 'rate-limited', 'offline']);
  assert.equal(rate.diagnostic.retryable, true);
  assert.equal(retryable.diagnostic.retryable, true);
  assert.equal(permanent.diagnostic.retryable, false);
  assert.equal(permanent.status, 'error');
});

test('successful resolution clears conflict presentation without contaminating another workspace', () => {
  const before = { 'ws-a': 'conflict' as const, 'ws-b': 'offline' as const };
  const after = mergeWorkspaceCloudStatuses(before, [['ws-a', 'synced']]);
  assert.deepEqual(after, { 'ws-a': 'synced', 'ws-b': 'offline' });
  assert.deepEqual(finalizeAccountSync(0, 0, null, 42), { status: 'synced', lastSyncedAt: 42 });
  const connection = { provider: 'googledrive' as const, accountIdentifier: 'account-1', connectedAt: 1 };
  assert.equal(getCloudSyncPresentation({ enabled: true, status: 'synced', connection }).kind, 'ready');
});
