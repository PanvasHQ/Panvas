// Generate delivery formats from approved captures; originals remain untouched.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root='public/Application SS updated';
const files=['HeroPanvasClean.png','NotebookStyle_Template.png','CustomizeYourNotebook.png','Turn_Handwriting_into_text.png','PreferenceStationary.png','InkGestures.png','HeroResearchWorkSpace.png','printNotes_ExportPDF.png','StickyNotes.png','Voice Notes.png','ToolBar.png','e.png'];
await mkdir(root+'/optimized',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  for(const file of files) {
    const bytes=await readFile(root+'/'+file);
    const images=await page.evaluate(async({base64})=>{
      const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
      return [640,1280].map(width=>{const canvas=document.createElement('canvas');canvas.width=Math.min(width,img.width);canvas.height=Math.round(img.height*canvas.width/img.width);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return {width,base64:canvas.toDataURL('image/webp',.9).split(',')[1]};});
    },{base64:bytes.toString('base64')});
    for(const image of images)await writeFile(root+'/optimized/'+file.replace('.png','')+'-'+image.width+'.webp',Buffer.from(image.base64,'base64'));
  }
} finally {await browser.close();}
console.log('Optimized 12 approved captures at 640/1280 widths.');
