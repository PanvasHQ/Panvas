import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const server = await createServer({ mode: 'web', server: { port: 0, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1300 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pixels = async () => {
  const url = await page.evaluate(() => window.renderInk());
  return sharp(Buffer.from(url.split(',')[1], 'base64')).removeAlpha().raw().toBuffer();
};
const pagePoint = (angle, x, y) => {
  const a = angle * Math.PI / 180;
  return { x: 330 + x * Math.cos(a) - y * Math.sin(a), y: 285 + x * Math.sin(a) + y * Math.cos(a) };
};
const sample = (data, p) => {
  const index = (Math.round(p.y) * 700 + Math.round(p.x)) * 3;
  return [...data.subarray(index, index + 3)];
};
const ink = color => color.some(channel => channel < 245);

try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/ruler-eraser.html`);
  await page.waitForFunction(() => Boolean(window.setup));
  const instruments = [
    { tool: 'marker', opacity: 1, thickness: 40 },
    { tool: 'pen', opacity: 1, thickness: 2 },
    { tool: 'pen', opacity: 1, thickness: 60 },
    { tool: 'pencil', opacity: .85, thickness: 6 },
    { tool: 'marker', opacity: .35, thickness: 40, overlap: true },
    { tool: 'highlighter', opacity: .65, thickness: 20, overlap: true },
  ];
  for (const instrument of instruments) for (const angle of [0, 25, 70]) for (const zoom of [.5, 1, 1.5]) {
    await page.evaluate(({ angle, zoom, instrument: s }) => window.setup(angle, zoom, s.tool, s.opacity, s.thickness, s.overlap), { angle, zoom, instrument });
    const before = await pixels();
    const box = await page.locator('#paper').boundingBox();
    const move = async (x, y) => {
      const p = pagePoint(angle, x, y);
      await page.mouse.move(box.x + (p.x + 17) * zoom, box.y + (p.y + 23) * zoom);
    };
    // Actual PointerEvents through InputManager: huge eraser starts ON the ruler,
    // sweeps both ends in one move, then repeats from the other side.
    for (const y of [-5, 5, -40, 40]) {
      await move(-120, y); await page.mouse.down();
      await move(180, y); await move(-180, y);
      await page.mouse.up();
    }
    await page.evaluate(() => { window.engine.ruler.setEnabled(false); window.engine.drawing.redraw(); });
    const after = await pixels();
    for (let x = -120; x <= 120; x += 4) for (let y = -30; y <= 30; y += 3) {
      const p = pagePoint(angle, x, y);
      // Canvas may choose a different raster path with a vector clip. Allow only
      // two 8-bit rounding levels, never lost coverage or an opacity change.
      const original = sample(before, p), retained = sample(after, p);
      assert.ok(retained.every((v, i) => Math.abs(v - original[i]) <= 2), `protected ink changed: ${angle}deg ${zoom}x (${x},${y}) ${original} -> ${retained}`);
    }
    for (let x = -120; x <= 120; x += 8) for (const y of [-50, -36, 36, 50]) {
      const p = pagePoint(angle, x, y);
      if (!ink(sample(before, p))) continue;
      assert.deepEqual(sample(after, p), [255, 255, 255], `exposed ink remains: ${angle}deg ${zoom}x (${x},${y})`);
    }
    for (const x of [-150, 150]) assert.deepEqual(sample(after, pagePoint(angle, x, 0)), [255, 255, 255], 'ruler end left a protected extension');
    const saved = await page.evaluate(() => JSON.parse(JSON.stringify(window.read())));
    assert.ok(saved.objects[0].inkClip?.length, 'saved vector geometry must own the cut');
    await page.evaluate(() => { while(window.engine.history.canUndo()) window.engine.history.undo(); });
    assert.deepEqual(await pixels(), before, 'undo must restore exact rendered alpha');
    await page.evaluate(() => { while(window.engine.history.canRedo()) window.engine.history.redo(); });
    assert.deepEqual(await pixels(), after, 'redo must restore exact vector cut');
    await page.evaluate(data => window.reopen(data), saved);
    assert.deepEqual(await pixels(), after, 'reopen must not bring ink back');
    if (angle === 25 && zoom === 1 && instrument.tool === 'marker' && instrument.opacity === 1) {
      await page.locator('#paper').screenshot({ path: 'artifacts/ruler-mask-browser-canvas.png' });
      await sharp(after, { raw: { width: 700, height: 650, channels: 3 } }).png().toFile('artifacts/ruler-mask-surviving-ink.png');
      await sharp(before, { raw: { width: 700, height: 650, channels: 3 } }).png().toFile('artifacts/ruler-mask-original-ink.png');
    }
    if (zoom === 1.5) {
      await page.evaluate(data => localStorage.setItem('ruler-eraser-regression', JSON.stringify(data)), saved);
      await page.reload();
      await page.waitForFunction(() => Boolean(window.renderInk));
      assert.deepEqual(await pixels(), after, 'full browser reload must retain the exact cut');
    }
    console.log(`PASS real input, shield, both edges/ends, undo/redo/reopen: ${instrument.tool}/${instrument.thickness}/${instrument.opacity} ${angle}deg ${zoom * 100}%`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); await server.close(); }
