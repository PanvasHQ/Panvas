# Panvas Sync-0 Contract and Legacy Audit

Status: implementation contract reconciled 2026-08-30. Google Drive sync exists for Electron and browser/PWA. Electron OAuth and real object/manifest creation have manual evidence; stable Electron second-sync and browser/PWA cross-device runtime behavior remain pending user verification. This document does not certify Supabase as a user-data sync backend.

## 2026-08-30 focused reconciliation

- A manifest read-back may acknowledge local publishes, but those same-cycle records must not be returned for local download/re-application. Records authored elsewhere remain eligible when their remote state is genuinely newer or different.
- Remote application is phased: workspace → folder → notebook → section → page/canvas metadata → page content/drawing/canvas scene → custom blocks → assets. A phase completes before the next starts; bounded concurrency is allowed only within a phase.
- A valid empty workspace is not a zero-entity scan: its workspace root is the canonical one-record baseline. `initial-scan-empty` means the requested canonical workspace root was unavailable and remains a failure.
- Account-level success requires every selected workspace to finish without errors, conflicts, or unresolved journal entries.
- Browser/PWA OAuth uses Google Identity Services `initTokenClient` and `requestAccessToken` with only the public `VITE_PANVAS_GOOGLE_WEB_CLIENT_ID`. No desktop client-ID fallback, browser client secret, refresh token, or persistent browser token storage is allowed.

## Boundary and selected architecture

Panvas remains local-first. A successful local save is complete without a network, account, or provider. Sync is an explicitly enabled transport for a selected workspace; it never becomes the canonical store and disabling it never removes or hides local content.

Electron keeps refresh/access tokens in the main process and OS-protected storage. Browser/PWA uses the Google Identity Services token model: the build contains only a public Web OAuth client ID, the short-lived access token remains in memory, and expiry requires token reacquisition. Browser canonical documents remain in IndexedDB and use the same provider-neutral object/manifest engine.

No Electron provider token, refresh token, client secret, raw path, or unrestricted filesystem operation may cross the preload boundary. Electron remote application uses only a validated record capability. In browser builds there is no client secret or refresh token; the short-lived access token is memory-only and provider requests remain constrained to the Google Drive adapter.

The renderer-side Supabase data-sync engine is **legacy/quarantined** and is not the Google Drive transport. `VITE_ENABLE_CLOUD_SYNC` remains a release gate; manual Electron/browser acceptance is still required before enabling it for a release candidate.

## Canonical local sources

| Record family | Electron canonical source | Browser canonical source | Sync-0 requirement |
| --- | --- | --- | --- |
| Workspace, folder, canvas/notebook/page metadata and tombstones | `.panvas/workspace.json` plus recovery mirror | IndexedDB domain tables | Versioned records with stable IDs and parent references |
| Canvas scene and custom blocks | `Canvas/<canvasId>.json` | `canvasData` and `customBlocks` | One opaque, hash-verified scene record in v1 |
| Rich page content | `Notebooks/<notebookId>/pages/<pageId>.content.json` | `notebookPageContents` | Independent versioned record |
| Page/PDF drawing, layers, shapes and audio references | `Notebooks/<notebookId>/pages/<pageId>.drawing.json` | `notebookPageDrawings` | Independent versioned record |
| PDF, image and audio bytes | validated global asset stores keyed by generated ID | `pdfFiles`, `imageFiles`, and browser audio blobs | Immutable content-addressed objects plus reference metadata |
| Local Elements and workspace tool presets | `.panvas/settings.json` | workspace-scoped local storage/settings | Versioned workspace settings records; built-ins are not uploaded |
| View/session state | local UI stores | local UI stores | Never synchronized in v1 |
| Obsidian knowledge vault | separate read-only knowledge contract | unavailable | Never synchronized by Panvas cloud sync |

## Remote format

Each opted-in workspace has one manifest and immutable record/object payloads. JSON is UTF-8 with canonical key ordering before SHA-256 hashing.

```ts
interface SyncManifestV1 {
  format: 'panvas-sync';
  schemaVersion: 1;
  workspaceId: string;
  revision: number;
  previousRevision: number | null;
  writerDeviceId: string;
  generatedAt: string; // diagnostic only; never used for conflict ordering
  records: RecordPointer[];
}

interface RecordPointer {
  kind: SyncEntityKind;
  id: string;
  parentId: string | null;
  revision: number;
  baseRevision: number | null;
  contentHash: string;
  tombstone: boolean;
}
```

Provider writes use optimistic concurrency: `readManifest` returns the provider revision/ETag and `writeManifest` requires it through `ifMatch`. A rejected precondition triggers pull/reconciliation; it is never retried as an unconditional overwrite. Client timestamps are display evidence only.

Required adapter operations are `authorize`, `disconnect`, `getStatus`, `readManifest`, `writeManifest(ifMatch)`, `getObject(hash)`, `putObjectIfAbsent(hash, bytes)`, and `listRecoveryVersions`. Provider-specific identifiers remain inside the adapter.

## Local journal and commit protocol

1. Commit and verify the canonical local write first.
2. Append a versioned journal entry containing stable entity ID, kind, base revision, content hash, and action. Desktop journal updates use the existing atomic write queue; browser support, when separately approved, uses one IndexedDB transaction.
3. Upload immutable payloads and binary objects before publishing references to them.
4. Fetch the current remote manifest and ETag, reconcile, then publish with `ifMatch`.
5. Mark journal entries acknowledged only after the manifest read-back contains the expected hashes.

Retries are idempotent and use bounded exponential backoff with jitter. Repeated failures pause sync and remain visible; no failed network/auth/RLS operation may delete or reassign local content. Account switching leaves every local workspace intact and clears only in-memory provider capability state.

## Deterministic conflict policy

Sync v1 treats canvas scenes, rich text payloads, and drawing payloads as opaque records. It does not silently combine document JSON or advertise CRDT behavior.

- Identical hashes coalesce.
- A non-concurrent update replaces its base revision.
- Concurrent edit/edit creates a durable conflict sidecar containing both hashes and device/revision provenance. The remote version remains the shared head; the local edit stays intact and locally visible with `syncStatus: conflict` until the user selects one or explicitly keeps both.
- Concurrent delete/edit is always a visible conflict. Neither side is discarded.
- A tombstone wins only when the deleted record is based on the current head and no concurrent edit exists.
- Conflict resolution is a new optimistic manifest revision and is itself retryable/auditable.

Automatic hard deletion is out of scope for v1. Tombstones and referenced objects are retained indefinitely. A later, separately confirmed compaction protocol may purge only after all registered devices acknowledge a checkpoint and a recoverable backup exists.

## Privacy, recovery, and diagnostics

- Transport uses provider HTTPS and provider-at-rest protection. End-to-end encryption is not claimed in v1; adding it requires a key-recovery/product decision.
- Sync logs contain operation IDs, entity kinds, hashes, redacted provider error classes, attempts, and timings—never note text, binary contents, tokens, email addresses, or absolute local paths.
- Telemetry remains off unless independently opted in; sync correctness never depends on telemetry.
- Initial restore downloads to a staging area, validates schema/IDs/parents/hashes and size limits, writes a local backup, then imports atomically. An existing local workspace with the same ID becomes a visible reconciliation case, never an overwrite.
- Disconnecting or losing authorization stops network work only. Local data remains usable and exportable.

## Legacy implementation audit

| Area | Current evidence | Verdict required before enablement |
| --- | --- | --- |
| Entity coverage | `SyncQueueItem` supports only workspace, folder, canvasFile and canvasData | Add notebooks, sections, pages, page content/drawings, custom blocks/settings, all binary references/objects, and every tombstone |
| Native Electron writes | repositories return through `window.panvas` before adding Dexie outbox entries | Journal canonical main-process filesystem commits; do not depend on renderer Dexie |
| Local adoption | the former canvas-only purge was removed; existing-user adoption now stops when an unclaimed system workspace exists | Add an explicit merge/adopt/keep-local UI that evaluates every entity family |
| Auth/RLS failures | the former local-delete branch was removed; rejection now fails the queued operation and preserves local rows | Retain this invariant in main-process provider tests |
| Conflict ordering | pull compares remote `updated_at` with client `updatedAt` | Replace client-clock LWW with manifest revision plus ETag/`ifMatch` |
| Canvas merge | element versions are merged, but app state/files/custom-block enqueue and delete semantics are incomplete | Treat v1 scene as opaque or prove a complete element/tombstone merge suite |
| Deletes | soft deletes cover only three metadata tables; legacy hard remote DELETE calls are now blocked | Add durable tombstones for every record and the acknowledged compaction protocol |
| Binary assets | PDF/image/audio stores have no remote manifest, hash, retry, or garbage-collection protocol | Upload immutable hashed objects before record references and verify downloads |
| Credentials | Supabase PKCE sessions currently persist in renderer storage | Move Windows provider tokens to main/OS secure storage; keep renderer token-free |
| RLS/schema | only four tables and one scene bucket exist; migrations overlap and omit the final entity set | Replace with one idempotent schema, ownership-preserving foreign keys, complete RLS/storage policies, and adversarial tests |

The existing RLS predicates correctly attempt per-row `auth.uid() = user_id`, but they do not establish ownership consistency through every parent/child relationship, cover the final entity set, or make the migration set safely repeatable. They are insufficient evidence for production isolation.

## Acceptance suite before OneDrive enablement

All results must be produced with the feature disabled first, then in an isolated test tenant/account:

1. Enable, disable, sign out, and provider outage leave canonical local data unchanged and usable.
2. Two clean devices converge for every record family and all supported binary assets.
3. Concurrent edit/edit and delete/edit create visible, recoverable conflicts with deterministic resolution.
4. Interrupted asset upload never publishes a dangling reference; retry is idempotent.
5. A stale manifest `ifMatch` write is rejected and cannot overwrite newer remote state.
6. Corrupt, oversized, wrong-owner, wrong-parent, and hash-mismatched remote records are quarantined without local mutation.
7. Trash/restore and offline permanent-delete attempts cannot resurrect or silently erase content.
8. Account switching and RLS denial preserve local records and isolate remote accounts.
9. Fresh-device restore and restore-from-backup reproduce the canonical workspace, including pages, annotations, Elements, and assets.
10. Renderer inspection proves no token, provider endpoint/client, raw path, Node primitive, or unrestricted write capability.

Only after this suite passes may `VITE_ENABLE_CLOUD_SYNC=true` be used in a release candidate. Google Drive, Dropbox, and Box must reuse the same adapter/manifest contract rather than introduce provider-specific document models.
