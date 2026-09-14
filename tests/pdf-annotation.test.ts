import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sourceRectToVisual,
  sourceToVisual,
  visualDeltaToSource,
  visualPageDimensions,
  visualToSource,
} from '../src/components/notebook/engine/pdfCoordinates.ts';
import { pdfAnnotationStorageId } from '../src/services/search/searchIndexEvents.ts';

const dimensions = { width: 300, height: 500 };
const sourcePoint = { x: 72, y: 144 };

test('PDF source/visual point transforms use real non-square dimensions and round-trip', () => {
  const expected = {
    0: { x: 72, y: 144 },
    90: { x: 356, y: 72 },
    180: { x: 228, y: 356 },
    270: { x: 144, y: 228 },
  } as const;

  for (const rotation of [0, 90, 180, 270] as const) {
    assert.deepEqual(sourceToVisual(sourcePoint, dimensions, rotation), expected[rotation]);
    assert.deepEqual(visualToSource(expected[rotation], dimensions, rotation), sourcePoint);
  }
  assert.deepEqual(visualPageDimensions(dimensions, 0), { width: 300, height: 500 });
  assert.deepEqual(visualPageDimensions(dimensions, 90), { width: 500, height: 300 });
  assert.deepEqual(visualPageDimensions(dimensions, 270), { width: 500, height: 300 });
});

test('PDF source rectangles resolve to rotated visual bounding boxes without mutating canonical coordinates', () => {
  const sourceRect = { x: 20, y: 40, width: 80, height: 30 };
  const expected = {
    0: { x: 20, y: 40, width: 80, height: 30 },
    90: { x: 430, y: 20, width: 30, height: 80 },
    180: { x: 200, y: 430, width: 80, height: 30 },
    270: { x: 40, y: 200, width: 30, height: 80 },
  } as const;

  for (const rotation of [0, 90, 180, 270] as const) {
    assert.deepEqual(sourceRectToVisual(sourceRect, dimensions, rotation), expected[rotation]);
  }
  assert.deepEqual(sourceRect, { x: 20, y: 40, width: 80, height: 30 });
});

test('rotated text placement contract swaps visual bounds while retaining source placement', () => {
  const text = { x: 90, y: 120, width: 160, height: 72 };
  const visual = sourceRectToVisual(text, dimensions, 90);

  assert.deepEqual(visual, { x: 308, y: 90, width: 72, height: 160 });
  assert.deepEqual(text, { x: 90, y: 120, width: 160, height: 72 });
});

test('rotated text resize deltas stay in canonical source axes', () => {
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 0), { x: 5, y: 8 });
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 90), { x: 8, y: -5 });
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 180), { x: -5, y: -8 });
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 270), { x: -8, y: 5 });
});

test('primary and secondary PDF annotations have isolated canonical storage identities', () => {
  const primary = pdfAnnotationStorageId('pdf-owner', 1);
  const secondary = pdfAnnotationStorageId('pdf-owner', 2);
  const persisted = new Map<string, string>();

  persisted.set(primary, 'primary text');
  persisted.set(secondary, 'secondary text');

  assert.notEqual(primary, secondary);
  assert.equal(persisted.get(primary), 'primary text');
  assert.equal(persisted.get(secondary), 'secondary text');
});

test('mixed-rotation two-page spread keeps each page dimensions and text coordinates independent', () => {
  const primary = sourceRectToVisual({ x: 30, y: 40, width: 100, height: 50 }, dimensions, 0);
  const secondary = sourceRectToVisual({ x: 30, y: 40, width: 100, height: 50 }, dimensions, 90);

  assert.deepEqual(primary, { x: 30, y: 40, width: 100, height: 50 });
  assert.deepEqual(secondary, { x: 410, y: 30, width: 50, height: 100 });
  assert.deepEqual(visualPageDimensions(dimensions, 0), { width: 300, height: 500 });
  assert.deepEqual(visualPageDimensions(dimensions, 90), { width: 500, height: 300 });
});

test('annotation export receives canonical source coordinates, not rotated DOM coordinates', () => {
  const canonical = { x: 28, y: 64, width: 140, height: 72 };
  const visual = sourceRectToVisual(canonical, dimensions, 270);

  // The DOM uses visual for placement, while persistence/export continues to use canonical.
  assert.notDeepEqual(visual, canonical);
  assert.deepEqual(canonical, { x: 28, y: 64, width: 140, height: 72 });
});


test('expanded sheets preserve source-relative annotation placement at every rotation', async () => {
  const { pdfExpandedGeometry, pdfSurroundingGeometry } = await import('../src/components/notebook/engine/pdfCoordinates.ts');
  for (const rotation of [0, 90, 180, 270] as const) {
    const geometry = pdfExpandedGeometry(dimensions, rotation, 280);
    const old = sourceToVisual(sourcePoint, dimensions, rotation);
    const expanded = sourceToVisual({ x: sourcePoint.x + geometry.offset.x, y: sourcePoint.y + geometry.offset.y }, geometry.sheet, rotation);
    assert.deepEqual({ x: expanded.x - geometry.pdf.x, y: expanded.y - geometry.pdf.y }, old);
    const note = { x: -80, y: 650 };
    const sheetPoint = { x: note.x + geometry.offset.x, y: note.y + geometry.offset.y };
    const roundTrip = visualToSource(sourceToVisual(sheetPoint, geometry.sheet, rotation), geometry.sheet, rotation);
    assert.deepEqual({ x: roundTrip.x - geometry.offset.x, y: roundTrip.y - geometry.offset.y }, note);
    assert.deepEqual(pdfExpandedGeometry(dimensions, rotation).visual, visualPageDimensions(dimensions, rotation));
  }
  const allSides = pdfSurroundingGeometry(dimensions, 0, { top: 40, right: 50, bottom: 60, left: 70 });
  assert.deepEqual(allSides.sheet, { width: 420, height: 600 });
  assert.deepEqual(allSides.pdf, { x: 70, y: 40, width: 300, height: 500 });
  assert.equal(pdfExpandedGeometry(dimensions, 0, Infinity).extraHeight, 0);
});

test('continuous PDF navigation uses visible geometry and retains the prior page at a shared boundary', async () => {
  const { resolveActivePdfPage } = await import('../src/components/pdf/pdfNavigation.ts');
  const frames = [
    { page: 4, top: 0, bottom: 800 },
    { page: 9, top: 832, bottom: 1632 },
  ];
  assert.equal(resolveActivePdfPage(frames, 0, 700, 4), 4);
  assert.equal(resolveActivePdfPage(frames, 700, 1400, 4), 9);
  assert.equal(resolveActivePdfPage(frames, 766, 866, 4), 4);
  assert.equal(resolveActivePdfPage(frames, 820, 920, 9), 9);
});

test('page/canvas transforms accept objects in every surrounding note region without changing canonical coordinates', async () => {
  const { ViewportManager } = await import('../src/components/notebook/engine/ViewportManager.ts');
  const points = [
    { x: 150, y: -30 },
    { x: 360, y: 140 },
    { x: 150, y: 540 },
    { x: -40, y: 140 },
  ];
  for (const rotation of [0, 90, 180, 270] as const) {
    const viewport = new ViewportManager();
    viewport.setPageCoordinateTransform(rotation, 420, 600, 70, 40);
    for (const point of points) {
      const canvas = viewport.pageToCanvas(point.x, point.y);
      assert.deepEqual(viewport.canvasToPage(canvas.x, canvas.y), point);
    }
  }
});

test('PDF export expands the sheet without scaling the source and retains extension objects', async () => {
  const { PDFDocument } = await import('pdf-lib');
  const { renderPdfAnnotations } = await import('../src/services/pdf/renderPdfAnnotations.ts');
  const { createEmptyDrawingData } = await import('../src/components/notebook/engine/drawingTypes.ts');
  const source = await PDFDocument.create(); source.addPage([300, 500]);
  const drawing = createEmptyDrawingData(); drawing.properties.extraHeight = 280;
  drawing.objects = [{ id: 'extension', type: 'shape', createdAt: 1, shapeType: 'rectangle', x: 20, y: 600, width: 100, height: 40, color: '#000000', fill: null, strokeWidth: 2, rotation: 0 }];
  const result = await renderPdfAnnotations(await source.save(), [JSON.parse(JSON.stringify(drawing))]);
  const output = await PDFDocument.load(result.bytes);
  assert.equal(output.getPage(0).getWidth(), 300);
  assert.equal(output.getPage(0).getHeight(), 780);
  assert.equal(result.exportedObjects, 1);
  assert.equal(source.getPage(0).getHeight(), 500);
});


test('expanded PDF annotation streams are outside the source-content translation', async () => {
  const { PDFDocument, decodePDFRawStream } = await import('pdf-lib');
  const { renderPdfAnnotations } = await import('../src/services/pdf/renderPdfAnnotations.ts');
  const { createEmptyDrawingData } = await import('../src/components/notebook/engine/drawingTypes.ts');
  const source = await PDFDocument.create(); source.addPage([300, 500]);
  const drawing = createEmptyDrawingData(); drawing.properties.extraHeight = 280;
  drawing.objects = [{ id: 'ink', type: 'stroke', createdAt: 1, tool: 'pen', color: '#000000', thickness: 2, opacity: 1, points: [{ x: 20, y: 600, pressure: 0.5, t: 1 }, { x: 80, y: 650, pressure: 0.5, t: 2 }] }];
  const result = await renderPdfAnnotations(await source.save(), [drawing]);
  const output = await PDFDocument.load(result.bytes);
  const commands = output.getPage(0).node.Contents()!.asArray().map(ref => Buffer.from(decodePDFRawStream(output.context.lookup(ref) as any).decode()).toString()).join('\n');
  let matrix = [1, 0, 0, 1, 0, 0]; const stack: number[][] = []; let found = false;
  for (const command of commands.split('\n')) {
    const parts = command.trim().split(/\s+/), op = parts.pop();
    if (op === 'q') stack.push([...matrix]);
    else if (op === 'Q') matrix = stack.pop()!;
    else if (op === 'cm') {
      const [a,b,c,d,e,f] = parts.map(Number), [A,B,C,D,E,F] = matrix;
      matrix = [A*a+C*b, B*a+D*b, A*c+C*d, B*c+D*d, A*e+C*f+E, B*e+D*f+F];
    } else if (op === 'm' && parts[0] === '20' && parts[1] === '600') {
      const [a,b,c,d,e,f] = matrix;
      assert.equal(a*20+c*600+e, 20);
      assert.equal(b*20+d*600+f, 180); // 780 - 600; never translated twice.
      found = true;
    }
  }
  assert.ok(found);
  assert.equal(stack.length, 0);
});
