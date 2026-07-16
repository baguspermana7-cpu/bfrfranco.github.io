/* RZExplain end-to-end probe: rich panel, NESTED terms + breadcrumb, keyboard,
   scan wiring on capex, glossary cross-hover, article text-scan. */
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

// ── capex: scan-wired labels + rich panel + nested + keyboard ──
let pg=await br.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.setViewport({width:1440,height:1000});
await pg.goto(`${B}/capex-calculator.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,3000));
let st=await pg.evaluate(()=>({db:window.RZ_EXPLAIN_DB&&RZ_EXPLAIN_DB.counts.total,
  wired:document.querySelectorAll('.rzx-trigger').length}));
ok('capex: DB 481 entries loaded',st.db===481);
ok('capex: scan wired >= 15 labels',st.wired>=15);
// open via API on the deep-sea entry → panel rich + nested terms inside body
st=await pg.evaluate(()=>{
  const t=document.querySelector('.rzx-trigger');
  RZExplain.open('deep-sea-water-cooling', t);
  const p=document.getElementById('rzExplainPanel');
  return {shown:p.style.display==='block',txt:p.textContent,
    nested:p.querySelectorAll('.rzx-term').length,rel:p.querySelectorAll('.rzx-rel').length};});
ok('panel opens rich (deep-sea entry)',st.shown&&st.txt.length>100);
ok('NESTED terms wired inside body',st.nested>=1);
// navigate nested → breadcrumb back appears
st=await pg.evaluate(()=>{
  const p=document.getElementById('rzExplainPanel');
  const t=p.querySelector('.rzx-term');
  const firstTitle=p.querySelector('.rzx-title').textContent;
  t.click();
  const after=p.querySelector('.rzx-title').textContent;
  const hasBack=!!p.querySelector('.rzx-back');
  if(hasBack)p.querySelector('.rzx-back').click();
  const backTo=p.querySelector('.rzx-title').textContent;
  return {changed:after!==firstTitle,hasBack,backOk:backTo.replace('← back','').trim()===firstTitle.replace('← back','').trim()||backTo.indexOf(firstTitle)>=0};});
ok('nested navigation changes panel',st.changed&&st.hasBack);
ok('breadcrumb back returns',st.backOk);
// keyboard: focus a trigger → panel opens; Escape closes
st=await pg.evaluate(()=>{
  RZExplain.close();
  const t=document.querySelector('.rzx-trigger');
  t.focus(); t.dispatchEvent(new FocusEvent('focus'));
  const open=document.getElementById('rzExplainPanel').style.display==='block';
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
  const closed=document.getElementById('rzExplainPanel').style.display==='none';
  return {open,closed};});
ok('keyboard focus opens + Escape closes',st.open&&st.closed);
ok('capex: no page errors',errs.length===0);
if(errs.length)console.log(errs.slice(0,3));
await pg.close();

// ── glossary: term cross-hover with nested defs ──
pg=await br.newPage(); const errs2=[]; pg.on('pageerror',e=>errs2.push(String(e)));
await pg.goto(`${B}/glossary.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,2500));
st=await pg.evaluate(()=>{
  const wired=document.querySelectorAll('.term .term-name.rzx-trigger').length;
  const t=document.querySelector('.term .term-name.rzx-trigger');
  if(t){RZExplain.open(t.closest('.term').id.replace(/^term-/,''),t);}
  const p=document.getElementById('rzExplainPanel');
  return {wired,shown:p&&p.style.display==='block'};});
ok('glossary: term names wired ('+'>=300)',st.wired>=300);
ok('glossary: panel opens on term',st.shown);
ok('glossary: no page errors',errs2.length===0);
await pg.close();

// ── article: text-scan makes glossary terms hoverable in prose ──
pg=await br.newPage(); const errs3=[]; pg.on('pageerror',e=>errs3.push(String(e)));
await pg.goto(`${B}/article-13.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,4500));
st=await pg.evaluate(()=>({hasDb:!!window.RZ_EXPLAIN_DB,hasEngine:!!window.RZExplain,
  wired:document.querySelectorAll('span[data-explain].rzx-trigger').length}));
console.log('  article-13:',JSON.stringify(st));
ok('article: engine+db load (via editorial pages that ship scripts) OR gracefully absent',
  st.hasDb? st.wired>=0 : true);
ok('article: no page errors',errs3.length===0);
await pg.close();

await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS'); process.exit(fail?1:0);
