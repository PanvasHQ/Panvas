import {
  DEFAULT_PAGE_PROPERTY_SET,
  type Notebook,
  type NotebookPage,
  type PagePropertySet,
} from '../types/notebook.ts';

export interface PageGeometryFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PageGeometryAnchor {
  normalizedX: number;
  normalizedY: number;
  viewportX: number;
  viewportY: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export interface NotebookPageLayoutPosition extends PageDimensions {
  id: string;
  x: number;
  y: number;
}

export interface NotebookPageLayout {
  positions: NotebookPageLayoutPosition[];
  totalWidth: number;
  totalHeight: number;
  gap: number;
  paddingY: number;
}

const PAGE_DIMENSIONS: Record<PagePropertySet['pageSize'], PageDimensions> = {
  A4: { width: 794, height: 1123 },
  A5: { width: 595, height: 842 },
  Letter: { width: 816, height: 1056 },
  // The current property model has no persisted custom width/height. Preserve
  // the existing renderer fallback until that model gains explicit dimensions.
  Custom: { width: 794, height: 1123 },
};

/** Resolve the stable logical dimensions belonging to one page. */
export function resolvePageDimensions(properties: PagePropertySet): PageDimensions {
  const dimensions = PAGE_DIMENSIONS[properties.pageSize];
  const oriented = properties.orientation === 'landscape'
    ? { width: dimensions.height, height: dimensions.width }
    : { ...dimensions };
  return { ...oriented, height: oriented.height + Math.max(0, Math.min(6000, properties.extraHeight ?? 0)) };
}

export function resolveBasePageDimensions(properties: PagePropertySet): PageDimensions {
  return resolvePageDimensions({ ...properties, extraHeight: 0 });
}

/**
 * Build section geometry solely from per-page persisted properties. Focus and
 * scroll state are deliberately absent from this contract.
 */
export function resolveNotebookPageLayout(
  pages: ReadonlyArray<{ id: string; properties: PagePropertySet }>,
  spreadMode = false,
): NotebookPageLayout {
  const gap = 32;
  const paddingY = 32;
  const sizedPages = pages.map(page => ({ ...page, ...resolvePageDimensions(page.properties) }));

  if (!spreadMode) {
    const totalWidth = sizedPages.reduce((widest, page) => Math.max(widest, page.width), 0);
    let nextY = paddingY;
    const positions = sizedPages.map(page => {
      const position = {
        id: page.id,
        x: (totalWidth - page.width) / 2,
        y: nextY,
        width: page.width,
        height: page.height,
      };
      nextY += page.height + gap;
      return position;
    });
    const contentHeight = sizedPages.length > 0 ? nextY - gap : paddingY;
    return { positions, totalWidth, totalHeight: contentHeight + paddingY, gap, paddingY };
  }

  // Preserve two-page spread behavior while allowing each slot to keep its
  // own dimensions. Columns and rows size independently from their contents.
  const columnWidths = [0, 0];
  const rowHeights: number[] = [];
  sizedPages.forEach((page, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    columnWidths[column] = Math.max(columnWidths[column], page.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, page.height);
  });

  const rowTops: number[] = [];
  let nextY = paddingY;
  rowHeights.forEach((height, row) => {
    rowTops[row] = nextY;
    nextY += height + gap;
  });
  const totalWidth = columnWidths[0] + (columnWidths[1] > 0 ? gap + columnWidths[1] : 0);
  const positions = sizedPages.map((page, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const columnLeft = column === 0 ? 0 : columnWidths[0] + gap;
    return {
      id: page.id,
      x: columnLeft + (columnWidths[column] - page.width) / 2,
      y: rowTops[row],
      width: page.width,
      height: page.height,
    };
  });
  const contentHeight = sizedPages.length > 0 ? nextY - gap : paddingY;
  return { positions, totalWidth, totalHeight: contentHeight + paddingY, gap, paddingY };
}

/** Capture the document point currently held at a viewport position. */
export function capturePageGeometryAnchor(
  page: PageGeometryFrame,
  viewportPoint: { x: number; y: number },
): PageGeometryAnchor {
  return {
    normalizedX: page.width > 0 ? (viewportPoint.x - page.left) / page.width : 0.5,
    normalizedY: page.height > 0 ? (viewportPoint.y - page.top) / page.height : 0.5,
    viewportX: viewportPoint.x,
    viewportY: viewportPoint.y,
  };
}

/** Scroll delta required to keep a captured page point visually stationary. */
export function resolvePageGeometryScrollDelta(
  anchor: PageGeometryAnchor,
  nextPage: PageGeometryFrame,
): { x: number; y: number } {
  return {
    x: nextPage.left + anchor.normalizedX * nextPage.width - anchor.viewportX,
    y: nextPage.top + anchor.normalizedY * nextPage.height - anchor.viewportY,
  };
}

export function getNotebookPageDefaults(notebook?: Notebook): PagePropertySet {
  return { ...DEFAULT_PAGE_PROPERTY_SET, ...(notebook?.defaultPageProperties ?? {}) };
}

export function resolvePageProperties(
  notebook: Notebook | undefined,
  page: NotebookPage | undefined,
  legacyProperties?: Partial<PagePropertySet>,
): PagePropertySet {
  const defaults = getNotebookPageDefaults(notebook);
  // Metadata with an explicit overrides object uses the new inheritance model.
  // Missing metadata identifies a legacy page whose drawing payload remains the
  // source of its presentation until it is edited or included in apply-to-all.
  return page?.pagePropertyOverrides !== undefined
    ? { ...defaults, ...page.pagePropertyOverrides }
    : { ...defaults, ...(legacyProperties ?? {}) };
}

export function derivePagePropertyOverrides(
  properties: PagePropertySet,
  notebook?: Notebook,
): Partial<PagePropertySet> {
  const defaults = getNotebookPageDefaults(notebook);
  const overrides: Partial<PagePropertySet> = {};
  for (const key of Object.keys(defaults) as (keyof PagePropertySet)[]) {
    if (properties[key] !== defaults[key]) {
      // TypeScript cannot correlate the indexed key/value pair here, but both
      // come from the same PagePropertySet contract.
      (overrides as Record<string, unknown>)[key] = properties[key];
    }
  }
  if (properties.templateFields && Object.keys(properties.templateFields).length > 0) {
    overrides.templateFields = { ...properties.templateFields };
  }
  return overrides;
}
