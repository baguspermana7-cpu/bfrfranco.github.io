import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const xml=readFileSync(join(ROOT,'sitemap.xml'),'utf8');
const pages=[...xml.matchAll(/<loc>https:\/\/resistancezero\.com\/([^<]*)<\/loc>/g)].map(m=>m[1])
  .filter(p=>p.endsWith('.html')).filter(p=>existsSync(join(ROOT,p)));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const hits=[];
for(const rel of pages){
  try{
    await p.goto('file://'+join(ROOT,rel),{waitUntil:'domcontentloaded',timeout:20000});
    await new Promise(r=>setTimeout(r,200));
    const n=await p.evaluate(()=>[...document.querySelectorAll('input:not([type=hidden]),select,textarea')]
      .filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&parseFloat(c.fontSize)<16;}).length);
    if(n) hits.push(rel);
  }catch(e){}
}
await b.close();
console.log(hits.join('\n'));
