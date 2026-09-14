import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.PANVAS_QA_URL || 'http://127.0.0.1:3013';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => {
  if (!localStorage.getItem('panvas-theme')) localStorage.setItem('panvas-theme', 'light');
  sessionStorage.setItem('panvas.cloudSyncPromptDismissed', 'true');
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(`${base}/app/settings/appearance`);
  await page.getByRole('heading', { name: 'Appearance', exact: true }).waitFor();
  const themeButtons = page.getByRole('button').filter({ hasText: /^(Light|Ink|Dark)/ });
  const names = await themeButtons.evaluateAll(nodes => nodes.map(node => node.textContent?.trim().match(/^(Light|Ink|Dark)/)?.[1] ?? ''));
  assert.deepEqual(names.sort(), ['Dark', 'Ink', 'Light']);
  assert.equal(await page.getByText('System', { exact: true }).count(), 0);
  assert.equal(await page.getByText('E-Ink', { exact: true }).count(), 0);
  await page.getByRole('button', { name: /^(Ink)\b/ }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('theme-eink'));
  const ink = await page.evaluate(() => ({
    classes: document.documentElement.className,
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
    storage: localStorage.getItem('panvas-theme'),
  }));
  assert.equal(ink.bg, '216 213 204');
  await page.goto(`${base}/app`);
  await page.waitForTimeout(500);
  const app = await page.evaluate(() => ({
    classes: document.documentElement.className,
    documentTabs: document.querySelectorAll('.panvas-document-tabs').length,
    storage: localStorage.getItem('panvas-theme'),
  }));
  console.log('THEME_TRANSITION', JSON.stringify({ ink, app }, null, 2));
  assert.equal(app.documentTabs, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ names, ink, app, errors }, null, 2));
  console.log('REAL THEME / DOCUMENT TAB HARNESS COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
