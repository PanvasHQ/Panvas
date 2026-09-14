# 14 — Partial, Missing & Required Features (14_PARTIAL_OR_MISSING_FEATURES.md)

> **Document Type**: Subsystem Gap Analysis & Status Matrix  
> **Authoritative Scope Document**: [`V1_FEATURE_SCOPE.md`](V1_FEATURE_SCOPE.md)  
> **Master Product Roadmap**: [`docs/ROADMAP.md`](../ROADMAP.md)  
> **Hardening Backlog**: [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md)  
> **Future Engineering Reference**: [`V2_ROADMAP.md`](V2_ROADMAP.md)  
> **Last Updated**: September 10, 2026  
> **Historical Note**: *V1 focuses strictly on core product stability, local-first durability, and production readiness. V2 is the Knowledge Canvas. V3 is Extensibility & Intelligence (Embedded Web, MCP, Extensions, and AI are moved post-V1).*

---

## 1. Overview & Standardized Classification System

To prevent new engineers or AI coding agents from assuming UI mockups represent finished code, all subsystems and candidate capabilities are classified using the standardized status taxonomy:

* **`IMPLEMENTED`**: Fully functional in code, tested, and active in current source.
* **`PARTIAL`**: UI exists and core workflow functions, but specific secondary actions, deep querying, or advanced export operations are pending.
* **`V1 RELEASE BLOCKER`**: Essential data integrity, security, or legal prerequisite that must be fixed before V1 public distribution.
* **`V1 HARDENING REQUIRED`**: Reliability, IPC safety, or performance remediation tracked in the canonical release hardening backlog.
* **`V2 PLANNED`**: Scheduled for Panvas V2 (The Knowledge Canvas: structured blocks, Notion-grade knowledge base, Excalidraw spatial synthesis).
* **`V3 PLANNED`**: Scheduled for Panvas V3 (Extensibility & Intelligence: Embedded Web Workspace, Model Context Protocol, sandboxed plugins, and private LLM assistant).
* **`DEFERRED`**: Long-term future horizon (Native mobile apps, multi-tenant live CRDT collaboration).

---

## 2. Comprehensive Status Matrix

| Subsystem / Feature | Status | Technical Reality & Implementation Gap | Target Release |
| --- | --- | --- | :---: |
| **Dexie-to-FS Migration Fix** | **`V1 RELEASE BLOCKER`** | Fix data-loss defect in `migration.ts` where TipTap notes, ink drawings, and binary PDFs are omitted from filesystem migration (`HARDEN-001`). | V1 |
| **Persistent Storage (Web/PWA)** | **`V1 RELEASE BLOCKER`** | Call `navigator.storage.persist()` on database initialization to guard against browser/Safari 7-day eviction (`HARDEN-002`). | V1 |
| **Cloud Sync Status Rewire** | **`V1 RELEASE BLOCKER`** | Retire quarantined legacy Supabase sync (`SyncEngine.ts`); wire `StatusBar` exclusively to active Google Drive `cloudSyncStore` (`HARDEN-003`). | V1 |
| **Root License & Attribution** | **`V1 RELEASE BLOCKER`** | Add repository `LICENSE` file and consolidated `THIRD_PARTY_NOTICES.md` for Excalidraw, KaTeX, PDF.js, and font assets (`HARDEN-004`). | V1 |
| **CloudSync IPC Sender Check** | **`V1 RELEASE BLOCKER`** | Enforce `validateSender(event)` across all Google Drive IPC channels in `cloudsync-handlers.ts` (`HARDEN-005`). | V1 |
| **Atomic Binary Disk Writes** | **`V1 HARDENING REQUIRED`** | Prevent file truncation on crash by writing through staged `.tmp` files (`HARDEN-006`). | V1 |
| **Storage Location Chooser** | **`V1 HARDENING REQUIRED`** | Provide native folder picker in Settings for desktop storage directory (`HARDEN-007`). | V1 |
| **Notebook Lifecycle Cleanup** | **`V1 HARDENING REQUIRED`** | Clean up blob URLs and background workers on component unmount (`HARDEN-008`). | V1 |
| **Excalidraw CSP Connect-Src** | **`FIXED / PASSING`** | Allow Excalidraw community library downloads in CSP (`HARDEN-009`, verified in tests). | V1 |
| **Excalidraw Double Header** | **`FIXED / PASSING`** | Remove legacy double header mount in Canvas mode (`HARDEN-012`, verified in tests). | V1 |
| **Full Note Content Search** | **`PARTIAL`** | Title search in `TopBar.tsx` operates across notebooks, sections, and pages. Full-text indexing inside TipTap JSON page bodies and ink stroke OCR is deferred. | V1 (Title) / V2 (Body) |
| **PDF Annotation Flattening & Export** | **`PARTIAL`** | Inking annotations work over PDF pages in `PdfWorkspace.tsx`. Flattening ink annotations into a modified downloadable `.pdf` via `pdf-lib` is pending. | Post-V1 |
| **Canvas PNG/SVG Export** | **`IMPLEMENTED`** | Image and scene export functional in Excalidraw. Multi-block continuous document export is pending. | V1 |
| **Workspace Explorer File Actions** | **`PARTIAL`** | Hierarchy navigation, rename, and delete work; advanced bulk actions (multi-select cut/copy across folders) are pending. | V1 |
| **OneDrive Sync Provider** | **`V2 PLANNED`** | Google Drive is the primary V1 cloud sync provider. OneDrive Microsoft Graph integration is planned for V2. | V2 |
| **Knowledge Canvas (Structured Blocks)** | **`V2 PLANNED`** | Notion-style structured blocks integrated with Excalidraw spatial whiteboard. | V2 |
| **Embedded Web Workspace** | **`V3 PLANNED`** | *Moved post-V1*. Sandboxed `WebContentsView` desktop research browser with external fallback. | V3 |
| **MCP Integration Platform** | **`V3 PLANNED`** | *Moved post-V1*. Model Context Protocol server registration (stdio/SSE) and tool discovery. | V3 |
| **Panvas Extension Foundation** | **`V3 PLANNED`** | *Moved post-V1*. Sandboxed plugin manifest, public API façade, and custom UI panels. | V3 |
| **Panvas Intelligence (AI)** | **`V3 PLANNED`** | *Moved post-V1*. Local/remote LLM assistant, document QA, auto-summarization, diagram synthesis. | V3 |
| **Handwriting OCR / Text Conversion** | **`V2 PLANNED`** | Windows WinRT handwriting recognition exists; cross-platform web/WASM handwriting OCR is planned for V2. | V2 |
| **Mobile Companion Application** | **`DEFERRED`** | Native iOS / Android apps; V1 serves mobile and tablet via responsive Web/PWA. | Post-V2 |
| **Collaborative Editing / CRDT** | **`DEFERRED`** | Multi-user real-time live co-editing engine. | Post-V2 |

---

## 3. Detailed Component Technical Gaps (V1 Focus)

### 3.1 Note Content Search
* **Current State**: Title search filters notebooks, sections, and pages instantly in `TopBar.tsx` and navigation trees.
* **V1 Boundary**: Search covers document metadata and hierarchy titles. Full-text inverted index querying across thousands of serialized TipTap document JSON bodies is planned for V2.

### 3.2 PDF Annotation Flattening & Export
* **Current State**: Viewing, page navigation, and in-place vector drawing over PDF pages are functional. Stored as distinct vector layers.
* **V1 Boundary**: Viewing and native rendering of annotations inside the workspace are fully functional. Exporting a flattened single PDF file embedding ink layers is a post-V1 enhancement.

### 3.3 Workspace Explorer Bulk Actions
* **Current State**: Tree navigation, single-item rename, delete, and move operate reliably.
* **V1 Boundary**: Core tree and breadcrumb management is production-ready. Bulk multi-item clipboard operations (multi-select drag, cut, paste) are deferred.

### 3.4 Release Hardening & Reliability Backlog
All technical defects, security invariants, and packaging requirements for V1 release are tracked in:
👉 [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md) and [`V1_HARDENING_EXECUTION_PLAN.md`](V1_HARDENING_EXECUTION_PLAN.md).

---

## 4. Post-V1 Architecture & Future Specifications

For technical architecture specifications covering the Knowledge Canvas, Embedded Web Workspace, Model Context Protocol (MCP), Extension Platform, and Panvas AI, refer to:
- [`docs/ROADMAP.md`](../ROADMAP.md) — Master product vision across Horizons 1, 2, and 3.
- [`docs/panvas-handover/V2_ROADMAP.md`](V2_ROADMAP.md) — Future engineering and platform reference.
