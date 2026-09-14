# UX Reference: GoodNotes / Notability / OneNote

Use this alongside the screenshots as context for Claude Code when building the app's UI.

## GoodNotes
- **Shelf/library view**: notebooks shown as visual thumbnails (like a bookshelf), grouped into folders.
- **Canvas**: paper-like background (lined/grid/dot/blank), infinite scroll or paginated notebook pages.
- **Toolbar**: minimal, floating or top-docked — pen, highlighter, eraser, lasso/select, text box, shape recognition.
- **Sidebar**: page thumbnails for quick navigation within a notebook.
- **Standout feature**: handwriting-to-text search (search handwritten notes like typed text).
- **Theme**: light and dark mode; very whitespace-heavy, low-chrome UI so the "paper" stays the focus.

## Notability
- **Split view**: left sidebar = subject/folder list; right pane = note canvas. Persistent, not modal.
- **Notes within a subject**: horizontal scroll or list of individual note pages inside a subject.
- **Toolbar**: compact top bar — pen, highlighter, eraser, text, recording toggle.
- **Standout feature**: audio recording synced to handwriting — tap a word later and it jumps to that moment in the recording.
- **Multi-note view**: can view multiple notes side-by-side (split screen within the app).

## OneNote
- **Structure**: Notebook → Section → Page, shown as a 3-level hierarchy (tabs for sections, list for pages).
- **Canvas**: freeform — you can click/type anywhere on the page, not just linear top-down like a doc.
- **Toolbar**: ribbon-style (more traditional Office UI) with draw, insert, view tabs.
- **Standout feature**: infinite canvas + freeform placement of text, images, ink, and tables anywhere on a page.
- **Sync**: built around cloud-first sync (OneDrive), multi-device continuity is the core selling point.

## Common patterns worth borrowing
1. **Low-chrome canvas** — toolbars stay minimal/collapsible so the writing surface is the hero.
2. **Hierarchical navigation** — folder/notebook/section/page is the near-universal mental model; don't reinvent this.
3. **Fast mode-switching** — pen ⇄ highlighter ⇄ eraser ⇄ select needs to be reachable without menus (single tap/keyboard shortcut).
4. **Page thumbnails or shelf view** — visual browsing beats a flat file list for notes.
5. **Search that includes handwriting** — increasingly expected, not a "nice to have."

## Where you can differentiate
- None of the three fully nail **true cross-platform parity** (GoodNotes/Notability are iOS-first, OneNote is heavier/slower on browser). An Electron + responsive-browser app that feels equally native on desktop, tablet, and phone is itself a gap.
- Open-source + self-hostable sync is not something any of the three offer — that's a real differentiator if privacy-conscious users are your target.