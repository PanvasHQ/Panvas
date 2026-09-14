import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.PANVAS_QA_URL || 'http://127.0.0.1:3011';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  if (!localStorage.getItem('panvas-theme')) localStorage.setItem('panvas-theme', 'eink');
  sessionStorage.setItem('panvas.cloudSyncPromptDismissed', 'true');
});

try {
  await page.goto(`${base}/app/library`);
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();
  await page.evaluate(async () => {
    const { useWorkspaceStore } = await import('/src/stores/workspaceStore.ts');
    const { notebookRepository } = await import('/src/repositories/NotebookRepository.ts');
    const { createEmptyDrawingData } = await import('/src/components/notebook/engine/drawingTypes.ts');
    const store = useWorkspaceStore.getState;
    const workspace = await store().createWorkspace('Field notes');
    await store().setActiveWorkspace(workspace.id);
    const notebook = await store().createNotebook(null, 'Ideas & observations');
    const pageId = store().activePageId;
    const drawing = createEmptyDrawingData();
    drawing.properties = { ...drawing.properties, template: 'Ruled', paperColor: '#faf9f5' };
    drawing.objects = [{ id: 'qa-text', type: 'text', x: 70, y: 100, width: 640, height: 350, createdAt: 1, layerId: 'layer-default', content: { type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'A little room to think' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Capture the idea while it is still fresh.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Make space for sketches, questions, and the next thing you want to explore.' }] },
    ] } }, { id: 'qa-stroke', type: 'stroke', tool: 'pen', color: '#b64e39', opacity: 1, thickness: 5, createdAt: 1, layerId: 'layer-default', points: [{ x: 70, y: 470, pressure: .5, t: 0 }, { x: 330, y: 480, pressure: .8, t: 20 }, { x: 500, y: 460, pressure: .5, t: 40 }] }];
    await notebookRepository.setPagePropertyOverrides(workspace.id, pageId, { paperColor: '#faf9f5', template: 'Ruled' });
    await notebookRepository.saveDrawingData(workspace.id, notebook.id, pageId, drawing);
    const section = store().notebookSections.find(item => item.notebookId === notebook.id);
    await store().createNotebookPage(section.id, 'Next thoughts');
    store().setActivePage(pageId);
    window.qaPageId = pageId;
  });
  await page.goto(`${base}/app`);
  await page.locator('[data-focused-sheet="true"] canvas').first().waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('panvas-theme')), 'ink');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('theme-eink')), true);

  for (const [width, height] of [[320,658],[360,800],[390,844],[440,956],[600,900],[768,1024],[820,1180],[1024,768],[1440,900],[844,390]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async w => {
      const { useUIStore } = await import('/src/stores/uiStore.ts');
      useUIStore.setState({ isSidebarOpen: w >= 820, isPropertiesPanelOpen: false });
    }, width);
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const sheet = document.querySelector('[data-page-index="0"]')?.getBoundingClientRect();
      const viewport = document.querySelector('main[aria-label="Notebook pages"]');
      const toolbar = document.querySelector('.panvas-mobile-tool-dock')?.getBoundingClientRect();
      return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, sheetWidth: sheet?.width, sheetX: sheet?.x, viewportWidth: viewport?.clientWidth, toolbarY: toolbar?.y };
    });
    assert.equal(metrics.overflow, false, `${width}: no browser overflow`);
    if (width < 600) {
      assert.ok(metrics.sheetWidth >= width - 20 && metrics.sheetWidth <= width - 12, `${width}: fit width ${JSON.stringify(metrics)}`);
      assert.ok(metrics.toolbarY > height - 130, 'toolbar occupies a bottom dock');
      assert.equal(await page.locator('.panvas-notebook-chrome').count(), 0);
      for (const name of ['Undo (Ctrl+Z)', 'Redo (Ctrl+Y)', 'Pen and writing settings', 'Select (V)', 'Eraser (E)', 'Text (T)', 'More Tools']) {
        assert.equal(await page.getByRole('button', { name, exact: true }).isVisible(), true, name);
      }
    }
    await page.screenshot({ path: `artifacts/final-ui/notebook-${width}x${height}.png` });
    console.log(JSON.stringify(metrics));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Show library', exact: true }).click();
  assert.equal(await page.locator('main[aria-label="Notebook pages"]').evaluate(el => el.clientWidth), 390, 'drawer reserves zero layout width');
  await page.screenshot({ path: 'artifacts/final-ui/library-drawer-390.png' });
  await page.getByRole('button', { name: 'Close library sidebar' }).click({ position: { x: 375, y: 400 } });
  await page.getByRole('button', { name: 'Open page and view inspector' }).click();
  await page.screenshot({ path: 'artifacts/final-ui/inspector-390.png' });
  await page.getByRole('button', { name: 'Close Page Properties', exact: true }).last().click();
  await page.getByRole('button', { name: 'Pen and writing settings' }).click();
  await page.screenshot({ path: 'artifacts/final-ui/pen-settings-390.png' });
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  // Native Chromium touch input goes through browser hit testing and default
  // gesture arbitration, unlike dispatching synthetic PointerEvents.
  const sheet = page.locator('[data-page-index="0"]');
  const initial = await sheet.boundingBox();
  const cdp = await context.newCDPSession(page);
  const first = { x: 130, y: 360, id: 1 };
  const second = { x: 230, y: 360, id: 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
  for (let step = 1; step <= 5; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...first, x: first.x - step * 8 }, { ...second, x: second.x + step * 8 }] });
    await page.waitForTimeout(40);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const zoomed = await sheet.boundingBox();
  assert.ok(zoomed.width > initial.width * 1.65, 'native page pinch increases document zoom');
  const ratio = zoomed.width / initial.width;
  assert.ok(Math.abs(zoomed.x + (180 - initial.x) * ratio - 180) < 8, 'pinch midpoint stays anchored horizontally');
  assert.ok(Math.abs(zoomed.y + (360 - initial.y) * ratio - 360) < 8, 'pinch midpoint stays anchored vertically');
  assert.equal(await page.evaluate(() => visualViewport.scale), 1, 'browser zoom is not hijacked');
  await page.screenshot({ path: 'artifacts/final-ui/pinch-390.png' });
  await page.getByRole('button', { name: 'Fit page width', exact: true }).click();
  await page.waitForTimeout(150);
  assert.ok(Math.abs((await sheet.boundingBox()).width - 374) < 1, 'fit width resets document zoom');
  await page.getByRole('button', { name: 'More Tools', exact: true }).click();
  await page.screenshot({ path: 'artifacts/final-ui/more-tools-390.png' });
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.goto(`${base}/app/settings/appearance`);
  await page.getByRole('heading', { name: 'Appearance', exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/final-ui/themes-390.png' });
  assert.equal(await page.getByRole('button', { name: /^(Light|Ink|Dark) (Selected theme|Switch theme)$/ }).count(), 3);
  console.log('Browser errors:', errors);
} finally { await browser.close(); }
