import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.PANVAS_QA_URL || 'http://127.0.0.1:3011';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  localStorage.setItem('panvas-theme', 'light');
  sessionStorage.setItem('panvas.cloudSyncPromptDismissed', 'true');
  window.__PANVAS_QA_TRACE__ = true;
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

async function seedEmptyNotebook() {
  await page.goto(`${base}/app/library`);
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();
  return page.evaluate(async () => {
    const { useWorkspaceStore } = await import('/src/stores/workspaceStore.ts');
    const store = useWorkspaceStore.getState;
    const workspace = await store().createWorkspace('REAL QA handwriting');
    await store().setActiveWorkspace(workspace.id);
    const notebook = await store().createNotebook(null, 'REAL QA handwriting notebook');
    const section = store().notebookSections.find(item => item.notebookId === notebook.id);
    const first = store().notebookPages.find(item => item.sectionId === section.id);
    await store().loadWorkspaceContents(workspace.id);
    await store().setActivePage(first.id, false);
    return { workspaceId: workspace.id, notebookId: notebook.id, pageId: first.id };
  });
}

async function stroke(canvas, points) {
  const box = await canvas.boundingBox();
  assert.ok(box, 'focused production canvas must be visible');
  const first = points[0];
  await page.mouse.move(box.x + first[0], box.y + first[1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) await page.mouse.move(box.x + x, box.y + y, { steps: 4 });
  await page.mouse.up();
}

try {
  const seeded = await seedEmptyNotebook();
  await page.goto(`${base}/app`);
  await page.locator(`canvas[data-rendered-page-id="${seeded.pageId}"]`).waitFor();
  const canvas = page.locator(`canvas[data-rendered-page-id="${seeded.pageId}"]`).last();
  console.log('REAL HANDWRITING CANVAS', JSON.stringify(await canvas.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + 240, rect.top + 260);
    return { count: document.querySelectorAll('canvas[data-rendered-page-id]').length, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, pointerEvents: getComputedStyle(node).pointerEvents, hit: hit?.tagName + '.' + hit?.className };
  }), null, 2));
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Pen (P)', exact: true }).first().click();
  // Selecting a tool opens its settings popover in the production toolbar;
  // close that real popover before sending the canvas gesture so the stroke
  // points are not legitimately intercepted by its color controls.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  console.log('REAL HANDWRITING PRE-DRAW', JSON.stringify(await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-rendered-page-id]');
    const engine = window.__realQaNotebookEngine;
    return {
      mode: engine?.tools.getState().mode ?? null,
      drawingTool: engine?.tools.getState().drawingTool ?? null,
      owner: engine?.getDrawingOwnership?.() ?? null,
      canvas: canvas ? { id: canvas.getAttribute('data-rendered-page-id'), rect: canvas.getBoundingClientRect().toJSON(), hit: document.elementFromPoint(canvas.getBoundingClientRect().left + 240, canvas.getBoundingClientRect().top + 260)?.tagName } : null,
    };
  }), null, 2));

  // Draw a real two-stroke “Hi” on the production canvas.
  const box = await canvas.boundingBox();
  assert.ok(box);
  await stroke(canvas, [[240, 260], [240, 380]]);
  await stroke(canvas, [[240, 320], [300, 320]]);
  await stroke(canvas, [[300, 260], [300, 380]]);
  await stroke(canvas, [[340, 320], [340, 380]]);
  await stroke(canvas, [[340, 280], [340, 284]]);
  await page.waitForTimeout(150);
  console.log('REAL HANDWRITING POST-DRAW', JSON.stringify(await page.evaluate(() => {
    const engine = window.__realQaNotebookEngine;
    const canvas = document.querySelector('canvas[data-rendered-page-id]');
    return {
      mode: engine?.tools.getState().mode ?? null,
      owner: engine?.getDrawingOwnership?.() ?? null,
      canvas: canvas ? { rect: canvas.getBoundingClientRect().toJSON(), pointerEvents: getComputedStyle(canvas).pointerEvents, hit: document.elementFromPoint(canvas.getBoundingClientRect().left + 240, canvas.getBoundingClientRect().top + 260)?.className } : null,
      strokes: engine?.drawing.getStrokes().length ?? null,
    };
  }), null, 2));

  await page.getByRole('button', { name: 'Select (V)', exact: true }).first().click();
  const lassoStart = { x: box.x + 190, y: box.y + 210 };
  const lassoEnd = { x: box.x + 390, y: box.y + 430 };
  await page.mouse.move(lassoStart.x, lassoStart.y);
  await page.mouse.down();
  await page.mouse.move(lassoEnd.x, lassoStart.y, { steps: 5 });
  await page.mouse.move(lassoEnd.x, lassoEnd.y, { steps: 5 });
  await page.mouse.move(lassoStart.x, lassoEnd.y, { steps: 5 });
  await page.mouse.move(lassoStart.x, lassoStart.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const convert = page.getByRole('button', { name: 'Convert to Text', exact: true });
  const convertCount = await convert.count();
  const forensic = await page.evaluate(() => {
    const engine = window.__realQaNotebookEngine;
    const canvas = document.querySelector('canvas[data-rendered-page-id]');
    const pixels = canvas instanceof HTMLCanvasElement ? canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data : null;
    let nonTransparent = 0;
    if (pixels) for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) nonTransparent += 1;
    return {
      strokeIds: engine?.drawing.getStrokes().map(stroke => stroke.id) ?? null,
      strokePoints: engine?.drawing.getStrokes().map(stroke => stroke.points.length) ?? null,
      selectedIds: engine?.selection.getSelectedElements().map(element => element.id) ?? null,
      selectedStrokeIds: engine?.selection.getSelectedStrokes().map(stroke => stroke.id) ?? null,
      mode: engine?.tools.getState().mode ?? null,
      handwritingToTextEnabled: engine?.tools.getState().handwritingToTextEnabled ?? null,
      nonTransparent,
      buttons: [...document.querySelectorAll('button')].map(button => button.getAttribute('aria-label') || button.textContent?.trim()).filter(Boolean),
    };
  });
  console.log('REAL HANDWRITING FORENSICS', JSON.stringify(forensic, null, 2));
  const selectedState = await page.locator(`canvas[data-rendered-page-id="${seeded.pageId}"]`).last().evaluate(node => ({
    renderedPage: node.getAttribute('data-rendered-page-id'),
    focused: node.getAttribute('data-render-ready'),
  }));
  assert.ok(convertCount > 0, `real selected handwriting should expose Convert to Text (state=${JSON.stringify(selectedState)}, forensic=${JSON.stringify(forensic)})`);
  await convert.first().click();

  const dialog = page.getByRole('dialog', { name: /Convert to Text/i });
  await dialog.waitFor();
  await page.waitForTimeout(1200);
  const dialogText = await dialog.innerText();
  const lineInputs = dialog.locator('input[id^="recognized-handwriting-line-"]');
  const lineCount = await lineInputs.count();
  const globalError = await dialog.locator('text=Recognition needs attention').count();
  let fontValue = null;
  let normalFontClickError = null;
  if (lineCount > 0) {
    await lineInputs.first().fill('Hi');
    const font = dialog.getByLabel('Conversion font');
    await font.click();
    const fontOption = page.getByRole('option', { name: 'Patrick Hand', exact: true });
    await fontOption.waitFor();
    const optionHitTest = await fontOption.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, hit: hit?.tagName + '.' + hit?.className, zIndex: getComputedStyle(node).zIndex, parentZIndex: getComputedStyle(node.parentElement ?? node).zIndex };
    });
    console.log('REAL HANDWRITING FONT HIT TEST', JSON.stringify(optionHitTest, null, 2));
    try {
      await fontOption.click({ timeout: 2_000 });
    } catch (error) {
      normalFontClickError = error instanceof Error ? error.message : String(error);
      // Keep the forensic run moving on the pre-fix build so the resulting
      // report records the real pointer-interception failure rather than
      // silently converting it into a forced test click.
      await fontOption.click({ force: true });
    }
    fontValue = await font.evaluate(node => node.parentElement?.querySelector('span span')?.textContent?.replace(/\s+(loading|unavailable)$/, '') ?? '');
    const convertButton = dialog.getByRole('button', { name: /Convert \d+ line/ });
    assert.equal(await convertButton.isDisabled(), false, 'reviewed line should enable real conversion');
    await convertButton.click();
    await page.waitForTimeout(350);
  }

  const afterConversion = await page.evaluate(async ({ workspaceId, notebookId, pageId }) => {
    const engine = window.__realQaNotebookEngine;
    const { notebookRepository } = await import('/src/repositories/NotebookRepository.ts');
    const { db } = await import('/src/database/schema.ts');
    const { useCanvasStore } = await import('/src/stores/canvasStore.ts');
    await new Promise(resolve => setTimeout(resolve, 3_000));
    const saved = await notebookRepository.loadDrawingData(workspaceId, notebookId, pageId);
    return {
      engineStrokeIds: engine?.drawing.getStrokes().map(stroke => stroke.id) ?? null,
      engineTextObjects: engine?.texts.getTexts().map(text => ({ id: text.id, metadata: text.metadata, content: text.content })) ?? null,
      selectedIds: engine?.selection.getSelectedElements().map(element => element.id) ?? null,
      canUndo: engine?.history.canUndo() ?? null,
      savedStrokeIds: saved?.objects?.filter(object => object.type === 'stroke').map(object => object.id) ?? [],
      savedTextObjects: saved?.objects?.filter(object => object.type === 'text').map(object => ({ id: object.id, metadata: object.metadata, content: object.content })) ?? [],
      saveStatus: useCanvasStore.getState().saveStatus,
      hasPanvasApi: Boolean(window.panvas),
      directDb: await db.notebookPageDrawings.get(pageId).then(row => row?.data ?? null),
    };
  }, seeded);
  console.log('REAL HANDWRITING AFTER CONVERSION', JSON.stringify(afterConversion, null, 2));
  const textObjectsAfterConversion = await page.locator('[data-text-object-id]').count();

  // Undo through the real notebook keyboard command, then verify both the
  // live engine and the persisted DrawingData returned by the repository.
  await page.locator(`canvas[data-rendered-page-id="${seeded.pageId}"]`).last().focus();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(2_000);
  const afterUndo = await page.evaluate(async ({ workspaceId, notebookId, pageId }) => {
    const engine = window.__realQaNotebookEngine;
    const { notebookRepository } = await import('/src/repositories/NotebookRepository.ts');
    const saved = await notebookRepository.loadDrawingData(workspaceId, notebookId, pageId);
    return {
      engineStrokeIds: engine?.drawing.getStrokes().map(stroke => stroke.id) ?? null,
      engineTextIds: engine?.texts.getTexts().map(text => text.id) ?? null,
      selectedIds: engine?.selection.getSelectedElements().map(element => element.id) ?? null,
      canRedo: engine?.history.canRedo() ?? null,
      savedStrokeIds: saved?.objects?.filter(object => object.type === 'stroke').map(object => object.id) ?? [],
      savedTextIds: saved?.objects?.filter(object => object.type === 'text').map(object => object.id) ?? [],
    };
  }, seeded);
  console.log('REAL HANDWRITING AFTER UNDO', JSON.stringify(afterUndo, null, 2));

  await page.waitForTimeout(2_000);
  const result = {
    pageId: seeded.pageId,
    convertCount,
    dialogText,
    lineCount,
    globalError,
    fontValue,
    normalFontClickError,
    afterConversion,
    afterUndo,
    handwritingTrace: await page.evaluate(() => window.__realQaHandwritingTrace ?? []),
    notebookTrace: await page.evaluate(() => window.__realQaTrace ?? []),
    textObjects: textObjectsAfterConversion,
    textObjectsAfterUndo: await page.locator('[data-text-object-id]').count(),
    textObjectMarkup: await page.locator('[data-text-object-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('data-text-object-id'), text: node.textContent?.trim() ?? '', rect: node.getBoundingClientRect().toJSON() }))),
    focusedSheets: await page.locator('[data-focused-sheet="true"]').evaluateAll(nodes => nodes.map(node => ({ pageId: node.getAttribute('data-page-id'), ready: node.querySelector('[data-render-ready]')?.getAttribute('data-render-ready') }))),
    engineLayers: await page.evaluate(() => window.__realQaNotebookEngine?.layers.getLayers() ?? []),
    errors,
    consoleErrors,
  };
  console.log(JSON.stringify(result, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(lineCount > 0, true, 'real recognition dialog must expose at least one reviewed line');
  assert.equal(fontValue, 'Patrick Hand');
  assert.equal(normalFontClickError, null, 'font option must be reachable by a normal real pointer click');
  assert.ok(result.textObjects > 0, 'real conversion must create a text object in the notebook UI');
  assert.equal(afterConversion.engineStrokeIds?.length, 0, 'conversion must remove selected source strokes from the live engine');
  assert.ok((afterConversion.engineTextObjects?.length ?? 0) > 0, 'conversion must add text to the live engine');
  assert.ok(afterConversion.savedTextObjects.length > 0, 'conversion must persist generated text DrawingData');
  assert.ok(afterUndo.engineStrokeIds && afterUndo.engineStrokeIds.length >= lineCount, 'undo must restore source strokes in the live engine');
  assert.equal(afterUndo.engineTextIds?.length, 0, 'undo must remove generated text from the live engine');
  assert.ok(afterUndo.savedStrokeIds.length >= lineCount, 'undo must persist restored source strokes');
  assert.equal(afterUndo.savedTextIds.length, 0, 'undo must persist removal of generated text');
  assert.ok(result.handwritingTrace.some(entry => entry.event === 'recognition-input'), 'real recognition input must be instrumented');
  assert.ok(result.handwritingTrace.some(entry => entry.event === 'recognition-output'), 'real recognition output must be instrumented');
  console.log('REAL HANDWRITING CONVERSION HARNESS COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
