import { createHash } from 'node:crypto';
import { access, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const manifestPath = path.join(releaseDir, 'SHA256SUMS.txt');
const releaseBinaryExtensions = new Set(['.appimage', '.deb', '.dmg', '.exe', '.msi', '.pkg', '.rpm', '.tar.gz', '.zip']);

function isReleaseBinary(name) {
  const lowerName = name.toLowerCase();
  return [...releaseBinaryExtensions].some(extension => lowerName.endsWith(extension));
}

async function sha256(filePath) {
  const digest = createHash('sha256');
  digest.update(await readFile(filePath));
  return digest.digest('hex');
}

try {
  await access(releaseDir);
} catch {
  throw new Error('release/ does not exist. Build the release artifact before generating checksums.');
}

const entries = await readdir(releaseDir, { withFileTypes: true });
const binaries = entries
  .filter(entry => entry.isFile() && isReleaseBinary(entry.name))
  .map(entry => entry.name)
  .sort((a, b) => a.localeCompare(b));

if (binaries.length === 0) {
  throw new Error('No release binaries found in release/. Build the release artifact before generating checksums.');
}

const lines = [];
for (const name of binaries) {
  const filePath = path.join(releaseDir, name);
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size === 0) throw new Error(`Release binary is empty: ${name}`);
  lines.push(`${await sha256(filePath)}  ${name}`);
}

await writeFile(manifestPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, manifestPath)} for ${binaries.length} release ${binaries.length === 1 ? 'binary' : 'binaries'}.`);
