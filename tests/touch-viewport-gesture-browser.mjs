import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ mode: 'web', server: { port: 0, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/notebook-interactions.html?renderer=1`);
  const canvas = page.locator('main[aria-label="Notebook pages"] canvas').first();
  await canvas.waitFor();
  const bounds = await canvas.boundingBox();
  assert.ok(bounds, 'the notebook canvas needs a visible page surface');

  const origin = page.locator('main[aria-label="Notebook pages"] .origin-top');
  const initialTransform = await origin.getAttribute('style');
  const initialScale = Number(initialTransform?.match(/scale\(([^)]+)\)/)?.[1]);
  assert.ok(Number.isFinite(initialScale), 'the notebook surface needs an initial scale');
  const x = bounds.x + 60;
  const y = bounds.y + 80;

  // A first finger enters the normal draw/select path. The second is captured
  // at the viewport level and promotes the interaction to a two-finger zoom.
  await canvas.dispatchEvent('pointerdown', { pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y });
  await canvas.dispatchEvent('pointerdown', { pointerId: 42, pointerType: 'touch', isPrimary: false, button: 0, buttons: 1, clientX: x + 100, clientY: y });
  await canvas.dispatchEvent('pointermove', { pointerId: 42, pointerType: 'touch', isPrimary: false, button: 0, buttons: 1, clientX: x + 200, clientY: y });

  await page.waitForFunction(scale => {
    const transform = document.querySelector('main[aria-label="Notebook pages"] .origin-top')?.getAttribute('style') ?? '';
    const nextScale = Number(transform.match(/scale\(([^)]+)\)/)?.[1]);
    return Number.isFinite(nextScale) && nextScale >= scale * 1.95;
  }, initialScale);
  const zoomedScale = Number((await origin.getAttribute('style'))?.match(/scale\(([^)]+)\)/)?.[1]);
  assert.ok(Math.abs(zoomedScale - initialScale * 2) < 0.02, 'pinch doubles the page scale from its fitted starting zoom');
  await page.screenshot({ path: 'artifacts/qa-notebook-touch-390.png' });

  await canvas.dispatchEvent('pointerup', { pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, clientX: x, clientY: y });
  await canvas.dispatchEvent('pointerup', { pointerId: 42, pointerType: 'touch', isPrimary: false, button: 0, buttons: 0, clientX: x + 200, clientY: y });
  assert.deepEqual(errors, []);
  console.log('PASS: a two-finger pinch on the notebook page updates the shared viewport without browser errors');
} finally {
  await browser.close();
  await server.close();
}
