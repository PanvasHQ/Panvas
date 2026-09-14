# 11 — Known Bugs & Fix History (11_KNOWN_BUGS_AND_FIX_HISTORY.md)

## 1. Overview

This document maintains an accurate, ground-truth record of critical engineering incidents, root cause diagnoses, and fixes applied throughout the development of Panvas.

---

## 2. Incident & Bug Fix Log

### 1. IndexedDB Quota Database Lock (Electron Zombie Processes)
* **Symptom**: Importing a PDF failed with `Failed to import PDF: UnknownError: Internal error`. Terminal logged:
  `ERROR:net\disk_cache\cache_util_win.cc: Access is denied. (0x5)`
  `ERROR:storage\browser\quota\quota_database.cc: Could not open the quota database, resetting.`
* **Root Cause**: Restarting or hot-reloading the dev server left orphaned background `electron.exe` zombie processes running in Windows task manager. These processes held an exclusive OS file lock on Chromium's IndexedDB Quota database files in `%USERPROFILE%/AppData/Roaming/panvas/`.
* **Fix**: Terminated all orphaned `electron.exe` zombie background tasks using `taskkill /F /IM electron.exe /T`, releasing the database file lock and restoring normal IndexedDB writes.
* **Current Status**: **RESOLVED**.
* **Files Involved**: Environment process manager, `electron/main.ts`.

---

### 2. PDF.js Cloudflare CDN Worker Content Security Policy (CSP) Violation
* **Symptom**: PDF page thumbnails and the PDF viewer failed to load, displaying `Failed to load PDF`.
* **Root Cause**: `InactivePagePreview.tsx` and `PdfBlock.tsx` contained hard-coded dynamic imports pointing to a Cloudflare CDN URL: `https://cdnjs.cloudflare.com/cdnjs/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`. Electron's Content Security Policy (CSP) blocked loading external web scripts.
* **Fix**: Replaced Cloudflare CDN URLs with Vite's local static worker asset import:
  ```typescript
  // @ts-ignore
  const pdfjsWorkerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  ```
* **Current Status**: **RESOLVED**.
* **Files Involved**: [`src/components/notebook/InactivePagePreview.tsx`](../../src/components/notebook/InactivePagePreview.tsx), [`src/components/canvas/PdfBlock.tsx`](../../src/components/canvas/PdfBlock.tsx), [`src/hooks/usePdfDocument.ts`](../../src/hooks/usePdfDocument.ts).

---

### 3. Uint8Array vs Blob Object URL PDF Loading Restoration
* **Symptom**: Passing raw `Uint8Array` buffers directly to PDF.js occasionally caused stream memory issues and lost reference errors across component remounts.
* **Root Cause**: Lack of explicit Blob Object URL creation and lifecycle management.
* **Fix**: Standardized PDF loading across `usePdfDocument.ts`, `InactivePagePreview.tsx`, and `PdfBlock.tsx` to convert stored `ArrayBuffer` data into `Blob` instances and generate `URL.createObjectURL(blob)`, revoking the URL on component unmount.
* **Current Status**: **RESOLVED**.
* **Files Involved**: `src/hooks/usePdfDocument.ts`, `src/components/notebook/InactivePagePreview.tsx`, `src/components/canvas/PdfBlock.tsx`.

---

### 4. Viewport Scrolling Moving Pinned UI Elements
* **Symptom**: Mouse wheel scrolling in Vertical or Horizontal modes caused the entire application window (topbar, sidebar, pen toolbar, right properties inspector) to scroll away with the pages.
* **Root Cause**: Outer parent DOM containers had `overflow: auto` enabled, allowing document scroll events to bubble up to the root application shell.
* **Fix**: Enforced isolated scroll containment inside `.notebook-viewport` (`overflow-y: auto; overflow-x: hidden` for Vertical; `overflow-x: auto; overflow-y: hidden` for Horizontal). Placed `NotebookFloatingToolbar`, `TopBar`, `Sidebar`, and `NotebookToolPropertiesPanel` outside `.notebook-viewport` with fixed positioning.
* **Current Status**: **RESOLVED**.
* **Files Involved**: [`src/components/notebook/NotebookRenderer.tsx`](../../src/components/notebook/NotebookRenderer.tsx), [`src/components/workspace/WorkspaceContent.tsx`](../../src/components/workspace/WorkspaceContent.tsx).

---

### 5. "Apply to All Pages" Popover Trigger Bug
* **Symptom**: Toggling "Apply to all pages" in the Page Properties panel and clicking Paper Color or Background popovers opened an unrelated "Scroll Direction" popover.
* **Root Cause**: Shared popover state keys and overlapping controlled event handler bindings in `NotebookToolPropertiesPanel.tsx`.
* **Fix**: Separated popover ID state keys and isolated click handler callbacks for each property popover control.
* **Current Status**: **RESOLVED**.
* **Files Involved**: [`src/components/notebook/NotebookToolPropertiesPanel.tsx`](../../src/components/notebook/NotebookToolPropertiesPanel.tsx).

---

### 6. Page Content Disappearing / Turning Black on Orientation Change
* **Symptom**: Toggling page orientation (Portrait ↔ Landscape) or changing paper size caused rendered ink and rich text to disappear or turn into black rectangles.
* **Root Cause**: React component keying used array indices (`key={index}`), causing React to unmount and remount DOM elements destructively without re-initializing canvas contexts.
* **Fix**: Replaced array indices with stable `key={page.id}` keys and preserved engine state across orientation updates.
* **Current Status**: **RESOLVED**.
* **Files Involved**: `src/components/notebook/NotebookRenderer.tsx`, `src/components/notebook/PageRenderer.tsx`.

---

### 7. Unselected Inactive Pages Not Rendering Preview Until Clicked
* **Symptom**: In multi-page vertical scroll mode, non-active pages displayed blank white boxes until explicitly clicked.
* **Root Cause**: Drawing canvas surfaces were only instantiated for the active page ID (`isActive`).
* **Fix**: Implemented `InactivePagePreview.tsx` to render static vector stroke previews and PDF page 1 thumbnails for all inactive pages visible in the viewport.
* **Current Status**: **RESOLVED**.
* **Files Involved**: `src/components/notebook/InactivePagePreview.tsx`, `src/components/notebook/NotebookRenderer.tsx`.
