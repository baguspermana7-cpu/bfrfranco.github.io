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
const pg=await br.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(`${B}/capex-calculator.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,2500));

// config list: [name, {inputs}, advanced?]
const CONFIGS=[
 ['default', {}],
 ['ai-liquid-2n', {itLoad:'20000', rackType:'ai', coolingType:'liquid', redundancy:'2n'}],
 ['tokyo-city', {itLoad:'5000', cityMarket:'tokyo', locationFactor:'apac'}],
 ['india-inrow-n', {itLoad:'2000', locationFactor:'apac', cityMarket:'mumbai', coolingType:'inrow', redundancy:'n'}],
 ['eu-rdhx-highrise-z3', {itLoad:'8000', locationFactor:'emea', coolingType:'rdhx', buildingType:'highrise', seismicZone:'zone3', fireType:'inergen', upsType:'rotary', genType:'hvo', fuelHours:'96'}],
 ['adv-fom-tokyo', {itLoad:'10000', locationFactor:'apac', cityMarket:'tokyo', coolingType:'liquid', redundancy:'2n1'}, true],
 ['adv-full-options', {itLoad:'15000', rackType:'high', coolingType:'inrow', redundancy:'n1'}, true, {projYear:'2027', marketCondition:'seller', deliveryMethod:'epc', contractorAvail:'tight', powerDistribution:'underground', transformerType:'cast_resin', pduType:'switched', cablingType:'fiber', floorType:'raised_900', siteCondition:'retrofit', securityLevel:'high', fiberEntry:'multi', greenCert:'gold', renewableOption:'solar_bess', includeFOM:true, substationType:'dedicated_33kv', transformerLead:'extended'}],
];

async function applyCfg(inputs, advanced, advInputs){
  await pg.evaluate((inputs, advanced, advInputs)=>{
    // premium unlock for advanced mode capture
    if(advanced){ window.isPremiumUser=true; window.userTier='pro'; switchCapexMode('advanced'); }
    else { window.capexMode='simple'; }
    const set=(id,val)=>{const el=document.getElementById(id);if(!el)return;
      if(el.type==='checkbox'){el.checked=!!val;}else{el.value=val;}};
    const ordered=Object.entries(inputs).sort((a,b)=>(a[0]==='locationFactor'?-1:b[0]==='locationFactor'?1:0));
    for(const [k,v] of ordered){
      if(['rackType','coolingType','redundancy'].includes(k)){
        const r=document.querySelector(`input[name="${k}"][value="${v}"]`);if(r)r.checked=true;
      } else { set(k,v); const el=document.getElementById(k); if(el) el.dispatchEvent(new Event('change',{bubbles:true})); }
    }
    if(advInputs)for(const [k,v] of Object.entries(advInputs))set(k,v);
    calculateCosts();
  }, inputs, advanced||false, advInputs||null);
  return pg.evaluate(()=>JSON.parse(JSON.stringify(window.__capexLast)));
}

const out={_captured:'pre-refactor v1.57.x', _note:'exact internals of capex-calculator calculateCosts(); engine models.capex.detailed must reproduce (reconciliations documented per-item in CHANGELOG)'};
for(const [name, inputs, adv, advInputs] of CONFIGS){
  // reload page per config for clean state
  await pg.goto(`${B}/capex-calculator.html`,{waitUntil:'domcontentloaded',timeout:60000});
  await new Promise(r=>setTimeout(r,1800));
  out[name]={inputs, advanced:!!adv, advInputs:advInputs||null, result:await applyCfg(inputs, adv, advInputs)};
  console.log(name, '→ total', Math.round(out[name].result.total), 'pue', out[name].result.pue);
}
fs.writeFileSync(path.join(ROOT,'tools/fixtures/capex-golden.json'), JSON.stringify(out,null,1));
console.log('errors:', errs.length? errs.slice(0,3):'none');
await br.close(); srv.close();
console.log('FIXTURES WRITTEN');
