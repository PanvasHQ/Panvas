# 15 — Roadmap Status & Phase Progression (15_ROADMAP_STATUS.md)

> **Document Type**: Roadmap Status Assessment & Phase Transition Guide
> **Authoritative Scope Document**: [`V1_FEATURE_SCOPE.md`](V1_FEATURE_SCOPE.md)
> **Master Product Roadmap**: [`docs/ROADMAP.md`](../ROADMAP.md)
> **Hardening Backlog**: [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md)
> **Execution Plan**: [`V1_HARDENING_EXECUTION_PLAN.md`](V1_HARDENING_EXECUTION_PLAN.md)
> **Last Updated**: September 10, 2026

---

## 1. Product Horizon Strategy & Scope Boundary

Panvas follows a strict three-generation product evolution:

1. **Panvas V1 (Foundation & Reliability)**:
   - Complete local-first Notebook (5-tier hierarchy, 2D vector ink, TipTap rich text, layouts).
   - Freeform Infinite Canvas (Excalidraw 0.17.6 integration, custom blocks).
   - Dedicated PDF Workspace (PDF.js, in-place annotations, thumbnail sidebar).
   - Study & Voice notes, Command Palette (`Ctrl+K`), and optional Google Drive backup.
   - Production readiness: resolution of all 5 BLOCKER and 7 P0 items, 505 passing tests, and clean packaging.
2. **Panvas V2 (The Knowledge Canvas)**:
   - Notion-style structured knowledge blocks seamlessly embedded in Excalidraw's spatial whiteboard.
   - Cross-platform handwriting OCR, deep document graph linking, and advanced PDF export flattening.
3. **Panvas V3 (Extensibility & Intelligence)**:
   - Embedded Web Research Workspace (`WebContentsView`).
   - Model Context Protocol (MCP) tool and resource integration.
   - Sandboxed Extension / Plugin platform (`panvas-extension.json`).
   - Panvas Intelligence (Private local/remote LLM assistant, document QA, diagram synthesis).

> [!IMPORTANT]
> **Strict V1 Scope Contract**: Embedded Web, MCP, Extensions, and AI are formally designated as post-V1 (`V3 PLANNED`) and are strictly excluded from V1 release gates. All active engineering must focus exclusively on hardening the canonical 30 backlog items in [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md).

---

## 2. Master Phase Status Matrix

| Phase | Subsystem / Focus | Checklist | Status | Scope Description |
| --- | --- | :---: | :---: | --- |
| **Phase 1** | Foundation & Shell | `- [x]` | `IMPLEMENTED` | Frameless window, dark/light theme, Discord RPC (`panvas-logo_1`). |
| **Phase 2** | Workspace & 5-Tier Hierarchy | `- [x]` | `IMPLEMENTED` | Workspace $\to$ Folder $\to$ Notebook $\to$ Section $\to$ Page. |
| **Phase 3** | Notebook & Page Management | `- [x]` | `IMPLEMENTED` | Page reorder, duplicate, delete, templates, paper sizes. |
| **Phase 4** | 2D Vector Ink Engine | `- [x]` | `IMPLEMENTED` | Catmull-Rom Bezier curves, pressure, nibs, multi-eraser, stroke persistence. |
| **Phase 5** | Rich Content Engine | `- [x]` | `IMPLEMENTED` | TipTap rich text, LaTeX (KaTeX), code blocks, images. |
| **Phase 6** | Handwriting Recognition | `- [x]` | `IMPLEMENTED` | WinRT desktop recognition; Web OCR deferred to V2. |
| **Phase 7** | PDF Workspace & Annotations | `- [x]` | `IMPLEMENTED` | Local PDF.js offline viewing and vector ink annotations. |
| **Phase 8** | Study & Voice Notes | `- [x]` | `IMPLEMENTED` | Audio note cards, immutable recordings, dual-surface player. |
| **Phase 9** | Local Search & Command Palette | `- [x]` | `IMPLEMENTED` | `Ctrl+K` palette, title search, PDF stream text retrieval. |
| **Phase 10** | Infinite Freeform Canvas | `- [x]` | `IMPLEMENTED` | Excalidraw 0.17.6 integration, custom blocks; CSP (`HARDEN-009`) and double-header (`HARDEN-012`) verified. |
| **Phase 11A**| UI/UX System & Ergonomics | `- [x]` | `IMPLEMENTED` | Adaptive floating toolbar, theme studio, gestures. |
| **Phase 11B**| Embedded Web Workspace | Moved | **`V3 PLANNED`** | *Moved post-V1*. Isolated `WebContentsView` desktop browser. |
| **Phase 12** | Web / PWA Storage Durability | `- [ ]` | **`V1 RELEASE BLOCKER`** | `navigator.storage.persist()` grant (`HARDEN-002`). |
| **Phase 13** | Storage Locations & Migration | `- [ ]` | **`V1 RELEASE BLOCKER`** | Fix Dexie-to-FS migration for notes/drawings/PDFs (`HARDEN-001`). |
| **Phase 14** | Security Foundation & IPC | `- [ ]` | **`V1 RELEASE BLOCKER`** | Enforce `validateSender` on cloudsync (`HARDEN-005`), CSP audit. |
| **Phase 15** | Cloud Sync (Google Drive) | `- [ ]` | **`V1 RELEASE BLOCKER`** | Retire legacy Supabase sync; wire `StatusBar` to `cloudSyncStore` (`HARDEN-003`). |
| **Phase 16** | Windows Distribution & Signing | `- [ ]` | `V1 HARDENING REQUIRED` | Multi-resolution icon (`HARDEN-021`), NSIS installer, signature hooks. |
| **Phase 17** | Official Landing Page | `- [ ]` | `PARTIAL` | Landing page rebuild; purge dead marketing code (`HARDEN-014`). |
| **Phase 18** | Release Hardening & Verification | `- [ ]` | **`V1 RELEASE BLOCKER`** | Close out 30 canonical items in [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md). |
| **Phase 19** | Panvas Intelligence (AI) | Future | **`V3 PLANNED`** | *Moved post-V1*. Contextual note chat, document QA, agent workflows. |
| **Phase 20A**| MCP Integration Platform | Moved | **`V3 PLANNED`** | *Moved post-V1*. Model Context Protocol (stdio/SSE) server registration. |
| **Phase 20B**| Panvas Extension Foundation | Moved | **`V3 PLANNED`** | *Moved post-V1*. Manifest format, public API façade, custom commands. |
| **Phase 21** | Long-Term Vision & Multiplayer | Future | `DEFERRED` | Post-V2: CRDT live collaborative notebooks, native iOS/Android apps. |

---

## 3. Authoritative Hardening Execution Sequence

To execute release hardening safely without regression, engineering must proceed strictly by the work packages defined in [`V1_HARDENING_EXECUTION_PLAN.md`](V1_HARDENING_EXECUTION_PLAN.md):

1. **Package E: Open Source Licensing & Legal Attribution**
   - Add root `LICENSE` (MIT) and `THIRD_PARTY_NOTICES.md` (`HARDEN-004`).
   - Set `"license": "MIT"` in `package.json`.
2. **Package A: Data Integrity & Persistence Safety**
   - Complete Dexie-to-Filesystem migration round-trip (`HARDEN-001`, `HARDEN-017`).
   - Browser storage persist call (`HARDEN-002`, `HARDEN-020`).
   - Atomic binary disk writes via `.tmp` files (`HARDEN-006`).
3. **Package B: Electron Security & IPC Boundaries**
   - Enforce trusted sender checks on all cloud sync IPC channels (`HARDEN-005`, `HARDEN-018`).
   - Atomic PDF page creation in one IPC pass (`HARDEN-026`).
   - Flush pending writeQueue on `before-quit` (`HARDEN-027`).
4. **Package C: Cloud Sync & Status Bar Consolidation**
   - Retire quarantined Supabase sync; wire `StatusBar` to `cloudSyncStore` (`HARDEN-003`, `HARDEN-029`).
   - Cross-platform desktop token path fallback (`HARDEN-010`).
   - CloudSync conflict resolution tests (`HARDEN-019`).
5. **Package D: Low-Risk Cleanup & Safe Verification**
   - Delete 14 dead marketing prototypes (`HARDEN-014`).
   - Delete abandoned `ViewportEngine.ts` (`HARDEN-015`).
   - Untrack build outputs and large images from Git index (`HARDEN-016`).
   - Verify Discord RPC Application ID fallback with owner (`HARDEN-028`).
6. **Package F: UI Polish, A11y & Lifecycle Safety**
   - Settings storage folder chooser (`HARDEN-007`).
   - Dispose `NotebookEngine` on unmount (`HARDEN-008`).
   - Snapshot desktop IPC reads on startup (`HARDEN-011`).
   - Replace `window.confirm()` with modal dialog (`HARDEN-013`).
   - Multi-resolution icon (`HARDEN-021`), local fonts (`HARDEN-022`), A11y labels (`HARDEN-023`), asset compression (`HARDEN-024`), legacy auth retire (`HARDEN-025`), error boundary standardization (`HARDEN-030`).
7. **Verification & Publication Gate**
   - Strix automated penetration test run and triage.
   - Definitive 13-criteria V1 release gate verification.
