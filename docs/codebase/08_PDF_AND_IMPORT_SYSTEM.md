# PDF & Import System

Panvas supports importing PDFs into the workspace. A PDF acts as a distinct type of "Page" inside a Notebook.

## Architecture

When a Page is defined with `type: 'pdf'` in `src/types/notebook.ts`, the application routes the user to `PdfWorkspace.tsx` instead of the standard infinite canvas `NotebookRenderer.tsx`.

### `src/components/pdf/PdfWorkspace.tsx`
This component wraps the PDF rendering experience.
- It sits inside the standard `AppShell`.
- It mounts a custom `PdfAnnotationToolbar` at the top (for highlights, pens).
- It displays a `PdfThumbnailSidebar` on the left (for document navigation).
- It displays a `PdfAnnotationSidebar` on the right (for summarizing annotations).

*(Note: Currently, as explicitly noted in the code, the actual PDF JS rendering viewer is mocked via `PdfPaperMock`. The integration of Mozilla's `pdf.js` is deferred to a future phase).*

## Flow: PDF Import
1. A user triggers an import (e.g., from a workspace context menu).
2. The file is selected and stored locally in the IndexedDB/FileSystem (via a `pdfDataId`).
3. A new `NotebookPage` is created in `workspaceStore` with `type: 'pdf'` and the associated `pdfDataId`.
4. When the user navigates to this page, `WorkspaceContent.tsx` detects `page.type === 'pdf'` and mounts `<PdfWorkspace page={activePage} />`.

## Unified File Storage
PDFs and Images share the same underlying binary storage pattern. 
- Metadata and pointers (like `pdfDataId` or `fileId`) are stored in the lightweight JSON files (`workspace.json` or `.drawing.json`).
- The actual binary blobs are stored using standard hashing or UUIDs in a dedicated "assets" or "files" directory managed by `WorkspaceService.ts` in Electron.
