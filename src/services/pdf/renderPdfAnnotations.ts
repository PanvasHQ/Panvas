import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DrawingData, NotebookObject, Shape, Stroke, TextObject } from '../../components/notebook/engine/drawingTypes';
import type { PdfPageState } from '@/types/notebook';
import { normalizePdfPageState } from './pdfPageOperations.ts';

export interface PdfAnnotationRenderResult {
  bytes: Uint8Array;
  exportedObjects: number;
  unsupportedObjects: number;
  warnings: string[];
}

function color(value: string | undefined) {
  const normalized = /^#[0-9a-f]{6}$/i.test(value ?? '') ? value!.slice(1) : '20242a';
  return rgb(Number.parseInt(normalized.slice(0, 2), 16) / 255, Number.parseInt(normalized.slice(2, 4), 16) / 255, Number.parseInt(normalized.slice(4, 6), 16) / 255);
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return `${typeof record.text === 'string' ? record.text : ''}${textContent(record.content)}`;
}

function drawStroke(page: PDFPage, stroke: Stroke): number {
  if (stroke.points.length < 2) return 0;
  const height = page.getHeight();
  for (let index = 1; index < stroke.points.length; index += 1) {
    const start = stroke.points[index - 1];
    const end = stroke.points[index];
    page.drawLine({
      start: { x: start.x, y: height - start.y },
      end: { x: end.x, y: height - end.y },
      thickness: Math.max(0.5, stroke.thickness),
      color: color(stroke.color),
      opacity: Math.max(0, Math.min(1, stroke.opacity)),
    });
  }
  return 1;
}

function drawShape(page: PDFPage, shape: Shape): boolean {
  const pageHeight = page.getHeight();
  const common = { borderColor: color(shape.color), borderWidth: Math.max(0.5, shape.strokeWidth), opacity: 1 };
  if (shape.shapeType === 'rectangle' || shape.shapeType === 'rounded-rectangle') {
    page.drawRectangle({ x: shape.x, y: pageHeight - shape.y - shape.height, width: Math.abs(shape.width), height: Math.abs(shape.height), ...common, opacity: shape.opacity ?? 1, ...(shape.fill ? { color: color(shape.fill) } : {}) });
    return true;
  }
  if (shape.shapeType === 'ellipse') {
    page.drawEllipse({ x: shape.x + shape.width / 2, y: pageHeight - shape.y - shape.height / 2, xScale: Math.abs(shape.width / 2), yScale: Math.abs(shape.height / 2), ...common, opacity: shape.opacity ?? 1, ...(shape.fill ? { color: color(shape.fill) } : {}) });
    return true;
  }
  if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
    const start = { x: shape.x, y: pageHeight - shape.y };
    const end = { x: shape.x + shape.width, y: pageHeight - shape.y - shape.height };
    page.drawLine({ start, end, thickness: Math.max(0.5, shape.strokeWidth), color: color(shape.color) });
    if (shape.shapeType === 'arrow') {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const size = Math.max(8, shape.strokeWidth * 4);
      for (const offset of [-Math.PI / 6, Math.PI / 6]) {
        page.drawLine({ start: end, end: { x: end.x - Math.cos(angle + offset) * size, y: end.y - Math.sin(angle + offset) * size }, thickness: Math.max(0.5, shape.strokeWidth), color: color(shape.color) });
      }
    }
    return true;
  }
  return false;
}

function drawText(page: PDFPage, object: TextObject, font: PDFFont): boolean {
  const text = textContent(object.content).replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const fontSize = 12;
  const maxCharacters = Math.max(8, Math.floor((object.width || 240) / (fontSize * 0.55)));
  const lines = text.match(new RegExp(`.{1,${maxCharacters}}(?:\\s|$)`, 'g'))?.map(line => line.trim()).filter(Boolean) ?? [text];
  page.drawText(lines.slice(0, 40).join('\n'), { x: object.x, y: page.getHeight() - object.y - fontSize, size: fontSize, font, color: color('#20242a'), lineHeight: 15, maxWidth: object.width || 240 });
  return true;
}

export async function renderPdfAnnotations(
  originalBytes: ArrayBuffer | Uint8Array,
  drawingsByPage: ReadonlyArray<DrawingData | null>,
  pageState?: PdfPageState,
): Promise<PdfAnnotationRenderResult> {
  const document = await PDFDocument.load(originalBytes, { ignoreEncryption: false });
  const normalizedState = normalizePdfPageState(pageState, document.getPageCount());
  const sourcePages = document.getPages();
  const orderedPages = await document.copyPages(document, normalizedState.pageOrder.map(page => page - 1));
  document.removePage(0);
  while (document.getPageCount() > 0) document.removePage(0);
  orderedPages.forEach(page => document.addPage(page));
  const font = await document.embedFont(StandardFonts.Helvetica);
  let exportedObjects = 0;
  let unsupportedObjects = 0;

  for (let pageIndex = 0; pageIndex < document.getPageCount(); pageIndex += 1) {
    const sourcePageNumber = normalizedState.pageOrder[pageIndex];
    const drawing = drawingsByPage[sourcePageNumber - 1];
    const visibility = new Map((drawing?.layers ?? []).map(layer => [layer.id, layer.visible !== false]));
    const objects = (drawing?.objects ?? []).filter(object => visibility.get(object.layerId ?? 'layer-default') !== false);
    const pdfPage = document.getPage(pageIndex);
    const intrinsicRotation = sourcePages[sourcePageNumber - 1]?.getRotation().angle ?? 0;
    const requestedRotation = normalizedState.rotations[sourcePageNumber] ?? 0;
    if (requestedRotation) pdfPage.setRotation(degrees((intrinsicRotation + requestedRotation) % 360));
    for (const object of objects as NotebookObject[]) {
      if (object.type === 'stroke') exportedObjects += drawStroke(pdfPage, object);
      else if (object.type === 'shape' && drawShape(pdfPage, object)) exportedObjects += 1;
      else if (object.type === 'text' && drawText(pdfPage, object, font)) exportedObjects += 1;
      else unsupportedObjects += 1;
    }
    unsupportedObjects += drawing?.audioNotes?.length ?? 0;
  }

  return {
    bytes: await document.save(),
    exportedObjects,
    unsupportedObjects,
    warnings: unsupportedObjects > 0
      ? [`${unsupportedObjects} unsupported annotation or attachment object(s) were not included. Image/table/code/callout/sticky/audio/attachment and triangle/diamond overlays are not yet exported.`]
      : [],
  };
}
