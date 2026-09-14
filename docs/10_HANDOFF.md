# Handoff to AntiGravity

> [!NOTE]
> **Historical Document**: This document reflects early planning/development phases (August-September 2026). For the canonical v0.1.0 architecture and documentation, see [README.md](../README.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md).

You inherit a polished UI system and a partially real local-first workspace application. Start by reading `IMPLEMENTATION_PRIORITY.md`, `ARCHITECTURE.md`, and the actual source—not the preview screens alone.

Do not rewrite `AppShell`, Sidebar, TopBar, existing theme tokens, Notebook/PDF/Canvas visual language, or working Excalidraw persistence for stylistic reasons. The UI is effectively frozen; feature work must preserve the same components/tokens and avoid unrelated screen changes.

What is real: IndexedDB/Dexie workspace/canvas/notebook entities, Zustand stores, Excalidraw wrapper/autosave/custom blocks, and optional Supabase auth/sync scaffolding. What is visual-only: most newer feature previews, notebook editing/drawing shell, PDF workspace, library/explorer, pen system, theme studio, and system gallery.

Refactor only where it supports the functional roadmap: introduce explicit document models, a desktop filesystem boundary, typed command/tool abstractions, and tests. Build next: local filesystem source of truth and notebook document persistence. Then consolidate real library/search and PDF/canvas engines. Do not add AI until the application is stable, offline-correct, and performant.
