# 07 — PDF System (07_PDF_SYSTEM.md)

## 1. Subsystem Architecture Overview

The **PDF System** handles importing, storing, rendering thumbnails for, and interactively viewing/annotating PDF documents in Panvas.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PDF IMPORT FLOW                                 │
│  File Picker / Drag & Drop PDF File                                         │
│       │                                                                     │
│       ▼                                                                     │
│  file.arrayBuffer()                                                         │
│       │                                                                     │
│       ▼                                                                     │
│  canvasRepository.storePdf(userId, 'temp', fileName, buffer)               │
│       │                                                                     │
│       ▼                                                                     │
│  Dexie IndexedDB -> db.pdfFiles.add({ id: 'pdf_xxx', data: ArrayBuffer })   │
│       │                                                                     │
│       ▼                                                                     │
│  notebookRepository.createPage(..., type: 'pdf', pdfDataId: 'pdf_xxx')      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────┐
│     INACTIVE PREVIEW / THUMBNAIL      │ │           PDF WORKSPACE           │
│     [InactivePagePreview.tsx]         │ │         [PdfWorkspace.tsx]        │
├───────────────────────────────────────┤ ├───────────────────────────────────┤
│ 1. getPdf(pdfDataId)                  │ │ 1. Active Page type === 'pdf'     │
│ 2. Create Blob & URL.createObjectURL  │ │ 2. Mounts PdfWorkspace            │
│ 3. pdfjsLib.getDocument({ url })      │ │ 3. usePdfDocument(pdfDataId) hook │
│ 4. Render Page 1 to HTML5 canvas      │ │ 4. Creates Blob & Object URL      │
│ 5. Displays page thumbnail card       │ │ 5. Full PDF.js page rendering     │
└───────────────────────────────────────┘ └───────────────────────────────────┘
```

---

## 2. Component & File Reference

| Module | Path | Responsibility |
|---|---|---|
| **`usePdfDocument.ts`** | `src/hooks/usePdfDocument.ts` | React hook that fetches PDF ArrayBuffer from IndexedDB, creates a Blob Object URL, and manages PDF.js document lifecycle. |
| **`PdfWorkspace.tsx`** | `src/components/pdf/PdfWorkspace.tsx` | Full PDF viewer shell with page navigation, zoom controls, annotation overlays, and thumbnail sidebar. |
| **`PdfPageRenderer.tsx`**| `src/components/pdf/PdfPageRenderer.tsx` | Renders individual PDF document pages onto canvas using PDF.js. |
| **`PdfThumbnailSidebar.tsx`**| `src/components/pdf/PdfThumbnailSidebar.tsx` | Sidebar showing rendered thumbnail previews for all pages in the current PDF document. |
| **`InactivePagePreview.tsx`**| `src/components/notebook/InactivePagePreview.tsx` | Renders first-page thumbnail card for PDF pages inside notebook grid/scroll layouts. |
| **`PdfBlock.tsx`** | `src/components/canvas/PdfBlock.tsx` | Embedded interactive PDF block for the infinite canvas workspace. |

---

## 3. PDF Data Flow & Storage Specification

1. **Storage Format**:
   * Raw PDF bytes are stored as an `ArrayBuffer` in IndexedDB inside the `pdfFiles` table (`src/database/schema.ts`).
   * Schema: `{ id: string, canvasFileId: string, fileName: string, data: ArrayBuffer, createdAt: number, userId: string | null }`.

2. **Page Linkage**:
   * Notebook page object stores `type: 'pdf'` and `pdfDataId: 'pdf_xxx'`.
   * When notebook pages load, pages with `type === 'pdf'` query `canvasRepository.getPdf(userId, page.pdfDataId)`.

3. **Viewer Object URL Lifecycle**:
   * To prevent memory leaks and stream issues, `usePdfDocument.ts` wraps the retrieved `ArrayBuffer` in a native `Blob`:
     ```typescript
     const blob = new Blob([pdfData.data], { type: 'application/pdf' });
     const url = URL.createObjectURL(blob);
     loadingTask = pdfjsLib.getDocument({ url });
     ```
   * Object URLs are held open while the viewer or thumbnail renderer is active and revoked (`URL.revokeObjectURL(url)`) upon component unmount or task cleanup.

---

## 4. Confirmed PDF Failures & Incident Fix History

### Incident 1: IndexedDB Quota Database Lock (Electron Zombie Processes)
* **Symptom**: Importing a PDF threw `Failed to import PDF: UnknownError: Internal error`. Terminal logged:
  `ERROR:net\disk_cache\cache_util_win.cc: Unable to move the cache: Access is denied. (0x5)`
  `ERROR:storage\browser\quota\quota_database.cc: Could not open the quota database, resetting.`
* **Root Cause**: Multiple orphaned background `electron.exe` zombie processes remained active after previous dev server restarts, holding exclusive OS file locks on Chromium's IndexedDB and Quota database directory in `%USERPROFILE%/AppData/Roaming/panvas/`.
* **Fix**: Terminated all background `electron.exe` zombie tasks (`taskkill /F /IM electron.exe /T`), releasing the file lock and restoring normal IndexedDB writes.

### Incident 2: PDF.js Worker Content Security Policy (CSP) Violation
* **Symptom**: PDF page thumbnails and the PDF viewer failed to render, displaying `Failed to load PDF`.
* **Root Cause**: `InactivePagePreview.tsx` and `PdfBlock.tsx` contained hard-coded dynamic imports pointing to a Cloudflare CDN URL: `https://cdnjs.cloudflare.com/cdnjs/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`. Electron's Content Security Policy (CSP) blocked loading external web scripts.
* **Fix**: Replaced CDN URLs with Vite's local static worker asset import:
  ```typescript
  // @ts-ignore
  const pdfjsWorkerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  ```

### Incident 3: Uint8Array vs Blob Object URL Pipeline Restoration
* **Symptom**: Direct `Uint8Array` buffer loading into PDF.js occasionally caused stream memory issues and lost reference errors across component remounts.
* **Fix**: Standardized PDF loading across `usePdfDocument.ts`, `InactivePagePreview.tsx`, and `PdfBlock.tsx` to convert stored ArrayBuffers to `Blob` objects and generate fresh `URL.createObjectURL(blob)` instances, safely cleaning them up on unmount.
