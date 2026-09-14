import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Keep Vite's HTML scan scoped to this fixture. The repository also contains
// an unrelated marketing prototype with optional Three.js imports that should
// never be part of a notebook renderer regression run.
const server = await createServer({ mode: 'web', optimizeDeps: { entries: ['tests/fixtures/notebook-interactions.html'] }, server: { port: 0, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function sampleFrame(label) {
  const sample = await page.evaluate(() => {
    const viewport = document.querySelector('main[aria-label="Notebook pages"]');
    const roots = [...document.querySelectorAll('main[aria-label="Notebook pages"] [data-page-index] > [data-page-id]')];
    const focused = roots.find(node => node.parentElement?.getAttribute('data-focused-sheet') === 'true');
    const focusedId = focused?.getAttribute('data-page-id') ?? null;
    const ownership = roots.map(node => ({
      id: node.getAttribute('data-page-id'),
      rendered: node.getAttribute('data-rendered-page-id'),
      owner: node.getAttribute('data-scene-owner-page-id'),
      ready: node.getAttribute('data-render-ready'),
    }));
    const blankIndexes = [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18];
    const alphaFor = index => {
      const canvas = roots[index]?.querySelector('canvas');
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return 0;
      const width = canvas.width;
      const height = canvas.height;
      const pixels = context.getImageData(0, 0, width, height).data;
      let alpha = 0;
      for (let offset = 3; offset < pixels.length; offset += 4 * 16) alpha += pixels[offset] > 0 ? 1 : 0;
      return alpha;
    };
    return {
      scrollTop: viewport?.scrollTop ?? 0,
      focusedId,
      ownership,
      blankAlpha: blankIndexes.map(index => alphaFor(index)),
      blankText: blankIndexes.map(index => roots[index]?.textContent?.includes('VISUAL PAGE') ?? false),
      pageCount: roots.length,
    };
  });
  assert.equal(sample.pageCount, 20, `${label}: expected 20 physical page roots`);
  for (const row of sample.ownership) {
    assert.equal(row.rendered, row.id, `${label}: rendered page must stay keyed to its physical page`);
    if (row.id !== sample.focusedId && row.ready === 'true') assert.equal(row.owner, '', `${label}: inactive page must not claim the shared scene`);
  }
  const focused = sample.ownership.find(row => row.id === sample.focusedId);
  assert.ok(focused, `${label}: focused page exists`);
  assert.equal(focused.ready, 'true', `${label}: focused page is render-ready`);
  assert.equal(focused.owner, focused.id, `${label}: shared engine owner matches focused page`);
  assert.deepEqual(sample.blankAlpha, sample.blankAlpha.map(() => 0), `${label}: blank pages stayed visually blank`);
  assert.deepEqual(sample.blankText, sample.blankText.map(() => false), `${label}: blank pages never exposed another page's text DOM`);
}

async function waitForFocusedReady() {
  await page.waitForFunction(() => {
    const focused = [...document.querySelectorAll('main[aria-label="Notebook pages"] [data-page-index] > [data-page-id]')]
      .find(node => node.parentElement?.getAttribute('data-focused-sheet') === 'true');
    return Boolean(focused
      && focused.getAttribute('data-render-ready') === 'true'
      && focused.getAttribute('data-scene-owner-page-id') === focused.getAttribute('data-page-id'));
  });
}

try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/notebook-interactions.html?visualIsolation=1`);
  await page.waitForFunction(() => Array.isArray(window.visualIsolationIds) && window.visualIsolationIds.length === 20);
  const viewport = page.locator('main[aria-label="Notebook pages"]');
  await viewport.waitFor();
  await page.waitForTimeout(500);

  const positions = await viewport.evaluate(node => [0, node.scrollHeight * .13, node.scrollHeight * .31, node.scrollHeight * .52, node.scrollHeight * .74, node.scrollHeight, node.scrollHeight * .43, node.scrollHeight * .86, 0]);
  for (let index = 0; index < positions.length; index += 1) {
    await viewport.evaluate((node, top) => { node.scrollTop = top; node.dispatchEvent(new Event('scroll', { bubbles: true })); }, positions[index]);
    for (let frame = 0; frame < 3; frame += 1) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
      await sampleFrame(`position ${index}, frame ${frame}`);
    }
  }
  // Exercise the exact A -> empty B -> different C -> B -> A focus path,
  // including a renderer remount and a reload after the scroll pass.
  const ids = await page.evaluate(() => window.visualIsolationIds);
  for (const pageId of [ids[0], ids[1], ids[4], ids[1], ids[0], ids[4], ids[1], ids[0]]) {
    await page.evaluate(id => window.visualIsolationSelect(id), pageId);
    await waitForFocusedReady();
    await sampleFrame(`quick switch ${pageId}`);
  }
  await page.evaluate(() => window.visualIsolationZoom(1.35));
  await waitForFocusedReady();
  await sampleFrame('after zoom');
  await page.setViewportSize({ width: 1100, height: 760 });
  await waitForFocusedReady();
  await sampleFrame('after resize');
  await page.evaluate(() => window.visualIsolationRemount());
  await waitForFocusedReady();
  await sampleFrame('after renderer remount');
  await page.reload();
  await page.waitForFunction(() => Array.isArray(window.visualIsolationIds) && window.visualIsolationIds.length === 20);
  await page.locator('main[aria-label="Notebook pages"]').waitFor();
  await waitForFocusedReady();
  await sampleFrame('after app reload');
  assert.deepEqual(errors, []);
  console.log('PASS: 20-page visual isolation kept every blank page free of ink and text and never exposed a shared scene under another page id during intermediate scroll frames');
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
