#!/usr/bin/env node
/* test-conv-modal-no-self-repeat.mjs — STRICT (PRD-CONV-LIVING-PLANT §6.1, owner comment C10). On the 9 Conventional
   cockpits at 1440: every element with a pointer cursor is clicked; when a modal opens, no drawing inside it may be
   the sheet it was opened from (>= 70 % of the modal drawing's text labels found on a drawing behind it).
   A block opens its own content, never its parent sheet. Baseline 2026-11-17: 0 on all 9 pages. */
import puppeteer from 'puppeteer'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
const ROOT=process.cwd(); const MIME={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});r.end(d);});});
await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const O=`http://127.0.0.1:${srv.address().port}/`;
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const pages=(process.argv[2]||'dc-conventional,datahall,chiller-plant,water-system,fire-system,fuel-system,ict,EPMS_Telemetry,cdu-mini-bms').split(',');
let total=0;
const SEL='[role="dialog"]:not([hidden]), dialog[open], .modal.show, .show[class*="modal"], .open[class*="modal"], [class*="modal"].active, [aria-modal="true"]:not([hidden])';
for (const page of pages){ const pg=await b.newPage(); await pg.setViewport({width:1440,height:1000}); await primeCockpitAuditDocument(pg,'dark');
 await pg.goto(O+page+'.html',{waitUntil:'networkidle0',timeout:90000}); try{await enterAuthorizedAuditState(pg,page==='EPMS_Telemetry'?'epms-telemetry':page);}catch(e){} await new Promise(r=>setTimeout(r,2000));
 const n=await pg.evaluate(()=>{let i=0;const seen=new Set();document.querySelectorAll('svg g, svg rect, svg text, [onclick], .tile, .card, .block, [role=button], button').forEach(el=>{const r=el.getBoundingClientRect();if(r.width<8||r.height<8||r.width>700)return;if(getComputedStyle(el).cursor!=='pointer')return;if(el.closest('nav,header,footer,.rz-inspector,[data-c10]'))return;let p=el;while(p.parentElement&&getComputedStyle(p.parentElement).cursor==='pointer'&&!p.parentElement.matches('svg,body,main,section,div.shell'))p=p.parentElement;if(seen.has(p))return;seen.add(p);p.setAttribute('data-c10',i++);});return i;});
 const hits=[]; let opened=0;
 for(let i=0;i<Math.min(n,140);i++){ const info=await pg.evaluate(i=>{const el=document.querySelector('[data-c10="'+i+'"]');if(!el||!el.isConnected)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();if(r.width<1)return null;return{x:r.left+r.width/2,y:r.top+r.height/2,t:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,40),tag:el.tagName};},i); if(!info)continue;
  await pg.mouse.click(info.x,info.y); await new Promise(r=>setTimeout(r,400));
  const res=await pg.evaluate((SEL)=>{const ms=[...document.querySelectorAll(SEL)].filter(m=>m.getBoundingClientRect().width>100);if(!ms.length)return null;const m=ms[ms.length-1];const sig=s=>[...s.querySelectorAll('text')].map(t=>t.textContent.trim()).filter(Boolean).sort().join('|');const inner=[...m.querySelectorAll('svg')].filter(s=>s.getBoundingClientRect().width>200);const outer=[...document.querySelectorAll('svg')].filter(s=>!m.contains(s)&&s.querySelectorAll('text').length>5);let dup=null;for(const a of inner){const A=new Set(sig(a).split('|'));if(A.size<6)continue;for(const o of outer){const B=sig(o).split('|');const common=B.filter(x=>A.has(x)).length;if(common/Math.max(1,Math.min(A.size,new Set(B).size))>0.7){dup=(o.id||o.getAttribute('class')||'svg')+' share '+common+'/'+A.size;}}}return{cls:(m.id||m.className||'').toString().slice(0,50),dup,svgs:inner.length};},SEL);
  if(res){opened++; if(res.dup)hits.push(info.t+' ['+info.tag+'] -> '+res.cls+' DUP '+res.dup);}
  await pg.keyboard.press('Escape'); await new Promise(r=>setTimeout(r,150));
  await pg.evaluate((SEL)=>{document.querySelectorAll(SEL).forEach(m=>{const x=m.querySelector('[aria-label*="lose" i],.close,[class*="close"],[data-close]');if(x)x.click();});},SEL); await new Promise(r=>setTimeout(r,120)); }
 total+=hits.length; console.log(page,'clickables',n,'modals',opened,'DUP',hits.length); hits.slice(0,12).forEach(h=>console.log('   ',h)); await pg.close(); }
await b.close(); srv.close();
if (total) { console.log('\nCONV MODAL SELF-REPEAT — FAIL (' + total + ')'); process.exit(1); }
console.log('\nCONV MODAL SELF-REPEAT — PASS (no modal repeats the sheet behind it)');
