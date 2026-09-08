import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function shoot(size, name) {
  const port = 9250 + Math.floor(Math.random() * 40);
  const proc = spawn('npx', ['electron', '.', `--remote-debugging-port=${port}`], {
    cwd: process.cwd(), shell: true, stdio: 'ignore',
    env: { ...process.env, PANVAS_TEST_WINDOW: size },
  });
  let browser;
  for (let i = 0; i < 40; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 2500 }); break; } catch { await sleep(700); } }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('index.html'));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('header', { timeout: 30000 });
  await sleep(2500);
  await page.screenshot({ path: `tests/screenshots/${name}.png` });
  const dims = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, root: getComputedStyle(document.documentElement).fontSize }));
  console.log(name, JSON.stringify(dims));
  await browser.close();
  proc.kill();
  const { execSync } = await import('node:child_process');
  try { execSync('taskkill /IM electron.exe /T /F', { stdio: 'ignore' }); } catch {}
  for (let i = 0; i < 8; i++) {
    await sleep(600);
    try {
      const out = execSync('tasklist /FI "IMAGENAME eq electron.exe"', { encoding: 'utf8' });
      if (!out.toLowerCase().includes('electron.exe')) break;
    } catch { break; }
  }
}

// Target matrix from the P0 brief, in CSS px (this display: 1536x960 CSS max)
await shoot('1536x940', 'desktop-1536x940');
await shoot('1440x900', 'desktop-1440x900');
await shoot('1280x800', 'desktop-1280x800');
await shoot('1200x800', 'laptop-1200x800');
await shoot('1024x768', 'laptop-1024x768');
await shoot('900x700', 'small-900x700');
await shoot('820x1000', 'tablet-820x1000');
await shoot('768x900', 'tablet-768x900');
await shoot('680x600', 'narrow-680x600');
await shoot('560x600', 'narrow-560x600');
process.exit(0);
