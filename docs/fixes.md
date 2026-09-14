# Panvas V1 Cleanup & Fix Plan

## Focused cloud-sync repair — 2026-08-30

- Proven that `runSyncCycle` returned the entire confirmed manifest after publication, including records just published and acknowledged by the same device. Those records are now removed from the download handoff; genuinely newer remote edits remain downloadable.
- Made remote application phases explicit and regression-tested so workspace/folder/notebook/section/page metadata completes before page content and drawing records.
- Kept `initial-scan-empty` as a real missing-workspace-root failure. A valid workspace with no children publishes a one-record workspace manifest and succeeds.
- Centralized the account result decision: any genuine workspace error, unresolved entry, or conflict prevents `synced` status.
- Completed browser GIS token acquisition with `initTokenClient` and `requestAccessToken`. Browser auth reads only `VITE_PANVAS_GOOGLE_WEB_CLIENT_ID`, stores the access token in memory only, and has no desktop-ID or client-secret fallback.
- Verification: focused 55/55; full suite 333 passed / 0 failed / 1 platform-only skip; typecheck and production build passed. Runtime status remains **IMPLEMENTED / TEST-PASSING — PENDING USER MANUAL CROSS-DEVICE VERIFICATION**.

_Last updated from the latest full manual student-style walkthrough._

## Purpose

This file is the working cleanup checklist before Panvas moves into security/stability hardening and then cloud sync.

The goal is to fix **real user-facing regressions and rough UX**, without reopening systems that are already working well.

### Protect these working systems

Unless a bug directly proves otherwise, do **not** refactor or redesign:

- Real-time Handwriting → Text
- Bulk handwriting conversion
- Windows Ink recognition worker
- Pen/Pencil handwriting recognition toggle model
- Multi-word / multi-line handwriting placement
- Draw-to-Shape
- Canvas hierarchy interoperability
- Canvas Voice Notes
- PDF annotation/export/print
- Mixed portrait/landscape page geometry
- Zoom/DPR rendering
- Existing persistence/search architecture

---

# Recommended Model Split

## Gemini 3.7 Flash High

Best for:
- Library UI/UX
- navigation/discoverability
- responsive shell positioning
- visual polish
- segmented controls
- creation dialogs
- simple Library actions
- backup/import UX messaging
- page/view panel polish

Gemini should primarily own **Pass 1 and Pass 2** below.

## Luna Extra High

Best for:
- pointer/input ownership bugs
- selection/object interaction
- Voice Note direct interaction
- margin behavior
- editable template/object behavior
- bounded functional fixes where persistence/history must remain safe

Luna should primarily own **Pass 3 and Pass 4** below.

## Do not spend Sol/Opus first

Use Sol/Opus only if:
- a fix turns into a real persistence/data-model problem,
- an existing migration is needed,
- security/cloud architecture is involved,
- Gemini/Luna cannot isolate a reproducible bug.

---

# PASS 1 — Library + Shell UX

**Recommended model: Gemini 3.7 Flash High**

**Priority: P0 / first**

## 1. Library → item navigation is inconsistent

### Current behavior
From the Library screen:
- opening an item card can work,
- but navigating from the left Workspace tree to a notebook/page/canvas can get stuck or fail to leave Library,
- the user should be able to use the Workspace tree as global navigation from anywhere.

### Required behavior
- Clicking a Notebook in the left tree opens it.
- Clicking a Section navigates to that section/notebook context.
- Clicking a Page opens that page.
- Clicking a Canvas opens that canvas.
- Clicking a PDF opens that PDF.
- Library must not trap the current route/view.
- Navigation behavior must be consistent between:
  - Library cards,
  - sidebar tree,
  - breadcrumbs,
  - Recent/Favorites/Trash results.

---

## 2. Recent does not work properly

### Required
- Show genuinely recently opened/edited notebooks, canvases, PDFs, and supported items.
- Clicking a Recent item opens it.
- Sort newest activity first.
- Do not show deleted/trash items as normal Recent content.
- Persist/rebuild using canonical local data rather than mock/static data.

---

## 3. Favorites does not work properly

### Required
- Favorite/unfavorite supported Library items.
- Favorites view must list them.
- Favorite state persists after restart.
- Items can be opened from Favorites.
- Deleted/trash items should not continue appearing as normal active Favorites.

---

## 4. Trash behavior needs full user-facing verification

### Required
- Deleted supported items appear in Trash.
- Restore works.
- Permanent delete works only through an explicit destructive action.
- Nested objects preserve hierarchy on restore where applicable.
- Trash counters/list refresh immediately after delete/restore.

Do not rewrite the already-fixed Electron canvas trash cascade unless a current bug proves it necessary.

---

## 5. Rename/delete from Library needs consistency

### Current issue
Some Library interactions are inconsistent or can throw errors.

### Required
- Rename through card/context action works.
- Delete through card/context action works.
- Rename uses the same canonical repository/store path as sidebar rename.
- Validation:
  - empty name rejected cleanly,
  - duplicate naming behavior follows existing Panvas rules,
  - UI refreshes immediately.

---

## 6. Double-click / single-click behavior

Define a consistent rule.

Recommended:
- Single click = select/focus card.
- Double click or explicit Open action = open item.
- Context menu = rename/favorite/delete/etc.

Avoid accidental opening while trying to select/manage an item.

---

## 7. Workspace Backup UX wording

The backup system itself has been manually shown to export and restore.

### Improve wording
Replace vague:
- `Export backup`
- `Import backup`

with clearer labels where appropriate:
- `Export Workspace Backup`
- `Restore Workspace Backup`

or keep compact button labels but use tooltips/subtext clearly saying it is a **workspace backup**, not PDF/notebook export.

---

## 8. Import backup file filtering + errors

### Current behavior
Selecting an arbitrary invalid file can produce:
`The selected backup file is not valid JSON.`

### Required
- File picker should prefer/filter the real Panvas backup extension/type if one exists.
- If backups are JSON-based, clearly state expected format.
- Invalid backup message should be user-friendly, e.g.:
  - `This file is not a valid Panvas workspace backup.`
- Preserve technical details for logs, not the primary toast.
- Do not imply import failed if user simply picked the wrong file type.

---

## 9. Restored workspace naming

Current restored naming such as:
- `test (Restored)`

is acceptable.

Verify:
- no collision with existing workspace,
- restored hierarchy/items are visible,
- restored workspace can be renamed later.

---

## 10. Library visual refinement

Keep the current Panvas aesthetic.

Improve:
- information density,
- card spacing,
- empty states,
- active navigation state,
- folder/item section hierarchy,
- context actions,
- consistency of grid/list buttons,
- stronger distinction between folders and actual content items.

Do **not** redesign into a dashboard/SaaS layout.

---

## 11. Responsive top-right shell controls

### Current issue
At smaller/non-maximized window sizes:
- Local-only status,
- theme button,
- cloud/offline icon,
- native window controls

can crowd/collide visually.

### Required
- Reserve a safe draggable/non-draggable titlebar region.
- Never overlap minimize/maximize/close controls.
- Theme/local/cloud controls remain visually grouped.
- Compact gracefully at narrow widths.
- Fullscreen/maximized/windowed layouts all remain clean.
- Avoid icons merging into native window chrome.

---

# PASS 2 — Notebook Creation + Page & View UI

**Recommended model: Gemini 3.7 Flash High**

**Priority: P1**

## 12. Notebook creation should support page defaults

The current New Notebook dialog supports name/cover but should also allow initial page defaults.

### Add optional creation defaults
- Page size:
  - A4
  - A5
  - Letter
  - other already-supported sizes
- Orientation:
  - Portrait
  - Landscape
- Paper color
- Background/template
- Margin preset
- potentially line/grid color if already supported cleanly

### Behavior
- These are **initial notebook/page defaults**.
- They are not permanent locks.
- User can change page properties later.
- First created page should reflect chosen defaults.
- Future pages should follow the notebook default if that is already Panvas architecture; otherwise do not invent a large defaults subsystem without need.

---

## 13. New Notebook dialog refinement

Keep:
- cover presets,
- custom image,
- name.

Improve:
- hierarchy/spacing,
- compact advanced page options,
- clear default values,
- keyboard accessibility,
- validation.

Do not make the dialog enormous.

Suggested UI:
- core fields visible,
- `Page defaults` expandable section.

---

## 14. Page & View panel — Edit / Read / Present UI

### Current problem
Hover/selected state looks like an awkward rounded square and does not fully match Panvas.

### Required
- Treat as a proper compact segmented control.
- Clean selected pill/surface.
- Soft hover.
- Equal alignment/padding.
- Avoid chunky isolated rounded boxes.
- Maintain clear selected state in light/dark themes.

---

## 15. Page & View panel spacing/polish

Review:
- Layout dropdown
- Zoom controls
- Apply to all pages
- Paper color
- Background format
- Line color
- Orientation
- Page size
- Margins

Improve:
- spacing rhythm,
- label hierarchy,
- consistent control heights,
- section separators,
- responsive panel width.

Do not change the underlying functionality unless a bug is found.

---

# PASS 3 — Interaction Routing / Direct Object Controls

**Recommended model: Luna Extra High**

**Priority: P1**

## 16. Voice Note should not require Select just to use its controls

### Current issue
If Pen/Pencil/etc. is active:
- user may be unable to click Play/Rename/Delete/resize Voice Note until manually selecting Select.

### Desired behavior
Voice Note UI controls are directly interactive regardless of active writing tool.

Examples:
- Play/pause should work.
- Rename should work.
- Delete should work.
- card-specific buttons should work.

### Pointer ownership rule
- Click on an explicit interactive object control → object control owns event.
- Click/drag on card body → move/select behavior according to existing rules.
- Draw on empty paper → active drawing tool owns event.

H→Text must not intercept object controls.

Do not globally switch the user's active tool to Select just because they clicked Play.

---

## 17. General object interaction policy

Audit similar floating objects:
- images,
- sticky notes,
- audio cards,
- embedded custom blocks.

Where reasonable:
- direct buttons should work without Select.
- manipulation handles may still require selection.
- clicking a control must not create a stroke underneath it.

Preserve current drawing ergonomics.

---

## 18. Selection / Lasso regression safety

Selection and lasso were recently repaired for handwriting bulk conversion.

Regression-check:
- Select tool
- Lasso
- floating selection toolbar
- Convert to Text
- move/delete/copy
- mixed selections

Do not rewrite them unless currently broken.

---

# PASS 4 — Margins + Editable Page Templates

**Recommended model: Luna Extra High**

**Priority: P2, but complete before final V1 release if kept in scope**

This is larger than pure polish.

---

## 19. Margin line visual quality

### Current issue
Margin guides look dotted/weak and aesthetically inconsistent.

### Desired
- solid clean margin lines by default,
- theme-aware,
- printable/exportable according to existing page-background semantics.

Do not make the margin look like a selection rectangle.

---

## 20. Margin side control

Current margin system appears mostly preset-based/all-sides.

### Desired
Allow user to choose which sides have visible margin guides:
- left
- right
- top
- bottom

Possible presets:
- None
- Left only
- Left + Right
- Top + Bottom
- All sides
- Custom

Keep existing Narrow/Normal/Wide spacing concepts if useful.

### Important
Distinguish:
- content margin/layout inset
from
- visible margin guide line

Do not accidentally break page geometry or exports.

---

## 21. Template backgrounds contain baked-in content

Examples:
- Cornell notes
- Lecture notes
- Assignment sheet
- Checklist
- Daily planner
- Weekly planner
- Journal
- other structured backgrounds

### Current issue
Labels/boxes/dividers are effectively engraved into the background and cannot be selected/removed/edited.

The user wants more control.

---

## 22. Upgrade structured templates toward editable template elements

Preferred long-term V1-compatible direction:

Instead of one immutable decorated background:

`paper background + baked labels + baked boxes`

use:

`paper background + editable/removable template elements`

Potential editable elements:
- headings/labels,
- divider lines,
- boxes,
- checklist regions,
- date/title labels,
- planner blocks.

### Rules
- Reuse canonical Panvas shapes/text objects where possible.
- Template elements should be selectable.
- User can delete/move/edit them.
- Do not make them ordinary user ink.
- Initial template application should be undoable.
- Persist normally.
- Export/print correctly.
- Avoid duplicating template elements every time page reloads.

---

## 23. Template migration / compatibility

Existing pages using old baked backgrounds must continue rendering.

Do not destructively migrate existing notes without a safe strategy.

Possible approach:
- old template versions remain supported,
- new pages use editable-template-element version,
- optional `Convert template to editable` for legacy pages later if needed.

Do not attempt a dangerous whole-workspace migration without explicit approval.

---

## 24. Journal/template quality review

Some templates are visually weaker than others.

Review only after editable-template architecture is stable.

Improve:
- spacing,
- useful writing zones,
- label alignment,
- consistency with Panvas,
- no unnecessary decorative clutter.

---

# Additional Regression Checks

These are not necessarily known broken features, but should be manually checked after the above passes.

## 25. Library search
- Search notebook title.
- Search canvas title.
- Search PDF title.
- Clear search restores list.

## 26. Favorites persistence
- Favorite item.
- restart/reopen.
- remains favorite.

## 27. Recent persistence
- open item,
- leave,
- verify it appears at top of Recent.

## 28. Trash lifecycle
- delete,
- restore,
- permanent delete test on disposable item.

## 29. Backup round trip
Using a disposable workspace:
1. export,
2. make changes,
3. restore backup,
4. verify hierarchy/content/assets.

## 30. Dark/light shell
Check:
- Library,
- dialogs,
- titlebar controls,
- Page & View panel,
- context menus,
- Trash/Favorites/Recent.

## 31. Narrow-window shell
Check:
- top-right native controls,
- search bar,
- breadcrumbs,
- sidebar,
- Page & View panel.

---

# Explicitly Deferred / Do Not Add During Cleanup

Do not scope-creep these cleanup passes into:

- Cloud Sync
- Time Keeper
- OCR
- audio transcription
- AI assistant
- collaboration
- mobile apps
- plugin system
- Canvas → Notebook diagram copying
- advanced handwriting math recognition
- handwriting smart reflow

---

# V1 Order From Here

## Status Categorization

### A. COMPLETED — MANUALLY VERIFIED
- **Pass 1: Library + Shell UX**:
  - Live workspace collections, canonical root/cascade trash model (`deletedByAncestorId`), lossless restore.
  - Recent view sorted by persisted `lastOpenedAt`, excluding deleted records.
  - Favorites view backed by `isPinned` across notebooks and canvases.
  - TopBar 3-zone titlebar layout with Windows native caption button safe spacer (`144px`).
  - Library Browse navigation separating `onSelectView` from `onSelectFolder` with proper active/empty states.
  - Runtime persistence and restart behavior verified by the USER.
- Notebook/page system & 5-tier document hierarchy
- 2D Vector Ink & Drawing engine (Pen, Pencil, Marker, Highlighter, Erasers, Ruler, Laser, Layers)
- WinRT local handwriting recognition on Windows desktop
- Excalidraw infinite canvas integration & 4-tier hierarchy interoperability
- Canvas Draw-to-Shape & Canvas Voice Notes
- In-place PDF vector annotation, rotation transforms, page operations (reorder/rotate/extract)
- Export & print (annotated PDF export, whole-notebook PDF export, isolated printing)
- Full-text search (TipTap, PDF streams, recognized handwriting, Ctrl+K command palette)
- Study templates baseline & cover art system
- Workspace backup/restore archive baseline

### B. IMPLEMENTED — PENDING MANUAL VERIFICATION
- **Web & Mobile Presentation Pass**:
  - Default `/app` landing document restore with `/app/library` fallback.
  - Mobile shell drawer overlay (<600px), bottom sheet for Page & View properties, segmented Document Mode control.
  - Provider-aware handwriting activation feedback & `WebHandwritingRecognitionProvider` feature detection.
- **Loading Branding & Rich Text Baseline**:
  - Pre-React & post-bootstrap branded loading states.
  - Contextual text-formatting strip (B/I/U/S, text/highlight colors, typography menu).

### C. REMAINING V1 WORK (Strict Sequence)
1. **PWA / Installable Web Foundation** (PLANNED / NOT YET IMPLEMENTED):
   - Web App Manifest (standalone, icons, metadata, theme colors).
   - Offline service worker application shell caching (zero user-document corruption).
   - `navigator.storage.persist()` persistent storage request & status detection.
   - Web/PWA Storage Status UX in Settings (usage, quota, persistence state, backup actions).
2. **Remaining UI/Ergonomics Cleanup**:
   - Pass 2: Notebook creation defaults & template selection.
   - Pass 3: Direct object interaction/input routing.
   - Pass 4: Margins + editable structured templates.
3. **Windows User-Data Storage Support** (PLANNED / NOT YET IMPLEMENTED):
   - User-selectable storage location during first-run onboarding or Settings (`%USERPROFILE%\Documents\Panvas` default).
   - Distinction between Install Location and Panvas User-Data Location.
   - Atomic, verified data migration flow between directories.
4. **Security Foundation for Release & Cloud** (PARTIAL):
   - Electron Google PKCE + safeStorage and browser Google token-model OAuth are implemented; broader release hardening remains.
   - Cloud IPC validation and narrow Google CSP endpoints are implemented; full path/dependency audit remains.
5. **Provider-Neutral Cloud Sync Core** (IMPLEMENTED / AUTOMATED TESTS PASS — USER RUNTIME CERTIFICATION PENDING):
   - Manifest generation, delta change journal, stable coalescing, non-destructive conflicts, tombstones, timeouts/retries, and cross-device reconstruction.
6. **OneDrive Sync Adapter** (PLANNED / NOT YET IMPLEMENTED): Microsoft Graph API delta sync.
7. **Google Drive Sync Adapter** (IMPLEMENTED — USER RUNTIME CERTIFICATION PENDING): Electron + browser/PWA Google Drive API v3 transport.
8. **Offline / Multi-Device Sync Validation** (IMPLEMENTED IN AUTOMATED FAKE TRANSPORT — MANUAL DEVICE VERIFICATION PENDING): Windows Electron ↔ Cloud ↔ browser/PWA behavior.
9. **Release Security & Stability Audit**: Clean profile checks, vulnerability scans, binary integrity.
10. **Windows Installer / Packaging / Signing** (PLANNED / NOT YET IMPLEMENTED):
    - Direct website distribution installer (NSIS is the current recommended Windows installer candidate, branding, desktop/start menu shortcuts, clean uninstall).
    - Code signing with Authenticode certificate.
11. **Production Web / PWA Deployment** (PLANNED / NOT YET IMPLEMENTED): Static host deployment, HTTPS, PWA install checks.
12. **Official Landing & Download Website** (PLANNED / NOT YET IMPLEMENTED):
    - Dedicated download page ("Download Panvas for Windows" vs "Open Panvas Web" vs "Install PWA").
    - Professional, local-first research/writing tool messaging (no AI/SaaS hype).
13. **Final Regression & Release Certification**: Full end-to-end user testing and release tagging.

### D. POST-V1 / EXPLICITLY DEFERRED ([V2] & [FUTURE])
- ❌ Web / PWA Handwriting-to-Text recognition & native mobile recognition ([V2 / FUTURE] — V1 Web/PWA supports full vector ink creation/editing; H→Text is scoped to Windows Electron via Windows Ink; experimental browser OCR rejected due to inadequate accuracy)
- ❌ Native iOS / Android app store applications (PWA fulfills mobile/tablet access in V1)
- ❌ Microsoft Store packaging (Direct website distribution is V1 priority)
- ❌ Dropbox sync adapter (Evaluated post-V1)
- ❌ Time Keeper / Pomodoro study widget ([V2])
- ❌ General OCR / scanned PDF OCR pipelines ([V2])
- ❌ Audio transcription & audio-to-ink synchronization ([V2])
- ❌ Developer Coding Workspace ([V2] — Code files, Monaco/CodeMirror editor, external folder workspace, desktop terminal, Notes ↔ Code backlinks)
- ❌ Multiplayer real-time collaboration ([FUTURE])
- ❌ AI assistant / summaries / mind maps ([FUTURE])
- ❌ Custom brush illustration engine ([FUTURE])
- ❌ Third-party plugin / extension runtime ([FUTURE])

---

# Library data / Trash / Recent / Favorites backend repair (2026-08-29)

- **Completed & Verified:** Full Pass 1 library persistence and restart behavior manually tested and verified by the USER.
- **Canonical Trash roots:** Browser IndexedDB and Electron workspace metadata now use the same `deletedByAncestorId` marker. Trash lists the entity directly deleted (workspace, folder, notebook, section, page, or canvas) once; cascaded descendants stay persisted but are suppressed from root lists. Legacy rows without markers are still hidden by their persisted parent relationships.
- **Lossless restore:** Restoring a folder, notebook, section, page, canvas, or workspace clears only the cascade marker created by that root and retains stable IDs, ownership, and direct child deletions. Folder/workspace cascades include nested notebooks, sections, pages, and section-owned canvases.
- **Recent:** `lastOpenedAt` is persisted on the canonical canvas/notebook/page record in both browser and Electron paths. Recent loading no longer selects or timestamps a file during startup; the Library Recent view sorts by open time and excludes deleted content.
- **Favorites:** Existing `isPinned` persistence remains the single source of truth for notebook/canvas favorites; reloads and deletes now flow through the canonical live collections.
- **Refresh/parity:** Store Trash reloads from canonical repositories/IPC immediately after delete and restore, with active-workspace scoping shared by both backends.
- **Validation:** Focused Library data tests, `npm test`, `npm run typecheck`, and `npm run build` passed.
- **Status:** COMPLETED — MANUALLY VERIFIED (Confirmed working at runtime with restart persistence).

# Web / mobile default-landing, handwriting capability, and phone presentation pass (2026-08-29)

Status: IMPLEMENTED — PENDING MANUAL VERIFICATION. Automated validation (`npm run typecheck`, `npm test` 248 pass / 1 pre-existing skip, `npm run build`) executed; browser/Electron runtime verification and `npm run test:resize` (extended with 400/440px) are NOT executed and remain the owner's manual gate.

- **Default `/app` landing:** the "Good afternoon, there." dashboard is no longer the normal landing surface. Bootstrap now runs the canonical `loadWorkspaceContents` pass for the active workspace, which validates and restores the persisted active page/canvas without recording an open event; a new `initialDocumentRestoreComplete` store flag gates a `/app → /app/library` fallback (`shouldFallBackToLibrary` pure helper) so transient null ids during async workspace/document transitions can never cause a spurious redirect. No document restore → Library. WelcomeScreen remains only as an unreachable transient fallback.
- **Browser handwriting capability (precise scope):** Windows Electron behavior is unchanged (Windows Ink provider, worker, debounce, batching untouched). `RealTimeHandwritingSession` activation/unavailable feedback is provider-aware: only the `windows-ink` provider surfaces Windows language-component guidance; all other environments get a neutral "not supported on this platform / your ink will be kept" message with ink preserved. `WebHandwritingRecognitionProvider.isAvailable()` now feature-detects `navigator.queryHandwritingRecognizer` independently: absent → existing API-surface check; present → one memoized query for `navigator.language`; `null` → genuinely unavailable; query throws → safe fallback. This pass does NOT add universal browser handwriting recognition (no Android ML Kit, PencilKit, cloud service, or bundled WASM model) — unsupported browsers keep raw ink and show the neutral notice.
- **Mobile shell (<600px only; desktop/tablet untouched):** TopBar search compresses to a compact icon action that opens the same command palette as Ctrl+K; the library sidebar becomes an overlay drawer (scrim tap, Escape, and navigation/document-open close it) that never squeezes the document; nothing overflows horizontally.
- **Mobile writing toolbar/popups:** the More Tools menu and tool settings popups are width/height capped and scrollable on phones; the H→Text settings strip leads with recent colors, palette, and thickness and moves font/size/language into a compact anchored popover; Pen/Pencil quick presets stay reachable through the More menu below 680px (existing behavior); Notebook navigator's three-column manager stacks vertically. No drawing-coordinate, pointer, or zoom code was touched.
- **Page & View mobile bottom sheet:** the notebook properties panel (and the PDF view inspector) render as viewport-level bottom sheets with scrim, own scrolling, safe-area padding, and no chrome width reservation (`right-72` reservation and the ≤680px auto-close are gated to ≥600px viewports). Zero document-coordinate impact.
- **Document Mode control polish:** Edit / Read / Present is now a compact segmented control (equal segments, clean selected pill, subtle hover, focus ring, correct light/dark) in both light and dark themes; behavior and semantics unchanged.
- **Mobile Library navigation:** a compact `lg:hidden` view switcher (Recent / Favorites / Library / Trash) reuses the existing `selectView` path because the desktop navigator aside is hidden below `lg`; below 600px the list presentation automatically renders the existing card grid (preference preserved for ≥600px). No Library persistence/data changes.
- **Canvas chrome (bounded):** the canvas toolbar is viewport-capped with a horizontally scrollable row and its More/settings menus are width-capped and right-anchored on phones. Excalidraw scene geometry, persistence, and panning are untouched.
- **Tests:** new `tests/default-landing.test.ts` (redirect gating, canonical restore ordering) and `tests/mobile-presentation.test.ts` (mobile reachability/presentation contracts); `tests/handwriting-recognition.test.ts` gains activation-message and web-capability-matrix coverage; `tests/toolbar-resize.test.ts` sweep extended to 400/440px (not executed here). No existing test was weakened or deleted.
- **Phone toolbar compactness polish (same-day follow-up, UI-only):** below 600px the writing toolbar surface padding drops to 6px/4px with 2px gaps, tool and More buttons shrink from 40px to 36px (rounded-lg), dividers tighten to 16px, the Pen/Pencil preset strip and the mobile H→Text strip drop to 36px tall with tighter padding, strip hosts sit 6px closer, the Convert-to-Text clearance tightens, and the workspace-controls cluster drops to 4px padding / 2px gaps / 20px divider margin. Floating chrome on phones uses a 0.75rem radius and a lighter shadow. Desktop/tablet sizing is byte-identical; behavior, state, and coordinates untouched.

# Loading branding + rich-text baseline completion (2026-08-29)

Status: IMPLEMENTED — PENDING MANUAL VERIFICATION. Automated validation executed (`npm run typecheck`, `npm test` 260 pass / 1 pre-existing skip, `npm run build`); runtime verification is the owner's manual gate.

- **Branded loading state:** the pre-React `index.html` bootstrap fallback now shows the canonical `panvas-logo-1.1.png` mark, a compact "Panvas" wordmark, and one restrained indeterminate hairline in Panvas paper colors (warm light default, ink dark via `prefers-color-scheme`, reduced-motion aware, CSP-compliant with no inline script). The post-bootstrap `App.tsx` loading screen uses the same mark with a compact wordmark and slim bar and still disappears immediately when startup completes — no artificial delay.
- **Branded loading state:** the pre-React `index.html` bootstrap fallback now shows the canonical `panvas_logo.png` mark, a compact "Panvas" wordmark, and one restrained indeterminate hairline in Panvas paper colors (warm light default, ink dark via `prefers-color-scheme`, reduced-motion aware, CSP-compliant with no inline script). The post-bootstrap `App.tsx` loading screen uses the same mark with a compact wordmark and slim bar and still disappears immediately when startup completes — no artificial delay.
- **Text architecture found (already working):** one TipTap editor (`FloatingTextEditor`) over the shared `notebookTipTapExtensions`; `TextObject.content` is ProseMirror JSON, so inline runs and selected-range formatting are natively representable (no model change needed). Persistence is `editor.getJSON()` → `engine.texts.updateTextContent` → the canonical page save (Dexie/IPC, environment-independent). Search extraction (`textFromTipTap`) is formatting-agnostic. The PDF exporter already draws bold, italic, font size (incl. heading sizes), text color, center/right alignment, and `• `/`1. ` list markers.
- **Capabilities already present (functional editor path, not just types):** Bold, Italic, Underline, Strikethrough; font family, font size, text color, multicolor highlight; H1–H3; bulleted/numbered lists, checklists, quote, code block; left/center/right/justify alignment; TipTap-native Ctrl/Cmd+B/I/U and Ctrl+Shift+S while the editor is focused; Undo/Redo inside the editor plus engine object history; clipboard HTML → rich JSON sanitation.
- **Capabilities added this pass:** a contextual text-formatting strip rendered only while a text editor is usable (focused editor or selected text object) — desktop shows B/I/U/S, text color, highlight color, and an "Aa" trigger; below 600px it keeps B/I/U plus both color wells inline and moves strikethrough and all paragraph controls into the shared menu. The full formatting menu body was extracted into one shared `TextFormatMenuContent` used by both the toolbar's Aa trigger and the strip (single source, no duplicated menu). Strip buttons hold the pointer via `preventDefault`, so the editor never blurs and no ink is created underneath; toggle states follow the editor's transaction events.
- **Intentionally deferred / export limits (precise):** the PDF exporter does not yet draw underline, strikethrough, highlight background, or custom font families for text objects (it uses standard Helvetica variants); indent/outdent (Tab handling) was not added because it would need list-keyboard work beyond this baseline; no tables changes, no equation editor, no track changes. Lists rely on TipTap's native Enter/Backspace behavior.

# Local web/PWA handwriting → text fallback (2026-08-29)

Status: LOCAL WEB HANDWRITING FALLBACK: EXPERIMENTAL — PENDING MANUAL ACCURACY/PERFORMANCE VERIFICATION. Automated validation executed (`npm run typecheck`, `npm test` 278 pass / 1 pre-existing skip, `npm run build`); real-model accuracy/latency verification is the owner's manual gate.

- **Provider chain (capability-based, no UA sniffing):** Windows Electron bridge → `WindowsInkRecognitionProvider` (unchanged) → native browser Handwriting API → `WebHandwritingRecognitionProvider` (unchanged) → `LocalNeuralHandwritingRecognitionProvider` (new) → `UnsupportedRecognitionProvider` (raw ink preserved). The factory adds a cheap `hasLocalNeuralRuntime` capability check (Worker + rasterizable canvas surface).
- **Model/runtime:** `@huggingface/transformers` 4.2.0 running `Xenova/trocr-small-handwritten` int8 (encoder q8 + merged-decoder q8, ~64 MB first-use download) inside a dedicated Web Worker, with a ~23 MB ONNX WASM runtime asset emitted locally. WebGPU is attempted first when `navigator.gpu` exists; single-threaded WASM (no cross-origin isolation requirement) is the mandatory baseline fallback. EXPERIMENTAL — not production-certified.
- **Rasterization:** `neural/inkRasterizer.ts` is pure/DOM-free and unit-tested: tight padded bounds, uniform scale (never stretches X/Y), preserved inter-word gaps and multi-stroke structure, dark ink on a clean light background, normalized toward the model's 384px long edge. It lives entirely in the recognition layer — no NotebookRenderer/Engine/coordinate changes and no stroke mutation.
- **Lazy load / concurrency:** nothing downloads at startup or on H→Text activation (`isAvailable()` is a cheap capability check). The worker + model initialize once per app context (module-level singleton shared by every provider instance, including per-open dialog instances); concurrent recognizes share one init promise and route through one stable response dispatcher (a first-pass per-request handler swap that could drop a concurrent result under load was found by tests and fixed). First-use notices — "Preparing on-device handwriting recognition…", "Downloading local handwriting model (~65 MB). This is needed only once.", ready/error — each appear at most once via a `panvas:neural-status` DOM event relayed by the existing toolbar toast path.
- **Language:** English only (TrOCR IAM training). Other requested languages return a truthful `unavailable` result with zero model traffic; Windows Ink and the native browser provider keep their existing language behavior.
- **Privacy:** recognition runs fully on-device after the one-time static model download; no API keys, no ink uploads, no telemetry, no ink logging (diagnostics limited to provider id, backend, and latency).
- **Failures:** download/cache/worker/WASM/WebGPU/inference failures all resolve to the existing safe result statuses, never delete ink, and never crash the shell; a wedged runtime is terminated and reset so a later attempt gets a fresh worker. WebGPU failure falls back to WASM before unavailability is declared.
- **CSP/Vite (minimum changes):** `connect-src` gains the Hugging Face model hosts (`huggingface.co`, `*.huggingface.co`, `*.hf.co`); `vite.config.ts` sets `worker.format: 'es'` because the worker lazily imports transformers.js. The dev-only `unsafe-eval` exception is unchanged and confined to script-src.
- **Integration:** real-time H→Text (1300 ms debounce, sealed batches, placement, Undo/Redo) and bulk Convert-to-Text consume the new provider through the existing `provider.recognize()` contract with zero behavior changes; both are covered by new fake-runtime tests (18 new tests in `tests/neural-handwriting.test.ts`; the real model is never downloaded during `npm test`).
- **Not yet done (deferred to PWA/deployment work):** self-hosted versioned model assets, Cache Storage/OPFS pinning, service-worker pre-cache, additional languages, accuracy tuning.

# TrOCR-small rejection, model-cache fix, and fallback benchmark harness (2026-08-29)

Status: CURRENT TROCR-SMALL FALLBACK: REJECTED — USER-VERIFIED ACCURACY FAILURE. Automated validation executed (`npm run typecheck`, `npm test` 283 pass / 1 pre-existing skip, `npm run build`); candidate accuracy benchmarking is the owner's manual gate via `/app/dev/handwriting-benchmark`.

- **TrOCR-small disabled for runtime:** `LOCAL_NEURAL_FALLBACK_ENABLED = false` in `src/services/recognition/index.ts` — browsers without the native Handwriting API now resolve to the explicit Unsupported provider (raw ink preserved, neutral notice) exactly as before the experiment. The provider, worker, and rasterizer are kept intact because the benchmark harness reuses them. Nothing claims browser handwriting is complete.
- **Root cause of the repeat ~62 MB downloads:** transformers.js defaults to Cache Storage only; it is `undefined` on insecure origins (plain-LAN `http` serving of `dist/`) and in private browsing, so every start missed and re-downloaded. Verified in the shipped transformers 4.2.0 dist (`caches.open(env.cacheKey)` guarded by `typeof caches === "undefined"`).
- **Versioned persistent model cache (`neural/panvasModelCache.ts`):** a transformers `env.customCache` implementation with two tiers — Cache Storage (`panvas-model-cache-v1`) primary, IndexedDB blob fallback secondary — so cached weights now survive restarts on insecure origins too. Entries are revision-stamped (`panvas-handwriting-en-v1`); `purgeStaleModelRevisions()` removes old revisions after a new one lands; reads self-heal the active-revision manifest. `navigator.storage.persist()` is requested once (best-effort, never claimed absolute). The worker now routes all model fetches through this cache.
- **Background preparation contract (`modelPreparation.ts`, dormant):** after startup settles (~idle + 5 s), Panvas checks native provider capability and — only when the runtime fallback is enabled AND native recognition is absent — prepares the model in the background with a restrained "Preparing offline handwriting recognition" status. Currently a no-op because the fallback is disabled. Never blocks startup, never waits for the first handwritten phrase.
- **Benchmark harness:** pure CER/WER/Levenshtein metrics, an evidence-based candidate registry, `runLocalHandwritingBenchmark` (rasterizes Panvas strokes or accepts prepared line images, drives the existing provider, reports expected/recognized/latency per sample), and a lazy developer-only lab at `/app/dev/handwriting-benchmark` (image + expected text → on-device recognition report; nothing uploaded; no product surface links to it).
- **Candidate evidence (verified, not assumed):** `@paddleocr/paddleocr-js` 0.4.2 exists on npm (Apache-2.0) — Candidate A, must be measured on real handwriting before any decision (print-leaning engine, cursive expectations low). `Xenova/trocr-base-handwritten` int8 verified at 88.1 MB encoder + 250 MB decoder ≈ 338 MB — REJECTED at evaluation stage (mobile-infeasible). True stroke-sequence direction: closest real prior art is PellelNitram/OnlineHTR (PyTorch, IAM-OnDB, CTC, pretrained weights, no browser/ONNX export shipped) → a browser-ready stroke recognizer "would require Panvas-specific model training/fine-tuning" (export + calibration work, roughly a dedicated effort: dataset licensing, export, on-device CTC decoding, benchmarking).

# Library Browse Navigation Repair (2026-08-29)

- **Completed & Verified:** Browse navigation in `LibraryWorkspace.tsx` successfully isolated `onSelectView` callback from `onSelectFolder`. Clicking `Recent`, `Favorites`, `Trash`, or `Library` immediately transitions the active view state, clears folder selection, updates the main heading and content list, and retains the active highlight.
- **Empty State UX:** Informative, clear empty states for empty Recent ("No recent activity yet"), empty Favorites ("No favorite items yet"), and empty Trash ("Trash is empty") without reverting the active view to Library.
- **Accessibility:** Accessible native `<button>` controls with `<nav aria-label="...">`, `aria-current="page"`, full-row click targets, and active/hover styling.
- **Status:** COMPLETED — MANUALLY VERIFIED.

# Pre-cloud local storage parity repair (2026-08-29)

Status: PRE-CLOUD LOCAL STORAGE PARITY: IMPLEMENTED — PENDING USER MANUAL VERIFICATION. CLOUD SYNC: NOT STARTED. Automated validation executed (`npm run typecheck`, `npm test` 292 pass / 1 pre-existing skip, `npm run build`); runtime verification is the owner's manual gate.

- **Audit confirmed (against current source):** `CanvasRepository.loadData/saveData` and all custom-block methods used Dexie (`canvasData`/`customBlocks`) unconditionally — even in Electron — while the Electron bridge already exposed `window.panvas.canvas.save/load` writing `Documents/Panvas/<Workspace>/Canvas/<canvasId>.json` through the atomic write queue. Filesystem copies were therefore only ever written by backup/restore, so they went stale between backups. Exactly the reported disparity.
- **Canonical Electron path now:** `saveData` assembles the complete payload (scene merged over the previous canonical file + the renderer's custom blocks embedded + `version`/`updatedAt` stamped) and writes via the validated `canvas:save` IPC → write-queue → `Canvas/<canvasId>.json`; `loadData` reads that file as the source of truth. Dexie `canvasData` is no longer written in Electron — no competing authoritative store. Browser behavior is byte-identical (IndexedDB + sync queue).
- **Legacy data protection:** on Electron load, a pure `selectCanonicalCanvasScene` decision (unit-tested in `canvasSceneStorage.ts`) picks newest-by-`updatedAt`; ties/unknowns go to the filesystem, and a strictly newer (or file-missing) legacy IndexedDB scene is written FORWARD to the filesystem exactly once — the reverse overwrite never happens, so no user data can regress and migration never loops.
- **Custom-block parity:** `CanvasData.customBlocks` was already part of the canonical type; saves now embed the renderer block cache into the file (ONE complete representation), and loads mirror embedded blocks back into an empty Dexie block cache (`canvasDB.importCustomBlocks`, gap-filling `bulkPut` that never overwrites existing rows) so restore/new-profile loads reconstruct fully.
- **Backup/restore:** no format changes. Electron export already reads `Canvas/<id>.json` (now always fresh) and restore writes it through the write queue with existing ID remapping; restored canvases carry their embedded blocks. The required scenario — create → edit → save → edit → backup → restore → latest content present — is now structural.
- **Windows reserved names:** new `src/lib/entityName.ts` `validateEntityName` rejects CON/PRN/AUX/NUL/COM1-9/LPT1-9 case-insensitively, including with extensions (`CON.txt`, `nul.md`, `lpt9.notes`), plus illegal Windows characters/length, with clean Panvas errors; wired into the CreateDialog before any store call. Valid names pass through unchanged (including names that merely contain reserved words like "con artist").
- **Historical state at the time of this storage-parity pass:** Cloud work was documentation-only then. The 2026-08-30 sections below supersede that implementation status while preserving the optional, local-first, user-owned-account contract.

# Google Drive document-sync repair (2026-08-30)

Status: IMPLEMENTED — PENDING USER MANUAL RETEST. The empty-remote repair enumerates canonical workspaces, reads Electron filesystem-backed payloads, uploads exact-byte SHA-256 objects before manifest publication, and requires exact read-back acknowledgment.

## Second-sync stability/performance and browser parity follow-up

- Root cause: a newer coalesced delete received a new journal row while a stale pending restore remained actionable. Coalescing is now transactionally scoped by workspace + kind + ID; legacy lower revisions become `superseded`, never falsely `synced`.
- One cycle performs one canonical scan and one payload load/hash per entity, transfers objects with bounded concurrency, skips known hashes, uses hard Google request timeouts, and retries only transient/network/408/429/5xx failures with bounded backoff. A no-change sync writes nothing.
- Manifest metadata is refreshed before publication to reject a newer cross-device revision. Success requires exact read-back and no unresolved journal entries.
- Browser/PWA now uses Google Identity Services with a public Web client ID and a memory-only short-lived access token. Remote workspaces are discoverable and reconstruct into browser IndexedDB or Electron canonical storage with stable IDs and exact binary envelopes.
- Verification: focused Google/cloud tests 47/47; full suite 324 pass / 0 fail / 1 platform-only skip; typecheck and renderer/Electron production build pass; renderer secret-marker scan pass.
- Runtime gate: stable Electron sync is pending user retest; browser/PWA sync is pending user manual verification. OneDrive remains unimplemented.

# Active Immediate Task

The active immediate task is:
1. **NEXT**: PWA / installable-web + persistent-storage foundation (`navigator.storage.persist()`, Web App Manifest, offline service worker shell).
2. **THEN**: Remaining UI cleanup (Pass 2: Notebook creation defaults & template selection → Pass 3: Direct object interaction/input routing → Pass 4: Margins + editable structured templates).
3. **THEN**: Windows Storage-Location Support → Security Foundation → Provider-Neutral Cloud Sync (OneDrive & Google Drive) → Multi-Device/Offline Conflict Validation → Windows Installer & Signing → Landing Site → Release Verification.
