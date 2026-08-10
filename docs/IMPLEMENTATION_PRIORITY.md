# Implementation priority: single source of truth

1. **Local-first desktop application.** Introduce the actual desktop host and a secure filesystem boundary. The filesystem must become canonical; do not build more visual-only product screens first.
2. **Filesystem as source of truth.** Specify on-disk workspace, files, assets, metadata, migrations, backups, and recovery. Keep Dexie as cache/index only if that decision is deliberate.
3. **Replace mocks with real functionality.** Begin with notebook page content and real workspace/library data; then canvas/PDF functionality. Do not connect a mock preview directly without removing mock data.
4. **Performance.** Measure large documents/canvases/PDFs, virtualization, asset memory, autosave and startup.
5. **Stability.** Tests, migrations, error handling, crash recovery, data integrity, accessibility.
6. **UX polish.** Only after real flows work; preserve the locked Panvas system.
7. **Cloud sync.** Harden the existing outbox/RLS direction after local correctness and file strategy are proven.
8. **AI last.** No AI, OCR, RAG, or assistant features before priorities 1–7 are complete.

Every new implementation task should state: affected real domain model, persistence path, failure/recovery behavior, test plan, and which existing screen is allowed to change. One screen/feature area at a time.
