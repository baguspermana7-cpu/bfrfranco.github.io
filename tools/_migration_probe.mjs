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
const SOURCE_ONLY={'rz-ops-p7x3k9m.html':1};  // attrs live in gated JS templates
const PAGES=['tco-calculator.html','cx-calculator.html','rz-ops-p7x3k9m.html',
 'ltc-uptime-tier-alignment.html','ltc-nfpa-fire-risk.html','ltc-ansi-tia-topology-readiness.html',
 'ltc-ashrae-thermal-control.html','ltc-system-modelling-lab.html','ltc-iso-energy-governance.html','article-3.html',
 'article-4.html','article-16.html','article-17.html','article-18.html','article-20.html',
 'article-12.html','article-11.html','article-15.html','article-13.html','article-25.html',
 'FF-1.html','FF-2.html','FF-3.html','geopolitics-3.html'];
for(const f of PAGES){
  const pg=await br.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(`${B}/${f}`,{waitUntil:'domcontentloaded',timeout:60000});
  await new Promise(r=>setTimeout(r,2200));
  const st=await pg.evaluate(()=>{
    const db=!!window.RZ_EXPLAIN_DB, eng=!!window.RZExplain;
    let opens=false;
    if(eng&&db){
      const t=document.querySelector('[data-explain]');
      if(t){const k=t.getAttribute('data-explain');
        if(RZExplain.has(k)){RZExplain.open(k,t);
          const p=document.getElementById('rzExplainPanel');
          opens=p&&p.style.display==='block'&&p.textContent.length>40;RZExplain.close();}}
    }
    return {db,eng,wired:document.querySelectorAll('[data-explain]').length,opens};
  });
  if(SOURCE_ONLY[f]){
    const src=fs.readFileSync(path.join(ROOT,f),'utf8');
    ok(`${f}: db+engine loaded, template-wired (source), 0 errors`,
       st.db&&st.eng&&/data-explain=/.test(src)&&errs.length===0);
  } else {
    ok(`${f}: db+engine, wired=${st.wired}, panel opens, 0 errors`,
       st.db&&st.eng&&st.wired>0&&st.opens&&errs.length===0);
  }
  if(errs.length)console.log('  ',errs.slice(0,2));
  await pg.close();
}
await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS'); process.exit(fail?1:0);
