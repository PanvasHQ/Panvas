import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.PANVAS_QA_URL || 'http://127.0.0.1:3011';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  localStorage.setItem('panvas-theme', 'ink');
  sessionStorage.setItem('panvas.cloudSyncPromptDismissed', 'true');
  const events = [];
  window.__realQaNavigation = events;
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function wrappedHistoryMethod(...args) {
      events.push({ method, before: location.pathname, after: String(args[2] ?? location.href), at: Date.now(), stack: new Error().stack });
      return original.apply(this, args);
    };
  }
  window.addEventListener('popstate', () => events.push({ method: 'popstate', path: location.pathname, at: Date.now() }));
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function cloudHeadingInfo() {
  return page.getByRole('heading', { name: 'Cloud Sync', exact: true }).evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      outerHTML: node.outerHTML,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      connected: node.isConnected,
    };
  }));
}

async function seedNotebook() {
  await page.goto(`${base}/app/library`);
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();
  return page.evaluate(async () => {
    const { useWorkspaceStore } = await import('/src/stores/workspaceStore.ts');
    const store = useWorkspaceStore.getState;
    const workspace = await store().createWorkspace('REAL QA cloud navigation');
    await store().setActiveWorkspace(workspace.id);
    const notebook = await store().createNotebook(null, 'REAL QA cloud notebook');
    const pageId = store().activePageId;
    return { workspaceId: workspace.id, notebookId: notebook.id, pageId };
  });
}

try {
  const seeded = await seedNotebook();
  await page.goto(`${base}/app`);
  await page.locator('[data-focused-sheet="true"]').waitFor();
  const before = { url: page.url(), active: await page.evaluate(() => ({ path: location.pathname, state: (window.__realQaNavigation ?? []).slice() })) };
  const syncButton = page.getByRole('button', { name: 'Open Cloud Sync', exact: true });
  await syncButton.waitFor();
  await syncButton.click();
  const immediate = { url: page.url(), cloudHeading: await cloudHeadingInfo(), state: await page.evaluate(() => ({ path: location.pathname, active: (window.__realQaNavigation ?? []).slice() })) };
  await page.waitForTimeout(10_000);
  const afterWait = { url: page.url(), cloudHeading: await cloudHeadingInfo(), notebookPages: await page.locator('main[aria-label="Notebook pages"]').count(), state: await page.evaluate(() => ({ path: location.pathname, active: (window.__realQaNavigation ?? []).slice() })) };

  const cloudButton = page.getByRole('button', { name: 'Cloud Sync', exact: true }).last();
  if (await cloudButton.count()) await cloudButton.click();
  const afterSidebar = { url: page.url(), cloudHeading: await cloudHeadingInfo(), state: await page.evaluate(() => ({ path: location.pathname, active: (window.__realQaNavigation ?? []).slice() })) };
  // Keep the panel and the V2 runner real, but provide a deterministic
  // isolated connected account so the actual Sync now path can execute
  // without opening OAuth or touching a user's account. The provider is not
  // mocked: the real runner/provider is allowed to complete or report its
  // normal friendly error state.
  await page.evaluate(async () => {
    const trace = window.__realQaCloudTrace = [];
    const { useCloudSyncStore } = await import('/src/stores/cloudSyncStore.ts');
    const { SinglePendingRunner } = await import('/src/services/cloudsync/v2/singlePendingRunner.ts');
    const originalTrigger = useCloudSyncStore.getState().triggerSync;
    useCloudSyncStore.setState({
      triggerSync: async (...args) => {
        trace.push({ type: 'triggerSync-entry', at: Date.now(), args });
        try { return await originalTrigger(...args); }
        finally { trace.push({ type: 'triggerSync-exit', at: Date.now() }); }
      },
      connectionByProvider: {
        ...useCloudSyncStore.getState().connectionByProvider,
        googledrive: { provider: 'googledrive', accountIdentifier: 'qa-account', displayName: 'QA account', email: 'qa@example.invalid', connectedAt: Date.now() },
      },
      statusByProvider: { ...useCloudSyncStore.getState().statusByProvider, googledrive: 'connected' },
      autoSync: false,
    });
    const originalRequest = SinglePendingRunner.prototype.request;
    if (!(SinglePendingRunner.prototype).__realQaWrapped) {
      SinglePendingRunner.prototype.request = function qaRequest(run) {
        trace.push({ type: 'runner-request', at: Date.now() });
        return originalRequest.call(this, async () => {
          trace.push({ type: 'runner-entry', at: Date.now() });
          try { return await run(); }
          finally { trace.push({ type: 'runner-exit', at: Date.now() }); }
        });
      };
      (SinglePendingRunner.prototype).__realQaWrapped = true;
    }
    document.addEventListener('pointerdown', event => {
      if ((event.target instanceof Element) && event.target.closest('button[title="Sync all changes immediately"]')) trace.push({ type: 'button-pointerdown', at: Date.now() });
    }, true);
    document.addEventListener('click', event => {
      if ((event.target instanceof Element) && event.target.closest('button[title="Sync all changes immediately"]')) trace.push({ type: 'button-click', at: Date.now() });
    }, true);
  });
  const syncNow = page.getByRole('button', { name: 'Sync now', exact: true });
  await syncNow.waitFor();
  await syncNow.click();
  await page.waitForFunction(() => {
    const state = window.__realQaCloudTrace ?? [];
    return state.some(item => item.type === 'triggerSync-exit');
  }, null, { timeout: 20_000 });
  const syncFlow = await page.evaluate(async () => {
    const { useCloudSyncStore } = await import('/src/stores/cloudSyncStore.ts');
    return {
      trace: (window.__realQaCloudTrace ?? []).slice(),
      path: location.pathname,
      state: { isSyncing: useCloudSyncStore.getState().isSyncing, status: useCloudSyncStore.getState().statusByProvider.googledrive, lastError: useCloudSyncStore.getState().lastError },
    };
  });
  const diagnostics = { seeded, before, immediate, afterWait, afterSidebar, syncFlow, errors };
  console.log(JSON.stringify(diagnostics, null, 2));
  assert.equal(immediate.url.endsWith('/app/library'), true);
  assert.equal(afterWait.url.endsWith('/app/library'), true);
  assert.equal(await page.locator('#cloud-sync-heading').count(), 1);
  assert.equal(afterWait.cloudHeading.some(item => item.outerHTML.includes('id="cloud-sync-heading"') && item.rect.width > 0 && item.rect.height > 0 && item.visibility !== 'hidden' && item.display !== 'none'), true);
  assert.equal(afterSidebar.url.endsWith('/app/library'), true);
  assert.equal(afterSidebar.cloudHeading.some(item => item.outerHTML.includes('id="cloud-sync-heading"') && item.rect.width > 0 && item.rect.height > 0 && item.visibility !== 'hidden' && item.display !== 'none'), true);
  assert.equal(syncFlow.path.endsWith('/app/library'), true);
  assert.equal(syncFlow.trace.filter(item => item.type === 'button-pointerdown').length, 1);
  assert.equal(syncFlow.trace.filter(item => item.type === 'button-click').length, 1);
  assert.equal(syncFlow.trace.filter(item => item.type === 'triggerSync-entry').length, 1);
  assert.equal(syncFlow.trace.filter(item => item.type === 'triggerSync-exit').length, 1);
  assert.equal(syncFlow.trace.filter(item => item.type === 'runner-request').length, 1);
  assert.equal(syncFlow.trace.filter(item => item.type === 'runner-entry').length, 1);
  assert.equal(syncFlow.trace.filter(item => item.type === 'runner-exit').length, 1);
  assert.deepEqual(errors, []);
  console.log('REAL CLOUD NAVIGATION HARNESS COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
