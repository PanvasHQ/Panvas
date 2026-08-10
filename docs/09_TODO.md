# Engineering TODO

## Critical
- [ ] Decide and implement desktop host + secure IPC before claiming native filesystem support.
- [ ] Define filesystem-first canonical data model and migration from Dexie-only data.
- [ ] Audit/remove temporary preview routes and double-slash compatibility routes after review.
- [ ] Add tests for data migration, delete/restore, user isolation, and canvas save recovery.

## High
- [ ] Add persisted notebook document content and real rich-text editor.
- [ ] Integrate PDF.js rendering and page/file persistence.
- [ ] Connect real library/explorer data to repositories; remove sample records.
- [ ] Establish shared command/tool registry before wiring pen/toolbar UIs.
- [ ] Audit sync queue/RLS/error handling and binary asset policy.

## Medium
- [ ] Search index and global search results.
- [ ] History/undo/recovery across workspace documents.
- [ ] Asset thumbnails, import/export, media metadata.
- [ ] Accessibility and keyboard-navigation audit.
- [ ] Replace loose `any` canvas types where Excalidraw contracts allow it.

## Low
- [ ] Consolidate legacy CSS utilities that conflict with the locked native visual language.
- [ ] Remove stale `v1/` copy only after confirming it is no longer needed.
- [ ] Improve route organization and add route tests.

## Future
- [ ] Cloud collaboration.
- [ ] AI/OCR/RAG, only after local-first product and sync are reliable.
