# UI system

## Tokens and themes

`src/styles/index.css` defines CSS variables and `tailwind.config.ts` exposes them as `panvas-*` utilities. Themes: default light (`:root`), dark (`.dark`), warm paper ink (`.theme-ink`). Use `bg-panvas-bg-*`, `text-panvas-text-*`, `border-panvas-border-*`, and `panvas-accent-*`; do not hard-code theme colors except inside small visual mock previews.

Typography: Tailwind `font-sans` is Inter/system UI; `font-mono` is JetBrains Mono/Fira Code. Existing scale uses `2xs`, `xs`, `sm`, page headings around 30–32px, and short readable line heights. Lucide is the icon set.

Spacing/radius/shadows: compact rows are generally 28–40px; panels use `rounded-lg`/`rounded-xl`, 1px token borders, elevated backgrounds, and restrained `shadow-sm`, `shadow-glass-sm`, or layered paper shadows. Preserve existing 8px-based gaps and calm hover states.

## Shared language

- `AppShell`: fixed desktop frame; TopBar → Sidebar/content → StatusBar.
- Floating toolbars: elevated rounded container, grouped 40px icon controls, subtle dividers and active fill.
- Pages: breadcrumbs, clear title/subtitle, generous content whitespace; content panels use `bg-panvas-bg-elevated`.
- Sidebar/tree: dense hierarchy, small icons, quiet selected state, indentation; no large web buttons.
- Cards/tables: token border, compact metadata, hover changes background/border/shadow rather than a bright color.
- Inputs/buttons: see global `.input-field`, `.btn-*`, `.focus-ring` styles. Existing globals still include legacy gradient button utilities; do not introduce them into the current native UI language.

## Existing overlay systems

`CommandPalette`, `CreateDialog`, `ContextMenu`, and `Toast` are mounted globally by `App`. Their state is in `uiStore`. The System preview is a visual catalogue, not a replacement implementation.

## Important rule

The UI review surfaces establish visual language only. Reuse their atoms/layout patterns; do not make a second design system or copy static sample content into real data views.
