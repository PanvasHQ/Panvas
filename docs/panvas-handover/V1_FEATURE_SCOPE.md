# Panvas V1 Canonical Feature Scope & Release Contract

> **Document Type**: Canonical Product Specification & V1 Scope Lock  
> **Authority**: Product & Engineering Leadership  
> **Status**: LOCKED FOR V1 RELEASE  
> **Last Reconciled**: September 10, 2026 (Pre-Hardening Baseline Reconciliation)  
> **Master Product Roadmap**: [`docs/ROADMAP.md`](../ROADMAP.md)  
> **Future Engineering Reference**: [`V2_ROADMAP.md`](V2_ROADMAP.md)  
> **Engineering Audit**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md)  
> **Hardening Backlog**: [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md)  
> **Security Testing Plan**: [`STRIX_SECURITY_PLAN.md`](STRIX_SECURITY_PLAN.md)  

---

## 1. Executive Scope Lock & Version Strategy

This document establishes the **authoritative product scope and release contract for Panvas V1**.

Panvas follows an intentional, disciplined three-generation product evolution:

$$\mathbf{V1} = \text{\bfseries FOUNDATION + RELIABILITY (Core Local-First Workspace)}$$
$$\mathbf{V2} = \text{\bfseries KNOWLEDGE CANVAS (Notion-Style Blocks + Spatial Freedom)}$$
$$\mathbf{V3} = \text{\bfseries EXTENSIBILITY + INTELLIGENCE (Web Workspace, MCP, Plugins, AI)}$$

### Scope Reduction & V1 Focus
To ensure Panvas reaches users as a rock-solid, private, local-first, highly reliable, and polished desktop and web application rather than expanding indefinitely, **the following four feature families are strictly excluded from V1 and deferred to post-V1 releases**:

1. **Embedded Web Research Workspace / Browser** $\to$ **`V3 PLANNED`** (Post-V1)
2. **Model Context Protocol (MCP) Integration** $\to$ **`V3 PLANNED`** (Post-V1)
3. **Panvas Extension / Plugin Platform** $\to$ **`V3 PLANNED`** (Post-V1)
4. **Panvas AI & Contextual Intelligence** $\to$ **`V3 PLANNED`** (Post-V1)

Panvas V1 delivers a complete, self-sufficient, privacy-respecting research environment whose core usefulness requires zero network dependencies and zero third-party AI services.

---

## 2. Panvas V1 Locked Core Scope

Panvas V1 consists strictly of the **CURRENT IMPLEMENTED CORE** and its final production-hardening passes:

### A. Workspace & Organization
- **5-Tier Hierarchy**: `Workspace → Folder → Notebook → Section → Page` full data model and UI navigation.
- **Sidebar & Library**: Visual notebook shelf with covers, folder customization (colors/icons), recents (`lastOpenedAt`), favorites (`isPinned`), and soft-delete trash recovery with 30-day retention (`deletedByAncestorId`).
- **File Management**: Reliable creation, renaming, moving, duplicating, and permanent deleting of all hierarchy nodes.

### B. Notebook & Editor System
- **2D Vector Ink Engine**: Bezier-interpolated smooth strokes, stylus pressure curves, stroke stabilization, and pen families/nibs (Pen, Pencil, Marker, Highlighter, Eraser).
- **Ink Controls**: Color palettes, opacity, stroke widths, interactive Ruler tool, and presentation Laser.
- **Layers & Organization**: Workspace drawing layers (Content, Annotation, Background), sticky notes, and local elements.
- **Rich Media & Transforms**: Image insertion, cropping, aspect-ratio locked resizing, rotation, and z-index ordering.
- **Rich Document Content**: TipTap rich text engine (H1–H3, bullet/numbered lists, task checklists, blockquotes), KaTeX LaTeX math equations, Lowlight syntax-highlighted code blocks, and contextual formatting strips.
- **Study & Audio Notes**: Page-bound audio note recordings with synchronized playback timeline player.

### C. Page & Research Workflow
- **Paper Formats & Sizing**: A4, Letter, A5, and Legal dimensions in Portrait or Landscape orientations.
- **Stationery & Templates**: Blank, Ruled, Grid, Dotted, Cornell, and Planner SVG patterns with custom line colors and paper backgrounds.
- **Surrounding Research-Note Space**: Four-sided expandable margin space around pages for peripheral annotations, voice memos, and scratchpad calculations.
- **Navigation Modes**: Vertical continuous scrolling, horizontal paging, and 2-page side-by-side spread display.

### D. PDF Workspace
- **Local PDF Rendering**: Offline PDF.js rendering with multi-page thumbnail navigation and rotation transforms.
- **In-Place Annotation**: Freehand vector ink, highlighter markup, text annotations, and shapes directly over PDF pages.
- **Research Note Space**: Expandable surrounding space around PDF pages for marginalia.
- **Document Operations**: Page reordering, rotation, extraction, annotated PDF export, and printing.

### E. Infinite Freeform Canvas
- **Excalidraw Engine**: Embedded infinite canvas with custom blocks (LaTeX math cards, Markdown cards, PDF previews, and Voice Notes).
- **Canvas Interoperability**: First-class canvas ownership across Workspace root, Folder, Notebook, and Section levels.
- **Production Hardening**: Elimination of bundle bloat (`HARDEN-012`), CSP community library permissions (`HARDEN-009`), discrete asset persistence, 100% offline typography (*Virgil* local WOFF2 font), and zero lost drawings.

### F. Local-First Durability & Persistence
- **Zero-Account System of Record**: Local disk (`Documents/Panvas/<Workspace>/`) in Electron desktop, and IndexedDB (Dexie `panvas`) in browser.
- **Browser Durability**: Feature-detected `navigator.storage.persist()` grant on initialization to prevent eviction (`HARDEN-002`).
- **Filesystem Migration**: Comprehensive migration routine transferring TipTap text, drawings, and binary files (`HARDEN-001`).
- **Deterministic Search**: Full local search across note titles, body text, and PDF text streams (`Ctrl+K`).
- **Optional Cloud Sync**: Google Drive provider with content-addressed objects and conflict resolution; UI status bar rewired to active cloud sync store (`HARDEN-003`).

### G. Platform Targets
- **Windows Desktop (Electron `^43.3.0`)**: Frameless native window, Discord Rich Presence (`panvas-logo_1`), and NSIS installer packaging.
- **Web / PWA Application**: Responsive web shell with mobile bottom sheets (<600px) and offline service worker.

---

## 3. Standardized Feature Status Classification

Across all Panvas documentation, feature states are strictly classified using the following seven standardized statuses:

| Status | Definition |
|---|---|
| **`IMPLEMENTED`** | Fully functional in source code, automated-tested, and active in the runtime shell. |
| **`TEST-PASSING`** | Code written and passes unit/integration tests; pending UI wiring or runtime validation. |
| **`PARTIAL`** | Baseline implementation exists, but specific edge cases, sub-features, or platforms are incomplete. |
| **`V1 HARDENING REQUIRED`** | Feature exists in code, but requires targeted stability, data-integrity, or performance remediation. |
| **`V1 RELEASE BLOCKER`** | Critical security, data-loss, or licensing defect that must be resolved before V1 release (`HARDEN-001`–`HARDEN-005`). |
| **`V2 PLANNED`** | Formally accepted feature for the next major milestone (**Knowledge Canvas**). |
| **`V3 PLANNED`** | Long-term roadmap capability (**Embedded Web, MCP, Extensions, AI**). |

---

## 4. Canvas V1 Production Hardening (`V1 HARDENING REQUIRED`)

Panvas Canvas is an active, fully integrated subsystem powered by Excalidraw. **It does not need to be rewritten**, but requires specific hardening passes before release:

### 4.1 Completed Canvas Hardening Items
- [x] **Bundle Code-Splitting (`HARDEN-012`)**: Lazy-load `CanvasView.tsx` via `React.lazy()` with Suspense fallback, isolating Excalidraw from the entry chunk (verified in production build).
- [x] **CSP Whitelist for Community Libraries (`HARDEN-009`)**: `https://libraries.excalidraw.com` authorized in CSP `connect-src` in `index.html` (verified passing in `tests/canvas-capabilities.test.ts`).

### 4.2 Pending Canvas Hardening Checklist
- [ ] **Asset Persistence Optimization**: Save embedded images as discrete content-addressed binary files (`assets/<hash>.png`) instead of giant inline base64 strings in `.canvas.json`.
- [ ] **Memory Teardown on Unmount**: Comprehensive canvas context cleanup when switching views to prevent WebGL/2D canvas context leaks.
- [ ] **100% Offline Durability**: Bundle canvas typography (*Virgil*, *Cascadia*, *Assistant*) locally with zero Google Fonts CDN dependencies (`HARDEN-022`).
- [ ] **Data Integrity**: Guarantee atomic writeQueue saves; zero lost drawings or corrupt 0-byte `.canvas.json` files on reload/crash.
- [ ] **Open-Source Attribution**: Consolidated MIT attribution notices for Excalidraw in `THIRD_PARTY_NOTICES.md` (`HARDEN-004`).

---

## 5. Comprehensive Feature Status Matrix

| Subsystem / Feature Area | Scope Level | Status | Target Phase | Notes & Backlog Item |
|---|:---:|:---:|:---:|---|
| **5-Tier Document Hierarchy** | V1 Core | `IMPLEMENTED` | Phase 2 | Workspace → Folder → Notebook → Section → Page. |
| **2D Vector Ink Engine** | V1 Core | `IMPLEMENTED` | Phase 4 | Bezier curves, pressure, nibs, multi-eraser, ruler. |
| **Rich Content (TipTap/LaTeX)** | V1 Core | `IMPLEMENTED` | Phase 5 | Inline formatting, math formulas, code blocks, images. |
| **PDF Workspace & Annotations**| V1 Core | `IMPLEMENTED` | Phase 7 | Local PDF.js offline rendering and in-place vector ink. |
| **Voice & Audio Notes** | V1 Core | `IMPLEMENTED` | Phase 8 | Page-bound audio player cards and voice memos. |
| **Local Search (Ctrl+K)** | V1 Core | `IMPLEMENTED` | Phase 9 | Local indexing of titles, notes, and PDF text streams. |
| **Discord Rich Presence** | V1 Core | `IMPLEMENTED` | Phase 1 | Local named-pipe RPC; logo `panvas-logo_1` (`HARDEN-028`). |
| **Google Drive Cloud Sync** | V1 Core | `PARTIAL` | Phase 15 | Engine tested; UI status bar rewire open (`HARDEN-003`). |
| **Canvas Freeform Workspace** | V1 Core | `V1 HARDENING REQUIRED` | Phase 10 | Excalidraw integration; asset saving & memory cleanup open. |
| **Dexie-to-FS Migration Fix** | V1 Core | `V1 RELEASE BLOCKER` | Phase 13 | Migrate notes, ink drawings, and binary files (`HARDEN-001`). |
| **Persistent Storage (Web/PWA)**| V1 Core | `V1 RELEASE BLOCKER` | Phase 12 | `navigator.storage.persist()` grant on boot (`HARDEN-002`). |
| **Cloud Sync Status Rewire** | V1 Core | `V1 RELEASE BLOCKER` | Phase 15 | Wire `StatusBar` to Google Drive `cloudSyncStore` (`HARDEN-003`). |
| **License & Attribution** | V1 Core | `V1 RELEASE BLOCKER` | Phase 18 | Root `LICENSE` and `THIRD_PARTY_NOTICES.md` (`HARDEN-004`). |
| **IPC Sender Validation** | V1 Core | `V1 RELEASE BLOCKER` | Phase 14 | `requireTrustedSender` on cloudsync IPC (`HARDEN-005`). |
| **Atomic Binary Disk Writes** | V1 Core | `V1 HARDENING REQUIRED` | Phase 13 | Staged `.tmp` writes for PDFs & binary assets (`HARDEN-006`). |
| **Folder Rename Resilience** | V1 Core | `V1 HARDENING REQUIRED` | Phase 13 | OneDrive lock backoff & storage path setting (`HARDEN-007`). |
| **Lifecycle Unmount Cleanup** | V1 Core | `V1 HARDENING REQUIRED` | Phase 14 | Call `NotebookEngine.destroy()` in unmount hook (`HARDEN-008`). |
| **Desktop OAuth Path Fallback**| V1 Core | `V1 HARDENING REQUIRED` | Phase 15 | Cross-platform POSIX token storage fallback (`HARDEN-010`). |
| **Startup IPC Snapshot** | V1 Core | `V1 HARDENING REQUIRED` | Phase 14 | Consolidate N+1 startup disk reads (`HARDEN-011`). |
| **Custom Confirm Dialog** | V1 Core | `V1 HARDENING REQUIRED` | Phase 14 | Replace synchronous `window.confirm()` (`HARDEN-013`). |
| **Dead Code Cleanup** | V1 Core | `V1 HARDENING REQUIRED` | Phase 18 | Purge 14 unused marketing files & `ViewportEngine` (`HARDEN-014`, `015`). |
| **Packaging & Code Signing** | V1 Core | `V1 HARDENING REQUIRED` | Phase 16 | Multi-res `.ico` (`HARDEN-021`), NSIS installer, signature hooks. |
| **Knowledge Canvas** | V2 | `V2 PLANNED` | Phase 19 | Notion-style structured blocks + spatial canvas integration. |
| **Embedded Web Workspace** | V3 | `V3 PLANNED` | Phase 20 | Sandboxed research companion browser (`WebContentsView`). |
| **MCP Integration Platform** | V3 | `V3 PLANNED` | Phase 21 | Stdio/SSE Model Context Protocol server registration & tools. |
| **Panvas Extension Foundation**| V3 | `V3 PLANNED` | Phase 21 | Sandboxed plugin runtime, manifest loader, public API façade. |
| **Panvas Intelligence (AI)** | V3 | `V3 PLANNED` | Phase 22 | Note assistant, auto-summaries, PDF semantic extraction. |
| **Collaborative Editing (CRDT)**| Post-V3 | `DEFERRED` | — | Multi-user real-time live canvas/notebook co-editing. |
| **Native Mobile Binaries** | Post-V3 | `DEFERRED` | — | Dedicated native iOS/Android packages (PWA serves mobile V1). |

---

## 6. Definitive Panvas V1 Release Gate

Panvas V1 will be declared **FEATURE COMPLETE** and approved for public release only when every condition below is verified:

- [ ] 1. Current notebook, layers, and vector ink feature work is fully stabilized.
- [ ] 2. Current PDF reader, in-place annotation engine, and research-space workflow are complete.
- [ ] 3. Canvas passes all V1 production-hardening checks (lazy-load bundle, CSP fix, asset saving, zero data loss).
- [ ] 4. Local persistence and data integrity are hardened (zero data loss across migration, reloads, and offline edits).
- [ ] 5. Optional Google Drive sync is stable and status bar UI accurately reflects sync state.
- [ ] 6. All release-security blockers are fixed (`requireTrustedSender` on all IPC, CSP hardened).
- [ ] 7. Licensing and third-party attribution are complete (`LICENSE` file & `THIRD_PARTY_NOTICES.md`).
- [ ] 8. Performance and reliability blockers are addressed (startup N+1 IPC resolved, bundle split).
- [ ] 9. Accessibility blockers are addressed (unlabelled buttons resolved).
- [ ] 10. Manual UX verification across Windows desktop and modern browser is completed.
- [ ] 11. Final platform regression testing passes cleanly.
- [ ] 12. Strix automated dynamic and static security penetration pass is completed and triaged.
- [ ] 13. Windows packaging, installer generation, and release build checks pass cleanly.

*(EXPLICITLY EXCLUDED FROM V1 GATE: Embedded Web, MCP, Extensions, and AI — all moved to post-V1).*

---

## 7. Release-Hardening Execution Priority

To achieve V1 feature completion without scope creep, development proceeds strictly in the following 15-step sequence:

```
[ Step 1: Canvas Runtime Corrections ]
           │
           ▼
[ Step 2: P0 Data-Loss Hardening (HARDEN-001) ]
           │
           ▼
[ Step 3: Browser/Desktop Persistence Hardening (HARDEN-002) ]
           │
           ▼
[ Step 4: Electron IPC & Security Hardening (HARDEN-005) ]
           │
           ▼
[ Step 5: Sync Cleanup & StatusBar Rewire (HARDEN-003) ]
           │
           ▼
[ Step 6: Licensing & Third-Party Attribution (HARDEN-004) ]
           │
           ▼
[ Step 7: Repository & Git Hygiene (HARDEN-016) ]
           │
           ▼
[ Step 8: Error UX & Dialog Polish (HARDEN-013) ]
           │
           ▼
[ Step 9: Lifecycle & Memory Leak Cleanup (HARDEN-008) ]
           │
           ▼
[ Step 10: Performance & Bundle Splitting (HARDEN-011, HARDEN-012) ]
           │
           ▼
[ Step 11: Accessibility & Button Labels (HARDEN-023) ]
           │
           ▼
[ Step 12: Packaging & Code Signing Readiness (HARDEN-021) ]
           │
           ▼
[ Step 13: Strix Penetration Testing & Triage (STRIX_SECURITY_PLAN.md) ]
           │
           ▼
[ Step 14: Final Platform Regression & Manual QA ]
           │
           ▼
[ Step 15: V1 Public Release ]
```

> [!WARNING]
> **No agent or engineer may begin post-V1 feature work (Knowledge Canvas, Embedded Web, MCP, Extensions, or AI) until Step 15 is complete.**

---

## 8. Historical / Future Engineering Reference

The technical specifications and sandboxing architectures for post-V1 capabilities are preserved as future engineering references:
- **Master Product Roadmap**: [`docs/ROADMAP.md`](../ROADMAP.md) (V1 Foundation $\to$ V2 Knowledge Canvas $\to$ V3 Extensibility & Intelligence).
- **Future Technical Architecture**: [`V2_ROADMAP.md`](V2_ROADMAP.md) (Detailed specifications for `WebContentsView` browser isolation, MCP stdio/SSE registration, sandboxed extension manifests, and private AI architecture).
