# Cloud Sync: reset this device

This procedure applies only when Google Drive Cloud Sync is explicitly enabled. It resets the local replica; it does not delete Drive objects, manifests, account state, or OAuth credentials.

## Before resetting

Use the Cloud Sync panel's **Reset this device** action and read its confirmation. Export a workspace backup first when the local copy contains work that is not yet in Drive. Do not use a filesystem delete as a substitute for this flow.

## What the reset does

- **Browser:** removes the current user's local workspaces, payloads, assets, trash, sync journals, baselines, bindings, and review records from Dexie/IndexedDB.
- **Electron:** waits for any legacy migration, snapshots discovered workspace roots and device-local asset stores into a dated recovery directory, then removes only the validated local roots and stores.
- A pending-reset marker prevents normal default-workspace bootstrap while the remote hierarchy is being restored.
- After local cleanup, the ordinary sync path hydrates the remote hierarchy from the workspace root down. The marker is cleared only after a terminal sync result; failed hydration remains recoverable for a later retry.

## Safety boundaries

- The reset IPC is available only to a trusted renderer sender.
- Electron deletion is limited to validated workspace roots; the Panvas storage root itself is never recursively removed.
- Recovery data is local and dated. Drive files and OAuth/account state are outside the deletion set.
- Existing conflict choices remain unchanged: **Use Google Drive**, **Use this device**, or **Keep both**.

## Verification

The reset flow is covered by the cloud-workspace flow and production UI tests. Run `npm run test:cloud-workspace-flow` and `npm run typecheck` when changing this behavior. Treat reset, migration, and sync changes as high-risk and review them together.
