import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const srv=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname.startsWith('/gwstub')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,data:{}}));return;}
  let p=path.join(ROOT,decodeURIComponent(u.pathname));
  fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r));
const B=`http://localhost:${srv.address().port}`;
const br=await puppeteer.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
let fail=0; const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n); if(!c)fail++;};
const ctx=await br.createBrowserContext(); const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.evaluateOnNewDocument((gw)=>{try{
  localStorage.setItem('rz_ft_gw',gw);localStorage.setItem('rz_ft_v2','1');
  localStorage.setItem('rz_ft_port',JSON.stringify([
    {tk:'AAPL',price:150,qty:100,date:'2025-01-02'},
    {tk:'MSFT',price:300,qty:10,date:'2025-01-02'},
    {tk:'NVDA',price:400,qty:2,date:'2025-01-02'}]));
}catch(e){}},`${B}/gwstub`);
await pg.setViewport({width:1440,height:1000});
await pg.goto(`${B}/Apps/finance-terminal/index.html`,{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,2500));
await pg.evaluate(()=>{
  window.yahooCandles=async function(sym){
    const seed=sym.length*7;const out={t:[],o:[],h:[],l:[],c:[],v:[]};let c=100+seed;
    for(let i=0;i<260;i++){const t=Math.floor(Date.now()/1000)-((260-i)*86400);
      const r=Math.sin((i+seed)*0.9)*0.012+0.0011;const o=c;c=c*(1+r);
      out.t.push(t);out.o.push(+o.toFixed(2));out.c.push(+c.toFixed(2));
      out.h.push(+(Math.max(o,c)*1.004).toFixed(2));out.l.push(+(Math.min(o,c)*0.996).toFixed(2));out.v.push(4e7+i*1e4);}
    return Object.assign({s:'ok'},out);
  };
});
const perr=await pg.evaluate(async()=>{try{renderPortfolio();await loadPortfolioAnalytics();return null;}catch(e){return String(e&&e.stack||e).slice(0,300);}});
if(perr)console.log('  loadPortfolioAnalytics ERROR:',perr);
await new Promise(r=>setTimeout(r,1500));
let st=await pg.evaluate(()=>{const el=document.getElementById('portDoctor');
  return {txt:el?el.textContent:'',rows:el?el.querySelectorAll('tbody tr').length:0,
    chip:el?!!el.querySelector('.rz-ap-chip'):false};});
ok('doctor renders committee chip',st.chip&&/Committee \(value-weighted\)/.test(st.txt));
ok('doctor per-holding rows = 3',st.rows===3);
ok('doctor concentration flag',/(Concentrated|Moderate concentration|Diversified by weight)/.test(st.txt));
ok('doctor HHI + effective positions',/HHI/.test(st.txt)&&/effective positions/.test(st.txt));
ok('doctor diversification score',/Diversification score/.test(st.txt));
ok('doctor disclaimer + no-sizing',/not (investment )?advice/i.test(st.txt)&&/No trade prescriptions/.test(st.txt));
const cerr=await pg.evaluate(async()=>{try{S.curStock='AAPL';S.compareSyms=['MSFT','NVDA'];await loadCompareChart();return null;}catch(e){return String(e&&e.stack||e).slice(0,300);}});
if(cerr)console.log('  loadCompareChart ERROR:',cerr);
await new Promise(r=>setTimeout(r,1000));
st=await pg.evaluate(()=>{const el=document.getElementById('compareTable');
  return {txt:el?el.textContent:'',rows:el?el.querySelectorAll('tbody tr').length:0};});
ok('compare committee rows = 3',st.rows>=3);
ok('compare verdict + value gate cols',/Verdict/.test(st.txt)&&/Value Gate/.test(st.txt));
ok('compare disclaimed',/Descriptive, not advice/.test(st.txt));
ok('no page errors',errs.length===0);
if(errs.length)console.log(errs.slice(0,4));
await pg.screenshot({path:'/tmp/portdoctor.png'});
await ctx.close(); await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS'); process.exit(fail?1:0);
