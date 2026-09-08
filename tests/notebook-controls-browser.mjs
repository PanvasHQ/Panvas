import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import sharp from 'sharp';

const server = await createServer({ mode: 'web', server: { port: 0, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const read = () => page.evaluate(() => structuredClone(window.fixtureEngine.texts.getTexts()[0]));
async function waitData(count) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const data = await page.evaluate(() => window.readFixturePage());
    if (data.objects.length === count) return data;
    await page.waitForTimeout(100);
  }
  throw new Error(`Autosave did not reach ${count} objects`);
}
async function drag(locator, dx, dy) {
  const box = await locator.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}
try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/notebook-interactions.html`);
  const sticky = page.locator('[data-text-object-id="runtime-note"]');
  await sticky.waitFor();
  await page.getByRole('toolbar', { name: 'Sticky note controls' }).waitFor();
  await drag(page.getByLabel('Drag to move'), 60, 40);
  assert.equal((await read()).x, 240);
  assert.equal((await read()).y, 220);
  const beforeResize = await read();
  await drag(sticky.locator('.cursor-nwse-resize').last(), 70, 60);
  assert.equal((await read()).width, beforeResize.width + 70);
  assert.equal((await read()).height, beforeResize.height + 60);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal((await read()).height, beforeResize.height);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal((await read()).height, beforeResize.height + 60);
  for (const shape of ['square', 'rounded-rect', 'rectangle', 'circle', 'oval', 'star']) {
    await page.getByLabel('Sticky note shape').selectOption(shape);
    assert.equal((await read()).metadata.shape, shape);
  }
  const swatch = page.getByRole('button', { name: /sticky note$/ }).last();
  await swatch.click();
  assert.notEqual((await read()).metadata.color, '#fef08a');
  const opacity = page.getByRole('slider', { name: 'Sticky note opacity' });
  for (const value of [50, 20, 100]) {
    await opacity.fill(String(value));
    assert.equal((await read()).metadata.opacity, value / 100);
  }
  await sticky.locator('.ProseMirror').dblclick();
  await sticky.locator('.ProseMirror').fill('Research notes: x = 42');
  await page.getByRole('button', { name: 'Deselect', exact: true }).click();
  assert.equal(await page.getByRole('toolbar', { name: 'Sticky note controls' }).count(), 0);
  await sticky.click();
  await page.getByRole('toolbar', { name: 'Sticky note controls' }).waitFor();
  const saved = await read();
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  assert.deepEqual(await read(), saved);
  await sticky.click();
  await page.getByRole('button', { name: 'Zoom', exact: true }).click();
  const beforeZoomDrag = await read();
  await drag(page.getByLabel('Drag to move'), 60, 30);
  assert.ok(Math.abs((await read()).x - beforeZoomDrag.x - 40) < 1);
  assert.ok(Math.abs((await read()).y - beforeZoomDrag.y - 20) < 1);
  await page.getByRole('button', { name: 'Local Elements', exact: true }).click();
  await page.getByRole('button', { name: 'Save selection', exact: true }).click();
  await page.getByLabel('Element name Element 1').waitFor();
  await page.getByTitle('Insert Element 1').click();
  const copies = await page.evaluate(() => window.fixtureEngine.texts.getTexts());
  assert.equal(copies.length, 2);
  assert.notEqual(copies[0].id, copies[1].id);
  assert.deepEqual(copies[0].metadata, copies[1].metadata);
  assert.deepEqual(copies[0].content, copies[1].content);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByLabel('Lock Content', { exact: true }).click();
  assert.equal(await page.getByRole('toolbar', { name: 'Sticky note controls' }).count(), 0);
  assert.equal(await page.evaluate(() => window.fixtureEngine.layers.isEditable('layer-default')), false);
  await page.getByLabel('Hide Content', { exact: true }).click();
  assert.equal(await page.locator('[data-text-object-id]').count(), 0);
  await page.getByLabel('Show Content', { exact: true }).click();
  await page.getByLabel('Unlock Content', { exact: true }).click();
  assert.equal(await page.locator('[data-text-object-id]').count(), 2);
  await page.screenshot({ path: 'artifacts/notebook-controls-runtime.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: production sticky controls, drag/resize at zoom, style, text, reopen, history, Local Elements roundtrip, layer lock/visibility');
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/notebook-interactions.html?renderer=1`);
  await page.locator('[data-page-id] canvas').first().waitFor();
  await page.waitForTimeout(800);
  const original = await page.evaluate(() => window.readFixturePage());
  assert.equal(original.objects.length, 2);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.keyboard.press('Control+v');
  const pasted = await waitData(4);
  assert.deepEqual(pasted.objects.slice(0, 2), original.objects);
  assert.equal(new Set(pasted.objects.map(object => object.id)).size, 4);
  assert.equal(pasted.objects[2].points[0].x, original.objects[0].points[0].x + 20);
  assert.notEqual(pasted.objects[2].layerId, 'layer-default');
  assert.equal(pasted.objects[2].layerId, pasted.activeLayerId);
  await page.keyboard.press('Control+v');
  await waitData(6);
  await page.keyboard.press('Control+z');
  await waitData(4);
  await page.keyboard.press('Control+Shift+z');
  await waitData(6);
  await page.screenshot({ path: 'artifacts/notebook-clipboard-runtime.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: NotebookRenderer native Ctrl+C / Ctrl+V, repeated paste, new IDs, offsets, originals, autosave, undo/redo');
  const firstPageBeforeSwitch = await page.evaluate(() => window.readFixturePage());
  const firstId = await page.evaluate(() => window.fixturePage.pageId);
  const secondId = await page.evaluate(() => window.createFixturePage());
  await page.evaluate(pageId => window.selectFixturePage(pageId), firstId);
  await page.waitForFunction(pageId => {
    const container = document.querySelector('.notebook-viewport');
    const target = document.querySelector(`[data-page-id="${pageId}"]`);
    if (!container || !target) return false;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return Math.abs(targetRect.top - containerRect.top - 24) < 3;
  }, firstId);
  await page.evaluate(pageId => window.selectFixturePage(pageId), secondId);
  await page.waitForFunction(pageId => {
    const container = document.querySelector('.notebook-viewport');
    const target = document.querySelector(`[data-page-id="${pageId}"]`);
    if (!container || !target) return false;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return Math.abs(targetRect.top - containerRect.top - 24) < 3;
  }, secondId);
  console.log('PASS: external/sidebar-style active-page selection scrolls the notebook viewport');
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await page.locator(`[data-page-id="${secondId}"]`).first().scrollIntoViewIfNeeded();
  await page.locator(`[data-page-id="${secondId}"]`).first().click({ position: { x: 60, y: 80 } });
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+v');
  let secondPage;
  for (let i = 0; i < 60; i++) {
    secondPage = await page.evaluate(() => window.readSecondFixturePage());
    if (secondPage.objects.length === 2) break;
    await page.waitForTimeout(100);
  }
  assert.equal(secondPage.objects.length, 2);
  assert.equal(secondPage.objects[0].layerId, secondPage.activeLayerId);
  assert.deepEqual((await page.evaluate(() => window.readFixturePage())).objects, firstPageBeforeSwitch.objects);
  console.log('PASS: paste targets the new current page/layer without changing the source page');

  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/notebook-interactions.html?layers=1`);
  await page.locator('[data-text-object-id="layer-sticky"]').waitFor();
  const bounds = await page.locator('[data-page-id="layer-page"]').first().boundingBox();
  async function pixel() {
    const buffer = await page.screenshot({ clip: { x: bounds.x + 300, y: bounds.y + 235, width: 1, height: 1 } });
    return [...await sharp(buffer).removeAlpha().raw().toBuffer()];
  }
  const colors = [[254, 240, 138], [230, 57, 70], [40, 100, 220], [32, 160, 96], [112, 64, 192]];
  const types = ['text', 'text', 'image', 'shape', 'stroke'];
  for (let index = 4; index >= 0; index--) {
    await page.waitForTimeout(100);
    const actual = await pixel();
    assert.ok(actual.every((value, channel) => Math.abs(value - colors[4 - index][channel]) < 6), `layer ${index}: pixel ${actual}`);
    assert.equal(await page.evaluate(() => window.fixtureEngine.selection.hitTest(300, 235)?.type), types[4 - index]);
    await page.evaluate(index => window.fixtureEngine.layers.setVisible(window.fixtureLayerIds[index], false), index);
  }
  await page.evaluate(() => window.fixtureLayerIds.forEach(id => window.fixtureEngine.layers.setVisible(id, true)));
  await page.evaluate(() => {
    const engine = window.fixtureEngine;
    for (let n = 0; n < 4; n++) engine.layers.move(window.fixtureLayerIds[0], 1);
  });
  await page.waitForTimeout(100);
  assert.ok((await pixel()).every((value, channel) => Math.abs(value - colors[4][channel]) < 6));
  assert.equal(await page.evaluate(() => window.fixtureEngine.selection.hitTest(300, 235)?.type), 'stroke');
  await page.evaluate(() => window.fixtureEngine.layers.setLocked(window.fixtureLayerIds[0], true));
  assert.equal(await page.evaluate(() => window.fixtureEngine.selection.hitTest(300, 235)?.id), 'layer-sticky');
  await page.evaluate(() => {
    const data = JSON.parse(JSON.stringify(window.fixtureEngine.getDrawingData()));
    window.fixtureEngine.setDrawingData(data, 'layer-page');
  });
  await page.waitForTimeout(100);
  assert.ok((await pixel()).every((value, channel) => Math.abs(value - colors[4][channel]) < 6));
  assert.equal(await page.evaluate(() => window.fixtureEngine.layers.isEditable(window.fixtureLayerIds[0])), false);
  await page.screenshot({ path: 'artifacts/notebook-mixed-layers-runtime.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: pixel-verified five-type layer compositing, visibility, reorder, and matching lock-aware hit testing');
} catch (error) {
  await page.screenshot({ path: 'artifacts/notebook-controls-failure.png' });
  console.error('Browser errors:', errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
