import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ mode: 'web', server: { port: 0, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function persistedObjectIds(id) {
  return page.evaluate(async pageId => {
    const data = await window.recordingFlowRead(pageId);
    return (data?.objects ?? []).map(object => object.id).sort();
  }, id);
}

async function visibleInk(index) {
  return page.locator(`[data-page-index="${index}"] canvas`).evaluateAll(canvases => Math.max(0, ...canvases.map(canvas => {
    const context = canvas.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3] > 0) colored += 1;
    }
    return colored;
  })));
}

async function scrollTo(index) {
  await page.locator(`[data-page-index="${index}"]`).first().evaluate(element => element.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
}

try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/notebook-interactions.html?recordingFlow=1`);
  await page.waitForFunction(() => Array.isArray(window.recordingFlowIds) && window.recordingFlowIds.length === 3);
  await page.locator('[aria-label="Notebook pages"]').waitFor();
  const ids = await page.evaluate(() => window.recordingFlowIds);
  await page.waitForFunction(ownerId => document.querySelector('[data-focused-sheet="true"]')?.getAttribute('data-scene-owner-sheet-id') === ownerId, ids[1]);
  for (let attempt = 0; attempt < 20 && await visibleInk(1) === 0; attempt += 1) await page.waitForTimeout(100);
  await scrollTo(1);
  await page.waitForFunction(() => typeof window.recordingFlowDraw === 'function');
  await page.evaluate(() => window.recordingFlowDraw());
  await page.waitForTimeout(1200);
  const ownerObjectsAfterDraw = await persistedObjectIds(ids[1]);
  assert.ok(ownerObjectsAfterDraw.includes('RECORDING_GREEN'));
  assert.ok(ownerObjectsAfterDraw.includes('RECORDING_ORANGE'));
  assert.ok(ownerObjectsAfterDraw.includes('RECORDING_LIVE_STROKE'), 'a live-engine edit must persist on the owning sheet');

  await scrollTo(0);
  await scrollTo(1);
  await scrollTo(2);
  await scrollTo(1);
  assert.ok(await visibleInk(1) > 0, 'the orange/green drawing must render on its owning sheet');
  assert.equal(await visibleInk(0), 0, 'sheet 1 must stay visually blank');
  assert.equal(await visibleInk(2), 0, 'sheet 3 must stay visually blank');

  await scrollTo(2);
  await page.getByRole('button', { name: 'Insert page after current page' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-page-index]').length >= 4);
  for (const index of [1, 2, 3, 2, 1, 3]) await scrollTo(index);
  await page.waitForTimeout(1300);

  assert.ok(await visibleInk(1) > 0, 'the owning sheet must retain its drawing after 3 to 4 insertion');
  assert.equal(await visibleInk(0), 0, 'sheet 1 must remain visually blank after insertion');
  assert.equal(await visibleInk(2), 0, 'sheet 3 must remain visually blank after insertion');
  assert.equal(await visibleInk(3), 0, 'new sheet 4 must render blank');
  assert.deepEqual(await persistedObjectIds(ids[0]), [], 'sheet 1 persistence must remain blank');
  assert.deepEqual(await persistedObjectIds(ids[1]), ownerObjectsAfterDraw);
  assert.deepEqual(await persistedObjectIds(ids[2]), [], 'sheet 3 persistence must remain blank');
  assert.deepEqual(errors, []);
  console.log('PASS: exact recording flow preserves orange/green drawing ownership across 3 to 4 sheet insertion');
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
