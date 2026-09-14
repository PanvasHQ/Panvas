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

function expectedMarker(pageNumber) {
  return `PAGE_${String(pageNumber).padStart(2, '0')}`;
}

const editedPages = new Set([1, 8, 15, 25]);
const appliedEdits = new Set();

function editMarker(pageNumber) {
  return `PAGE_${String(pageNumber).padStart(2, '0')}_LIVE_EDIT`;
}

async function readAllMarkers() {
  return page.evaluate(async () => {
    const ids = window.pageIsolationIds;
    return Promise.all(ids.map(async id => {
      const data = await window.pageIsolationRead(id);
      return {
        id,
        objectIds: data.objects.map(object => object.id),
        text: data.objects.find(object => object.type === 'text')?.content?.content?.[0]?.content?.[0]?.text,
        template: data.properties.template,
        paperColor: data.properties.paperColor,
      };
    }));
  });
}

async function assertPersistedMarkers() {
  const rows = await readAllMarkers();
  assert.equal(rows.length, 25);
  for (let index = 0; index < rows.length; index += 1) {
    const marker = expectedMarker(index + 1);
    assert.equal(rows[index].text, marker, `text ownership for page ${index + 1}`);
    const expectedIds = [`${marker}_DRAWING`, `${marker}_TEXT`];
    if (appliedEdits.has(index + 1)) expectedIds.push(editMarker(index + 1));
    assert.deepEqual(rows[index].objectIds.toSorted(), expectedIds.toSorted());
    assert.equal(rows[index].template, (index + 1) % 2 === 0 ? 'Dotted' : 'Ruled', `template ownership for page ${index + 1}`);
    assert.equal(rows[index].paperColor, (index + 1) % 3 === 0 ? '#fff4cc' : '#ffffff', `paper ownership for page ${index + 1}`);
  }
}

try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/notebook-interactions.html?pageIsolation=1`);
  await page.waitForFunction(() => Array.isArray(window.pageIsolationIds) && window.pageIsolationIds.length === 25);
  await page.locator('[data-page-id]').first().waitFor();
  const thumbnails = page.locator('[data-isolation-sidebar] button[draggable="true"]');
  await assert.doesNotReject(() => thumbnails.nth(24).waitFor());
  assert.equal(await thumbnails.count(), 25);
  let thumbnailText = await thumbnails.allTextContents();
  assert.match(thumbnailText[0], /Page 1/);
  assert.match(thumbnailText[24], /Page 25/);

  const localFontLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const bundledFaces = [
      'Inter', 'Newsreader', 'JetBrains Mono', 'Patrick Hand', 'Kalam', 'Caveat',
      'Permanent Marker', 'Shadows Into Light', 'Architects Daughter',
      'Dancing Script', 'Indie Flower', 'Gochi Hand', 'Schoolbell', 'Sacramento',
    ];
    const faceCounts = Object.fromEntries(await Promise.all(bundledFaces.map(async family => [
      family,
      (await document.fonts.load(`32px "${family}"`)).length,
    ])));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const widths = bundledFaces.map(family => {
      context.font = `32px "${family}"`;
      return context.measureText('Panvas handwritten sample 123').width;
    });
    const probe = document.querySelector('[data-font-probe="Sacramento"]');
    return {
      missing: bundledFaces.filter(family => faceCounts[family] === 0),
      family: probe ? getComputedStyle(probe).fontFamily : '',
      uniqueWidths: new Set(widths.map(width => width.toFixed(3))).size,
    };
  });
  assert.deepEqual(localFontLoaded.missing, [], 'every bundled editor face must load locally');
  assert.ok(localFontLoaded.uniqueWidths >= 10, 'font selections must produce distinct glyph metrics');
  assert.match(localFontLoaded.family, /Sacramento/);

  await assertPersistedMarkers();
  for (const pageNumber of Array.from({ length: 25 }, (_, index) => index + 1)) {
    const id = await page.evaluate(index => window.pageIsolationIds[index], pageNumber - 1);
    await page.locator(`[data-page-index="${pageNumber - 1}"]`).first().evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(
      pageId => document.querySelector('[data-focused-sheet="true"]')?.getAttribute('data-scene-owner-sheet-id') === pageId,
      id,
    );
    if (editedPages.has(pageNumber)) {
      await page.waitForFunction(() => typeof window.pageIsolationEdit === 'function');
      const marker = editMarker(pageNumber);
      await page.evaluate(({ pageId, marker: objectId }) => window.pageIsolationEdit(pageId, objectId), { pageId: id, marker });
      await page.waitForFunction(async ({ pageId, marker: objectId }) => {
        const data = await window.pageIsolationRead(pageId);
        return data?.objects?.some(object => object.id === objectId);
      }, { pageId: id, marker });
      appliedEdits.add(pageNumber);
    }
  }

  // Let every delayed persistence callback settle after rapid navigation.
  await page.waitForTimeout(1200);
  await assertPersistedMarkers();

  await page.evaluate(() => window.pageIsolationRemount());
  await page.locator('[data-page-id]').first().waitFor();
  await page.waitForTimeout(900);
  await assertPersistedMarkers();

  const restored = await page.evaluate(async () => {
    const id = window.pageIsolationIds[14];
    return window.pageIsolationDeleteRestore(id);
  });
  assert.deepEqual(restored.objects.map(object => object.id).toSorted(), ['PAGE_15_DRAWING', 'PAGE_15_LIVE_EDIT', 'PAGE_15_TEXT']);

  const reversed = await page.evaluate(() => window.pageIsolationReorder());
  assert.equal(reversed.length, 25);
  await page.waitForTimeout(900);
  thumbnailText = await thumbnails.allTextContents();
  assert.match(thumbnailText[0], /Page 25/);
  assert.match(thumbnailText[24], /Page 1/);
  await assertPersistedMarkers();

  const blankPageId = await page.evaluate(() => window.pageIsolationAddBlank());
  const blank = await page.evaluate(pageId => window.pageIsolationRead(pageId), blankPageId);
  assert.deepEqual(blank.objects, [], 'new page must not inherit page 25 data');

  await page.reload();
  await page.waitForFunction(() => Array.isArray(window.pageIsolationIds) && window.pageIsolationIds.length === 25);
  await page.locator('[data-page-id]').first().waitFor();
  await page.waitForTimeout(900);
  await assertPersistedMarkers();
  assert.deepEqual(errors, []);
  console.log('PASS: all 14 bundled editor fonts loaded with distinct metrics; 25 unique pages and page-keyed thumbnails survived navigation, delayed saves, remount, delete/restore, reorder, blank-page creation, and reload');
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
