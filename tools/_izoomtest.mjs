import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
for(const rel of process.argv.slice(2)){
  await p.goto('file:///home/baguspermana7/rz-work/'+rel,{waitUntil:'domcontentloaded',timeout:30000});
  await new Promise(r=>setTimeout(r,600));
  const before=await p.evaluate(()=>({ov:document.documentElement.scrollWidth-innerWidth,
    n:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&parseFloat(c.fontSize)<16;}).length}));
  await p.evaluate(()=>{const s=document.createElement('style');
    s.textContent='@media (max-width:768px){input:not([type=hidden]),select,textarea{font-size:16px !important}}';
    document.head.appendChild(s);});
  await new Promise(r=>setTimeout(r,500));
  const after=await p.evaluate(()=>({ov:document.documentElement.scrollWidth-innerWidth,
    n:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&parseFloat(c.fontSize)<16;}).length}));
  console.log(`${rel.padEnd(38)} sub16 ${before.n}->${after.n}   h-overflow ${before.ov>0?'+'+before.ov:'0'} -> ${after.ov>0?'+'+after.ov:'0'}`);
}
await b.close();
