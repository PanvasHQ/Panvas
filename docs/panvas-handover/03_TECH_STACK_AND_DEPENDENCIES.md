# 03 — Tech Stack & Dependencies (03_TECH_STACK_AND_DEPENDENCIES.md)

## 1. Core Technology Stack

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Desktop Runtime** | Electron | `^43.3.0` | Desktop container, native file system access, window management. |
| **UI Framework** | React | `^18.3.1` | Component-based rendering engine. |
| **Language** | TypeScript | `^5.7.3` | Type safety and domain interface specs across renderer and IPC. |
| **Build System** | Vite | `^6.1.0` | Fast HMR dev server and production bundler. |
| **Electron Plugin** | `vite-plugin-electron` | `^1.1.1` | Integrates Electron main and preload build with Vite lifecycle. |
| **State Management** | Zustand | `^5.0.0` | Micro client-side state stores without boilerplate. |
| **Database / Storage** | Dexie.js | `^4.0.11` | IndexedDB wrapper for local fallback & binary storing (`pdfFiles`, `imageFiles`). |
| **CSS / Styling** | Tailwind CSS + Vanilla CSS | `^3.4.17` | Utility-first styling supplemented by custom CSS design tokens in `src/styles/`. |
| **Rich Text Editor** | TipTap | `^3.29.2` | Headless WYSIWYG editor framework based on ProseMirror. |
| **Freeform Canvas** | Excalidraw | `^0.17.6` | Canvas drawing component for infinite canvas workspace mode. |
| **PDF Renderer** | PDF.js (`pdfjs-dist`) | `^4.10.38` | Canvas-based PDF document rendering engine. |
| **Iconography** | Lucide React | `^0.469.0` | Comprehensive UI iconography. |

---

## 2. Complete Dependency Audit (`package.json`)

### 2.1 Runtime Dependencies (`dependencies`)

| Package | Version | Primary Purpose | Used By Component / File | Notes |
|---|---|---|---|---|
| `react` | `^18.3.1` | Core UI library | Global | Concurrent React rendering |
| `react-dom` | `^18.3.1` | DOM renderer | `src/main.tsx` | Entry point mount |
| `electron` | `^43.3.0` | Native runtime | `electron/` | Built in main/preload |
| `zustand` | `^5.0.0` | Global state | `src/stores/` | All application stores |
| `dexie` | `^4.0.11` | IndexedDB database | `src/database/schema.ts` | Local browser db fallback |
| `dexie-react-hooks` | `^1.1.7` | Reactive Dexie hooks | `src/database/` | Live query hooks |
| `pdfjs-dist` | `^4.10.38` | PDF parsing & rendering | `usePdfDocument.ts`, `InactivePagePreview.tsx`, `PdfWorkspace.tsx` | Uses local worker asset URL |
| `pdf-lib` | `^1.17.1` | PDF manipulation | Future PDF export | Utilities for PDF modification |
| `@excalidraw/excalidraw` | `^0.17.6` | Canvas engine | `CanvasView.tsx` | Freeform canvas view |
| `@tiptap/react` | `^3.29.2` | Rich text UI | `FloatingTextEditor.tsx`, `NotebookRenderer.tsx` | Inline notebook text editing |
| `@tiptap/starter-kit` | `^3.29.2` | Rich text extensions | `FloatingTextEditor.tsx` | Basic text extensions |
| `@tiptap/extension-color` | `^3.29.2` | Text color | `FloatingTextEditor.tsx` | Typography styling |
| `@tiptap/extension-font-family` | `^3.29.2` | Font selector | `FloatingTextEditor.tsx` | Handwriting font styles |
| `@tiptap/extension-highlight` | `^3.29.2` | Text highlighter | `FloatingTextEditor.tsx` | Text highlighting |
| `@tiptap/extension-image` | `^3.29.2` | Inline images | `FloatingTextEditor.tsx` | Inline text images |
| `@tiptap/extension-link` | `^3.29.2` | Text links | `FloatingTextEditor.tsx` | Hyperlinks |
| `@tiptap/extension-placeholder` | `^3.29.2` | Editor placeholder | `FloatingTextEditor.tsx` | Empty text state guidance |
| `@tiptap/extension-task-item` | `^3.29.2` | Checklist items | `FloatingTextEditor.tsx` | Interactive checklists |
| `@tiptap/extension-task-list` | `^3.29.2` | Checklist container | `FloatingTextEditor.tsx` | Task lists |
| `@tiptap/extension-text-align` | `^3.29.2` | Text alignment | `FloatingTextEditor.tsx` | Align left/center/right |
| `@tiptap/extension-text-style` | `^3.29.2` | Text style base | `FloatingTextEditor.tsx` | Base styling extension |
| `@tiptap/extension-underline` | `^3.29.2` | Underline styling | `FloatingTextEditor.tsx` | Underlining |
| `katex` | `^0.16.21` | Math expression layout | `LatexBlock.tsx` | Formula rendering |
| `rehype-katex` | `^7.0.1` | Markdown KaTeX plugin | `MarkdownBlock.tsx` | LaTeX inside Markdown |
| `remark-gfm` | `^4.0.0` | GitHub Flavored Markdown | `MarkdownBlock.tsx` | Tables, tasklists in MD |
| `remark-math` | `^6.0.0` | Math parser | `MarkdownBlock.tsx` | Math syntax parsing |
| `react-markdown` | `^9.0.3` | Markdown renderer | `MarkdownBlock.tsx` | Canvas Markdown block |
| `react-syntax-highlighter` | `^16.1.1` | Code highlighting | `MarkdownBlock.tsx` | Code snippet syntax |
| `lucide-react` | `^0.469.0` | UI Icons | Global | All icons across toolbars |
| `framer-motion` | `^12.40.0` | UI Animations | Modals, Sidebars, Toasts | Smooth transitions |
| `nanoid` | `^5.1.0` | Unique ID generator | `src/lib/utils/id.ts` | Entity ID creation |
| `wouter` | `^3.10.0` | Router | `src/app/App.tsx` | Client-side route switching |
| `zod` | `^4.4.3` | Schema validation | `src/lib/validation/` | Form & API validation |
| `@supabase/supabase-js` | `^2.49.0` | Cloud database & Auth | `src/services/supabase/` | Optional auth & cloud sync |
| `posthog-js` | `^1.376.4` | Telemetry analytics | `src/lib/analytics.ts` | Opt-in usage metrics |
| `tippy.js` | `^6.3.7` | Tooltips | `FloatingTextEditor.tsx` | Rich text bubble menus |

---

### 2.2 Development Dependencies (`devDependencies`)

| Package | Version | Purpose |
|---|---|---|
| `vite` | `^6.1.0` | Bundler & dev server |
| `typescript` | `^5.7.3` | TypeScript compiler |
| `@vitejs/plugin-react` | `^4.3.4` | Fast Refresh plugin for Vite |
| `vite-plugin-electron` | `^1.1.1` | Electron main/preload bundling |
| `vite-plugin-electron-renderer` | `^1.0.0` | Renderer process Node API integration |
| `tailwindcss` | `^3.4.17` | Tailwind CSS compiler |
| `autoprefixer` | `^10.4.20` | CSS vendor prefixing |
| `postcss` | `^8.5.1` | CSS processor |
| `@tailwindcss/typography` | `^0.5.20` | Prose typography plugin |
| `electron-builder` | `^26.15.3` | Executable packaging & installer creator |
| `playwright` | `^1.60.0` | End-to-end testing suite |

---

## 3. Build & Execution Scripts (`package.json`)

* `npm start`: Runs `prestart` (`npm run build`), then launches `electron .`.
* `npm run dev`: Starts Vite dev server (`vite`) on `http://localhost:3000`.
* `npm run build`: Executes `tsc -b` type check, followed by production `vite build`.
* `npm run preview`: Previews built production artifacts.
* `npm run lint`: Runs ESLint check.
