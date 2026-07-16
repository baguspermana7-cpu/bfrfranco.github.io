import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const AXE=fs.readFileSync(path.join(ROOT,'tools/vendor/axe.min.js'),'utf8');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const srv=http.createServer((req,res)=>{ let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
  if(p.endsWith('/'))p+='index.html';
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); res.end(d); });});
await new Promise(r=>srv.listen(0,r));
const br=await puppeteer.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
for(const f of process.argv.slice(2)){
  for(const theme of ['light','dark']){
    const pg=await br.newPage();
    await pg.evaluateOnNewDocument(t=>{try{localStorage.setItem('theme',t)}catch(e){}},theme);
    await pg.goto(`http://localhost:${srv.address().port}/${f}`,{waitUntil:'networkidle2',timeout:60000});
    await pg.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
    /* scroll through so IntersectionObserver entrance animations complete
       (below-fold .fade-in cards otherwise sit at partial opacity forever) */
    await pg.evaluate(async()=>{ const h=document.documentElement.scrollHeight;
      for(let y=0;y<h;y+=600){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,40)); }
      window.scrollTo(0,0); });
    await new Promise(r=>setTimeout(r,900));
    await pg.evaluate(AXE);
    const res=await pg.evaluate(async()=>await axe.run(document,{resultTypes:['violations'],rules:{'meta-viewport':{enabled:false}}}));
    const g={};
    for(const v of res.violations){ if(v.impact!=='critical'&&v.impact!=='serious')continue;
      for(const n of v.nodes){ const m=(n.failureSummary||'').match(/foreground color: (#\w+), background color: (#\w+)/);
        const k=v.id+(m?' '+m[1]+' on '+m[2]:'')+' | '+((n.target&&n.target[0])||'').replace(/:nth-child\(\d+\)/g,'').slice(0,60);
        g[k]=(g[k]||0)+1; }}
    const tot=Object.values(g).reduce((a,b)=>a+b,0);
    console.log(`== ${f}/${theme} — ${tot} ==`);
    for(const [k,c] of Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,12)) console.log(`  ${c}x ${k}`);
  }
}
await br.close(); srv.close();
