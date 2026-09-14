import { rgb, type PDFPage } from 'pdf-lib';
import type { Shape } from '../../components/notebook/engine/drawingTypes.ts';
import { buildLineStyleGeometry } from '../../components/notebook/engine/lineStyleGeometry.ts';
export function drawPdfLine(page: PDFPage, shape: Shape, sx = 1, sy = 1) {
  const geometry = buildLineStyleGeometry(shape);
  const hex = /^#[\da-f]{6}$/i.test(shape.color) ? shape.color.slice(1) : '20242a';
  const color = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4), 16) / 255);
  const opacity = shape.opacity ?? 1;
  const point = (p: { x: number; y: number }) => ({ x: p.x * sx, y: page.getHeight() - p.y * sy });
  for (const path of geometry.paths) for (let i = 1; i < path.length; i++) page.drawLine({ start: point(path[i - 1]), end: point(path[i]), thickness: shape.strokeWidth * (sx + sy) / 2, color, opacity, lineCap: 1 });
  for (const dot of geometry.dots) page.drawCircle({ ...point(dot), size: geometry.radius * (sx + sy) / 2, color, opacity });
}
