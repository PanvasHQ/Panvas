import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const out = path.resolve('artifacts/landing-review');
await mkdir(out, { recursive: true });
const quick = process.argv.includes('--quick');
const url = process.env.PANVAS_QA_URL || 'http://127.0.0.1:4173/#/landing';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const [name, viewport] of [['desktop', {width:1440,height:900}], ['mobile', {width:390,height:844}]]) {
    const context = await browser.newContext({viewport, deviceScaleFactor:1, isMobile:name==='mobile', hasTouch:name==='mobile', ...(quick ? {} : {recordVideo:{dir:out,size:viewport}})});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.addInitScript(() => {
      window.__landingVitals={cls:0,lcp:0,longTasks:[],frames:[]};
      new PerformanceObserver(list=>{for(const e of list.getEntries())window.__landingVitals.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) window.__landingVitals.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
      new PerformanceObserver(list=>{for(const e of list.getEntries()) window.__landingVitals.longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});
    });
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForTimeout(2000);
    await page.evaluate(() => { window.__landingVitals.initialLcp = window.__landingVitals.lcp; });
    const editorRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter(e=>/vendor-(excalidraw|tiptap|pdf)|\/src\/app\/App|\/assets\/(App-|workspaceStore-|cloudSyncStore-|blocks-)|fonts.googleapis.com/.test(e.name)).map(e=>e.name));
    assert.deepEqual(editorRequests,[], 'public landing must not load the editor engines');
    await page.screenshot({path:path.join(out,name+'-hero.png')});
    if (!quick) {
      await page.evaluate(async () => {
        const distance=document.documentElement.scrollHeight-innerHeight;
        const duration=24000;
        await new Promise(resolve=>{let start;let previous;function step(now){start??=now; if(previous)window.__landingVitals.frames.push(now-previous);previous=now;const t=Math.min(1,(now-start)/duration);window.scrollTo({top:distance*t,behavior:'instant'});if(t<1)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});
      });
    }
    for (const id of ['notebooks','ink','pdf','canvas','research','local-first','download','faq']) {
      await page.locator('#'+id).scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      await page.locator('#'+id+' img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));
      await page.locator('#'+id).screenshot({path:path.join(out,name+'-'+id+'.png')});
    }
    await page.locator('.pl-footer').scrollIntoViewIfNeeded();
    await page.locator('.pl-footer').screenshot({path:path.join(out,name+'-footer.png')});
    // Capture the fixed navigation at the top, after all lazy product media was visited.
    await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(out,name+'-full.png'),fullPage:true});
    if (!quick) {
      assert.equal(await page.getByRole('button',{name:'Try drawing'}).count(),0,'no duplicate demo controls');
      await page.getByRole('button',{name:'Pencil',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Pencil',exact:true}).getAttribute('aria-pressed'),'true');
      await page.getByRole('button',{name:'Pen',exact:true}).click();
      const drawing = page.locator('.pl-live-paper canvas');
      await drawing.scrollIntoViewIfNeeded();
      const bounds = await drawing.boundingBox();
      assert.ok(bounds);
      const inkPixels = () => drawing.evaluate(canvas => { const data=canvas.getContext('2d').getImageData(0,0,1000,600).data; let count=0; for(let i=3;i<data.length;i+=4)if(data[i])count++; return count; });
      await page.mouse.move(bounds.x+bounds.width*.3,bounds.y+bounds.height*.5);
      await page.mouse.down();
      await page.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.5,{steps:15});
      await page.mouse.up();
      const drawnPixels=await inkPixels();
      assert.ok(drawnPixels>100,'drawing must leave real ink');
      assert.equal(await page.getByRole('combobox',{name:'Notebook page'}).count(),0,'no invented page switcher');
      assert.equal(await page.getByRole('combobox',{name:'Demo paper'}).count(),0,'no invented paper controls');
      await page.getByRole('button',{name:'Violet pen',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Violet pen',exact:true}).getAttribute('aria-pressed'),'true');
      await page.getByRole('button',{name:'Eraser',exact:true}).click();
      const eraseBounds=await drawing.boundingBox();
      await page.mouse.move(eraseBounds.x+eraseBounds.width*.3,eraseBounds.y+eraseBounds.height*.5);
      await page.mouse.down();await page.mouse.move(eraseBounds.x+eraseBounds.width*.7,eraseBounds.y+eraseBounds.height*.5,{steps:15});await page.mouse.up();
      assert.ok(await inkPixels()<drawnPixels,'eraser removes ink while preserving the rest of the welcome');
      await page.locator('.pl-hero-art').screenshot({path:path.join(out,name+'-interactive-hero.png')});
      await page.getByRole('button',{name:'Page settings',exact:true}).click();
      await page.getByRole('heading',{name:'Continue in Panvas',exact:true}).waitFor();
      assert.match(await page.getByRole('link',{name:'Download for Windows',exact:true}).getAttribute('href'),/releases/);
      await page.locator('.pl-continue-popup').screenshot({path:path.join(out,name+'-continue-popover.png')});
      await page.keyboard.press('Escape');
      await page.locator('.pl-continue-popup').waitFor({state:'hidden'});
      await page.getByRole('button',{name:'Text tool',exact:true}).click();
      await page.getByRole('heading',{name:'Continue in Panvas',exact:true}).waitFor();
      await page.getByRole('button',{name:'Close Continue in Panvas'}).click();
      await page.getByRole('button',{name:'Covers & character',exact:true}).click();
      await page.locator('.pl-capture-notebook img').evaluate(img=>img.decode());
      assert.match(await page.locator('.pl-capture-notebook img').getAttribute('src'),/CustomizeYourNotebook/);
      await page.getByRole('button',{name:'Pressure & color',exact:true}).click();
      await page.locator('.pl-capture-ink img').evaluate(img=>img.decode());
      assert.match(await page.locator('.pl-capture-ink img').getAttribute('src'),/PreferenceStationary/);
      await page.locator('.pl-capture-ink').screenshot({path:path.join(out,name+'-pressure.png')});
      await page.getByRole('button',{name:'Ink gestures',exact:true}).click();
      await page.locator('.pl-capture-ink img').evaluate(img=>img.decode());
      assert.match(await page.locator('.pl-capture-ink img').getAttribute('src'),/InkGestures/);
      await page.getByRole('button',{name:'Your notes',exact:true}).click();
      assert.equal(await page.locator('.pl-pdf-stage').getAttribute('data-step'),'notes');
      await page.getByRole('button',{name:'Export / print',exact:true}).click();
      assert.equal(await page.locator('.pl-pdf-stage').getAttribute('data-step'),'export');
      await page.locator('.pl-faq-item > button').nth(1).click();
      assert.equal(await page.locator('.pl-faq-item > button').nth(1).getAttribute('aria-expanded'),'true');
      if(name==='mobile') {
        await page.getByRole('button',{name:'Open navigation menu'}).click();
        await page.getByRole('button',{name:'Close navigation menu'}).waitFor({state:'visible'});
        await page.keyboard.press('Escape');
        await page.locator('.pl-nav-sheet').waitFor({state:'hidden'});
      }
      await page.locator('.pl-footer-row a').click();
      assert.match(page.url(),/#\/landing$/, 'section links must not replace the application hash route');
    }
    const metrics=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      height:document.documentElement.scrollHeight,
      missingImages:[...document.querySelectorAll('.panvas-site img')].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),
      foreignProductImages:[...document.querySelectorAll('main img')].filter(i=>!decodeURIComponent(i.src).includes('/Application SS updated/')).map(i=>i.src),
      enhanced:!!document.querySelector('.pl-atmosphere-vanta canvas'),
      vitals:window.__landingVitals,
    }));
    assert.equal(metrics.overflow,false,name+' horizontal overflow');
    assert.deepEqual(metrics.missingImages,[]);
    assert.deepEqual(metrics.foreignProductImages,[]);
    if (!quick) assert.deepEqual(errors,[]);
    if(name==='mobile')assert.equal(metrics.enhanced,false);
    results.push({name,...metrics,errors});
    if(!quick && name==='desktop') {
      await page.getByRole('button',{name:'Explore Panvas',exact:true}).click();
      await page.waitForURL(/#\/app(?:\/library)?$/);
      await page.waitForTimeout(1500);
      assert.equal(await page.locator('.panvas-site').count(),0,'CTA must enter the existing app');
      assert.equal(await page.locator('[data-panvas-editor-fonts]').getAttribute('rel'),'stylesheet');
      assert.deepEqual(errors,[], 'deferred editor must start without a runtime error');
    }
    const video=page.video();
    await context.close();
    if(video)await video.saveAs(path.join(out,name+'-walkthrough.webm'));
  }
  if(!quick) {
    const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForTimeout(1900);
    assert.equal(await page.locator('.pl-atmosphere-vanta canvas').count(),0);
    await page.locator('#canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'reduced-motion.png')});
    await context.close();
  }
  if(!quick) {
    for(const mode of ['save-data','no-webgl','narrow']) {
      const context=await browser.newContext({viewport:mode==='narrow'?{width:320,height:740}:{width:1280,height:800}});
      const page=await context.newPage();
      await page.addInitScript(mode=>{
        if(mode==='save-data')Object.defineProperty(navigator,'connection',{value:{saveData:true},configurable:true});
        if(mode==='no-webgl'){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};}
      },mode);
      await page.goto(url,{waitUntil:'networkidle'});await page.waitForTimeout(1800);
      assert.equal(await page.locator('.pl-atmosphere-vanta canvas').count(),0,mode+' should use CSS atmosphere');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await context.close();
    }
  }
} finally {await browser.close();}
await writeFile(path.join(out,'qa-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({vitals,...r})=>({...r,cls:vitals.cls,initialLcpMs:vitals.initialLcp,longTaskCount:vitals.longTasks.length,framesOver34ms:vitals.frames.filter(n=>n>34).length,frameCount:vitals.frames.length})),null,2));
