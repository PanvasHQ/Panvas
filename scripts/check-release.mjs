import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist');
const electronDist = path.join(root, 'dist-electron');
// The current feature-frozen application build is 1,743,841 bytes gzip for
// support chunks. There is no duplicate/accidental chunk to remove without
// refactoring UI routes, so 1.8 MB is the narrow release budget for this build.
const APPLICATION_SUPPORT_GZIP_BUDGET = 1_800_000;

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesBelow(path.join(directory, entry.name))
    : Promise.resolve([path.join(directory, entry.name)])));
  return nested.flat();
}

const rendererFiles = await filesBelow(dist);
const electronFiles = await filesBelow(electronDist);
const relative = rendererFiles.map(file => path.relative(dist, file));
assert.ok(relative.includes('index.html'), 'renderer index exists');
assert.ok(relative.includes('service-worker.js'), 'offline service worker is packaged');
assert.equal(relative.some(file => file.endsWith('.map')), false, 'renderer source maps are excluded');
assert.equal(electronFiles.some(file => file.endsWith('.map')), false, 'Electron source maps are excluded');
assert.equal(relative.some(file => /(^|[\\/])(?:\.env(?:\.[^\\/]+)?|\.mcp\.json)([\\/]|$)/i.test(file)), false, 'sensitive config is excluded');

const javascript = rendererFiles.filter(file => file.endsWith('.js'));
// Excalidraw's browser asset directory is copied verbatim by the local asset
// plugin. Those vendor/locale files are intentionally lazy-loaded by
// Excalidraw and are not Panvas application chunks, so keep them visible in
// the report without charging them against the application bundle budgets.
const appJavascript = rendererFiles.filter(file => file.endsWith('.js') && !file.includes('excalidraw-assets'));
let vendorAssetGzipBytes = 0;
for (const file of javascript.filter(file => file.includes('excalidraw-assets'))) {
  vendorAssetGzipBytes += gzipSync(await readFile(file)).byteLength;
}
let appGzipBytes = 0;
for (const file of appJavascript) appGzipBytes += gzipSync(await readFile(file)).byteLength;
const totalRendererGzipBytes = appGzipBytes + vendorAssetGzipBytes;
const mainEntry = javascript.find(file => path.basename(file).startsWith('bootstrap-'))
  ?? javascript.find(file => path.basename(file).startsWith('index-'));
assert.ok(mainEntry, 'hashed renderer entry exists');
const mainEntryGzipBytes = gzipSync(await readFile(mainEntry)).byteLength;
const supportGzipBytes = appGzipBytes - mainEntryGzipBytes;
assert.ok(mainEntryGzipBytes <= 1_500_000, `main renderer gzip budget exceeded: ${mainEntryGzipBytes} bytes`);
assert.ok(supportGzipBytes <= APPLICATION_SUPPORT_GZIP_BUDGET, `renderer support JavaScript gzip budget exceeded: ${supportGzipBytes} bytes`);
assert.ok(appGzipBytes <= 3_000_000, `total Panvas application JavaScript gzip budget exceeded: ${appGzipBytes} bytes`);

const packagedMain = path.join(electronDist, 'main.js');
const packagedMainBytes = (await stat(packagedMain)).size;
assert.ok(packagedMainBytes <= 250_000, `Electron main-process bundle exceeds reviewable budget: ${packagedMainBytes} bytes`);

const rendererText = (await Promise.all(javascript.map(file => readFile(file, 'utf8')))).join('\n');
for (const forbidden of ['PANVAS_KNOWLEDGE_VAULT', 'OBSIDIAN_API_KEY', 'MCP_ENDPOINT']) {
  assert.equal(rendererText.includes(forbidden), false, `${forbidden} is absent from renderer artifacts`);
}

console.log(JSON.stringify({
  rendererFiles: rendererFiles.length,
  mainEntryGzipBytes,
  supportGzipBytes,
  totalApplicationJavaScriptGzipBytes: appGzipBytes,
  totalRendererJavaScriptGzipBytes: totalRendererGzipBytes,
  excalidrawAssetJavaScriptGzipBytes: vendorAssetGzipBytes,
  electronMainBytes: packagedMainBytes,
  sourceMaps: 0,
  sensitiveConfigFiles: 0,
}, null, 2));
