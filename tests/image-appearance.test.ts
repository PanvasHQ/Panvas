import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getImageRenderAppearance } from '../src/components/notebook/engine/imageAppearance.ts';
import { resolveImageToolbarPlacement } from '../src/components/notebook/engine/imageToolbarPlacement.ts';

test('image appearance normalizes persisted opacity and rotation for rendering', () => {
  const appearance = getImageRenderAppearance({ rotation: 30, opacity: 0.4 });
  assert.equal(appearance.opacity, 0.4);
  assert.ok(Math.abs(appearance.rotationRadians - Math.PI / 6) < 0.000001);
  assert.equal(getImageRenderAppearance({ rotation: 0 }).opacity, 1);
  assert.equal(getImageRenderAppearance({ rotation: 0, opacity: 2 }).opacity, 1);
});

test('image controls stay compact and avoid the canvas rotation handle', async () => {
  const source = await readFile(new URL('../src/components/notebook/FloatingImageControls.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label="Crop image"/);
  assert.match(source, /aria-label="Rotate image left 90 degrees"/);
  assert.match(source, /aria-label="Rotate image right 90 degrees"/);
  assert.match(source, /aria-label="Image opacity"/);
  assert.match(source, /resolveImageToolbarPlacement/);
  assert.match(source, /placementRef/);
  assert.match(source, /center\.x \+ 24/);
  assert.ok(!source.includes('<span>Opacity</span>'));
});

test('image contextual placement stays sticky during transforms and falls back only when inaccessible', () => {
  const initial = resolveImageToolbarPlacement({ boundTop: 240, boundBottom: 560, centerX: 500, controlWidth: 278, viewportWidth: 1200, viewportHeight: 800 });
  assert.equal(initial, 'below');
  assert.equal(resolveImageToolbarPlacement({ boundTop: 250, boundBottom: 790, centerX: 500, controlWidth: 278, viewportWidth: 1200, viewportHeight: 800, current: initial }), 'below');
  assert.equal(resolveImageToolbarPlacement({ boundTop: 250, boundBottom: 830, centerX: 500, controlWidth: 278, viewportWidth: 1200, viewportHeight: 800, current: initial }), 'above');
  assert.equal(resolveImageToolbarPlacement({ boundTop: 30, boundBottom: 580, centerX: 20, controlWidth: 278, viewportWidth: 600, viewportHeight: 600 }), 'side');
});


test('crop can restore the original window after repeated edits at every rotation', async () => {
  const { FULL_IMAGE_CROP, getImageCrop, recropImageGeometry } = await import('../src/components/notebook/engine/imageAppearance.ts');
  for (const rotation of [0, 37, 90, 180, 270]) {
    const original = { id: 'image', type: 'image' as const, createdAt: 1, fileId: 'original', x: 80, y: 70, width: 400, height: 300, rotation, opacity: 0.4 };
    let current = { ...original, crop: FULL_IMAGE_CROP };
    for (const crop of [{ x: 0.1, y: 0.2, width: 0.7, height: 0.6 }, { x: 0.2, y: 0, width: 0.8, height: 1 }, FULL_IMAGE_CROP]) {
      current = JSON.parse(JSON.stringify({ ...current, ...recropImageGeometry(current, crop), crop }));
    }
    for (const key of ['x', 'y', 'width', 'height'] as const) assert.ok(Math.abs(current[key] - original[key]) < 1e-8);
    assert.equal(current.fileId, original.fileId);
    assert.equal(current.opacity, 0.4);
    assert.deepEqual(getImageCrop(original), FULL_IMAGE_CROP);
  }
});


test('PDF image export clips the original asset and applies opacity in its rotated frame', async () => {
  const { drawPdfImage } = await import('../src/services/pdf/drawPdfImage.ts');
  const calls: any[] = [], operators: any[] = [];
  const page = { getHeight: () => 800, pushOperators: (...ops: any[]) => operators.push(...ops), drawImage: (asset: unknown, options: unknown) => calls.push({ asset, options }) };
  const asset = {};
  drawPdfImage(page as any, asset as any, { id: 'crop', type: 'image', createdAt: 1, fileId: 'original', x: 10, y: 20, width: 100, height: 60, rotation: 90, opacity: 0.4, crop: { x: 0.2, y: 0.25, width: 0.5, height: 0.5 } });
  assert.equal(calls[0].asset, asset);
  assert.deepEqual(calls[0].options, { x: -90, y: -60, width: 200, height: 120, opacity: 0.4 });
  assert.ok(operators.some(op => op.toString() === 'W'));
  assert.equal(operators[0].toString(), 'q');
  assert.equal(operators[operators.length - 1].toString(), 'Q');
});
