import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist');
const electronDist = path.join(root, 'dist-electron');

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
assert.equal(relative.some(file => /(^|[\\/])(\.env|\.mcp\.json)([\\/]|$)/i.test(file)), false, 'sensitive config is excluded');

const javascript = rendererFiles.filter(file => file.endsWith('.js'));
const appJavascript = rendererFiles.filter(file => file.endsWith('.js') && !file.includes('excalidraw-assets'));
let totalGzipBytes = 0;
for (const file of javascript) totalGzipBytes += gzipSync(await readFile(file)).byteLength;
let appGzipBytes = 0;
for (const file of appJavascript) appGzipBytes += gzipSync(await readFile(file)).byteLength;
const mainEntry = javascript.find(file => path.basename(file).startsWith('bootstrap-'))
  ?? javascript.find(file => path.basename(file).startsWith('index-'));
assert.ok(mainEntry, 'hashed renderer entry exists');
const mainEntryGzipBytes = gzipSync(await readFile(mainEntry)).byteLength;
const supportGzipBytes = appGzipBytes - mainEntryGzipBytes;
assert.ok(mainEntryGzipBytes <= 1_500_000, `main renderer gzip budget exceeded: ${mainEntryGzipBytes} bytes`);
assert.ok(supportGzipBytes <= 1_500_000, `renderer support JavaScript gzip budget exceeded: ${supportGzipBytes} bytes`);
assert.ok(totalGzipBytes <= 3_000_000, `total renderer JavaScript gzip budget exceeded: ${totalGzipBytes} bytes`);

const packagedMain = path.join(electronDist, 'main.js');
assert.ok((await stat(packagedMain)).size <= 250_000, 'Electron main-process bundle stays within reviewable budget');

const rendererText = (await Promise.all(javascript.map(file => readFile(file, 'utf8')))).join('\n');
for (const forbidden of ['PANVAS_KNOWLEDGE_VAULT', 'OBSIDIAN_API_KEY', 'MCP_ENDPOINT']) {
  assert.equal(rendererText.includes(forbidden), false, `${forbidden} is absent from renderer artifacts`);
}

console.log(JSON.stringify({
  rendererFiles: rendererFiles.length,
  mainEntryGzipBytes,
  supportGzipBytes,
  totalJavaScriptGzipBytes: totalGzipBytes,
  electronMainBytes: (await stat(packagedMain)).size,
  sourceMaps: 0,
  sensitiveConfigFiles: 0,
}, null, 2));
