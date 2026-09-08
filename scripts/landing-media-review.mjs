import { chromium } from 'playwright';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('artifacts/landing-review');
const videoArgument = process.argv.indexOf('--video');
const recording = videoArgument < 0 ? 'C:/Users/sksum/Videos/Screen Recordings/curr update.mp4' : process.argv[videoArgument + 1];
const reviewName = videoArgument < 0 ? 'recording' : path.basename(recording).replace(/\.[^.]+$/, '');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.route('http://media.local/**', async route => {
  const name = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
  const file = name === 'recording.mp4' ? recording : path.join('public/Application SS updated', name);
  await route.fulfill({ body: await readFile(file), headers: {'Access-Control-Allow-Origin':'*'}, contentType: name.endsWith('.mp4') ? (recording.endsWith('.webm') ? 'video/webm' : 'video/mp4') : 'image/png' });
});
await page.setContent('<body style="margin:0;background:#eaf1f6"><canvas id="sheet"></canvas><video id="video" crossorigin="anonymous" muted preload="auto" src="http://media.local/recording.mp4"></video></body>');
try {
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2, { timeout: 15000 });
  const duration = await page.$eval('video', v => v.duration);
  console.log({ duration });
  if (process.argv.includes('--play')) {
    const frames = await page.evaluate(async () => {
      const video=document.querySelector('video'); video.style.cssText='position:fixed;left:0;top:0;width:960px;height:540px';
      const frames=[]; const canvas=document.createElement('canvas');canvas.width=720;canvas.height=405;
      video.currentTime=0;
      const capture=()=>{canvas.getContext('2d').drawImage(video,0,0,720,405);frames.push({time:video.currentTime,src:canvas.toDataURL()});};
      const timer=setInterval(capture,2000);capture();
      const end=new Promise(resolve=>video.addEventListener('ended',resolve,{once:true}));await video.play();await end;capture();clearInterval(timer);
      return frames;
    });
    await page.setContent('<body style="margin:0;background:#edf4f8;font:14px sans-serif"><div id="playback" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div></body>');
    await page.evaluate(frames=>{document.querySelector('#playback').innerHTML=frames.map(f=>`<div>${f.time.toFixed(1)}s<img style="width:100%" src="${f.src}"></div>`).join('');},frames);
    await page.screenshot({path:path.join(output,reviewName+'-playback.png'),fullPage:true});
    await browser.close();
    process.exit(0);
  }
  for (let start = 0; start < duration; start += 24) {
    await page.evaluate(async ({start,duration}) => {
      const video = document.querySelector('video'); const c = document.querySelector('canvas'); c.width=1440; c.height=900;
      const ctx=c.getContext('2d'); ctx.fillStyle='#eaf1f6'; ctx.fillRect(0,0,c.width,c.height);
      for(let i=0;i<12 && start+i*2<duration;i++) {
        const time=Math.min(start+i*2+.01,duration-.05);
        await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=time;});
        const x=(i%3)*480, y=Math.floor(i/3)*225;
        ctx.drawImage(video,x,y+20,480,205);ctx.fillStyle='#111';ctx.font='14px sans-serif';ctx.fillText(time.toFixed(1)+'s',x+8,y+15);
      }
    }, {start,duration});
    await page.locator('canvas').screenshot({path:path.join(output,`recording-${start}.png`)});
  }
} catch(error) {console.log('Video review failed: '+error.message);}
const files=(await readdir('public/Application SS updated')).filter(n=>n.endsWith('.png'));
await page.setContent('<body style="margin:0;background:#eaf1f6"><div id="assets" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px;font:14px sans-serif"></div></body>');
await page.evaluate(files=>{document.querySelector('#assets').innerHTML=files.map(n=>`<figure style="margin:0"><figcaption>${n}</figcaption><img style="width:100%;height:240px;object-fit:contain" src="http://media.local/${encodeURIComponent(n)}"></figure>`).join('');},files);
await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
await page.screenshot({path:path.join(output,'assets.png'),fullPage:true});
await browser.close();
