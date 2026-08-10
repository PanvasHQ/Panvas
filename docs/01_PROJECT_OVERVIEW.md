# Panvas: project overview

Panvas is a local-first visual research workspace for engineers, researchers, technical students, and creators. It brings structured notebooks, infinite canvases, PDFs, code/equation blocks, and reference material into one desktop-oriented product.

## Vision

Long term, Panvas should be a reliable offline-capable desktop application where a user can collect source material, write notes, diagram systems, annotate documents, and navigate a durable workspace without treating each activity as a separate app.

## Product philosophy

- Paper-first, calm, tactile, and native-desktop in feel.
- Local data should remain useful without a network; cloud is optional enhancement.
- Structured information architecture: `Workspace → Folder → Notebook → Section → Page`, alongside canvases and other files.
- Functionality is more important than visual novelty. Preserve working flows and reuse established architecture.

## Design philosophy

The official Panvas language is established by the Notebook, PDF, Canvas, Library, Workspace Explorer, Universal Toolbar, Theme Studio, and System preview screens. It is compact, warm, quiet, desktop-first, and uses shared tokens rather than per-screen inventions. Use Lucide icons only. Follow an 8px rhythm where practical. Avoid dashboard/SaaS treatment, neon, gradients for decoration, and Material-like visual noise.

## Inspiration

Use the *qualities* of Apple Notes/Freeform, Goodnotes, Notion, Obsidian, Excalidraw, tldraw, FigJam, Linear, Arc, Raycast, Finder, and Craft: density, hierarchy, paper surfaces, keyboard-aware desktop controls, and quiet precision. Do not copy layouts or branding.

## Panvas is

- A React/Vite application with a real Excalidraw-backed canvas flow.
- A local IndexedDB (Dexie) workspace model with folders, canvases, notebooks, sections, and pages.
- A UI system with static review routes for proposed interfaces.
- An optional Supabase auth/sync scaffold.

## Panvas is not

- A website dashboard or generic Tailwind admin template.
- A completed native Electron application (no Electron main/preload process exists in this repository).
- A finished notebook editor, PDF reader, filesystem product, or universal drawing engine.
- A reason to replace established UI for “improvement” without an explicit task.
