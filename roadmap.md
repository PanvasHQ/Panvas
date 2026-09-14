# PANVAS MASTER PRODUCT ROADMAP

> [!NOTE]
> **Historical Engineering Roadmap (August 2026)**  
> This file is the historical internal development roadmap used during earlier feature implementation sprints.  
> For the authoritative public product roadmap (V1 Foundation → V2 Knowledge Canvas → V3 Platform), refer to [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## 0. EXECUTIVE SCOPE: PANVAS V1 RELEASE

### Current implementation reconciliation — 2026-08-30

Google Drive Cloud Sync v0.1.0 is implemented for Electron and browser/PWA with the V2 architecture feature-frozen. Desktop PKCE OAuth, browser GIS, complete object/manifest reconstruction, per-workspace BASE reconciliation, recovery choices, quarantine, bounded retries, and account isolation are covered by the current focused suites. **LIVE DATA VERIFICATION REMAINS THE RELEASE OWNER'S FINAL CHECK.** OneDrive is not implemented. See [`docs/CLOUD_SYNC_V0_1_ARCHITECTURE.md`](docs/CLOUD_SYNC_V0_1_ARCHITECTURE.md) for the current contract.

Panvas is a local-first, desktop-first visual research workspace for engineers, researchers, students, and creators that blends diagrams, freeform canvas, 5-tier hierarchical notebooks, PDF annotations, pressure-sensitive 2D vector ink, and rich structured documents.

### 0.1 V1 Primary Delivery Forms & Platforms

Panvas V1 delivers two primary official form factors:

* **A. Windows Desktop Application (Electron)**:
  - Distributed directly from the official Panvas website (direct installer download).
  - Packaged with an installer wizard (NSIS is the current recommended Windows installer candidate; branding, license/EULA, Start Menu/Desktop shortcuts, clean uninstallation).
  - Code-signed before production release (PLANNED / NOT YET IMPLEMENTED).
  - *Note*: Microsoft Store packaging is future/optional and not a V1 dependency.
* **B. Web / PWA Application (Hosted Web)**:
  - Accessible via modern browsers on Windows, macOS, Linux, iPad/iPadOS, and Android tablets/phones.
  - Installable as a Progressive Web App (PWA) with Add to Home Screen / Desktop support (PLANNED / NOT YET IMPLEMENTED).
  - Offline-first execution via local storage and service worker application shell (PLANNED / NOT YET IMPLEMENTED).
* **Explicit Mobile Boundary**:
  - NO separate native iOS or Android app store applications for V1 (mobile and tablet access is delivered through responsive browser and PWA support; native mobile apps remain **[FUTURE]**).

---

### 0.2 Panvas V1 Scope Summary ([V1] — Must Ship)

* **UI/UX System & Canvas Ergonomics**:
  - GoodNotes/Notability-inspired low-chrome canvas experience where the paper/content is the visual hero.
  - Premium Library/Shelf with visual notebook covers, thumbnails, folder customization (colors/icons), recent/favorites, and grid/list browsing (COMPLETED — MANUALLY VERIFIED).
  - Compact adaptive floating toolbar providing direct access to Pen, Pencil, Marker, Highlighter, Eraser, Select/Lasso, Text, Shape, and a dedicated More/overflow menu.
  - Responsive toolbar behavior reflowing gracefully across large desktop, half-window, small desktop, tablet/iPad, and mobile browser viewports (<600px overlay drawer and bottom sheets).
  - Page thumbnails sidebar, notebook document tabs, side-by-side independent split-view workspace, and quick undo/redo gestures.
  - High-contrast, curated Light, Dark, and Ink theme studios with custom typography.
* **Core Notebook Experience**:
  - Full 5-tier document hierarchy: `Workspace → Folder → Notebook → Section → Page`.
  - Page management: thumbnail strip, page creation (before/after), reordering, duplication, deletion, and trash/recovery.
  - Page properties: paper templates (Blank, Ruled, Grid, Dotted, Cornell, Planner), custom page sizes, orientations, and margins.
  - Local-first persistence: zero-account local source of truth, write queue serialization, and crash recovery.
  - Local backup & restore: export notebook/workspace backup archives and import/restore workspace backups.
* **Windows User-Data Storage Architecture**:
  - **Distinction**: *Install Location* (e.g., Program Files) vs *Panvas User-Data Location* (user notebooks and assets).
  - **Default Location**: `path.join(app.getPath('documents'), 'Panvas')` (`%USERPROFILE%\Documents\Panvas` on Windows) is the current default storage path in Electron source; existing user notes remain accessible.
  - **Configurable Location (PLANNED / NOT YET IMPLEMENTED)**: User can choose a custom directory during onboarding or in Settings (`Settings → Storage`).
  - **Safe Migration Engine (PLANNED / NOT YET IMPLEMENTED)**: Verifies and atomically copies all notebooks, canvases, PDFs, assets, and metadata before switching canonical pointers.
* **Web / PWA Local Storage Model & Persistence (PLANNED / NOT YET IMPLEMENTED)**:
  - Application-private storage using IndexedDB (Dexie) and OPFS for binary assets.
  - No assumption of arbitrary filesystem access on browsers or mobile/iPad platforms.
  - **Persistent Storage**: Feature-detected `navigator.storage.persist()` and `navigator.storage.persisted()` to reduce eviction risk (with clear communication that backups and cloud sync provide full disaster recovery).
  - **Storage Status UX**: Settings panel displaying persistent storage status, estimated usage, approximate quota, and backup export/restore actions.
* **2D Vector Ink & Drawing Engine**:
  - Drawing tools: Pen, Pencil, Marker, Highlighter, Fountain/Brush styles.
  - Pressure-sensitive input, stylus ergonomics, hover indicators, and stroke smoothing.
  - Eraser suite: whole-stroke eraser, precision/pixel eraser, and highlighter-only erasing.
  - Fast gestures: scribble-to-erase, circle-to-select, and lasso selection with move/resize/transform/delete.
  - Geometric intelligence: conservative straight-line recognition (0°/45°/90° snapping), rough-shape recognition (circles, ellipses, rectangles, squares).
  - Interactive on-canvas Ruler: draggable, rotatable, angle and measurement markings with edge-snapping.
  - Vector shapes: arrows, connectors, rectangles, ellipses, polygons.
  - Workspace drawing layers (Content, Annotation, Background), sticky notes/elements, and presentation laser pointer.
* **Handwriting Recognition & Conversion**:
  - **Windows Desktop (Electron)**: Local WinRT ink recognition converts reviewed strokes to editable text (`H → Text`) with font preview and placement (COMPLETED — MANUALLY VERIFIED).
  - **Web / PWA Application (V1 Boundary)**: Full 2D vector ink creation, editing, erasing, layers, and gestures are fully supported. Handwriting-to-Text recognition is available only in Windows Electron through Windows Ink; unsupported web browsers preserve raw ink with a neutral notification. Experimental browser OCR approaches were rejected due to inadequate accuracy / excessive latency. Web fallback and native on-device mobile recognition (Android ML Kit / iOS PencilKit) are deferred to **[V2 / FUTURE]**.
  - Complete workflow on Windows: Strokes → recognition → editable text → handwriting-style font selection → preview/apply.
  - Searchable recognized handwriting within local note search.
* **PDF & Document Workspace**:
  - PDF import via file picker and universal drag & drop.
  - High-performance local PDF rendering and multi-page thumbnail navigation.
  - In-place annotation: freehand pen/pencil, highlighter markup, text annotations, and shapes over PDF pages.
  - Page operations: rotate, reorder, and extract PDF pages.
  - Export & Print: export annotated PDFs, export whole notebooks to PDF, and isolated printing.
* **Rich Document Content**:
  - TipTap rich text: headings (H1–H3), lists, task checklists, blockquotes, code blocks, and KaTeX math equations.
  - Contextual text formatting strip (B/I/U/S, text/highlight colors, typography menu).
  - Slash-command (`/`) block insertion and media embedding (images, diagrams, callouts, dividers).
  - Mixed layout: freeform placement of text boxes, handwriting, shapes, and images on the same page.
* **Infinite Freeform Canvas (Excalidraw)**:
* **Infinite Freeform Canvas (Excalidraw & Production Hardening)**:
  - Freeform diagramming with custom blocks (LaTeX, Markdown, PDF preview, Voice Notes).
  - 4-tier hierarchy placement (Workspace root, Folder, Notebook, Section) with drag-and-drop moves and soft-delete/restore cascading.
  - Draw-to-Shape and native selection integration.
  - **V1 Final Production Hardening**: Code-split Excalidraw bundle (`HARDEN-012`), fix CSP library download permissions (`HARDEN-009`), asset saving without giant data URLs, 100% offline typography (*Virgil* font bundled locally), zero lost drawings.
* **Embedded Web Research Workspace ([V1] — Confirmed Scope)**:
  - Accessible via dedicated `Web` tool in the main editor/workspace toolbar.
* **Embedded Web Research Workspace ([V3] — Moved Post-V1)**:
  - *Moved to V3 post-V1 release.* Accessible via dedicated `Web` tool in the main editor/workspace toolbar.
  - True embedded research companion inside Panvas; default home/search destination is Google.
  - Omnibox URL/search bar, Back, Forward, Reload, Stop, Home, Open in external browser, loading and error states.
  - Sensible keyboard shortcuts (`Ctrl+L`, `Ctrl+R`, `Alt+Left`, `Alt+Right`), close/hide without losing workspace state.
  - **Desktop Security Boundary**: Isolated Electron `WebContentsView` (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, zero preload bridge, zero IPC emitter, partitioned session `persist:panvas_research_browser`, protocol validation).
  - **Web / PWA Fallback**: Clean external tab launch / safe link preview for browser environments where iframe framing is blocked by CSP/X-Frame-Options.
* **MCP / Extension Platform Foundation ([V1] — Confirmed Scope)**:
  - Extensibility platform inspired by Obsidian; V1 ships the **Platform & Foundation**, not hundreds of extensions.
* **MCP / Extension Platform Foundation ([V3] — Moved Post-V1)**:
  - *Moved to V3 post-V1 release.* Extensibility platform inspired by Obsidian; ships the **Platform & Foundation**, not hundreds of extensions.
  - **Model Context Protocol (MCP)**: Native support for registering local (`stdio`) and remote (`SSE`) MCP servers, capability negotiation, tool/resource discovery, connection monitoring, and explicit trust/permissions.
  - **Panvas Extension System Foundation**: Extension manifest schema (`panvas-extension.json`), public API façade decoupling plugins from internal Zustand stores and Dexie tables, least-privilege permissions (`workspace.read`, `notebook.write`, `canvas.read`, etc.), contribution points for custom commands, toolbar buttons, sidebar panels, and import/export handlers.
* **Study & Productivity Workflows**:
  - Page-linked audio note recording and synchronized audio playback timeline bar.
  - Multi-level document outlines / table of contents.
  - Study templates: planners, lecture notes, exam/practice sheets.
  - Global & note-level search: typed text, note titles, page titles, tags, and embedded PDF text.
* **Provider-Neutral Cloud Sync**:
  - Architecture: `Local Panvas Data ↔ Sync Engine ↔ Provider Adapter`.
  - **Priority 1**: Microsoft OneDrive (Microsoft Graph delta sync).
  - **Priority 2**: Google Drive (Google Drive API v3 sync).
  - *Post-V1*: Dropbox adapter.
  - Works across delivery forms (Windows Desktop ↔ Cloud ↔ iPad/Android Web/PWA).
  - Full data scope: workspaces, folders, notebooks, sections, pages, strokes, text, canvases, PDFs, assets, audio, metadata, and deletion tombstones.
  - Non-destructive conflict branching, offline change journals, and atomic sync verification.
* **Official Landing & Download Website**:
  - Professional website with clear CTAs: "Download Panvas for Windows", "Open Panvas Web", "Install Panvas Web App".
  - System requirements, version release notes, Privacy Policy, Terms of Service, software license/EULA, and contact/support.
  - Local-first research and writing tool tone (strictly avoiding AI/SaaS hype).

> [!IMPORTANT]
> **Authoritative Specifications & Master Roadmap**:
> - **Master Product Roadmap**: [`docs/ROADMAP.md`](docs/ROADMAP.md) (V1 Foundation → V2 Knowledge Canvas → V3 Platform)
> - **Panvas V1 Scope**: [`docs/panvas-handover/V1_FEATURE_SCOPE.md`](docs/panvas-handover/V1_FEATURE_SCOPE.md) (Core Product + Production Readiness)
> - **Future Engineering Reference**: [`docs/panvas-handover/V2_ROADMAP.md`](docs/panvas-handover/V2_ROADMAP.md)
>
> *Evolution: V1 is feature-frozen on core local-first capabilities. V2 delivers the Knowledge Canvas (Notion-style structured blocks + Excalidraw spatial freedom). V3 delivers Extensibility & Intelligence (Web, MCP, Plugins, AI).*

---

### 0.3 Explicitly Out of Scope for V1 ([V2] & [FUTURE])

The following capabilities are valid long-term roadmap items but are **STRICTLY EXCLUDED** from the V1 release gate:
* 🔮 **Panvas Intelligence & AI Features ([V2])**: AI research assistant, chat-with-notes, AI note summaries, document QA, AI mind maps, and autonomous agent workflows are **formally reserved for V2**. Core Panvas V1 is 100% self-sufficient and offline.
* 🌐 **Embedded Web Workspace / Research Browser ([V2])**: Moved to V2 on 2026-09-09 to prioritize V1 core stabilization.
* 🔌 **Model Context Protocol (MCP) Support ([V2])**: Moved to V2 on 2026-09-09. Local/remote MCP server integration is a V2 pillar.
* 🧩 **Panvas Extension / Plugin Platform ([V2])**: Moved to V2 on 2026-09-09. Extensibility manifest, public API façade, and contribution points belong to V2.
* 🔮 **Panvas Intelligence & AI Features ([V2])**: AI research assistant, chat-with-notes, AI note summaries, document QA, AI mind maps, and autonomous agent workflows are formally reserved for V2. Core Panvas V1 is 100% self-sufficient and offline.
* ❌ Native iOS / Android app store binaries ([FUTURE]).
* ❌ Microsoft Store packaging ([FUTURE/OPTIONAL]).
* ❌ Dropbox sync provider ([V2]).
* ❌ Time Keeper / stopwatch / Pomodoro study widget ([V2]).
* ❌ General OCR, image OCR, and scanned PDF OCR pipelines ([V2]).
* ❌ Audio transcription and word-by-word audio-to-ink synchronization ([V2]).
* ❌ Handwritten equation recognition to LaTeX ([V2]).
* ❌ Template marketplace & community sharing ([V2]).
* ❌ General AI assistant, chat-with-notes, AI note summaries, or AI mind maps ([FUTURE]).
* ❌ Public extension marketplace & community plugin store ([V2 / FUTURE] — V1 delivers local/manual extension platform foundation).
* ❌ Public extension marketplace & community plugin store ([FUTURE]).
* ❌ Advanced digital illustration brush engines ([FUTURE]).
* ❌ Real-time multiplayer collaborative editing ([FUTURE]).
* ❌ Third-party plugin marketplace and extension runtime ([FUTURE]).

---

## 1. GOVERNING DEVELOPMENT RULES

1. **One Task at a Time**: Only implement the feature explicitly assigned. Never bundle unrequested refactorings.
2. **Never Redesign Unrelated UI**: Do not restyle shell, sidebar, or toolbars unless required by the active task.
3. **No Placeholders or TODOs**: Every implemented handler must be production-ready with full error handling and validation.
4. **Local-First System of Record**: Local disk / browser storage is the authoritative durability layer. The application must work 100% offline.
5. **Data Model Before Cloud**: Local schemas, repositories, and persistence must be frozen before enabling remote sync providers.
6. **Strict Feature Completion Semantics**: A feature may only be marked `[x]` when the **USER-FACING CAPABILITY actually works end-to-end**. Do NOT mark infrastructure, storage, tests, or partial backend implementation as a completed product feature.
7. **Proportional Focused Validation**: Validate with `npm run typecheck` and focused unit/interaction tests. Do NOT run full Electron launches or broad release certification audits after minor feature edits.

---

## 2. REVISED V1 IMPLEMENTATION PHASES

### Phase 1 — Foundation & Shell [V1] ✅
- [x] Project setup (Vite, React 18, TypeScript, Tailwind CSS).
- [x] Electron main/preload secure shell with context isolation and sandboxing.
- [x] Wouter client-side routing.
- [x] Centralized theme engine with light, dark, and ink studio tokens.
- [x] Local disk persistence via Electron IPC and IndexedDB (Dexie) binary tables.
- [x] Global Zustand stores (`workspaceStore`, `canvasStore`, `layoutStore`, `uiStore`, `notebookSettingsStore`).
- [x] Base application shell (`AppShell`, `TopBar`, `Sidebar`, `StatusBar`).
- [x] Pre-React and post-bootstrap branded loading states.

### Phase 2 — Workspace & 5-Tier Document Hierarchy [V1] ✅
- [x] **5-Tier Data Model**: `Workspace → Folder → Notebook → Section → Page`.
- [x] **Filesystem Source of Truth**: `%USERPROFILE%/Documents/Panvas/<WorkspaceName>/.panvas/workspace.json`.
- [x] **Write Queue Serialization**: Disk writes serialized through `writeQueue` in Electron main process.
- [x] **Workspace Explorer**: Nested folder tree, breadcrumbs, item renaming, and deletion.
- [x] **Trash & Lossless Recovery**: Canonical root/cascade soft deletion and item recovery across notebooks, sections, folders, canvases, and pages.
- [x] **Library / Shelf View**: Premium visual notebook shelf with thumbnail covers, folder customization, grid/list view sorting, favorites (`isPinned`), dynamic recent documents (`lastOpenedAt`), and tags.
- [x] **Multi-Document Tabs & Split View**: Multi-tab notebook switching and side-by-side independent notebook split views.
- [x] **Workspace Backup & Restore**: Export notebook/workspace backup archives and import/restore workspace backups.

### Phase 3 — Notebook & Page Management [V1] ✅
- [x] **Page Creation**: Insert page after/before current page, create page from template.
- [x] **Page Numbering**: Dynamic page counter and position indicator (`Page X of Y`).
- [x] **Page Sorter & Drawer**: Thumbnail strip, drag-and-drop page reordering, page duplication, and page deletion.
- [x] **Page Properties**: Page size (A4, Letter, Infinite), paper color, template selector, orientation, and margins.
- [x] **Paper Templates**: Blank, Ruled, Grid, Dotted, Cornell, and Planner backgrounds.
- [x] **Table of Contents & Outlines**: Multi-level hierarchical outline generator based on page headings.

### Phase 4 — 2D Vector Ink & Drawing Engine [V1] ✅
- [x] **Core Drawing Surface**: High-performance HTML5 canvas with DPR scaling and viewport coordinate mapping.
- [x] **Basic Tools**: Pen, Pencil, Highlighter, Eraser with color palettes, stroke widths, and opacity controls.
- [x] **Pressure Sensitivity**: Stylus pressure curve mapping with fallback for mouse.
- [x] **Stroke Erasing**: Whole-stroke erase and precision pixel/area eraser.
- [x] **Highlighter-Only Erasing**: Eraser mode targeting only highlighter strokes while preserving ink and shapes.
- [x] **Scribble-to-Erase Gesture**: Fast zig-zag/scribble gesture over ink to delete strokes without switching tools.
- [x] **Circle-to-Select Gesture**: Closed loop gesture around ink/objects that automatically activates selection.
- [x] **Straight-Line Recognition**: Conservative snap-to-straight-line with 0°/45°/90° angle snapping.
- [x] **Rough-Shape Recognition**: Opt-in conservative recognition converts sufficiently large, closed, single-turn ink into native ellipse/rectangle shapes.
- [x] **Lasso Selection & Transform**: Freehand drags select enclosed strokes, shapes, text, and images.
- [x] **Ruler & Measurement Guide**: Transient draggable/rotatable ruler with edge-snapped drafting.
- [x] **Drawing Layers**: Persisted ordered page layers (Content, Annotations, Background).
- [x] **Presentation Laser Pointer**: Page-space trail with ~1-second animation decay.

### Phase 5 — Rich Content & Mixed Page Engine [V1] ✅
- [x] **TipTap Rich Text Integration**: Inline formatting, headings, lists, task checklists, code blocks, and KaTeX equations.
- [x] **Contextual Formatting Strip**: Non-blurring B/I/U/S formatting strip and typography menu.
- [x] **Slash Menu (`/`)**: Rapid block insertion menu for headings, tables, callouts, and dividers.
- [x] **Image Placement**: Insert, drag, resize, rotate, and delete images on notebook pages.
- [x] **Mixed Canvas Placement**: Rich text boxes, vector ink, images, shapes, and sticky notes with layer-scoped z-order.
- [x] **Sticky Notes & Elements**: Floating color-coded sticky note objects with editable text.

### Phase 6 — Handwriting Recognition & Conversion [V1] 🟡
- [x] **Windows Desktop WinRT Recognition**: Local Windows Ink recognition converts selected strokes to editable text.
- [x] **Searchable Handwriting Index**: Index recognized handwriting tokens into the local search database.
- [ ] **Browser / PWA Handwriting Fallback Provider [V1]**: Local on-device handwriting recognition fallback for non-Windows browsers (Android Chrome, iPadOS Safari, desktop web).
- [ ] **Handwriting → Editable Text Final UX Pass [V1]**: Floating selection trigger and typography polish.

### Phase 7 — PDF Workspace & Document Annotation [V1] ✅
- [x] **PDF Import & Storage**: Universal drag & drop and file picker import into local binary storage.
- [x] **Local PDF.js Rendering**: Offline PDF rendering with local web worker.
- [x] **PDF Workspace Layout**: Document viewer, zoom controls, and thumbnail sidebar.
- [x] **In-Place PDF Annotation**: Vector ink, highlighter, text annotations, and shapes over PDF pages.
- [x] **PDF Page Operations**: Reorder, rotate, and extract PDF pages.
- [x] **PDF & Note Export / Print**: Export annotated documents and full notebooks to PDF, and isolated printing.

### Phase 8 — Study & Productivity Workflows [V1] ✅
- [x] **Audio Notes Binary Storage**: Audio recording persistence in local database/IPC.
- [x] **Page-Linked Audio Recording**: Record lecture/meeting audio directly within a notebook page.
- [x] **Audio Playback Timeline**: Interactive player bar with scrub, pause, resume, and duration tracking.
- [x] **Academic & Planner Templates**: Cornell note systems, daily planners, and exam practice sheets.

### Phase 9 — Local Search & Retrieval [V1] ✅
- [x] **Command Palette (`Ctrl+K`)**: Rapid navigation and tool switching.
- [x] **Full-Text Page Content Search**: Indexed search over TipTap rich-text bodies, titles, and tags.
- [x] **PDF Embedded Text Search**: Searchable digital text layer extraction across imported PDFs.
- [x] **Unified Search Results View**: Direct result navigation with keyword snippet highlighting.

### Phase 10 — Infinite Freeform Canvas [V1] ✅
### Phase 10 — Infinite Freeform Canvas & Final Production Hardening [V1] ⚠️ (HARDENING REQUIRED)
- [x] **Excalidraw Core Integration**: Freeform vector canvas for diagrams and system architectures.
- [x] **Custom Blocks**: LaTeX blocks, Markdown blocks, PDF preview blocks, and Voice Notes in canvas.
- [x] **Canvas Persistence**: Dedicated canvas file storage (`.canvas.json`) in workspace repository.
- [x] **Canvas ↔ Notebook Hierarchy Interoperability**: First-class canvas ownership at Workspace, Folder, Notebook, and Section levels with single-parent integrity, drag-and-drop moves, and soft-delete/restore cascading.
- [ ] **10.5: Canvas V1 Production Hardening Pass (HARDENING REQUIRED)**:
  - Code-split Excalidraw bundle via `React.lazy()` (`HARDEN-012`) to drop entry bundle size from 3.89 MB to <1.5 MB.
  - Whitelist Excalidraw community library domain in CSP `connect-src` (`HARDEN-009`).
  - Asset persistence optimization: save embedded images as binary files rather than inline base64 strings in `.canvas.json`.
  - Comprehensive memory cleanup on unmount to prevent canvas WebGL/2D context leaks.
  - Offline durability: bundle *Virgil* and canvas fonts locally with zero CDN dependency.
  - Ensure zero lost drawings and rock-solid auto-save/reload recovery.

### Phase 11 — UI/UX System & Ergonomics [V1]
- [x] **Stationary Toolbars & Window Framing**: Scroll containment strictly owned by `.notebook-viewport`; frameless Electron window.
- [x] **Compact Adaptive Toolbar**: Floating toolbar with primary tool slots and overflow popover.
- [x] **Responsive Toolbar Reflow**: Seamless adaptation for large monitors, half-screen splits, small laptops, tablet/iPad, and mobile viewports (<600px).
- [x] **Pass 1: Library & Shell UX (COMPLETED — MANUALLY VERIFIED)**: Live workspace collections, 3-zone TopBar with native caption spacer, Browse view switcher, verified in runtime with persistence across restarts.
- [ ] **Pass 2: Notebook Creation Defaults & Template Selection [V1]**: Creation dialog flow and property panel discoverability.
- [ ] **Pass 3: Direct Object Interaction & Input Routing [V1]**: Pointer capture, selection boundaries, Voice Note cards.
- [ ] **Pass 4: Margins & Structured Templates [V1]**: Margin guides and structured template editing.

### Phase 11B — Embedded Web Research Workspace [V3] 🌐 (V3 PLANNED — NOT REQUIRED FOR V1)
> [!NOTE]
> **STATUS: POST-V1 (Scope changed on 2026-09-09: moved to V3)**  
> **Canonical Roadmap**: [`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/panvas-handover/V2_ROADMAP.md`](docs/panvas-handover/V2_ROADMAP.md)  
> *The technical architecture below is preserved for post-V1 implementation.*

- [ ] **11B.1: Toolbar Web Entry & Layout Surface**: Dedicated `Web` action in primary workspace toolbar; opens embedded research view alongside notes.
- [ ] **11B.2: Omnibox & Navigation Chrome**: URL/search bar defaulting to Google, Back, Forward, Reload, Stop, Home, and Open in External Browser.
- [ ] **11B.3: Desktop Electron Security Sandbox**: Isolated `WebContentsView` (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, zero preload bridge, zero IPC, partitioned session `persist:panvas_research_browser`, protocol validation).
- [ ] **11B.4: Web / PWA Safe Fallback**: External tab launch and safe preview cards for browser environments where iframe embedding is blocked by CSP/X-Frame-Options.
- [ ] **11B.5: Research Companion Workflow**: Seamless copy/paste of text and images into notes, safe drag-and-drop, and citation references.

### Phase 12 — Web / PWA Application Foundation & Persistent Storage [V1] 🔴
- [ ] **Web App Manifest (PLANNED / NOT YET IMPLEMENTED)**: Application name, canonical icons, theme colors, standalone display mode, start URL.
- [ ] **Offline Service Worker Shell (PLANNED / NOT YET IMPLEMENTED)**: Reliable offline application shell caching without risk of document corruption.
- [ ] **Persistent Storage API Integration (PLANNED / NOT YET IMPLEMENTED)**: Feature-detected `navigator.storage.persist()` and `navigator.storage.persisted()` requests.
- [ ] **Web Storage Status UX (PLANNED / NOT YET IMPLEMENTED)**: Settings section showing persistence status, estimated usage, approximate quota, and backup actions.
- [ ] **Mobile / Tablet PWA Validation**: Touch, stylus, and gesture verification on Android Chrome and iPadOS Safari.

### Phase 13 — Windows Storage-Location Support & First-Run Experience [V1] 🔴
- [ ] **Configurable User-Data Directory (PLANNED / NOT YET IMPLEMENTED)**: Allow user selection of Panvas data directory (`path.join(app.getPath('documents'), 'Panvas')` default).
- [ ] **Install vs Data Location Separation (PLANNED / NOT YET IMPLEMENTED)**: Strict separation between application binaries and user notebooks/assets.
- [ ] **Safe Data Migration Engine (PLANNED / NOT YET IMPLEMENTED)**: Verified, atomic data copy and path redirection with rollback safety.
- [ ] **First-Run Onboarding Flow (PLANNED / NOT YET IMPLEMENTED)**: Welcome screen with local storage confirmation/selection and optional non-blocking cloud connection.

### Phase 14 — Security Foundation for Release & Cloud [V1] 🔴
- [x] **Google OAuth 2.0 with PKCE (MANUALLY VERIFIED WORKING)**: System-browser authorization with loopback callback and least-privilege `drive.file` scope.
- [x] **Google Credential & Token Storage (IMPLEMENTED / AUTOMATED SECURITY TESTS PASS)**: Tokens remain in Electron main process and are encrypted with `safeStorage`.
- [ ] **IPC & Path Hardening (PLANNED / NOT YET IMPLEMENTED)**: Strict path validation, traversal prevention, and payload schema validation.
- [ ] **CSP & Dependency Review (PLANNED / NOT YET IMPLEMENTED)**: Review Content Security Policy, bundle sanitization, and vulnerability audit.

### Phase 15 — Provider-Neutral Cloud Sync Core, OneDrive & Google Drive [V1] 🔴
- [x] **Provider-Neutral Sync Engine (IMPLEMENTED / AUTOMATED TESTS PASS)**: Change journal, manifests, exact-byte hashing, initial local-state bootstrap, tombstones, read-back acknowledgment, safe metrics, and false-success prevention.
- [x] **Conflict Resolution Engine (IMPLEMENTED / AUTOMATED TESTS PASS)**: Deterministic non-destructive conflict handling and stable-ID delete/restore behavior.
- [ ] **Microsoft OneDrive Sync Adapter (PLANNED / NOT YET IMPLEMENTED)**: Microsoft Graph delta synchronization.
- [ ] **Google Drive Sync Adapter (IMPLEMENTED — PENDING USER RUNTIME CERTIFICATION)**: Electron OAuth and real objects/manifest have manual evidence; stable second-sync and browser/PWA behavior remain pending user verification.
- [ ] **Cross-Platform Multi-Device Sync (IMPLEMENTED / AUTOMATED FAKE-TRANSPORT TESTS PASS — MANUAL VALIDATION PENDING)**: Stable-ID Electron ↔ browser reconstruction exists; Windows Electron, Android PWA, and iPadOS PWA runtime verification remains open.

### Phase 16 — Windows Distribution, Installer & Code Signing [V1] 🔴
- [ ] **Direct Distribution Setup Wizard (PLANNED / NOT YET IMPLEMENTED)**: Installer with branding, versioning, publisher metadata, and license/EULA (NSIS is the current recommended Windows installer candidate).
- [ ] **Desktop & Start Menu Shortcuts (PLANNED / NOT YET IMPLEMENTED)**: User-configurable shortcut creation and clean uninstallation.
- [ ] **Code Signing (PLANNED / NOT YET IMPLEMENTED)**: Production executable and installer signing with Authenticode certificate.
- [ ] **Update Strategy (PLANNED / NOT YET IMPLEMENTED)**: Safe, transparent update notification and package delivery.

### Phase 17 — Official Landing & Download Website [V1] 🔴
- [ ] **Landing Page Architecture (PLANNED / NOT YET IMPLEMENTED)**: Clean, high-performance static website.
- [ ] **Clear Delivery CTAs (PLANNED / NOT YET IMPLEMENTED)**: "Download Panvas for Windows", "Open Panvas Web", "Install Panvas Web App".
- [ ] **Product Documentation & Legal (PLANNED / NOT YET IMPLEMENTED)**: System requirements, release notes, Privacy Policy, Terms of Service, and software license.

### Phase 18 — Final Release Hardening & Verification [V1] 🔴
- [ ] **Hardening Backlog Execution**: Complete resolution of 30 prioritized items in [`docs/panvas-handover/RELEASE_HARDENING_BACKLOG.md`](docs/panvas-handover/RELEASE_HARDENING_BACKLOG.md) (including 5 BLOCKER and 7 P0 stability/security items).
- [ ] **Automated Release Gates**: `npm run check:release`, `npm run audit:sync`, browser integrity, resize sweeps.
- [ ] **Clean Profile Verification**: Full installation, launch, offline, and data migration testing on clean environments.
- [ ] **V1 Release Tagging**: Production artifact generation and release publication.

### Phase 18B — Extensibility Platform & MCP Foundation [V3] 🔌 (V3 PLANNED — NOT REQUIRED FOR V1)
> [!NOTE]
> **STATUS: POST-V1 (Scope changed on 2026-09-09: moved to V3)**  
> **Canonical Roadmap**: [`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/panvas-handover/V2_ROADMAP.md`](docs/panvas-handover/V2_ROADMAP.md)  
> *The technical architecture below is preserved for post-V1 implementation.*

- [ ] **18B.1: Model Context Protocol (MCP) Foundation [V3]**:
  - Register local stdio MCP servers and remote SSE MCP servers.
  - Inspect server metadata, declared tools, resources, and prompt templates.
  - Connection health monitoring, status indicators in Settings, and reconnect/error recovery.
  - Explicit user trust and capability approval dialog before tool execution or resource access.
- [ ] **18B.2: Panvas Extension System Foundation [V3]**:
  - Standard extension manifest schema (`panvas-extension.json`): `id, name, version, permissions, entry, capabilities`.
  - Sandboxed lifecycle management (`onLoad`, `onUnload`, enable/disable toggles in Settings).
  - Extension contribution points: custom commands (`CommandPalette`), toolbar buttons, sidebar panels, and custom format import/export handlers.
  - Stable Public API Façade (`panvas.*`) strictly decoupling plugins from internal Zustand stores, Dexie tables, and Electron IPC bridges.
  - Granular capability-scoped permissions (`workspace.read`, `workspace.write`, `notebook.read`, `notebook.write`, `canvas.read`, `canvas.write`, `network`, `clipboard`).

---

## 3. POST-V1 ROADMAP ([V2] & [FUTURE])

### Phase 19 — Panvas Intelligence & AI Features [V3] 🔮 (PLANNED V3 — STRICTLY POST-V1)
> [!IMPORTANT]
> **Strict V1 Boundary**: All AI-native capabilities belong exclusively to V2. Core Panvas V1 functionality is 100% self-sufficient, private, local-first, and fully operational without AI dependencies.

- [ ] **Contextual Note Assistant [V2]**: Ground-truth chat with notes, document QA, and private local/cloud LLM integration.
- [ ] **AI Document Understanding [V2]**: Deep semantic PDF extraction, citation graph generation, and conceptual indexing.
- [ ] **AI-Assisted Note Summaries & Tagging [V2]**: Automatic key point extraction, meeting/lecture summaries, and smart backlinking.
- [ ] **AI Canvas & Diagram Generation [V2]**: Text-to-diagram generation, automatic mind mapping, and smart whiteboard layout.
- [ ] **Autonomous Research Workflows [V2]**: Agentic workflows orchestrating registered MCP tools and Panvas notebooks.
- [ ] **Web / PWA Handwriting Recognition & Native Mobile Recognition [V2 / FUTURE]**: Local fallback recognition for web/PWA and native mobile platforms (Android ML Kit Digital Ink / iOS PencilKit) alongside native app development.
- [ ] **Dropbox Sync Adapter [V2]**: Additional third-party cloud storage provider.
- [ ] **Time Keeper Widget [V2]**: On-canvas countdown/stopwatch study widget for exam preparation.
- [ ] **General OCR & Scanned PDF OCR [V2]**: Text extraction for non-searchable document bitmaps.
- [ ] **Audio-to-Ink Synchronization [V2]**: Tap any handwritten word to jump to the exact audio timestamp.
- [ ] **Audio Transcription [V2]**: Local/private speech-to-text transcription.
- [ ] **Template Marketplace & Sharing [V2]**: Community template import/export.
- [ ] **Handwritten Math Recognition [V2]**: Handwritten equation conversion to LaTeX.
- [ ] **Handwriting Smart Reflow [V2]**: Word-wrapping and editing handwritten strokes like typed text.

### Phase 20 — Panvas Developer Coding Workspace [V2] 🔴
- **Product Vision**: Unify `NOTES + CODE + CANVAS + PDF + TERMINAL` in a single local-first technical research and engineering environment.
- [ ] **20.1: Code File & Language Support [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - Full CRUD operations for source files: `.js, .ts, .tsx, .jsx, .py, .java, .c, .cpp, .h, .cs, .go, .rs, .php, .rb, .swift, .kt, .html, .css, .scss, .json, .yaml, .yml, .xml, .md, .sql, .sh, .ps1, .bat, .toml, .env, Dockerfile, Makefile`.
  - Extensible language grammar/mode architecture (not hardcoded to fixed lists).
  - Initial priority languages: TypeScript/JavaScript, HTML/CSS, Python, C/C++, Java, JSON/YAML/Markdown, Shell/PowerShell.
- [ ] **20.2: Professional Code Editor Engine [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - Technical evaluation and integration of modern web editor core (Monaco Editor or CodeMirror 6).
  - Editor features: syntax highlighting, line numbers, customizable indentation (tabs/spaces), bracket matching & auto-closing, code folding, find/replace, multi-cursor, comment/uncomment shortcuts, font customization, optional minimap, word wrap toggle, whitespace visibility, and file encoding awareness.
- [ ] **20.3: Project & Folder Workspace [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - Open arbitrary filesystem development folders directly on Electron desktop without copying files into internal notebook JSON.
  - Lazy file tree explorer, bounded filesystem change watchers, large repository safety, and binary file protection.
- [ ] **20.4: Code Tabs & Split Editor Layout [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - Dedicated Coding Workspace view mode integrated seamlessly with the global workspace.
  - Multi-file tab management, split editor panes, unsaved changes indicator, breadcrumb navigation, quick file switcher (`Ctrl+P`), and keyboard-driven workflows.
- [ ] **20.5: Desktop Integrated Terminal & Local Execution [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - Integrated terminal panel (VS Code-style) for Electron desktop.
  - Execution via user's locally installed toolchains (Node.js, Python, GCC/Clang, javac, Rust/Cargo, Go).
  - **Security Boundary**: Validated IPC to a controlled backend terminal process service; strictly NO raw renderer `child_process.exec()` or unsanitized shell commands.
  - Process lifecycle management, clear working directory enforcement, environment variable controls, kill/restart affordances, and user-visible execution.
- [ ] **20.6: Web / PWA Boundary & Sandboxing [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - PWA provides code editing, syntax highlighting, and project file editing (via File System Access API where available).
  - Strict browser sandbox: NO unrestricted OS shell access; future client-side execution evaluated via WASM/Pyodide.
- [ ] **20.7: Notes ↔ Code Interoperability [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - Two-way deep linking: Link notebook pages and Canvas diagram nodes directly to source code files.
  - Backlinks between technical research PDFs, architecture notes, and implementation source files.
  - Clear architectural separation between embedded rich-text Note Code Blocks (ProseMirror snippets) and full project files in Coding Workspace.
- [ ] **20.8: Staged Intelligence, Git & Diff Evolution [V2] (PLANNED / NOT YET IMPLEMENTED)**:
  - *V2.1 (Foundation)*: File editing, syntax highlighting, editor layout, desktop terminal, local build/run commands.
  - *V2.2 (Version Control & Diff)*: Git repository detection, branch status, stage/unstage/commit, side-by-side & inline diff viewer.
  - *V2.3 (Language Intelligence)*: Language Server Protocol (LSP) architecture, autocomplete, diagnostics, go-to-definition, symbol navigation.

### Phase 21 — Future Vision & Advanced Expansion [FUTURE]
- [ ] **Ground-Truth AI Note Assistant [FUTURE]**: Private document question-answering and mind map generation.
- [ ] **Multiplayer Real-Time Collaboration [FUTURE]**: CRDT-based collaborative notebooks and shared live canvases.
- [ ] **Professional Digital Art Engine [FUTURE]**: Custom raster/vector illustration brushes.
- [ ] **Native Mobile Binaries [FUTURE]**: Dedicated native iOS and Android app store packages.
- [ ] **Microsoft Store Distribution [FUTURE/OPTIONAL]**: MSIX packaging for Microsoft Store.
- [ ] **Plugin & Extension Architecture [FUTURE]**: Sandboxed third-party JavaScript plugin runtime.

---

## 4. AUTONOMOUS AGENT EXECUTION DIRECTIVES

> [!IMPORTANT]
> **Priority Execution Mandate for Autonomous Coding Agents**:
> 1. **V1 Features First**: Always prioritize incomplete **`[V1]`** items before touching `[V2]` or `[FUTURE]` items.
> 2. **Never Implement `[FUTURE]` or `[V2]` Items Early**: Do NOT start implementing AI assistants, audio transcription, collaboration, or native mobile apps during V1 development.
> 3. **Active Immediate Execution Order**:
>    - **NEXT**: PWA / installable-web + persistent-storage foundation (`navigator.storage.persist()`, manifest, offline shell).
>    - **THEN**: Remaining UI cleanup (Notebook creation defaults, object-control routing, margins/templates).
>    - **THEN**: Windows Storage-Location Support → Security Foundation → Provider-Neutral Cloud Sync (OneDrive & Google Drive) → Multi-Device/Offline Conflict Validation → Windows Installer & Signing → Landing Site → Release Verification.
> 4. **Strict Completion Rule**: A feature may only be marked `[x]` when the **USER-FACING CAPABILITY actually works end-to-end**.
> 5. **Definition of Progress**: Progress is measured strictly by: **"What can the Panvas user do now that they could not do before?"**

---

### 4.1 Definitive Panvas V1 Release Gate

Panvas V1 will be declared **FEATURE COMPLETE** and approved for public release only when every condition below is verified:

- [ ] Current notebook, layers, and vector ink feature work is complete and stabilized.
- [ ] Surrounding research-note space and page utilities work reliably.
- [ ] PDF reader, in-place annotation engine, and page-linked notes are robust.
- [ ] Canvas passes all V1 production-hardening checks (lazy-loaded bundle, CSP fix, asset saving, zero data loss).
- [ ] Embedded Web research workspace works safely with `WebContentsView` isolation on desktop and clean web fallback.
- [ ] MCP integration foundation connects, discovers tools, and enforces trust permissions.
- [ ] Extension platform foundation loads manifests and registers commands safely through the public API façade.
- [ ] All 5 BLOCKER items in [`docs/panvas-handover/RELEASE_HARDENING_BACKLOG.md`](docs/panvas-handover/RELEASE_HARDENING_BACKLOG.md) are resolved (`HARDEN-001` through `HARDEN-005`).
- [ ] Persistence and data-integrity verification tests pass (zero data loss across migration, reloads, and offline edits).
- [ ] Electron security boundary hardening passes (sender verification, CSP, zero token leaks).
- [ ] Strix dynamic and static penetration testing pass is completed and triaged.
- [ ] Manual end-to-end UX verification across Windows desktop and modern browser is completed.
- [ ] Packaging, installer generation, and release build checks pass cleanly.
- [ ] 1. Current notebook, layers, and vector ink feature work is fully stabilized.
- [ ] 2. Current PDF reader, in-place annotation engine, and research-space workflow are complete.
- [ ] 3. Canvas passes all V1 production-hardening checks (lazy-load bundle, CSP fix, asset saving, zero data loss).
- [ ] 4. Local persistence and data integrity are hardened (zero data loss across migration, reloads, and offline edits).
- [ ] 5. Optional Google Drive sync is stable and status bar UI accurately reflects sync state.
- [ ] 6. All release-security blockers are fixed (requireTrustedSender on all IPC, CSP hardened).
- [ ] 7. Licensing and third-party attribution are complete (LICENSE file & THIRD_PARTY_NOTICES.md).
- [ ] 8. Performance and reliability blockers are addressed (startup N+1 IPC resolved, bundle split).
- [ ] 9. Accessibility blockers are addressed (unlabelled buttons resolved).
- [ ] 10. Manual UX verification across Windows desktop and modern browser is completed.
- [ ] 11. Final platform regression testing passes cleanly.
- [ ] 12. Strix automated dynamic and static security penetration pass is completed and triaged.
- [ ] 13. Windows packaging, installer generation, and release build checks pass cleanly.

*(Note: AI features are strictly excluded from the V1 gate and begin in V2).*
*(EXPLICITLY REMOVED FROM V1 GATE: Embedded Web, MCP, Extensions, and AI — all moved to V2).*

---

### 4.2 Post-Canvas Release-Hardening Execution Priority

The immediate development priority following Canvas corrections is **production hardening of the existing core**, NOT new feature development:

1. Finish Canvas runtime and manual corrections.
2. P0 data-loss hardening (`HARDEN-001`: full Dexie-to-FS migration).
3. Browser and desktop persistence hardening (`HARDEN-002`: `navigator.storage.persist()`).
4. Electron IPC and security hardening (`HARDEN-005`: sender verification on all IPC).
5. Sync cleanup and StatusBar rewiring (`HARDEN-003`: retire legacy Supabase sync).
6. Licensing and third-party attribution (`HARDEN-004`: `LICENSE` & `THIRD_PARTY_NOTICES.md`).
7. Repository and Git hygiene (`HARDEN-016`: untrack build artifacts and giant PNGs).
8. Error UX and dialog polish (`HARDEN-013`: replace `window.confirm`).
9. Lifecycle and memory leak cleanup (`HARDEN-008`: `NotebookEngine.destroy()`).
10. Performance and bundle cleanup (`HARDEN-011`: N+1 IPC, `HARDEN-012`: Excalidraw lazy-load).
11. Accessibility and button labels (`HARDEN-023`).
12. Packaging and code signing readiness (`HARDEN-021`).
13. Strix automated penetration testing and manual triage ([`STRIX_SECURITY_PLAN.md`](docs/panvas-handover/STRIX_SECURITY_PLAN.md)).
14. Final platform regression testing and manual QA.
15. Panvas V1 Public Release.
