import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'};
function candles(){const out=[];let c=150;for(let i=0;i<260;i++){const t=Math.floor((Date.now()-((260-i)*86400000))/1000);
  const drift=0.0012,vol=0.012,r=Math.sin(i*1.7)*vol+drift;const o=c;c=c*(1+r);
  out.push({t,o:+o.toFixed(2),h:+Math.max(o,c*1.005).toFixed(2),l:+Math.min(o,c*0.995).toFixed(2),c:+c.toFixed(2),v:50e6+((i*7919)%20e6)});}
  return out;}
const FIX={
 '/quote':{c:190.5,d:2.1,dp:1.12,h:191.2,l:188.1,o:188.9,pc:188.4},
 '/profile':{name:'Apple Inc',exchange:'NASDAQ',marketCapitalization:2900000,finnhubIndustry:'Technology',country:'US'},
 '/metric':{metric:{'52WeekHigh':199.6,'52WeekLow':164.1,peBasicExclExtraTTM:29.5,epsBasicExclExtraItemsTTM:6.4,roeTTM:147,netProfitMarginTTM:25.3,pbAnnual:45.2,beta:1.24,dividendYieldIndicatedAnnual:0.55,'10DayAverageTradingVolume':58,'totalDebt/totalEquityQuarterly':1.76}},
 '/candles':{candles:candles()},
 '/search':{result:[{symbol:'AAPL',description:'APPLE INC'},{symbol:'AAPD',description:'DIREXION AAPL BEAR'}]}
};
const srv=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x'); 
  if(u.pathname.startsWith('/gwstub')){ console.log('  [gwstub]',u.pathname.replace('/gwstub',''));
    const ep=u.pathname.replace('/gwstub','');
    res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({ok:true,data:FIX[ep]??{}}));return;
  }
  let p=path.join(ROOT,decodeURIComponent(u.pathname)); if(p.endsWith('/'))p+='index.html';
  fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r));
const PORT=srv.address().port, B=`http://localhost:${PORT}`;
const br=await puppeteer.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
let fail=0; const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n); if(!c)fail++;};
const ctx=await br.createBrowserContext(); const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{const t=m.text();if((m.type()==='error'||m.type()==='warn')&&!/429|Failed to load resource/.test(t))console.log('  [console]',t.slice(0,200));});
await pg.evaluateOnNewDocument((gwUrl)=>{try{localStorage.setItem('rz_ft_gw',gwUrl);localStorage.setItem('rz_ft_v2','1');}catch(e){}},`${B}/gwstub`);
await pg.setViewport({width:1440,height:1000});
await pg.goto(`${B}/Apps/finance-terminal/index.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,2500));
// keyboard-first: "/" jumps to stocks tab + focuses search
await pg.keyboard.press('s');
let st=await pg.evaluate(()=>({tab:document.querySelector('.tab.active')?.dataset.tab,focus:document.activeElement?.id}));
ok('"s" switches to Stocks + focuses search',st.tab==='stocks'&&st.focus==='stockSearch');
// arrow-key result navigation
await pg.type('#stockSearch','AAP',{delay:30});
await new Promise(r=>setTimeout(r,900));
await pg.keyboard.press('ArrowDown');
st=await pg.evaluate(()=>({n:document.querySelectorAll('.sr-item').length,hi:document.querySelector('.sr-item.active')?.textContent||''}));
ok('results render + ArrowDown highlights first',st.n>=2&&/AAPL/.test(st.hi));
const selErr=await pg.evaluate(async()=>{try{await selectStock('AAPL');return null;}catch(e){return String(e&&e.stack||e);}});
if(selErr)console.log('  selectStock ERROR:',selErr.slice(0,400));
await new Promise(r=>setTimeout(r,2500));
console.log('  CFG.GW =',await pg.evaluate(()=>window.CFG&&CFG.GW), '| Chart lib:', await pg.evaluate(()=>typeof window.Chart), '| LW:', await pg.evaluate(()=>typeof window.LightweightCharts), '| FIN:', await pg.evaluate(()=>typeof window.FINEngine));
st=await pg.evaluate(()=>{
  const hero=document.getElementById('stockHero').textContent;
  const sc=document.getElementById('stockAdvisorScorecard');
  const chart=document.querySelector('#panel-stocks .g23');
  return {hero,scVisible:sc&&sc.style.display!=='none'&&sc.textContent.length>50,
    scAboveChart:sc&&chart?!!(sc.compareDocumentPosition(chart)&Node.DOCUMENT_POSITION_FOLLOWING):false,
    chips:document.querySelectorAll('#heroSignals .rz-ap-chip').length,
    chipTxt:document.getElementById('heroSignals')?.textContent||'',
    w52:/52W/.test(document.getElementById('stockHero').innerHTML),
    disclaimer:/not (investment )?advice/i.test(sc?.textContent||'')};
});
ok('hero renders live price',/190\.5|Apple/.test(st.hero)); if(!/Apple/.test(st.hero))console.log('  HERO:',st.hero.slice(0,200));
ok('52W range bar in hero',st.w52);
ok('committee scorecard VISIBLE + headline (above chart)',st.scVisible&&st.scAboveChart);
ok('hero signal chips render (committee/technical/risk)',st.chips>=3&&/Committee/.test(st.chipTxt));
ok('disclaimer present in scorecard',st.disclaimer);
ok('no page errors',errs.length===0);
if(errs.length)console.log(errs.slice(0,4));
await pg.screenshot({path:'/tmp/c2-terminal.png',fullPage:false});
await ctx.close(); await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS'); process.exit(fail?1:0);
