# Cloud Sync V2 handoff

> **HISTORICAL — superseded by [`CLOUD_SYNC_V0_1_ARCHITECTURE.md`](CLOUD_SYNC_V0_1_ARCHITECTURE.md).**
>
> This file is retained for incident/debugging context. It is not a current
> implementation plan and must not be used to reopen the feature-frozen V2
> architecture.

## Why V2 exists

V1 passed extensive automated tests but failed real multi-device use with stale journals, partial migration state, account-binding conflicts, false success, incomplete reconstruction, and a real stale-browser overwrite incident. V2 is side-by-side and does not migrate, delete, or modify V1 Drive data.

## Protocol

Remote namespace: `Panvas/sync-v2/`

- `profile.json`: one local Panvas sync profile linked to one Google account
- `catalog.json`: authoritative account-level workspace index
- `workspaces/<workspaceId>/manifest.json`: stable entity IDs, hashes, base hashes, parents, tombstones
- `objects/<sha256>`: immutable JSON or generic binary asset envelopes

Sync fetches the catalog, unions local and remote workspace IDs, scans canonical local records, reconciles by stable entity ID and a known common hash, uploads/verifies objects, publishes manifests last, conditionally publishes the catalog, then commits the fresh local V2 baseline. Mere absence never deletes. Unknown ancestry and concurrent same-entity edits conflict and keep local data.

## Reused primitives

- `LocalSyncPayloadSource`: canonical Electron/browser entity and asset enumeration
- `defaultRemoteRecordLocalAdapter`: dependency-safe canonical local writes
- SHA-256/canonical JSON helpers
- generic `asset-envelope-v1` encoding (PDF/image/audio metadata plus exact bytes)
- Google Drive request retry, bounded upload, object index, ETag checks, and one-shot 401 refresh
- existing OAuth: Electron tokens stay main-process-only; browser GIS tokens stay memory-only

## New primitives

- `src/services/cloudsync/v2/engine.ts`: catalog-driven deterministic reconcile
- `src/services/cloudsync/v2/types.ts`: V2 profile/catalog/manifest/baseline contracts
- `src/services/cloudsync/v2/baselineStore.ts`: isolated `panvas.cloudSync.v2.*` local baseline keys
- `src/services/cloudsync/v2/googleDriveV2Provider.ts`: namespaced Drive adapter
- `src/services/cloudsync/v2/localAdapter.ts`: narrow bridge to proven canonical storage
- `tests/cloud-sync-v2.test.ts`: incident and transaction matrix

## PDF root cause and fix

Electron PDF metadata is mirrored in IndexedDB `pdfFiles`, while canonical bytes live behind `binary:getPdf`; browser bytes live directly in IndexedDB `pdfFiles.data`. Metadata-only reconstruction cannot render. V2 scans the metadata ownership record, reads exact Electron bytes through the validated binary IPC, wraps metadata plus bytes in a generic asset envelope, hashes/uploads it before manifest publication, then writes both browser IndexedDB and Electron binary storage during reconstruction. This is generic for PDF, image, and audio assets—not extension-specific.

## Files changed for V2

- `.env.example`
- `src/config/features.ts`
- `src/vite-env.d.ts`
- `src/services/cloudsync/googleDriveProvider.ts`
- `src/services/cloudsync/v2/*`
- `electron/ipc/cloudsync-handlers.ts`
- `electron/preload.ts`
- `src/types/electron.d.ts`
- `src/stores/cloudSyncStore.ts`
- `src/components/library/CloudSyncPanel.tsx`
- `tests/cloud-sync-v2.test.ts`
- `package.json`

The worktree contained many pre-existing uncommitted changes in several of these shared files. Review the V2 hunks only.

## Tests

Automated coverage includes rich Electron → fresh browser reconstruction, exact PDF bytes, browser → Electron/different-entity union, stale-browser protection, same-entity conflict, proven tombstones, local/remote absence safety, idle idempotency, incomplete objects, interrupted manifest/catalog publication, exact hashes, and account blocking. Existing Google provider tests cover one-shot 401 refresh.

Runtime was deliberately not launched and live Drive was not touched.

## Manual certification plan

1. Back up Electron data independently; keep the recovery snapshot untouched.
2. Build with `VITE_ENABLE_CLOUD_SYNC=true` and `VITE_PANVAS_SYNC_V2=true`.
3. In Electron, confirm a rich workspace contains text, drawing, PDF, canvas, and nested folder/notebook/section/page IDs; connect Google and Sync now.
4. Confirm Drive creates only `Panvas/sync-v2/` V2 files and leaves legacy Panvas files unchanged.
5. In a fresh Chrome profile with only defaults, connect the same account and Sync now; verify automatic reconstruction and identical IDs/content, especially actual PDF rendering.
6. Create a browser page/drawing, sync, then sync Electron and verify arrival.
7. Repeat in a fresh Brave profile.
8. Test stale/incomplete same-ID browser state; verify Electron-only entities survive and download.
9. Test different-entity offline edits (union), then same-entity offline edits (visible conflict; local edit retained).
10. Expire/revoke a token during transfer and verify exactly one refresh/retry and truthful failure if renewal fails.
11. Connect a different Google account and verify V2 blocks without upload, migration, or changes to either account.
12. Disable `VITE_PANVAS_SYNC_V2`; verify legacy UI/path remains available and local data is unchanged.

## Unresolved risks / Sol review

Review:

- Real Drive ETag behavior for V2 root/workspace JSON files
- crash timing between manifest and catalog publication
- real Electron PDF/image/audio byte discovery and fresh Chrome/Brave rendering
- account/profile UX wording (V2 intentionally offers no automatic migration)
- scalability of full required-object availability checks
- explicit binary-asset tombstone lifecycle (V2 never infers deletion from missing metadata)

Do not rewrite OAuth, canonical workspace storage, PDF renderer, drawing/Canvas engines, Trash, backup, Supabase auth, or V1 recovery paths. Do not add account migration to V2.

## Status

**SYNC V2 IMPLEMENTED / TEST-PASSING — PENDING MANUAL ELECTRON + CHROME + BRAVE CERTIFICATION**
