import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const srv=http.createServer((req,res)=>{let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r));
const B=`http://localhost:${srv.address().port}`;
const br=await puppeteer.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
let fail=0; const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n); if(!c)fail++;};
const pg=await br.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(`${B}/index.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,2000));
await pg.keyboard.down('Control'); await pg.keyboard.press('k'); await pg.keyboard.up('Control');
await new Promise(r=>setTimeout(r,2500));
await pg.type('#searchInput','approach temp',{delay:25});
await new Promise(r=>setTimeout(r,900));
const st=await pg.evaluate(()=>{
  const items=[...document.querySelectorAll('#searchResults [data-url], #searchResults a, #searchResults .sr-result')];
  const txt=document.getElementById('searchResults')?document.getElementById('searchResults').textContent:'';
  return {n:items.length, hasTerm:/Approach Temperature/i.test(txt), hasGloss:/Glossary/i.test(txt)};
});
ok('palette finds glossary term "Approach Temperature"',st.hasTerm);
ok('categorized Glossary',st.hasGloss);
ok('no page errors',errs.length===0);
if(errs.length)console.log(errs.slice(0,3));
await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS'); process.exit(fail?1:0);
