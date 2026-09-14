# Canvas V1 hardening handoff

Last validated: 2026-09-09

## Release state

This Canvas pass is code-complete and automated-test-passing. Panvas, Electron, browser tests, and headless Chromium were deliberately not launched. Runtime UI validation remains required.

Installed editor: `@excalidraw/excalidraw` **0.17.6** from the lockfile and installed package. The version was retained. It is the patched release for the older web-embed stored-XSS issue affecting versions before 0.17.6.

## Audit classification

| Feature | Classification | Actual state |
|---|---|---|
| Selection, hand, free draw, eraser, shapes, arrows, lines, text, images | WORKING | Native Excalidraw tools remain authoritative. |
| Frames, HTTPS embeds, laser pointer | WORKING | Reachable in More. Embeds reject non-HTTPS and credential-bearing URLs. |
| Object appearance | HIDDEN BUT AVAILABLE → FIXED | Broad CSS had hidden Excalidraw's selected-object controls. Panvas now hides duplicate chrome while exposing native contextual appearance controls. |
| New-canvas appearance | BROKEN → FIXED | New canvases use warm paper; existing backgrounds are preserved. Editor chrome supports System, Light, and Dark independently from paper. |
| Grid and snapping | PARTIAL/MISLEADING → FIXED | Removed the duplicate midpoint toggle. UI accurately states that 0.17.6 couples grid visibility and grid snap; object edges/centers use one separate switch. |
| Lasso selection | NOT AVAILABLE IN CURRENT EXCALIDRAW VERSION | No lasso tool exists in the 0.17.6 public API. The dead control was removed. |
| Bucket fill | NOT AVAILABLE IN CURRENT EXCALIDRAW VERSION | No public bucket tool exists. The disabled control was removed. |
| Draw to shape | PARTIAL | Conservative deterministic adapter recognizes lines, arrows, rectangles, and ellipses; ambiguous strokes remain ink. |
| Save/open/import | WORKING | Autosave and Save now use canonical workspace storage. Imports add binary files before scene update and save. |
| Export | WORKING | One Panvas menu exports editable `.excalidraw`, PNG, SVG, or copies PNG. |
| Local libraries | WORKING | Personal and imported `.excalidrawlib` data are workspace-scoped and persistent. |
| Community libraries | PARTIAL | Online/offline Community tab opens the official site externally; downloaded libraries are imported locally. |
| Community callback security | BROKEN → FIXED | PostMessage/hash callbacks accept only official-origin `.excalidrawlib` URLs; fetch omits credentials. CSP adds only that exact connect origin. |
| Voice notes | WORKING | Existing Canvas voice-note control remains in More and ownership/persistence regressions pass. |
| Zoom, fit, fullscreen | NEEDS UI/UX POLISH → FIXED | Added to the compact settings panel. |
| Loading/error states | PARTIAL → FIXED | Editor and scene failures show a safe retry surface without modifying stored content. |
| Canvas loading | NEEDS UI/UX POLISH → FIXED | Workspace lazily loads Canvas; Excalidraw loads inside that boundary. |
| Mermaid to diagram | NOT AVAILABLE IN CURRENT EXCALIDRAW VERSION | 0.17.6 exposes no supported public Mermaid hook. No internal API or vulnerable converter was exposed. Reassess only with a reviewed patched converter/editor upgrade. |
| AI diagram generation | V2/AI | Deliberately outside this pass. |

## Architecture and persistence

`CanvasView` owns editor loading, hydration, file-bearing import, export, library bridging, fullscreen, errors, and the Excalidraw boundary. `CanvasToolbar` owns Panvas navigation chrome. Excalidraw continues to own scene editing and contextual element appearance.

New `src/services/canvas/canvasSceneState.ts` centralizes the warm-paper default, editor-theme preference, persistence allowlist, safe embed policy, trusted library URL policy, and download names.

Autosave now receives `activeWorkspaceId`, merges recognized app-state fields over canonical state, and preserves unknown prior fields for forward compatibility. It persists viewport, background, grid/object snap, arrow binding, view/zen mode, theme, current object appearance defaults, and export preferences. Existing scenes keep their values. A missing `viewBackgroundColor` defaults to `#f7f1e3`. System/Light/Dark editor preference is user-local under `panvas.canvas.editorTheme`.

Import uses Excalidraw `loadFromBlob`, adds imported binary files with `addFiles`, commits the scene to history, then saves elements/app state/files through the canonical repository. Image assets are included in save/reopen and editable export paths.

## Files changed

- `src/components/canvas/CanvasView.tsx`
- `src/components/canvas/CanvasToolbar.tsx`
- `src/components/canvas/CanvasLibraryDrawer.tsx`
- `src/components/canvas/canvasBackgrounds.ts`
- `src/services/canvas/canvasSceneState.ts` (new)
- `src/hooks/useAutosave.ts`
- `src/repositories/CanvasRepository.ts`
- `src/stores/canvasStore.ts`
- `src/components/workspace/WorkspaceContent.tsx`
- `src/styles/index.css`
- `index.html`
- `tests/canvas-capabilities.test.ts`
- `tests/canvas-persistence.test.ts`
- `docs/panvas-handover/CANVAS_V1_HARDENING.md` (new)
- `docs/panvas-handover/V1_FEATURE_SCOPE.md`

The tree was already dirty. Existing notebook, PDF, sync, Discord, generated `dist-electron`, and other edits were not reverted or intentionally modified by this Canvas pass. The required build regenerated normal output; generated output was not treated as source.

## Automated validation

- Focused Canvas/persistence/voice: **42 passed, 0 failed, 0 skipped** (including the real Electron-shaped save boundary regression).
- Focused Canvas/mobile after responsive correction: **21 passed, 0 failed, 0 skipped**.
- Full canonical non-browser suite (`npm test`): **481 tests; 480 passed, 0 failed, 1 skipped**.
- Skip: pre-existing environment-gated Windows production handwriting provider/WinRT test.
- `npm run typecheck`: **passed** for renderer and Electron.
- `npm run build`: **passed**.
- Build emitted existing warnings for large chunks, mixed imports, the non-module Excalidraw config script, runtime Virgil font resolution, and Electron Vite/Rollup option compatibility.
- `git diff --check`: no Canvas-pass whitespace errors; it reports pre-existing whitespace issues in unrelated dirty-tree files.

## Needs manual verification

- Open an old Canvas and confirm its background; create a new Canvas and confirm warm paper.
- Exercise all primary tools, selection, resize, rotation, grouping, clipboard, undo/redo, and shortcuts.
- Select shapes, text, arrows, ink, and images; confirm the native appearance panel is visible, unobstructed, and not duplicated.
- Insert images by tool/paste/drop; save/reopen; export/reimport an image-bearing `.excalidraw` file.
- Create frames, HTTPS embeds, and laser marks; confirm HTTP/javascript/data embed URLs are rejected.
- Verify 10/20/40 px grid behavior, object edges/centers, arrow binding, and reopen persistence.
- Verify zoom, reset, Fit content, fullscreen, View/Zen modes, toolbar hide/show, and phone-width overflow.
- Test editor themes and every paper preset/custom color, then reopen for persistence.
- Test Save now, valid/invalid import, editable/PNG/SVG export, and clipboard PNG.
- Test personal/local library add/import/load/delete/restart plus offline/online Community flow.
- Test voice recording, playback, seek, rename/move/delete, canvas switching during recording, and reopen.
- Exercise load failure/retry and confirm stored data remains intact.

## Known limits

- Lasso, bucket fill, and a supported public Mermaid importer are absent from Excalidraw 0.17.6.
- Community browsing is external and download/import requires a network connection.
- Draw to shape intentionally rejects ambiguous gestures.
- No separate Canvas PDF export command was added.
- Runtime and browser automation remain deliberately unrun.

## Manual runtime correction pass

The final correction-focused command (`tests/canvas-persistence.test.ts`, `tests/canvas-capabilities.test.ts`, and `tests/mobile-presentation.test.ts`) passed **31/31**.

The manual Electron run found a persistent `Save failed` status during ordinary Canvas edits. The root cause was in `src/repositories/CanvasRepository.ts`: the Electron preload contract returns `canvas.load(workspaceId, canvasId)` as a scene object or `null`, but `saveData` destructured that result as though it were a tuple (`const [rawPrevious] = ...`). A valid scene object is not iterable, so every subsequent save threw before the `canvas:save` IPC call. The newly persisted settings were valid JSON; they were not the cause.

The fix reads the object directly and lets a real read failure propagate instead of treating a failed read as an empty scene. `src/stores/canvasStore.ts` now rethrows write failures after setting `saveStatus: 'error'`, so the status bar remains truthful. `src/hooks/useAutosave.ts` retains dirty data when a flush fails; a later edit or explicit Save now transitions through `saving` to `saved`. Panvas-owned settings and Library panels also close each other when opened, while Excalidraw's native selected-object properties stay open and functional.

## FINAL MANUAL RUNTIME VISUAL CORRECTIONS - 2026-09-10

This bounded pass corrected seven issues found during manual observation. It did not start another Canvas feature pass.

### IMPLEMENTED / TEST-PASSING

- Canvas document paper is now independent from the Panvas application theme. `resolveCanvasDocumentBackground` in `src/services/canvas/canvasSceneState.ts` normalizes an explicit persisted `viewBackgroundColor`, supplies the warm-paper default only when a legacy scene is missing a color, and `CanvasView.tsx` restores that literal before autosave if Excalidraw emits a transient theme snapshot. Editor Light/Dark/System preference is stored separately under `panvas.canvas.editorTheme`.
- Notebook document paper and rule colors are now independent from application theme. `resolveNotebookPaperColor` and `resolveNotebookLineColor` preserve persisted literals and map only missing/`default` legacy values to canonical white and gray. `PageRenderer.tsx` and `TemplateGalleryModal.tsx` no longer consult `useUIStore` for document colors.
- Responsive notebook toolbar layout receives the active tool group and removes that group from overflow. Compact Select is represented by the active-tool button exactly once; the fullscreen fallback follows the same rule.
- Image contextual controls now use the pure `resolveImageToolbarPlacement` contract with placement hysteresis. The contextual bar stays below or above a transforming image until it is genuinely inaccessible, then uses a side placement while respecting the fixed header safe area. Crop, rotation and opacity remain one image-only surface.
- Automatic `Click to open` cards were removed from PDF-backed notebook page and inactive preview renderers. User-inserted Canvas PDF blocks still use `PdfBlock.tsx` and retain their intentional loading/opening surface.
- The TopBar cloud affordance always opens the canonical Library Cloud Sync view. `SyncIndicator` reports disconnected, connecting, synced, offline and attention states without routing to authentication pages. The optional prompt is session-dismissible, uses `Connect Google Drive`, and keeps local editing available.
- Line-color updates continue through `NotebookRenderer`'s active-page properties and section cache paths, so the renderer receives the new literal immediately instead of waiting for another background-format change.

### EXACT FILES CHANGED IN THIS CORRECTION

```text
src/services/canvas/canvasSceneState.ts
src/components/canvas/CanvasView.tsx
src/lib/pageProperties.ts
src/components/notebook/PageRenderer.tsx
src/components/notebook/templates/TemplateGalleryModal.tsx
src/components/notebook/toolbarLayout.ts
src/components/notebook/NotebookFloatingToolbar.tsx
src/components/notebook/engine/imageToolbarPlacement.ts
src/components/notebook/FloatingImageControls.tsx
src/components/notebook/NotebookPageView.tsx
src/components/notebook/InactivePagePreview.tsx
src/components/layout/TopBar.tsx
src/components/ui/SyncIndicator.tsx
src/components/ui/CommandPalette.tsx
src/components/auth/AuthGuard.tsx
src/components/library/CloudSyncPanel.tsx
tests/canvas-capabilities.test.ts
tests/page-properties.test.ts
tests/image-appearance.test.ts
tests/toolbar-layout.test.ts
tests/notebook-export-ui.test.ts
docs/panvas-handover/CANVAS_V1_HARDENING.md
docs/panvas-handover/STICKY_LAYERS_ELEMENTS_HANDOFF.md
docs/panvas-handover/CLOUD_SYNC_ENTRY_V1.md
```

### PERSISTENCE AND COMPATIBILITY CONTRACT

- Canvas keeps the existing `viewBackgroundColor` field and adds no document-theme field. `CanvasEditorThemeMode` (`system | light | dark`) is user-local editor chrome state. Missing or invalid Canvas background values use `#f7f1e3`; explicit colors remain stable through theme changes and save/reopen.
- Notebook keeps `paperColor`, `ruleLineColor`, `extraTop`, `extraRight`, `extraBottom`, `extraLeft`, and legacy `extraHeight`. Missing/`default` colors retain canonical white/gray defaults. Existing crop, nib, line-style, sticky and PDF expansion fields remain backward-compatible as documented in the earlier sections.
- Cloud Sync uses the existing `requestConnect('googledrive')` provider path and existing Electron/browser OAuth plumbing. No token or persistence format was added.

### VALIDATION

- Direct correction group: **82 passed, 0 failed, 0 skipped**.
- Closest PDF/export regression group: **76 passed, 0 failed, 0 skipped**.
- Cloud/release regression group: **110 passed, 0 failed, 0 skipped**.
- Full canonical non-browser suite (`npm test`): **488 total; 487 passed, 0 failed, 1 skipped**.
- Skipped test: the opt-in real Windows Ink integration gated by `PANVAS_RUN_WINDOWS_INK_INTEGRATION=1`.
- `npm run typecheck`: **passed** for renderer and Electron TypeScript.
- `npm run build`: **passed** for renderer, Electron main and preload. Existing non-fatal Vite/Rollup warnings remain documented above.
- Deliberately not run: `tests/toolbar-resize.test.ts`, browser/headless Chromium automation, Electron, Panvas and manual runtime UI testing.

### NEEDS MANUAL VERIFICATION

- Switch Panvas Light, Dark and Ink themes while checking a Canvas custom background, a notebook paper swatch and a line-color swatch; reload each document and confirm the persisted literals do not change.
- Resize the notebook toolbar through desktop, compact and fullscreen widths with Select, Pen, Text and shape tools active; confirm each active tool appears once and remains reachable.
- Transform images near the header, bottom edge and side edges; confirm the contextual Crop/rotate/opacity bar does not jitter, hide the rotation handle or cover the fixed toolbar. Exercise Crop Apply/Reset/Cancel/Escape and opacity history.
- Open PDF-backed notebook pages and confirm only the source PDF/annotation layers are visible; confirm user-inserted Canvas PDF blocks still open as expected.
- Change line colors on current and all-note-pages scope, switch templates, undo/redo and reload; confirm the rule/grid updates immediately.
- Open the TopBar cloud icon, Command Palette Cloud Sync command and unauthenticated soft prompt; confirm all land in Library Cloud Sync, `Connect Google Drive` invokes the existing provider flow when configured, and `Continue locally` dismisses the prompt for the session.

### PARTIAL / KNOWN LIMITATION

- These fixes are source, state, geometry and export-contract validated. They do not prove pointer feel, visual placement in every packaged window size, provider OAuth completion, webfont loading or long-document performance.
- The existing optional Cloud Sync feature remains configuration-gated and requires a configured Google provider for a real connection. Legacy authentication routes remain available for unrelated account flows.

### NOT IMPLEMENTED

No new editor feature family, OAuth implementation, browser automation, Electron runtime test or security-hardening pass was added.

The regression test in `tests/canvas-persistence.test.ts` exercises the repository boundary with Electron-shaped object/null loads, atomic file writes, Canvas settings, selected-object appearance defaults, binary image files, partial-save merging, a failed read, and the status sequence `saving → error → saving → saved`. Focused tests pass after this correction. Library Community behavior remains an external browser flow and still needs the manual checks listed above.
