# Feature specification

> [!NOTE]
> **Historical Document**: This document reflects early planning/development phases (August-September 2026). For the canonical v0.1.0 architecture and documentation, see [README.md](../README.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md).

| Feature | Current state | Expected eventual behavior |
|---|---|---|
| Workspace/folders | ✅ Dexie entities/actions | Recursive folders, file ownership, pin/recent/trash, filesystem-backed metadata. |
| Notebook | 🟡 hierarchy + visual page | Persisted rich-text pages, templates, handwriting, embeds, versions, export. |
| Canvas | ✅ baseline Excalidraw | Durable scenes/custom blocks, Panvas tool mapping, asset/import/export and real toolbar behavior. |
| PDF | 🟡 UI only | Render local PDFs, thumbnails, annotations/comments, search, export. |
| Library/media | 🟡 UI only | Index real files/assets, previews, metadata, filesystem actions. |
| Search | 🟡 command UI exists | Full-text/entity search with filters, recents, keyboard navigation. |
| Themes/settings | ✅ base theme setter; 🟡 studio | Persisted appearance/preferences; previews must drive real token selection. |
| Toolbar | 🟡 UI variants | Shared tool registry and workspace adapters, no duplicated command definitions. |
| Autosave/history | ✅ canvas debounce | Transactional document/file saves, undo history and restore across feature types. |
| Auth/sync | 🟡 scaffold | Optional account sync, secure RLS, conflict strategy and binary sync. |

Never claim PDF annotation, notebook rich text, filesystem operation, universal pen settings, AI/RAG/OCR, or cloud collaboration is complete; they are not.
