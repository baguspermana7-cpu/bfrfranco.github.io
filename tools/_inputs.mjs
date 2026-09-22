import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const xml=readFileSync(join(ROOT,'sitemap.xml'),'utf8');
const pages=[...xml.matchAll(/<loc>https:\/\/resistancezero\.com\/([^<]*)<\/loc>/g)].map(m=>m[1])
  .filter(p=>p.endsWith('.html')).filter(p=>existsSync(join(ROOT,p)));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const bad=[]; const sizes={}; let tot=0;
for(const rel of pages){
  try{
    await p.goto('file://'+join(ROOT,rel),{waitUntil:'domcontentloaded',timeout:20000});
    await new Promise(r=>setTimeout(r,250));
    const o=await p.evaluate(()=>{
      const out=[];
      for(const e of document.querySelectorAll('input:not([type=hidden]),select,textarea')){
        const cs=getComputedStyle(e);
        if(cs.display==='none'||cs.visibility==='hidden') continue;
        if(e.closest('[aria-hidden="true"],[hidden],details:not([open])')) continue;
        const fs=parseFloat(cs.fontSize);
        if(fs&&fs<16) out.push({tag:e.tagName.toLowerCase(),type:e.type||'',fs:Math.round(fs*10)/10});
      }
      return out;});
    if(o.length){ bad.push([rel,o.length]); tot+=o.length; o.forEach(x=>{sizes[x.fs]=(sizes[x.fs]||0)+1;}); }
  }catch(e){}
}
await b.close();
console.log(`pages with sub-16px inputs: ${bad.length}   total controls: ${tot}`);
console.log('font sizes:', JSON.stringify(sizes));
bad.sort((a,b)=>b[1]-a[1]).slice(0,14).forEach(([r,n])=>console.log(`  ${n.toString().padStart(3)}  ${r}`));
