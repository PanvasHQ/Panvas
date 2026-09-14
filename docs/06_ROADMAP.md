# Functional roadmap

> [!NOTE]
> **Historical Document**: This document reflects early planning/development phases (August-September 2026). For the canonical v0.1.0 architecture and documentation, see [README.md](../README.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md).

This replaces UI-first sequencing with functionality-first engineering. Do not begin AI before the foundations are stable.

1. **Local desktop/filesystem foundation** 🔴: choose Electron/Tauri architecture; establish safe main/preload IPC; make a workspace directory and files the source of truth; define migration/backup strategy.
2. **Data model and repositories** 🟡: reconcile Dexie with filesystem model; add notebook document content, file assets, metadata, migrations, and transactional deletion/restore.
3. **Notebook engine** 🟡: real editor model, autosave/versioning, page templates, keyboard/focus/accessibility; then handwriting and embedded objects.
4. **Canvas engine** 🟡: retain working Excalidraw baseline; decide how Panvas toolbar maps to engine commands, complete block lifecycle, imports/exports, and performance limits.
5. **PDF engine** 🔴: PDF.js rendering, page virtualization, storage, annotations, export, and links to workspace entities.
6. **Library/search/history** 🔴: index real filesystem/data, unified search, recents/favorites/trash, undo/history and recovery.
7. **Sync** 🟡: audit current Supabase outbox/RLS implementation; add conflicts, binary asset strategy, observability, retries and offline tests.
8. **Performance/reliability** 🔴: large canvas/PDF tests, migrations, crash recovery, accessibility, E2E tests, packaging.
9. **Cloud collaboration/AI** 🔴: cloud and AI only after local correctness, privacy, performance, and sync are proven.
