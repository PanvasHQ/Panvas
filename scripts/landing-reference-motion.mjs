import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out='artifacts/landing-review/references'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
await Promise.all([['spatial','https://www.get-spatial.com/'],['shuttle','https://shuttle.zip/about'],['seesaw','https://www.seesaw.website/'],['primitives','https://motion-primitives.com/']].map(async ([name,url])=>{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 try { await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});await page.waitForTimeout(1500);
 for(const [i,fraction] of [0,.22,.5].entries()) { await page.mouse.move(950,420);await page.evaluate(f=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*f,behavior:'smooth'}),fraction);await page.waitForTimeout(900);await page.screenshot({path:`${out}/${name}-${i}.png`}); }
 console.log(name,await page.evaluate(()=>({title:document.title,height:document.documentElement.scrollHeight,canvas:document.querySelectorAll('canvas').length,video:document.querySelectorAll('video').length,sticky:[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='sticky').slice(0,6).map(e=>({tag:e.tagName,cls:e.className})),animations:document.getAnimations().slice(0,8).map(a=>({duration:a.effect?.getTiming().duration,frames:a.effect?.getKeyframes().slice(0,2)}))})));
 }catch(error){console.log(name,error.message);}finally{await page.close();}
}));await browser.close();
