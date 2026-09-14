import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.PANVAS_QA_URL || 'http://127.0.0.1:3011';
const artifactDir = 'artifacts/real-regression/notebook-scroll';
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: {
    width: Number(process.env.PANVAS_QA_WIDTH || 1440),
    height: Number(process.env.PANVAS_QA_HEIGHT || 1000),
  },
  deviceScaleFactor: Number(process.env.PANVAS_QA_DPR || 1),
  isMobile: process.env.PANVAS_QA_MOBILE === 'true',
  hasTouch: process.env.PANVAS_QA_MOBILE === 'true',
});
await context.addInitScript(() => {
  localStorage.setItem('panvas-theme', 'ink');
  sessionStorage.setItem('panvas.cloudSyncPromptDismissed', 'true');
  window.__PANVAS_QA_TRACE__ = true;
  window.__realQaTrace = [];
  const events = [];
  window.__realQaNavigation = events;
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function wrappedHistoryMethod(...args) {
      events.push({ method, before: location.pathname, after: String(args[2] ?? location.href), at: Date.now() });
      return original.apply(this, args);
    };
  }
  window.addEventListener('popstate', () => events.push({ method: 'popstate', before: location.pathname, after: location.pathname, at: Date.now() }));
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

async function seedProductionNotebook() {
  await page.goto(`${base}/app/library`);
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();
  return page.evaluate(async () => {
    const { useWorkspaceStore } = await import('/src/stores/workspaceStore.ts');
    const { notebookRepository } = await import('/src/repositories/NotebookRepository.ts');
    const { createEmptyDrawingData } = await import('/src/components/notebook/engine/drawingTypes.ts');
    const store = useWorkspaceStore.getState;
    const workspace = await store().createWorkspace('REAL QA page isolation');
    await store().setActiveWorkspace(workspace.id);
    const notebook = await store().createNotebook(null, 'REAL QA notebook');
    const section = store().notebookSections.find(item => item.notebookId === notebook.id);
    const first = store().notebookPages.find(item => item.sectionId === section.id);
    const pages = [first];
    for (let n = 2; n <= 25; n += 1) {
      pages.push(await notebookRepository.createPage(null, workspace.id, notebook.id, section.id, `REAL QA Page ${n}`));
    }
    const blank = createEmptyDrawingData();
    const orange = createEmptyDrawingData();
    orange.objects = [{ id: 'REAL_ORANGE_AAA', type: 'stroke', tool: 'pen', color: '#ff5a1f', thickness: 48, opacity: 1, createdAt: 1, layerId: 'layer-default', points: [{ x: 160, y: 260, pressure: .8, t: 0 }, { x: 800, y: 260, pressure: .8, t: 20 }] }];
    const green = createEmptyDrawingData();
    green.objects = [{ id: 'REAL_GREEN_CCC', type: 'stroke', tool: 'pen', color: '#1ed760', thickness: 48, opacity: 1, createdAt: 1, layerId: 'layer-default', points: [{ x: 160, y: 260, pressure: .8, t: 0 }, { x: 800, y: 260, pressure: .8, t: 20 }] }];
    await notebookRepository.saveDrawingData(workspace.id, notebook.id, pages[0].id, orange);
    await notebookRepository.saveDrawingData(workspace.id, notebook.id, pages[1].id, blank);
    await notebookRepository.saveDrawingData(workspace.id, notebook.id, pages[2].id, green);
    for (const page of pages.slice(3)) await notebookRepository.saveDrawingData(workspace.id, notebook.id, page.id, blank);
    await store().loadWorkspaceContents(workspace.id);
    await store().setActivePage(pages[0].id, false);
    return { workspaceId: workspace.id, notebookId: notebook.id, pageIds: pages.map(item => item.id) };
  });
}

async function inspectPhysicalPages() {
  return page.evaluate(() => [...document.querySelectorAll('main[aria-label="Notebook pages"] [data-page-index]')].map(container => {
    const surface = container.querySelector('[data-page-id]');
    const canvas = surface?.querySelector('canvas');
    const rect = surface?.getBoundingClientRect();
    return {
      index: Number(container.getAttribute('data-page-index')),
      id: surface?.getAttribute('data-page-id') ?? null,
      focused: container.getAttribute('data-focused-sheet'),
      sceneOwner: surface?.getAttribute('data-scene-owner-page-id') ?? null,
      rendered: surface?.getAttribute('data-rendered-page-id') ?? null,
      ready: surface?.getAttribute('data-render-ready') ?? null,
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    };
  }));
}

async function inspectCanvasColors(ids) {
  return page.evaluate(pageIds => pageIds.map(pageId => {
    const canvases = [...document.querySelectorAll(`canvas[data-rendered-page-id="${pageId}"]`)].filter(node => node instanceof HTMLCanvasElement);
    return {
      pageId,
      canvases: canvases.map(canvas => {
        const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
        let orange = 0;
        let green = 0;
        if (pixels) for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          if (a > 0 && r > 190 && g < 150 && b < 110) orange += 1;
          if (a > 0 && g > 150 && r < 130 && b < 170) green += 1;
        }
        return { width: canvas.width, height: canvas.height, orange, green, ready: canvas.getAttribute('data-render-ready') };
      }),
    };
  }), ids);
}

async function drawProductionStroke(pageId, color) {
  const canvas = page.locator(`canvas[data-rendered-page-id="${pageId}"]`).last();
  await canvas.waitFor();
  const box = await canvas.boundingBox();
  assert.ok(box, `production canvas for ${pageId} must be measurable before drawing`);
  const pointA = { x: box.x + 160, y: box.y + Math.min(620, box.height - 100) };
  const pointB = { x: box.x + 800, y: pointA.y };
  assert.ok(pointA.y < 1000, 'stroke start must be in the real viewport');
  const hit = await page.evaluate(({ x, y }) => {
    const node = document.elementFromPoint(x, y);
    return { tag: node?.tagName ?? null, className: node instanceof Element ? node.className : null };
  }, pointA);
  assert.equal(hit.tag, 'CANVAS', `real stroke must land on the focused canvas (${pageId}), got ${JSON.stringify(hit)}`);
  const before = await page.evaluate(() => window.__realQaNotebookEngine?.drawing.getStrokes().length ?? -1);
  await page.evaluate(({ color }) => {
    const engine = window.__realQaNotebookEngine;
    engine?.tools.setDrawingTool('pen');
    engine?.tools.setColor(color);
    engine?.tools.setThickness(48);
  }, { color });
  await page.keyboard.press('Escape');
  await page.mouse.move(pointA.x, pointA.y);
  await page.mouse.down();
  await page.mouse.move(pointB.x, pointB.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__realQaNotebookEngine?.drawing.getStrokes().length ?? -1);
  console.log('REAL PAGE STROKE', JSON.stringify({ pageId, color, pointA, pointB, hit, before, after }));
  assert.equal(after, before + 1, `real pointer stroke should commit to ${pageId}`);
}

async function screenshotBlankPage(label, blankPageId) {
  const file = `${artifactDir}/${label}.png`;
  const clip = await page.evaluate(pageId => {
    const node = document.querySelector(`main[aria-label="Notebook pages"] #page-${pageId}`);
    if (!(node instanceof HTMLElement)) return null;
    const rect = node.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    if (right <= left || bottom <= top) return null;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }, blankPageId);
  if (!clip) return null;
  const buffer = await page.screenshot({ type: 'png', clip });
  await writeFile(file, buffer);
  const { data, info: rawInfo } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  let orange = 0;
  let green = 0;
  const insetX = Math.max(8, Math.floor(rawInfo.width * 0.08));
  const insetY = Math.min(rawInfo.height, 120);
  for (let y = insetY; y < rawInfo.height - insetY; y += 1) for (let x = insetX; x < rawInfo.width - insetX; x += 1) {
    const offset = (y * rawInfo.width + x) * rawInfo.channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (r > 190 && g < 150 && b < 110) orange += 1;
    if (g > 150 && r < 130 && b < 170) green += 1;
  }
  return { file, orange, green, size: { width: rawInfo.width, height: rawInfo.height } };
}

try {
  const seeded = await seedProductionNotebook();
  if (process.env.PANVAS_QA_ASYNC === 'true') {
    // The hook is installed before the real app navigation so its repository
    // reads survive the document bootstrap and the later reload.
    await page.addInitScript(ids => {
      window.__PANVAS_QA_LOAD_DELAY_MAP__ = Object.fromEntries([
        [ids[0], 520], [ids[1], 24], [ids[2], 260],
      ]);
      window.__realQaLoadCalls = [];
    }, seeded.pageIds.slice(0, 3));
  }
  await page.goto(`${base}/app`);
  await page.locator('main[aria-label="Notebook pages"] [data-focused-sheet="true"]').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('main[aria-label="Notebook pages"] [data-page-index]').length >= 25);
  console.log('REAL QA FLAG', await page.evaluate(() => ({ flag: window.__PANVAS_QA_TRACE__, traceCount: window.__realQaTrace?.length ?? -1 })));

  const pages = await inspectPhysicalPages();
  assert.equal(pages.length, 25, 'real app must render all seeded physical pages');
  const [pageA, pageB, pageC] = seeded.pageIds;
  // Establish the explicit A starting state through the production store so
  // the scroll sequence below cannot inherit a prior bootstrap page choice.
  await page.evaluate(async pageId => {
    const { useWorkspaceStore } = await import('/src/stores/workspaceStore.ts');
    await useWorkspaceStore.getState().setActivePage(pageId, false);
  }, pageA);
  await page.waitForFunction(pageId => document.querySelector(`main[aria-label="Notebook pages"] [data-page-id="${pageId}"][data-focused-sheet="true"]`), pageA);
  console.log('REAL PAGE CANVAS COLORS INITIAL', JSON.stringify(await inspectCanvasColors([pageA, pageB, pageC]), null, 2));
  await drawProductionStroke(pageA, '#ff5a1f');
  await page.waitForTimeout(120);
  const viewport = page.locator('main[aria-label="Notebook pages"]');
  const positions = await viewport.evaluate((node, ids) => {
    const roots = ids.map(id => [...node.querySelectorAll('[data-page-id]')].find(item => item.getAttribute('data-page-id') === id));
    return roots.map(root => root ? node.scrollTop + root.getBoundingClientRect().top - 180 : 0);
  }, [pageA, pageB, pageC]);
  console.log('REAL SCROLL POSITIONS', JSON.stringify(positions));

  const samples = [];
  let traceBeforeReload = [];
  let loadCallsBeforeReload = [];
  const captureB = async (label, target) => {
    const ready = await page.evaluate(pageId => {
      const surface = document.querySelector(`main[aria-label="Notebook pages"] [data-page-id="${pageId}"]`);
      return surface?.getAttribute('data-focused-sheet') === 'true'
        && surface.querySelector('canvas[data-rendered-page-id]')?.getAttribute('data-render-ready') === 'true';
    }, pageB);
    const sample = await screenshotBlankPage(label, pageB);
    if (sample) samples.push({ target, ready: Boolean(ready), ...sample });
  };
  const moveTo = async (target, label) => {
    await viewport.evaluate((node, top) => {
      node.scrollTo({ top, left: 0, behavior: 'instant' });
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, target);
    // Capture both the compositor-adjacent frame and settled frames. The live
    // bug is a transient bitmap leak, so a settled-only assertion is too weak.
    await captureB(`${label}-immediate`, target);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
    await captureB(`${label}-raf`, target);
    await page.waitForTimeout(32);
    await captureB(`${label}-32ms`, target);
    await page.waitForTimeout(220);
    await captureB(`${label}-settled`, target);
  };
  const cycles = Number(process.env.PANVAS_QA_CYCLES || 5);
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const [index, target] of [positions[0], positions[1], positions[2], positions[1], positions[0]].entries()) {
      await moveTo(target, `cycle-${cycle}-${index}`);
    }
  }

  await moveTo(positions[2], 'real-stroke-C');
  await page.waitForFunction(pageId => document.querySelector(`main[aria-label="Notebook pages"] [data-page-id="${pageId}"][data-focused-sheet="true"]`), pageC);
  await drawProductionStroke(pageC, '#1ed760');
  await moveTo(positions[1], 'real-stroke-return-B');

  // Use the production sidebar tree as a second navigation owner. This is
  // intentionally separate from scroll activation because the live report
  // showed the leak after switching away and back through the hierarchy.
  const sidebarPageB = page.getByRole('button', { name: /REAL QA Page 2/i }).first();
  if (await sidebarPageB.count()) {
    await sidebarPageB.click();
    await page.waitForFunction(pageId => document.querySelector(`main[aria-label="Notebook pages"] [data-page-id="${pageId}"][data-focused-sheet="true"]`), pageB);
    await captureB('actual-sidebar-page-B', 'actual-sidebar');
  }

  // Sample the actual B bitmap on every animation frame while the production
  // scroll surface is driven through a rapid A/B/C loop. This catches a
  // one-frame compositor leak that a settled screenshot can miss.
  const frameLeakSamples = await page.evaluate(async ({ tops, blankPageId }) => {
    const viewportNode = document.querySelector('main[aria-label="Notebook pages"]');
    if (!(viewportNode instanceof HTMLElement)) return [];
    const samples = [];
    const inspect = () => {
      const canvases = [...document.querySelectorAll(`main[aria-label="Notebook pages"] [data-page-id="${blankPageId}"] canvas[data-rendered-page-id="${blankPageId}"]`)]
        .filter(node => node instanceof HTMLCanvasElement);
      let orange = 0;
      let green = 0;
      for (const canvas of canvases) {
        const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!pixels) continue;
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          if (a > 0 && r > 190 && g < 150 && b < 110) orange += 1;
          if (a > 0 && g > 150 && r < 130 && b < 170) green += 1;
        }
      }
      samples.push({ top: viewportNode.scrollTop, orange, green, at: performance.now() });
    };
    for (let pass = 0; pass < 3; pass += 1) {
      for (const top of tops) {
        viewportNode.scrollTop = top;
        viewportNode.dispatchEvent(new Event('scroll', { bubbles: true }));
        await new Promise(resolve => requestAnimationFrame(() => { inspect(); resolve(); }));
      }
    }
    return samples;
  }, { tops: [positions[0], positions[1], positions[2], positions[1], positions[0]], blankPageId: pageB });

  // Exercise real page activation, zoom, and layout churn while B remains the
  // pixel target. These are the transitions that can expose stale canvas state
  // even when a normal scroll settles correctly.
  await page.evaluate((id) => {
    const root = document.querySelector(`main[aria-label="Notebook pages"] [data-page-id="${id}"]`);
    (root?.querySelector('[data-page-id]') ?? root)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }));
  }, pageC);
  await page.waitForTimeout(80);
  await moveTo(positions[1], 'sidebar-equivalent-return');
  await page.mouse.wheel(0, -120);
  await page.mouse.wheel(0, 60);
  await moveTo(positions[1], 'wheel-return');
  await viewport.evaluate(node => node.dispatchEvent(new WheelEvent('wheel', { bubbles: true, ctrlKey: true, deltaY: -48, clientX: 500, clientY: 400 })));
  await page.waitForTimeout(100);
  await moveTo(positions[1], 'zoom-return');

  await page.setViewportSize({ width: 1100, height: 760 });
  await page.waitForTimeout(120);
  const resizedPositions = await viewport.evaluate((node, ids) => {
    const roots = ids.map(id => [...node.querySelectorAll('[data-page-id]')].find(item => item.getAttribute('data-page-id') === id));
    return roots.map(root => root ? node.scrollTop + root.getBoundingClientRect().top - 180 : 0);
  }, [pageA, pageB, pageC]);
  await moveTo(resizedPositions[1], 'after-resize');

  // A reload must hydrate the same production repository path, not just retain
  // the current React tree.
  traceBeforeReload = await page.evaluate(() => window.__realQaTrace ?? []);
  loadCallsBeforeReload = await page.evaluate(() => window.__realQaLoadCalls ?? []);
  await page.reload();
  await page.locator('main[aria-label="Notebook pages"] [data-focused-sheet="true"]').waitFor();
  const reloadPositions = await viewport.evaluate((node, ids) => {
    const roots = ids.map(id => [...node.querySelectorAll('[data-page-id]')].find(item => item.getAttribute('data-page-id') === id));
    return roots.map(root => root ? node.scrollTop + root.getBoundingClientRect().top - 180 : 0);
  }, [pageA, pageB, pageC]);
  await moveTo(reloadPositions[1], 'after-reload');

  const diagnostics = {
    seeded,
    pages: await inspectPhysicalPages(),
    samples,
    frameLeakSamples,
    canvasColors: await inspectCanvasColors([pageA, pageB, pageC]),
    trace: [...traceBeforeReload, ...(await page.evaluate(() => window.__realQaTrace ?? []))],
    traceBeforeReload,
    traceAfterReload: await page.evaluate(() => window.__realQaTrace ?? []),
    loadCalls: [...loadCallsBeforeReload, ...(await page.evaluate(() => window.__realQaLoadCalls ?? []))],
    navigation: await page.evaluate(() => window.__realQaNavigation),
    errors: pageErrors,
    url: page.url(),
  };
  await writeFile(`${artifactDir}/diagnostics.json`, JSON.stringify(diagnostics, null, 2));
  console.log(JSON.stringify(diagnostics, null, 2));
  assert.deepEqual(pageErrors, []);
  for (const sample of samples) {
    assert.equal(sample.orange, 0, `PAGE B screenshot contains orange pixels at ${sample.target} (${sample.file})`);
    assert.equal(sample.green, 0, `PAGE B screenshot contains green pixels at ${sample.target} (${sample.file})`);
  }
  for (const sample of frameLeakSamples) {
    assert.equal(sample.orange, 0, `PAGE B animation-frame sample contains orange pixels at scrollTop ${sample.top}`);
    assert.equal(sample.green, 0, `PAGE B animation-frame sample contains green pixels at scrollTop ${sample.top}`);
  }
  console.log('REAL PAGE ISOLATION HARNESS COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
