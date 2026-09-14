# Returning-device recovery — 2026-09-11

## Verified scope

The V2 engine previously checked raw equality, then treated a missing per-record
baseline as divergence. With a partially populated baseline, equivalent browser
rows (ownership stamps, opening/expansion bookkeeping) could therefore block the
entire workspace. Existing semantic comparison only covered records with a base.

The missing-base path now compares verified cloud object content before declaring
a conflict. An unchanged historical predecessor still permits downloading a newer
cloud version. Existing baselines also recognize their recorded local hash, not
only the remote wire hash. Once the Drive profile is verified, the complete
remote workspace is inspected, including rows with stale or missing ownership
stamps. Content and historical-base checks decide whether the cloud copy is
canonical; rows that cannot be proven unchanged remain excluded from apply and
protected. This is evidence-based reconciliation, not an unconditional cloud
overwrite or an inference from
“Last synced: Never”.

## Safety and persistence

- Verified account/profile checks remain enforced.
- Before replacing a live local record, persist its bytes in the existing local
  `panvas-sync-v2` IndexedDB recovery/conflict store. Proven unchanged recovery
  copies use a `recovery:` key and a non-null `resolvedAt`; they are retained, but
  do not create a false user-review requirement. Existing adoption conflicts keep
  their unresolved review status and are not archived twice.
- Browser apply re-scans the workspace inside a Dexie write transaction. Any
  intervening edit/addition/removal rejects recovery. The full workspace download
  applies in hierarchy order in that same transaction; failure rolls it back.
- Rebuild baselines from committed records. Capture local transformed hashes only
  when their semantic content still matches the downloaded bytes, so a new edit
  is not accidentally marked synchronized.
- Checkpoint completed read-only workspaces for an already verified profile, so
  a later workspace failure does not discard their successful baselines.
- If a previously interrupted publisher left a manifest record without its
  content-addressed Drive object, manifest validation repairs it only when the
  current replica has bytes whose SHA-256 exactly equals the manifest hash.
  The repair is idempotent and never fabricates or replaces divergent content.
- If the manifest's current object is already irretrievably absent and the
  durable Electron filesystem still has that live entity, Electron uploads its
  complete current bytes first and conditionally rewrites only that broken
  record to the new content hash. Its base is reset to the same available hash,
  removing the dangling pointer. Browser caches cannot perform this recovery;
  they remain read-only until a durable device repairs the cloud graph. A
  durable device that also lacks the entity still fails closed with the exact
  `remote-object-missing` diagnostic.
- No storage reset, Drive deletion, account-ID change, or unconditional
  owner-guard bypass. A stale owner stamp is repaired only inside a verified
  canonical download whose workspace passed the unchanged/edit checks.
- If no baseline/history proves a divergent record unchanged, it remains a
  conflict. An empty V2 journal is **not** proof of no edits: V2 does not currently
  populate the V1 mutation journal.

## Diagnostics

Both explicit reconciliation conflicts and thrown apply failures return sanitized
workspace/entity IDs, stage, reason, and retryability. A missing content object is
reported as `stage: object-download`, `reason: remote-object-missing` with the
affected entity, rather than being reduced to a generic `Error`. The Cloud Sync
panel exposes these under **Sync diagnostic details**, and the existing diagnostic
logger still receives them. Tokens, email addresses and document bytes are not
added to logs.

## Validation

`npm run test:cloud-returning-browser` runs production browser storage scanning,
application, baseline persistence and recovery archives in isolated Chromium
contexts with real IndexedDB. Only the external Drive provider is in memory.

Scenarios:

1. Fourteen existing browser workspaces with root-only baselines; newer cloud page
   contents/drawings plus missing PDF pages, annotations, canvas scenes, custom
   blocks, PDF/image/audio bytes. All converge, retain 29 replaced-record archives
   (including one stale non-null owner stamp), even when Google Drive OAuth is
   present without a Panvas/Supabase app session,
   rebuild complete baselines, and a second sync is idle without remote writes.
2. A genuine offline same-record edit remains intact and reports its exact identity.
3. An edit injected after scanning but before application is not overwritten.
4. An existing foreign-owned asset with an independently changed local payload
   causes an identified conflict; preceding
   updates and newly inserted hierarchy in that workspace roll back.

Test review: no fixed sleeps, no user-profile reuse, no real Drive credentials,
fresh context per scenario, and teardown in `finally`. This is a browser-storage
end-to-end test, **not** a live OAuth/Google Drive/UI acceptance test. The fixture
is deliberately data-heavy; it exercises storage APIs, not DOM locators.

The focused V2 tests and `npm test` passed (546 passed, one skipped in the main
suite, plus package pretests). All four isolated browser scenarios and all 42 V2
tests passed after the missing-object repair, including two broken pointers
across a ten-workspace interrupted sync and a fresh-device reconstruction. Final typecheck and build passed
for the complete patch. Existing asset/chunk/plugin-option build warnings remain.

## Live acceptance still required

Reload the updated browser code without clearing data, sync on the same account,
then verify existing page bodies/drawings/assets against Electron and repeat sync.
If blocked, use the new diagnostic details to identify the actual record and
failure stage. The supplied user's live storage and Drive account were not read
or modified by this test; do not claim the live incident is verified resolved.

Repository note: `git status` fails because `.git/index` is smaller than expected.
The index was not repaired/reset and existing working files were not discarded.
