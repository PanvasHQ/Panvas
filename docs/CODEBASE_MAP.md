# Contributor codebase map

Use this map to find the narrowest layer for a change. Read [ARCHITECTURE.md](ARCHITECTURE.md) and [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) before changing persistence, sync, or the Electron boundary.

| Area | Start here | Notes |
| --- | --- | --- |
| Application entry and routes | `src/bootstrap.tsx`, `src/app/App.tsx`, `src/lib/location.ts` | Public routes and `/app` workspace routing |
| Workspace/library navigation | `src/components/workspace/`, `src/components/library/`, `src/stores/workspaceStore.ts` | Hierarchy, recent items, favorites, trash |
| Notebook UI | `src/components/notebook/` | Page shell, rich text, tools, templates, media |
| Notebook ink/input | `src/components/notebook/engine/` | Drawing, pointer routing, selection, viewport, page objects; high-risk |
| Handwriting recognition | `src/services/recognition/`, `electron/ipc/recognition-handlers.ts` | Windows Ink/browser-native providers; neural fallback is disabled |
| Canvas | `src/components/canvas/`, `src/stores/canvasStore.ts`, `src/repositories/CanvasRepository.ts` | Excalidraw scene and Panvas custom blocks |
| PDFs | `src/components/pdf/`, `src/services/pdf/` | PDF.js rendering, annotations, and `pdf-lib` export |
| Persistence | `src/repositories/`, `src/database/`, `src/services/storage/` | Browser Dexie adapter and shared repository contracts |
| Electron storage | `electron/ipc/WorkspaceService.ts`, `electron/ipc/write-queue.ts` | Filesystem paths, atomic writes, recovery; high-risk |
| Electron bridge/security | `electron/preload.ts`, `electron/ipc/domain-handlers.ts`, `electron/security-policy.ts` | Allowlisted bridge and trusted-sender validation |
| Cloud Sync | `src/services/cloudsync/`, `src/stores/cloudSyncStore.ts`, `electron/ipc/cloudsync-handlers.ts` | Release-gated; requires architectural review |
| Backup/import | `src/services/backup/`, `src/lib/migration*`, `electron/ipc/migration-import.ts` | Portable workspace recovery and legacy import |
| Tests | `tests/` and `package.json` scripts | Node test runner plus selected browser/Electron harnesses |
| Public pages | `src/components/marketing/`, `src/components/legal/` | Landing, download, legal, and roadmap pages |

## Safe change sequence

1. Confirm the behavior and owning layer.
2. Add or update a focused regression test.
3. Make the smallest change that preserves the repository/data contract.
4. Run `npm run typecheck`, the focused suite, then `npm test` and `npm run build`.
5. Update canonical docs for any user-visible or storage-contract change.

Do not commit `dist/`, `dist-electron/`, `release/`, `.env`, recordings, private workspace data, or local agent/research material.
