# E-Ink Appearance Theme — Implementation Notes

> **INTEGRATION STATUS (current):** This document originally described the isolated
> implementation on `feature/eink-theme` @ `59b7a20` (branched from `aafee7e`).
> That work has since been **ported onto the current Panvas working state** on
> branch `feature/eink-theme-integration` (worktree `../panvas-eink-integration`),
> where the current tree is preserved as snapshot commit `a56d8c9`. The sections
> below describe the theme itself; see **"Integration into current Panvas"** at the
> bottom for what was ported, adapted, or rejected during the port.
> Status: **IMPLEMENTED — PENDING MANUAL VERIFICATION.** Nothing is merged into `main`.

## What was added

A fifth appearance value, **E-Ink**, alongside the existing appearance options, plus a
**System** option that follows the OS color-scheme preference. The Appearance picker now
offers: **System · Light · Dark · E-Ink**. The legacy `ink` (warm Moleskine paper) value
remains internally valid so previously persisted choices keep rendering exactly as before;
it is no longer shown as a card or part of the TopBar cycle.

## Theme architecture (repository-native, no parallel system)

- `src/lib/theme.ts` (new): `PanvasTheme = 'system' | 'light' | 'dark' | 'ink' | 'eink'`,
  `resolveTheme()` (system → `prefers-color-scheme: dark`), `applyThemeClasses()`,
  `watchSystemTheme()` live listener. Classes on `<html>`: `.dark` / `.theme-ink` /
  `.theme-eink` — the same mechanism Tailwind `darkMode: 'class'` and the token blocks key off.
- `src/stores/uiStore.ts`: stores the raw choice (`theme`) + computed `resolvedTheme`;
  persists via `localStorage['panvas-theme']` (unchanged key); applies classes; notifies
  Electron with the *resolved* value; re-resolves live when the OS scheme flips while on System.
- `src/bootstrap.tsx`: pre-paint restore accepts all five values (no flash of wrong theme).
- `tailwind.config.ts`: new `eink:` variant (`.theme-eink &`) for e-ink-only tweaks —
  existing `dark:` styling is untouched.
- `electron/ipc/domain-handlers.ts`: `theme:set` validation accepts `eink`; title-bar
  overlay glyph uses the dark symbol on E-Ink (paper header), same as Light/Ink.

## E-Ink design tokens (`src/styles/index.css`, `.theme-eink` block)

Flat e-paper surface set ( researched against reMarkable/BOOX/Supernote constraints —
16-gray legibility, no soft shadows, ink-first hierarchy):

| Token | Value | Intent |
|---|---|---|
| `--bg-primary` | `#E9E8E2` | app background (e-paper panel gray, not bright white) |
| `--bg-secondary` / `--bg-tertiary` | `#E2E1DA` / `#D9D8D0` | recessed areas / deeper wells |
| `--bg-elevated` | `#F5F4EF` | floating panels = lighter paper lift |
| `--border-subtle/default/strong` | `#CBC9C0` / `#B0AEA4` / `#7A786F` | crisp hairlines carry depth instead of shadows |
| `--text-primary` | `#1C1C1A` | near-black ink |
| `--text-secondary/tertiary` | `#4A4943` / `#6A6861` | readable muted grays |
| accents | desaturated ink tones (`#5B5486` violet, `#3C5483` blue, `#5A6B52` green, `#8A7A3A` amber, `#8A5058` rose) | luminance-distinct, dither-safe, never the only signal |
| `--shadow-surface` | `0 1px 2px @5%` | effectively flat |
| `--shadow-floating` | 1px ring + 2px/10% lift | dialogs/menus separate by outline, not blur |
| `--focus-outline` | ink `@75%` | color-independent focus |
| `--code-*` | muted dark-on-paper palette | code blocks switch from the fixed dark slab to paper |

## E-Ink behavior changes (scoped to app surfaces only)

- **Flat chrome**: gradient washes on app shell/library/viewport removed; topbar/sidebar/
  tabs made opaque; `backdrop-filter` disabled; soft shadows (`shadow-*` utilities,
  `shadow-glass*`, `shadow-glow*`, hover variants) flattened inside `.panvas-app-shell`,
  `.panvas-layer-modal` (settings, command palette, create dialog, template gallery),
  `.panvas-overlay` (context menus/dropdowns) and `.panvas-toast`. Marketing, auth, and
  public legal pages keep their own fixed styling — selectors never reach them.
- **Instant feedback**: CSS animations/transitions frozen inside those same app containers
  (loading spinners remain as static glyphs — presence, not motion). framer-motion is
  silenced via `<MotionConfig reducedMotion="always">` in E-Ink (`never` = today's exact
  behavior for all other themes). The global `prefers-reduced-motion` rule is unchanged.
- **Paper pages**: notebook pages default to `#FBF8F0`→`#FBFAF6`-family paper with a 1px ink
  hairline edge (`.theme-eink [data-page-id]`), rule/grid lines `rgba(60,58,52,0.28)`,
  template fields follow. Handwriting ink defaults (`#20242a`/`#1e1e1e`) are untouched —
  full contrast on paper.
- **Ruler** (`RulerManager`): theme mode is now `'light' | 'dark' | 'eink'` (was a boolean
  dark check). E-Ink draws flat ink-on-paper with the restrained `#3C5483` handle accent.
  Light/dark palettes byte-identical to before.
- **Canvas (Excalidraw)**: unchanged `dark` for every existing appearance; E-Ink runs
  Excalidraw's **light** theme with paper-toned island/controls via `.theme-eink .excalidraw`
  CSS variables. Persisted canvas state (`viewBackgroundColor`, elements) is never mutated.
- **Canvas blocks** (`blocks.css`): ink-toned header hairline/resize handles and darker
  dither-safe badge text replace white-alpha values that vanish on paper.
- **Code & formulas**: `.theme-eink` overrides give ProseMirror code blocks a paper surface
  with the muted `--code-*` palette; KaTeX renders ink instead of the hardcoded light gray.
- **Selection**: ink-tinted (`rgb(28 28 26 / 0.16)`) instead of blue.
- **Toggle track** in page properties uses the new `eink:` variant for a visible gray.

## Files changed

```
src/lib/theme.ts                                   (new)
tests/eink-theme.test.ts                           (new, 16 tests, registered in npm test)
src/styles/index.css                               (.theme-eink tokens + scoped overrides)
src/styles/blocks.css                              (e-ink block chrome overrides)
src/stores/uiStore.ts                              (system/eink, resolvedTheme, live OS watch)
src/bootstrap.tsx                                  (pre-paint restore for all five values)
tailwind.config.ts                                 (eink: variant)
electron/ipc/domain-handlers.ts                    (theme:set accepts eink; title bar)
src/app/App.tsx                                    (MotionConfig wrapper)
src/components/layout/TopBar.tsx                   (4-option cycle, Monitor/Tablet icons)
src/components/settings/sections/AppearanceSection.tsx  (System/Light/Dark/E-Ink cards)
src/components/notebook/PageRenderer.tsx           (e-ink paper + rule colors)
src/components/notebook/templates/TemplateGalleryModal.tsx (e-ink previews)
src/components/notebook/NotebookToolPropertiesPanel.tsx    (resolved theme, swatch, toggle)
src/components/notebook/engine/DrawingEngine.ts    (theme-mode ruler detection)
src/components/notebook/engine/RulerManager.ts     (e-ink ruler palette)
src/components/canvas/CanvasView.tsx               (Excalidraw light theme in e-ink, live sync)
package.json                                       (eink-theme.test.ts added to npm test)
```

## Intentionally NOT themed

- PDF page content (rasterized pages), PDF thumbnail `bg-white` (page white).
- Sticky-note palette, pen/highlighter ink colors, laser red, canvas background presets — user content colors.
- Marketing landing/roadmap/legal/auth pages (self-contained fixed designs, outside the app shell).
- Excalidraw persisted canvas state; Cloud Sync / OAuth / storage / IPC / persistence logic.

## Known inherited issue (not from this branch)

`tests/release-readiness.test.ts` — "incomplete legacy cloud sync is quarantined…" fails at
the release-candidate HEAD (`aafee7e`) because `.env.example` lacks
`VITE_ENABLE_CLOUD_SYNC=false` / `PANVAS_GOOGLE_CLIENT_ID=`. The fix exists only as an
uncommitted change in the primary tree. Left untouched here deliberately.

## Manual verification checklist

1. `npm install && npm run build`, then serve `dist/` (e.g. `python -m http.server` inside `dist`) — avoid `npm run dev` (spawns Electron; see known clash note).
2. Settings → Appearance: pick **System / Light / Dark / E-Ink** in turn; repeat twice; confirm no stale styles and no reload needed.
3. Restart the app on E-Ink: choice persists (localStorage + title-bar glyphs).
4. Light and Dark: confirm pixel-identical behavior to before (no e-ink leakage).
5. System: flip the OS color-scheme while running — app follows live.
6. Notebook: paper pages show hairline edge; draw handwriting, add text, highlight, use the ruler (flat ink look), open template gallery + page settings.
7. PDF: open a PDF workspace, annotate, check thumbnail sidebar and controls.
8. Canvas: create a canvas, draw, check island/toolbar paper tones and hairline block borders (drop a PDF/markdown block).
9. Library, sidebar, trash, Cloud Sync panel, command palette (Ctrl/Cmd+K), create dialog, context menus, toasts, search.
10. Marketing pages and auth screens should look exactly as before even while E-Ink is active.

---

## Visual correction — v2 monochrome redesign (commit 48f6219)

The first integrated palette was functionally correct but visually rejected: live
Playwright DOM verification proved E-Ink WAS active (html.theme-eink + resolved
neutral-warm tokens), yet the warm cast made it read as "Ink v2". v2 replaces it with
a strictly neutral e-paper system:

| Token | v2 value | Role |
|---|---|---|
| --bg-primary | #ECECE7 | app sheet (neutral gray, user-specified family) |
| --bg-elevated | #F7F7F4 | panels/toolbars (paper white) |
| --bg-secondary / tertiary | #E4E4DF / #DADAD5 | recessed areas |
| --bg-active (selection fill) | #D2D2CC | graphite selection fill |
| --border-default / strong | #A6A6A1 / #585854 | crisp 1px graphite rules |
| --text-primary/secondary/tertiary | #161615 / #4A4A47 / #73736F | ink hierarchy |
| --accent-violet (selection slot) | #262624 | near-black — selection is shape+fill, never hue |
| --accent-blue | #3D5675 | the ONE restrained cool accent (links) |
| --accent-emerald/amber/rose | #4E5E4E / #6E6852 / #7C4A4E | desaturated semantic statuses |
| --shadow-floating | 1px ring + 2px flat lift | no soft blur anywhere |
| radius tokens | 0.25 / 0.375 / 0.5rem | squarer chrome |

Chrome flattening: selected tools render as ink chips (near-black fill, paper glyph);
rounded-xl/2xl flattened to 0.5rem and chip buttons squared inside app surfaces; toolbar
surfaces are opaque paper with graphite borders and zero shadow; the topbar reads as a
drawn 1px rule. User content colors (pen/highlighter palettes, paper-color swatches,
PDF/Google-brand colors, persisted page colors) are untouched. Light/Dark/legacy Ink are
byte-for-byte unaffected (all v2 rules are scoped under .theme-eink).

Live acceptance evidence: side-by-side screenshots of Library, notebook, inspector,
canvas, settings and Cloud Sync under all three themes are in
`C:\Users\sksum\OneDrive\Documents\eink-screenshots\v2\index.html` (open in a browser).

---
---

## Integration into current Panvas (feature/eink-theme-integration)

The current working tree moved *past* `aafee7e` in ways that changed three of the
original integration points. Current logic won everywhere; E-Ink was re-pointed at the
new architecture instead of dragging old code forward.

### Ported as-is (files unchanged in current tree — taken from `59b7a20` wholesale)

- `src/lib/theme.ts` (new) — theme resolution/apply/watch helpers.
- `tailwind.config.ts` — `eink:` variant.
- `src/styles/blocks.css` — E-Ink block-chrome overrides (appended).
- `src/components/settings/sections/AppearanceSection.tsx` — System/Light/Dark/E-Ink cards.
- `src/components/notebook/engine/RulerManager.ts` — theme-mode ruler palettes.

### Ported with hand-merges (current additions preserved)

- `src/stores/uiStore.ts` — theme slice rewritten for `system`/`eink` + `resolvedTheme`
  + live OS-preference watcher; current `inlineCreate`/`cloudSyncReviewRequested` state untouched.
- `src/bootstrap.tsx` — pre-paint restore via `@/lib/theme`; current `editor-fonts.css`
  lazy import untouched.
- `src/styles/index.css` — the full `.theme-eink` token + scoped-override block appended
  at EOF; current Excalidraw-wrapper rules untouched.
- `src/app/App.tsx` — `MotionConfig` wrapper + `resolvedTheme`; current restructured
  routes/bootstrapping untouched.
- `src/components/layout/TopBar.tsx` — Monitor/Tablet icons, `resolvedTheme`, 4-way cycle;
  current cloud-sync review + logo changes untouched.
- `electron/ipc/domain-handlers.ts` — `theme:set` validation + handler accept `eink`;
  all current security validation untouched.
- `package.json` — `tests/eink-theme.test.ts` prepended to the current test list;
  current `pretest`/package scripts untouched.
- `src/components/notebook/engine/DrawingEngine.ts` — ruler overlay theme-mode hunk only.
- `src/components/notebook/NotebookToolPropertiesPanel.tsx` — `eink:bg-[#8d8b83]` on the
  apply-to-all toggle track only.

### Rejected from `59b7a20` (current architecture supersedes)

- **PageRenderer/TemplateGalleryModal theme-derived paper colors** — the current tree
  made document colors persisted and theme-independent ("application themes never
  rewrite document appearance"). E-Ink now dresses notebook pages purely through CSS
  (`.theme-eink .panvas-app-shell [data-page-id]` hairline edge + flat shadows); paper
  pages keep their persisted colors, which is the correct behavior for an *application*
  theme.
- **CanvasView initialData/theme-prop hunks** — replaced by the current canvas editor
  theme system: `CanvasView` now feeds `resolveCanvasEditorTheme()` the *resolved* app
  theme (one-line change). `system` mode follows the OS (this also fixes `system`
  resolving to light under OS-dark), E-Ink naturally presents Excalidraw's light theme,
  and `.theme-eink .excalidraw` CSS supplies the paper chrome. A user's explicit canvas
  editor choice (`dark`) still wins over E-Ink.
- **NotebookToolPropertiesPanel `#c6c4c0` rule-line default** — the current swatch-dialog
  design owns line-color defaults; not ported.

### Safety

- Snapshot of the pre-integration current state: commit `a56d8c9` on this branch;
  full patch at `/tmp/panvas-integration-safety/current-state-snapshot.patch`.
- Primary working tree untouched; `main` untouched; nothing merged.
