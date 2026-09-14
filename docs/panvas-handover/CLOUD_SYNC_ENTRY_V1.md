# Cloud Sync entry handoff

Last validated: 2026-09-10

## IMPLEMENTED / TEST-PASSING

Panvas now has one canonical Cloud Sync entry path:

- The TopBar cloud status button always navigates to the Library Cloud Sync view.
- The Command Palette `Cloud Sync` command uses the same route.
- The unauthenticated local-mode prompt uses `Connect Google Drive` and opens the same view. `Continue locally` and the close button dismiss the prompt for the current browser session through `sessionStorage`; local editing is never blocked.
- `SyncIndicator` renders disconnected, connecting, syncing, connected, synced, offline and attention states from `cloudSyncStore`. It does not send the user to `/auth/login` or `/auth/signup`.
- StatusBar and Workspace settings use the same canonical presentation as `SyncIndicator`, so disconnected, offline, reconnect, conflict, error, connected, and synced states cannot diverge between surfaces.
- The Library panel's primary action is `Connect Google Drive` and calls the existing `requestConnect('googledrive')` provider action. Connected users retain Sync now, Disconnect, migration and error/review states.

## ARCHITECTURE AND SECURITY CONTRACT

This correction reuses the existing `CloudSyncPanel`, `cloudSyncStore`, Electron IPC and browser Google OAuth implementations. It adds no OAuth endpoint, token storage, provider, or persistence format. Error copy stays user-safe and does not expose access tokens or provider payloads. Legacy login, signup and forgot-password routes remain available for unrelated account authentication, but the Cloud Sync surface contains no email/password or GitHub sign-in action.

`cloudSyncStore` initializes after local storage bootstrap and does not require Panvas account authentication. The quarantined Supabase sync files remain in source, but active application bootstrap, stores, and cloud-status components no longer import, schedule, or update that legacy runtime state. Electron token persistence prefers `app.getPath('userData')`; platform-correct encrypted-storage fallbacks cover Windows, macOS, and Linux without placing tokens in workspace/document storage.

The feature is still optional and configuration-gated by `VITE_ENABLE_CLOUD_SYNC`. A build without Google provider configuration keeps the panel visible, disables the connection action and explains that the connection is unavailable in that build. Local workspace persistence remains the default.

## EXACT FILES CHANGED IN THIS ENTRY CORRECTION

```text
src/components/layout/TopBar.tsx
src/components/ui/SyncIndicator.tsx
src/components/ui/CommandPalette.tsx
src/components/auth/AuthGuard.tsx
src/components/library/CloudSyncPanel.tsx
tests/notebook-export-ui.test.ts
```

## NEEDS MANUAL VERIFICATION

- Click the TopBar cloud button while disconnected, connected, offline and in an attention state; confirm it always opens the Library Cloud Sync view and the status label remains readable.
- Run the configured Google Drive connection in Electron and in the browser build, complete OAuth, return to Panvas and verify the connected email/status, Sync now, Disconnect and reconnect paths.
- Dismiss the local-mode prompt, reload the same session and confirm it does not repeat; choose Connect Google Drive and confirm it opens the panel without losing local edits.
- Check a build with provider configuration absent and confirm the disabled explanatory state is clear.

No Electron, Panvas, browser or headless Chromium runtime was launched for this handoff. These checks remain **NEEDS MANUAL VERIFICATION**.

## PARTIAL

Google Drive OAuth/provider configuration and real sync completion are existing optional integrations; this pass corrected their entry UX and routing only. Other providers remain future/coming-later surfaces.

## KNOWN LIMITATION

The session dismissal uses best-effort `sessionStorage`; environments that deny storage may show the prompt again after a navigation. Local editing and local persistence still continue.

## NOT IMPLEMENTED

No new OAuth flow, token model, provider backend, cloud conflict algorithm or authentication-page redesign was added.
