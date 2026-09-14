// ============================================
// Panvas — Notebook toolbar responsive contract
// ============================================
// Pure width-to-groups mapping for NotebookFloatingToolbar, kept free of React
// so the breakpoints can be unit-tested (tests/toolbar-layout.test.ts).
// Contract source: docs/08_IMPLEMENTATION_ROADMAP.md section 7.
//
// The writing sequence ends at Select. The compact Shapes-family group is
// promoted beside it when measured width permits; remaining utilities use More.

export type ToolbarGroupId =
  | 'history'    // undo / redo
  | 'handwriting' // real-time handwriting to editable text
  | 'primary'    // pen, pencil, highlighter, marker, eraser, text
  | 'select'
  | 'hand'
  | 'image'
  | 'shapes'     // rectangle, ellipse, arrow, line
  | 'ruler'
  | 'laser'
  | 'gestures'
  | 'format';    // text formatting menu

/** 'active-tool' only exists in compact mode: a single button showing the
 *  currently active tool, so the active tool never disappears from view. */
export type CompactGroupId = 'active-tool';

export const TOOLBAR_GROUP_ORDER: readonly ToolbarGroupId[] = [
  'history',
  'handwriting',
  'primary',
  'select',
  'hand',
  'image',
  'shapes',
  'ruler',
  'laser',
  'gestures',
  'format',
] as const;

// Rendered widths in px, including the inter-group separator. Button size is
// 40px with 4px gaps, so single-tool groups are 40 + ~14 separator = 54.
// Rounded up so the fit check never underestimates a group.
export const TOOLBAR_GROUP_WIDTHS: Record<ToolbarGroupId | CompactGroupId, number> = {
  history: 98,   // 2 x 40px buttons + gap + separator
  handwriting: 54,
  primary: 276,  // 6 x 40px buttons + gaps + separator
  select: 54,
  hand: 54,
  image: 98,   // image + sticky note buttons + separator
  shapes: 54,    // one Shapes-family button + separator
  ruler: 54,
  laser: 54,
  gestures: 54,
  format: 54,
  'active-tool': 54,
};

// Toolbar chrome, measured against the rendered bar: px-3 side padding,
// the hide button, and (when anything overflows) the More button plus its
// divider. Rounded up so the fit check never underestimates.
const CHROME_WIDTH = 70;
const OVERFLOW_BUTTON_WIDTH = 48;

export const TOOLBAR_COMPACT_BREAKPOINT = 560;
export const TOOLBAR_MEDIUM_BREAKPOINT = 720;
// The image group now also contains the direct Sticky Note action. Keep a
// little extra full-width reserve so that pair cannot clip at the old 960px
// boundary; narrower windows use the existing More menu path.
export const TOOLBAR_FULL_BREAKPOINT = 1160;

// Below this the compact set (history + active-tool + More) cannot physically
// fit, so the bar degrades once more: the active tool stays visible and every
// other control — undo/redo included — lives behind the More button. With
// Electron's 680px window minimum and the 280px sidebar, the toolbar cell is
// never smaller than ~195px, which this tier still fits.
export const TOOLBAR_MINIMAL_CELL_WIDTH =
  CHROME_WIDTH + OVERFLOW_BUTTON_WIDTH + TOOLBAR_GROUP_WIDTHS['active-tool'];

export interface ToolbarLayout {
  /** Groups rendered directly on the toolbar bar, in display order. */
  visible: readonly (ToolbarGroupId | CompactGroupId)[];
  /** Groups reachable only through the overflow ("More Tools") menu. */
  overflow: readonly ToolbarGroupId[];
  /** Minimum-viable layout for narrow widths (< 560px). */
  compact: boolean;
}

/** Keep a most-recent-first, case-insensitive color history for one tool. */
export function recordRecentColor(
  colors: readonly string[],
  selectedColor: string,
  limit = 5,
): string[] {
  const normalized = selectedColor.toLowerCase();
  return [selectedColor, ...colors.filter(color => color.toLowerCase() !== normalized)].slice(0, limit);
}

/**
 * Resolve the fullscreen notebook tool-only layout.
 *
 * Fullscreen deliberately has a smaller contract than the normal notebook
 * header: history, the complete writing group, and Select are the controls
 * users should reach without opening a utility cluster. Secondary drawing
 * actions remain available from More.  Unlike the normal responsive layout,
 * this resolver never replaces the writing group with an active-tool button
 * while there is enough room for the group itself.
 */
export function resolveFullscreenToolbarLayout(containerWidth: number | null, activeToolGroupId?: ToolbarGroupId): ToolbarLayout {
  const secondary = TOOLBAR_GROUP_ORDER.filter(
    group => group !== 'history' && group !== 'handwriting' && group !== 'primary' && group !== 'select',
  );

  // Before measurement, render the complete tool-only contract. The parent
  // constrains the bar, and the measured pass below will move controls into
  // More if the actual width is smaller.
  if (containerWidth === null) {
    return {
      visible: ['history', 'handwriting', 'primary', 'select'],
      overflow: secondary,
      compact: false,
    };
  }

  // Fullscreen always has a More affordance for secondary tools, so reserve
  // its width while deciding what can remain inline. The order below is
  // intentionally priority-driven rather than using the normal compact
  // active-tool fallback.
  const chromeWithMore = CHROME_WIDTH + OVERFLOW_BUTTON_WIDTH;
  const canFit = (groups: readonly (ToolbarGroupId | CompactGroupId)[]) =>
    chromeWithMore + groups.reduce((sum, group) => sum + TOOLBAR_GROUP_WIDTHS[group], 0) <= containerWidth;
  const withoutActiveTool = (groups: readonly ToolbarGroupId[]) => activeToolGroupId
    ? groups.filter(group => group !== activeToolGroupId)
    : [...groups];

  if (canFit(['history', 'handwriting', 'primary', 'select'])) {
    return { visible: ['history', 'handwriting', 'primary', 'select'], overflow: secondary, compact: false };
  }
  if (canFit(['history', 'handwriting', 'primary'])) {
    return {
      visible: ['history', 'handwriting', 'primary'],
      overflow: withoutActiveTool(['select', ...secondary]),
      compact: containerWidth < TOOLBAR_COMPACT_BREAKPOINT,
    };
  }
  if (canFit(['handwriting', 'primary', 'select'])) {
    return {
      visible: ['handwriting', 'primary', 'select'],
      overflow: withoutActiveTool(['history', ...secondary]),
      compact: containerWidth < TOOLBAR_COMPACT_BREAKPOINT,
    };
  }
  if (canFit(['handwriting', 'primary'])) {
    return {
      visible: ['handwriting', 'primary'],
      overflow: withoutActiveTool(['history', 'select', ...secondary]),
      compact: containerWidth < TOOLBAR_COMPACT_BREAKPOINT,
    };
  }

  // At an extremely narrow browser width, keep the existing active-tool
  // fallback as a last resort. Electron's supported window sizes remain above
  // this tier, so normal fullscreen usage still exposes all writing tools.
  return {
    visible: ['active-tool'],
    overflow: withoutActiveTool(['history', 'primary', 'select', ...secondary]),
    compact: true,
  };
}

/**
 * Resolve the deterministic toolbar layout for the width actually available to
 * the toolbar container.
 *
 * Bracket contract (section 7 of the implementation roadmap):
 * - >= 1000px full:        every group directly visible.
 * - 720–999px laptop:      history, primary, select visible; hand, image,
 *                          shapes, ruler, format live in the overflow menu.
 * - 560–719px small:       same visible set (primary still fits whole, so
 *                          pencil stays one click away).
 * - < 560px   minimum:     history, a single active-tool control, select, and
 *                          the overflow menu; nothing else renders inline.
 *
 * Independently of the bracket, a measured fit check drops trailing groups so
 * the rendered bar never exceeds the container width. History is always
 * visible; at minimum the active-tool control is too.
 */
export function resolveToolbarLayout(containerWidth: number | null, activeToolGroupId?: ToolbarGroupId): ToolbarLayout {
  const primaryEnd = TOOLBAR_GROUP_ORDER.indexOf('select');
  if (containerWidth === null) {
    return {
      visible: [...TOOLBAR_GROUP_ORDER.slice(0, primaryEnd + 1), 'shapes'],
      overflow: TOOLBAR_GROUP_ORDER.slice(primaryEnd + 1).filter(group => group !== 'shapes'),
      compact: false,
    };
  }

  const compact = containerWidth < TOOLBAR_COMPACT_BREAKPOINT;

  // Stable primary ceiling: secondary controls never displace the requested
  // Handwriting-to-Text -> writing tools -> Select -> More sequence.
  const ceiling = primaryEnd;

  // Measured-fit ceiling: last group index that fits in the container.
  let used = CHROME_WIDTH + OVERFLOW_BUTTON_WIDTH;
  let fit = TOOLBAR_GROUP_ORDER.length - 1;
  for (let i = 0; i < TOOLBAR_GROUP_ORDER.length; i++) {
    const group = TOOLBAR_GROUP_ORDER[i];
    if (used + TOOLBAR_GROUP_WIDTHS[group] > containerWidth) {
      fit = i - 1;
      break;
    }
    used += TOOLBAR_GROUP_WIDTHS[group];
  }

  if (compact) {
    const base = CHROME_WIDTH + OVERFLOW_BUTTON_WIDTH
      + TOOLBAR_GROUP_WIDTHS.history + TOOLBAR_GROUP_WIDTHS.handwriting + TOOLBAR_GROUP_WIDTHS['active-tool'];

    // Degradation ladder inside compact mode:
    //   >= base: history + active-tool (+ select when it fits)
    //   <  base: active-tool alone; everything else — undo/redo included —
    //            lives behind the More button. With Electron's 680px window
    //            minimum and the 280px sidebar, the toolbar cell is never
    //            smaller than ~195px, which this tier still fits.
    if (containerWidth < base) {
      const handwritingAndActive = CHROME_WIDTH + OVERFLOW_BUTTON_WIDTH
        + TOOLBAR_GROUP_WIDTHS.handwriting + TOOLBAR_GROUP_WIDTHS['active-tool'];
      if (containerWidth >= handwritingAndActive) {
        return {
          visible: ['handwriting', 'active-tool'],
          overflow: TOOLBAR_GROUP_ORDER.filter(group => group !== 'handwriting' && group !== activeToolGroupId),
          compact: true,
        };
      }
      return {
        visible: ['active-tool'],
        overflow: TOOLBAR_GROUP_ORDER.filter(group => group !== activeToolGroupId),
        compact: true,
      };
    }
    const withSelect = base + TOOLBAR_GROUP_WIDTHS.select <= containerWidth;
    const visible: (ToolbarGroupId | CompactGroupId)[] = ['history', 'handwriting', 'active-tool'];
    if (withSelect && activeToolGroupId !== 'select') visible.push('select');
    const overflow = TOOLBAR_GROUP_ORDER.filter(group => !visible.includes(group) && group !== activeToolGroupId);
    return { visible, overflow, compact: true };
  }

  const lastVisible = Math.max(0, Math.min(ceiling, fit));
  const visible: (ToolbarGroupId | CompactGroupId)[] = [...TOOLBAR_GROUP_ORDER.slice(0, lastVisible + 1)];
  const usedByPrimary = CHROME_WIDTH + OVERFLOW_BUTTON_WIDTH
    + visible.reduce((sum, group) => sum + TOOLBAR_GROUP_WIDTHS[group], 0);
  if (containerWidth >= TOOLBAR_MEDIUM_BREAKPOINT && usedByPrimary + TOOLBAR_GROUP_WIDTHS.shapes <= containerWidth) visible.push('shapes');
  return {
    visible,
    overflow: TOOLBAR_GROUP_ORDER.filter(group => !visible.includes(group)),
    compact: false,
  };
}
