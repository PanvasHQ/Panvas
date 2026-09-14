# Tech stack

> [!NOTE]
> **Historical Document**: This document reflects early planning/development phases (August-September 2026). For the canonical v0.1.0 architecture and documentation, see [README.md](../README.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md).

- **React 18 + TypeScript 5**: UI/runtime, strict compiler configuration.
- **Vite 6**: dev server (port 3000), builds, `@` alias.
- **Tailwind CSS 3 + PostCSS**: token-driven styling; CSS variables in `src/styles/index.css`.
- **Wouter**: SPA routing.
- **Zustand 5**: UI, workspace, canvas, auth, sync state.
- **Dexie 4 / dexie-react-hooks**: IndexedDB schema/local persistence (hooks dependency is installed; inspect usage before assuming it is used everywhere).
- **Excalidraw 0.17**: functional canvas engine; dynamically imported by `CanvasView`.
- **Supabase JS**: optional auth and sync backend. SQL/migrations are in `supabase/`.
- **Framer Motion**: shell/sidebar motion.
- **Lucide React**: icons.
- **KaTeX, react-markdown, remark/rehype, syntax highlighter**: canvas custom content blocks.
- **pdfjs-dist**: installed; not yet integrated into the PDF workspace preview.
- **react-hook-form + resolvers + Zod**: form validation stack.
- **PostHog**: optional analytics initialization.
- **Playwright**: test tooling; current `tests/auth-isolation.spec.ts` is the visible test.

Not currently present: Electron/Tauri main process, filesystem bridge, TipTap, a production PDF viewer integration, collaboration transport, or AI SDK.
