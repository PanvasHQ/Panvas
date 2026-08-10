# Completed pages

| Page | Purpose/components | Status and future notes |
|---|---|---|
| Landing | `marketing/LandingPage` | ✅ Marketing site; do not redesign during application work. |
| App workspace | `AppShell`, `WorkspaceContent`, Sidebar, TopBar | ✅ Real shell. Canvas or notebook is selected from workspace store. |
| Notebook | `NotebookPagePlaceholder`, floating toolbar, properties/editor-surface components | 🟡 Entity hierarchy/navigation exists. Page is visual; replace editor surface with persisted rich-text document model, then connect drawing deliberately. |
| Infinite Canvas | `CanvasView`, CanvasOverlay/Toolbar/custom blocks | ✅ Excalidraw-backed canvas with IndexedDB autosave. Separate `CanvasWorkspace` is static preview only. |
| PDF | `PdfWorkspace`, thumbnail/sidebar/toolbar | 🟡 Static presentation only. `pdfjs-dist` is installed but the preview does not render documents. |
| Library | `LibraryWorkspace`, `FilePreviewCard` | 🟡 Static sample file hub at `/library-preview`; no filesystem/index. |
| Workspace Explorer | `WorkspaceExplorerPreview` | 🟡 Static sample table/grid/gallery and inspector. |
| Settings | `SettingsLayout` + sections | 🟡 Existing settings UI; actual theme control is currently via UI store. |
| Theme Studio | `AppearanceStudio` | 🟡 Static `/theme-preview`; does not switch/save theme. |
| Pen Toolbar | `PenToolbarPreview` | 🟡 Static `/pen-toolbar-preview`; do not confuse with `NotebookToolPropertiesPanel`. |
| System Components | `SystemPreview` | 🟡 Static `/system-preview`; documents desired visual states. |

Preview routes are not feature routes. Remove/rehome them after a real feature adopts their UI.
