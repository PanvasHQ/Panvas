import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.PANVAS_QA_URL || 'http://127.0.0.1:3011';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(20000);
await context.addInitScript(() => { localStorage.setItem('panvas-theme','ink'); sessionStorage.setItem('panvas.cloudSyncPromptDismissed','true'); });
const screenshot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: `artifacts/final-ui/${name}-390.png` }); };
try {
  await page.goto(`${base}/app/library`);
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New Notebook' }).click();
  await page.locator('#create-dialog-input').waitFor();
  await screenshot('create');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Search Panvas', exact: true }).click();
  await screenshot('search');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open Cloud Sync', exact: true }).click();
  await page.getByRole('heading', { name: 'Cloud Sync', exact: true }).first().waitFor();
  await screenshot('cloud');
  await page.evaluate(async () => {
    const { useWorkspaceStore } = await import('/src/stores/workspaceStore.ts');
    const { notebookRepository } = await import('/src/repositories/NotebookRepository.ts');
    const { storePdfFile } = await import('/src/database/canvasDB.ts');
    const store = useWorkspaceStore.getState;
    const workspace = await store().createWorkspace('Reading');
    await store().setActiveWorkspace(workspace.id);
    const notebook = await store().createNotebook(null, 'Research notes');
    const section = store().notebookSections.find(item => item.notebookId === notebook.id);
    const data = await (await fetch('/tests/fixtures/pipeline-test.pdf')).arrayBuffer();
    const pdf = await storePdfFile(null, notebook.id, 'Research.pdf', data);
    const pdfPage = await notebookRepository.createPage(null, workspace.id, notebook.id, section.id, 'Research.pdf', 'pdf', pdf.id);
    await store().loadWorkspaceContents(workspace.id);
    await store().setActivePage(pdfPage.id);
  });
  await page.goto(`${base}/app`);
  await page.locator('[data-pdf-source-page] canvas').first().waitFor();
  await page.waitForTimeout(500);
  const pdf = page.locator('[data-pdf-source-page]').first();
  const box = await pdf.boundingBox();
  assert.ok(box.width >= 370 && box.width <= 375, `PDF fit width ${box.width}`);
  await screenshot('pdf');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart',touchPoints:[{x:100,y:350,id:1},{x:220,y:350,id:2}] });
  for (let n=1;n<=5;n++) {
    await cdp.send('Input.dispatchTouchEvent', { type:'touchMove',touchPoints:[{x:100-n*5,y:350,id:1},{x:220+n*5,y:350,id:2}] });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd',touchPoints:[] });
  await page.waitForTimeout(150);
  assert.ok((await pdf.boundingBox()).width > box.width * 1.25, 'PDF native pinch on page');
  await page.getByRole('button',{name:'Fit PDF width'}).click();
  await page.getByRole('button',{name:'PDF pages',exact:true}).click();
  await screenshot('pdf-thumbnails');
  await page.keyboard.press('Escape');
  // Reopen the document to reset only transient QA panel state.
  await page.goto(`${base}/app`);
  await page.getByRole('button',{name:'PDF page controls',exact:true}).waitFor();
  await page.getByRole('button',{name:'PDF page controls',exact:true}).click();
  await screenshot('pdf-controls');
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export annotated PDF',exact:true}).click();
  assert.ok((await download).suggestedFilename().endsWith('.pdf'));
  const canvasId = await page.evaluate(async () => {
    const { useWorkspaceStore } = await import('/src/stores/workspaceStore.ts');
    const store = useWorkspaceStore.getState;
    const workspace = await store().createWorkspace('Canvas QA');
    await store().setActiveWorkspace(workspace.id);
    const canvas = await store().createCanvas(null, null, null, 'Canvas surface QA');
    await store().setActiveCanvas(canvas.id);
    return canvas.id;
  });
  await page.waitForFunction(async id => {
    const state = (await import('/src/stores/workspaceStore.ts')).useWorkspaceStore.getState();
    return state.activeCanvasId === id && !state.activePageId;
  }, canvasId);
  await page.goto(`${base}/app`);
  await page.getByRole('button',{name:'Draw (P / 7)',exact:true}).waitFor();
  await page.waitForFunction(async () => Boolean((await import('/src/stores/canvasStore.ts')).useCanvasStore.getState().excalidrawAPI));
  await page.getByRole('button',{name:'Draw (P / 7)',exact:true}).click();
  await page.mouse.move(100,300); await page.mouse.down(); await page.mouse.move(220,420,{steps:15}); await page.mouse.up();
  const sceneCount = await page.evaluate(async () => (await import('/src/stores/canvasStore.ts')).useCanvasStore.getState().excalidrawAPI.getSceneElements().filter(element => !element.isDeleted).length);
  assert.ok(sceneCount > 0, 'actual Excalidraw drawing is reachable');
  await screenshot('canvas');
  const initialCanvasZoom = await page.evaluate(async () => (await import('/src/stores/canvasStore.ts')).useCanvasStore.getState().excalidrawAPI.getAppState().zoom.value);
  const cdpCanvas = await context.newCDPSession(page);
  await cdpCanvas.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:600,id:1},{x:220,y:600,id:2}]});
  for(let n=1;n<=4;n++) { await cdpCanvas.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100-n*6,y:600,id:1},{x:220+n*6,y:600,id:2}]}); await page.waitForTimeout(40); }
  await cdpCanvas.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(async z => (await import('/src/stores/canvasStore.ts')).useCanvasStore.getState().excalidrawAPI.getAppState().zoom.value > z, initialCanvasZoom), 'native Excalidraw pinch');
  await page.getByRole('button',{name:'More canvas tools',exact:true}).click();
  await screenshot('canvas-more');
  await page.getByRole('menuitem',{name:'Canvas settings',exact:true}).click();
  await screenshot('canvas-settings');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors, []);
  console.log('PASS: dialogs, Cloud, PDF fit/pinch/export and live Canvas drawing/pinch');
} catch(error) { await screenshot('surface-failure'); console.log('PAGE ERRORS',errors); throw error; }
finally { await browser.close(); }
