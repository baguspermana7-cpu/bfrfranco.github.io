import puppeteer from 'puppeteer';
import http from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const AXE = readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const SKIP = /^(rz-|plan-|planb|google|404|sitemap|robots|llms)/;
const GATED = new Set(['ai-engineering-maintenance.html','cdu-mini-bms.html']);
const pages = readdirSync(ROOT).filter(f=>f.endsWith('.html') && !SKIP.test(f) && !GATED.has(f)).sort();
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{ let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
  if(p.endsWith('/'))p+='index.html';
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); res.end(d); });});
await new Promise(r=>srv.listen(0,r));
const PORT=srv.address().port;
const LAUNCH={args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']};
let browser=await puppeteer.launch(LAUNCH);
async function newPageSafe(){ try{return await browser.newPage();}catch(e){ try{await browser.close();}catch(_){} browser=await puppeteer.launch(LAUNCH); return browser.newPage(); } }
const rows=[]; let done=0;
for(const f of pages){
  for(const theme of ['light','dark']){
    const pg=await newPageSafe();
    try{
      await pg.evaluateOnNewDocument(t=>{try{localStorage.setItem('theme',t)}catch(e){}},theme);
      await pg.goto(`http://localhost:${PORT}/${f}`,{waitUntil:'networkidle2',timeout:45000});
      await pg.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
      await pg.evaluate(async()=>{ const h=document.documentElement.scrollHeight;
        for(let y=0;y<h;y+=600){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,40)); }
        window.scrollTo(0,0); });
      await new Promise(r=>setTimeout(r,900));
      await pg.evaluate(AXE);
      const res=await pg.evaluate(async()=>await axe.run(document,{resultTypes:['violations'],rules:{'meta-viewport':{enabled:false}}}));
      for(const v of res.violations){ if(v.impact!=='critical'&&v.impact!=='serious')continue;
        for(const n of v.nodes){ const m=(n.failureSummary||'').match(/foreground color: (#\w+), background color: (#\w+)/);
          rows.push({page:f,theme,rule:v.id,impact:v.impact,colors:m?`${m[1]} on ${m[2]}`:'',target:(n.target&&n.target[0])||''}); }}
    }catch(e){ rows.push({page:f,theme,rule:'PAGE-ERROR',impact:'critical',colors:'',target:String(e).slice(0,90)}); }
    finally{ try{await pg.close();}catch(_){} }
  }
  done++; if(done%10===0)console.error(`...${done}/${pages.length}`);
}
try{await browser.close();}catch(_){} srv.close();
console.log(`PAGES=${pages.length} VIOLATIONS=${rows.length}`);
const g={};
for(const r of rows){ const k=`${r.page} ${r.theme} ${r.rule}${r.colors?' '+r.colors:''}`; g[k]=(g[k]||0)+1; }
for(const [k,c] of Object.entries(g).sort((a,b)=>b[1]-a[1])) console.log(`${String(c).padStart(4)}x ${k}`);
fs.writeFileSync('/tmp/a11y_final.json', JSON.stringify(rows,null,1));
