import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const server = await createServer({
  configFile: false,
  envFile: false,
  mode: 'web',
  optimizeDeps: { entries: ['tests/fixtures/cloud-sync-interaction.html'] },
  resolve: { alias: { '@': path.resolve('src') } },
  server: { port: 0, open: false },
  plugins: [react(), {
    name: 'cloud-sync-test-state',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/components/library/CloudSyncPanel.tsx')) return;
      return code
        .replace(/import \{ useCloudSyncStore \} from [^;]+;/, 'const useCloudSyncStore = () => globalThis.__syncPanelState; useCloudSyncStore.getState = () => globalThis.__syncPanelState;')
        .replace(/import \{ useUIStore \} from [^;]+;/, 'const useUIStore = selector => selector(globalThis.__syncPanelUiState);')
        .replaceAll('import.meta.env.DEV', 'false');
    },
  }],
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(`${server.resolvedUrls.local[0]}tests/fixtures/cloud-sync-interaction.html`);
  const button = page.getByRole('button', { name: 'Sync now' });
  await button.waitFor();
  await button.dblclick({ delay: 0 });
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => globalThis.__syncPanelCount()), 1, 'one user gesture must invoke the V2 runner once');
  assert.deepEqual(errors, []);
  console.log('PASS: Cloud Sync Sync now invokes the existing runner exactly once for a rapid double interaction');
} finally {
  await browser.close();
  await server.close();
}
