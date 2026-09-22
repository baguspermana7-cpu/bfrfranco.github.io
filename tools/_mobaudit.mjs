import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const only = process.argv.slice(2).filter(a=>!a.startsWith('--'));
const xml = readFileSync(join(ROOT,'sitemap.xml'),'utf8');
let pages=[...xml.matchAll(/<loc>https:\/\/resistancezero\.com\/([^<]*)<\/loc>/g)]
  .map(m=>m[1]).filter(p=>p.endsWith('.html')).filter(p=>existsSync(join(ROOT,p)));
if(only.length) pages=only;

const PROBE = () => {
  const out={tap:[],tiny:[],offscreen:[],clipped:[],inputzoom:[],covered:[]};
  const vis=(e)=>{const cs=getComputedStyle(e);
    if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.05) return false;
    if(e.closest('[aria-hidden="true"],[hidden],details:not([open])')) return false;
    const r=e.getBoundingClientRect();
    return r.width>0 && r.height>0 && r.bottom>0 && r.top<document.documentElement.scrollHeight;};
  const label=(e)=>(e.textContent||'').trim().slice(0,22)||e.className?.toString().slice(0,22)||e.tagName;

  // 1. tap targets: interactive, visible, in-flow, under 24px in either axis
  for(const e of document.querySelectorAll('button,[role="button"],input[type="submit"],input[type="button"],summary,a.btn,a[class*="button"],a[class*="cta"],nav a,header a,footer a')){
    if(!vis(e)) continue;
    const r=e.getBoundingClientRect();
    if(e.closest('p')) continue;                               // inside a sentence: WCAG 2.5.8 exception
    if(r.height<24||r.width<24) out.tap.push(`${label(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  // 2. text under 12px that is real copy (not a badge/superscript)
  for(const e of document.querySelectorAll('p,li,td,th,span,div,a')){
    if(!vis(e)) continue;
    const txt=(e.childNodes.length && [...e.childNodes].some(n=>n.nodeType===3 && n.textContent.trim().length>25));
    if(!txt) continue;
    const fs=parseFloat(getComputedStyle(e).fontSize);
    if(fs && fs<10) out.tiny.push(`${Math.round(fs*10)/10}px ${label(e)}`);
  }
  // 3. horizontally off-screen visible content
  for(const e of document.querySelectorAll('main *,article *,section *')){
    if(!vis(e)) continue;
    const r=e.getBoundingClientRect();
    if(r.width<40||r.height<16) continue;
    if(r.left<-8 || r.right>innerWidth+8){
      const cs=getComputedStyle(e);
      if(cs.position==='fixed'||cs.position==='absolute') continue;   // drawers/tooltips park off-screen
      if(e.closest('.ticker,.marquee,[class*="ticker"],[class*="marquee"],[class*="carousel"],[class*="swiper"]')) continue;
      let anim=e, moving=false;
      while(anim&&anim!==document.body){const ac=getComputedStyle(anim);
        if(ac.animationName!=='none'||ac.transform!=='none'){moving=true;break;} anim=anim.parentElement;}
      if(moving) continue;                                              // scrolls or slides by design
      let p=e.parentElement,scroller=false;
      while(p&&p!==document.body){const pc=getComputedStyle(p);
        if(/auto|scroll/.test(pc.overflowX)){scroller=true;break;} p=p.parentElement;}
      if(!scroller) out.offscreen.push(`${label(e)} x=${Math.round(r.left)}..${Math.round(r.right)}`);
    }
  }
  // 4. inputs under 16px -> iOS zooms the page on focus
  for(const e of document.querySelectorAll('input:not([type=hidden]),select,textarea')){
    if(!vis(e)) continue;
    const fs=parseFloat(getComputedStyle(e).fontSize);
    if(fs&&fs<16) out.inputzoom.push(`${e.tagName.toLowerCase()}[${e.type||''}] ${fs}px`);
  }
  const dedup=(a)=>[...new Set(a)];
  return {tap:dedup(out.tap),tiny:dedup(out.tiny),offscreen:dedup(out.offscreen),inputzoom:dedup(out.inputzoom),
          scrollW:document.documentElement.scrollWidth, inner:innerWidth};
};

const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const p=await b.newPage();
await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const totals={tap:0,tiny:0,offscreen:0,inputzoom:0,overflow:0};
const rows=[];
let i=0;
for(const rel of pages){
  i++;
  try{
    await p.goto('file://'+join(ROOT,rel),{waitUntil:'domcontentloaded',timeout:25000});
    await new Promise(r=>setTimeout(r,450));
    await p.evaluate(()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(s);});
    const o=await p.evaluate(PROBE);
    const ov=o.scrollW>o.inner+2?o.scrollW-o.inner:0;
    totals.tap+=o.tap.length; totals.tiny+=o.tiny.length; totals.offscreen+=o.offscreen.length;
    totals.inputzoom+=o.inputzoom.length; totals.overflow+= ov?1:0;
    if(o.tap.length||o.tiny.length||o.offscreen.length||o.inputzoom.length||ov)
      rows.push({rel,tap:o.tap,tiny:o.tiny,off:o.offscreen,iz:o.inputzoom,ov});
  }catch(e){ rows.push({rel,err:String(e.message).slice(0,50)}); }
  if(i%40===0) console.error(`  ...${i}/${pages.length}`);
}
await b.close();
console.log(`pages scanned: ${pages.length}`);
console.log(`totals  tap<24px:${totals.tap}  text<12px:${totals.tiny}  offscreen:${totals.offscreen}  input<16px:${totals.inputzoom}  h-overflow pages:${totals.overflow}`);
console.log(`pages with any finding: ${rows.length}`);
for(const r of rows.slice(0,25)){
  const parts=[];
  if(r.err) parts.push('ERR '+r.err);
  if(r.ov) parts.push(`overflow +${r.ov}px`);
  if(r.tap?.length) parts.push(`tap:${r.tap.length} [${r.tap.slice(0,2).join(' | ')}]`);
  if(r.tiny?.length) parts.push(`tiny:${r.tiny.length} [${r.tiny.slice(0,2).join(' | ')}]`);
  if(r.off?.length) parts.push(`off:${r.off.length} [${r.off.slice(0,1).join('')}]`);
  if(r.iz?.length) parts.push(`inputzoom:${r.iz.length}`);
  console.log(`  ${r.rel}  ${parts.join('  ')}`);
}
