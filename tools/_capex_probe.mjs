/* capex-calculator end-to-end probe: engine delegation parity, deep-sea flow,
   refrigerant switch, renewables, space panel, PDF additive blocks. */
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
const pg=await br.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.setViewport({width:1440,height:1000});
await pg.goto(`${B}/capex-calculator.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,2500));

// 1. golden parity vs fixtures (delegated page)
const G=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/fixtures/capex-golden.json'),'utf8'));
let st=await pg.evaluate(()=>{calculateCosts();return window.__capexLast;});
ok('default parity vs fixture',Math.abs(st.total-G['default'].result.total)<1&&st.pue===G['default'].result.pue);
ok('space block present by default',st.space&&st.space.whiteSpaceM2>0&&st.space.racks===167);
ok('auto refrigerant on air = R-410A',st.refrigerant&&st.refrigerant.key==='R410A');

// 2. deep-sea tick flow
await pg.evaluate(()=>{document.getElementById('itLoad').value='150000';
  document.querySelector('input[name="rackType"][value="ai"]').checked=true;
  document.getElementById('deepSeaEnable').checked=true;toggleDeepSea();});
await new Promise(r=>setTimeout(r,600));
st=await pg.evaluate(()=>({last:window.__capexLast,
  panel:document.getElementById('deepSeaPanel').style.display,
  cfg:document.getElementById('deepSeaConfig').style.display,
  grid:document.getElementById('dsGrid').textContent,
  rows:document.getElementById('dsCapexRows').textContent,
  note:document.getElementById('dsIntakeNote').textContent}));
ok('deep-sea config panel shows',st.cfg==='block');
ok('deep-sea output panel renders',st.panel==='block'&&/m³\/s/.test(st.grid)&&/Titanium/.test(st.rows));
ok('deep-sea PUE physics (≤1.15, not lookup)',st.last.deepSea&&st.last.pue<=1.15);
ok('deep-sea capex line joined total',st.last.costs.deepSeaCooling>0);
ok('deep-sea refrigerant auto = R-1234ze (trim)',st.last.refrigerant&&st.last.refrigerant.key==='R1234ze');
ok('intake note explains depth→temp',/°C/.test(st.note));
await pg.screenshot({path:'/tmp/capex-deepsea.png',fullPage:false});

// 3. refrigerant manual switch → ammonia
await pg.evaluate(()=>{document.getElementById('refrigerantType').value='R717';calculateCosts();});
await new Promise(r=>setTimeout(r,400));
st=await pg.evaluate(()=>({ref:window.__capexLast.refrigerant,
  panel:document.getElementById('refrigerantPanel').style.display,
  flags:document.getElementById('refFlags').textContent}));
ok('ammonia selected: GWP 0 + B2L flags',st.ref.key==='R717'&&st.ref.gwp===0&&/B2L/.test(st.flags));
ok('refrigerant panel renders',st.panel==='block');

// 4. deep-sea off → back to lookup pue + panels hide
await pg.evaluate(()=>{document.getElementById('deepSeaEnable').checked=false;toggleDeepSea();
  document.getElementById('refrigerantType').value='auto';calculateCosts();});
await new Promise(r=>setTimeout(r,400));
st=await pg.evaluate(()=>({p:document.getElementById('deepSeaPanel').style.display,pue:window.__capexLast.pue}));
ok('untick hides panel + PUE back to matrix',st.p==='none'&&st.pue===1.5);

// 5. renewables (advanced mode)
await pg.evaluate(()=>{window.isPremiumUser=true;window.userTier='pro';switchCapexMode('advanced');
  document.getElementById('renewableOption').value='solar_bess';toggleRenewableSizing();calculateCosts();});
await new Promise(r=>setTimeout(r,500));
st=await pg.evaluate(()=>({p:document.getElementById('renewPanel').style.display,
  g:document.getElementById('renewGrid').textContent,
  sizing:document.getElementById('renewSizing').style.display}));
ok('renewable sizing inputs show',st.sizing==='grid');
ok('renewables screen renders coverage + offset',st.p==='block'&&/Coverage/.test(st.g)&&/tCO/.test(st.g));

// 6. PDF additive blocks present in print HTML (build without opening window)
st=await pg.evaluate(()=>{
  document.getElementById('deepSeaEnable').checked=true;toggleDeepSea();
  const r=lastResult;
  const cellS='padding:4px 6px;border:1px solid #cbd5e1;', hdrS='padding:4px 6px;text-align:left;';
  return buildEngineBlocksHTML(r,cellS,hdrS);
});
ok('PDF: deep-sea inputs+calculated+capex sections',/Input Parameters/.test(st)&&/Calculated Design Parameters/.test(st)&&/Deep-Sea CAPEX Breakdown/.test(st)&&/31,050|m³\/h/.test(st));
ok('PDF: white-space program section',/White Space Program/.test(st)&&/Gross building/.test(st));
ok('PDF: refrigerant impact section',/Selected Refrigerant Impact/.test(st));
ok('PDF: renewables section',/Renewables Screen/.test(st));

// 7. CSV rows include new blocks
st=await pg.evaluate(()=>{
  let captured=null; const orig=RZCalc.downloadCSV; RZCalc.downloadCSV=(f,h,r)=>{captured=r;};
  exportCapexCSV(); RZCalc.downloadCSV=orig; return captured.map(r=>r[1]).join('|');
});
ok('CSV: deep-sea + space + refrigerant rows',/DS seawater flow/.test(st)&&/White space/.test(st)&&/Refrigerant selected/.test(st));

ok('no page errors',errs.length===0);
if(errs.length)console.log(errs.slice(0,4));
await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS'); process.exit(fail?1:0);
