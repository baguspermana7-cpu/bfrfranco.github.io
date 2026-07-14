import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const srv=http.createServer((req,res)=>{ let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
  if(p.endsWith('/'))p+='index.html';
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); res.end(d); });});
await new Promise(r=>srv.listen(0,r));
const B=`http://localhost:${srv.address().port}`;
const br=await puppeteer.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
let fail=0;
function ok(name,cond){ console.log((cond?'PASS':'FAIL'),name); if(!cond)fail++; }

// 1. spares first visit: banner shows, tour NOT; accept -> no dark; tour starts after
let ctx=await br.createBrowserContext(); let pg=await ctx.newPage(); await pg.setViewport({width:1280,height:900});
await pg.goto(`${B}/spares-readiness-calculator.html`,{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,2000));
let st=await pg.evaluate(()=>({banner:!!document.getElementById('cookieBanner')&&!document.getElementById('cookieBanner').classList.contains('hidden'),
  tour:document.getElementById('tourOverlay')&&document.getElementById('tourOverlay').style.display==='block'}));
ok('spares: banner visible first visit',st.banner);
ok('spares: tour NOT started while banner open',!st.tour);
await pg.click('#cookieAccept');
await new Promise(r=>setTimeout(r,1200));
st=await pg.evaluate(()=>({hidden:document.getElementById('cookieBanner').classList.contains('hidden'),
  consent:localStorage.getItem('rz_cookie_consent'),
  tour:document.getElementById('tourOverlay')&&document.getElementById('tourOverlay').style.display==='block',
  ttVisible:(function(){var tt=document.getElementById('tourTooltip');if(!tt||tt.style.display==='none')return false;var r=tt.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()}));
ok('spares: banner hidden after accept',st.hidden);
ok('spares: consent stored',st.consent==='accepted');
ok('spares: tour auto-starts after accept',st.tour);
ok('spares: tooltip fully in viewport',st.ttVisible);
await pg.keyboard.press('Escape');
await new Promise(r=>setTimeout(r,300));
st=await pg.evaluate(()=>({tour:document.getElementById('tourOverlay').style.display,done:localStorage.getItem('cse_tour_done')}));
ok('spares: Escape ends tour',st.tour==='none');
await pg.screenshot({path:'/tmp/spares-fixed.png'});
await ctx.close();

// 2. returning consented visitor, 4 sample pages: no banner
for(const f of ['index.html','EPMS_Telemetry.html','article-13.html','id/index.html']){
  ctx=await br.createBrowserContext(); pg=await ctx.newPage();
  await pg.evaluateOnNewDocument(()=>{try{localStorage.setItem('rz_cookie_consent','accepted')}catch(e){}});
  await pg.goto(`${B}/${f}`,{waitUntil:'networkidle2',timeout:60000});
  await new Promise(r=>setTimeout(r,800));
  const vis=await pg.evaluate(()=>{const b=document.getElementById('cookieBanner');
    return b && !b.classList.contains('hidden') && getComputedStyle(b).display!=='none';});
  ok(`returning: no banner on ${f}`,!vis);
  await ctx.close();
}

// 3. decline path on EPMS (variant-2 page)
ctx=await br.createBrowserContext(); pg=await ctx.newPage();
await pg.goto(`${B}/EPMS_Telemetry.html`,{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,1000));
let has=await pg.evaluate(()=>!!document.getElementById('cookieDecline'));
ok('EPMS: decline button exists',has);
if(has){ await pg.click('#cookieDecline'); await new Promise(r=>setTimeout(r,400));
  st=await pg.evaluate(()=>({c:localStorage.getItem('rz_cookie_consent'),ga:window['ga-disable-G-GED7FX8RTV']===true}));
  ok('EPMS: declined stored',st.c==='declined');
  ok('EPMS: GA disabled',st.ga); }
await ctx.close();

// 4. /id/ first visit: Indonesian strings + legacy key migration
ctx=await br.createBrowserContext(); pg=await ctx.newPage();
await pg.goto(`${B}/id/index.html`,{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,1000));
st=await pg.evaluate(()=>{const b=document.getElementById('cookieBanner');
  return {vis:b&&!b.classList.contains('hidden'), txt:b?b.textContent:''};});
ok('id: banner shows',st.vis);
ok('id: Indonesian text',/Terima/.test(st.txt)&&/cookie/i.test(st.txt));
await ctx.close();
ctx=await br.createBrowserContext(); pg=await ctx.newPage();
await pg.evaluateOnNewDocument(()=>{try{localStorage.setItem('cookieConsent','accepted')}catch(e){}});
await pg.goto(`${B}/id/index.html`,{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,1000));
st=await pg.evaluate(()=>({vis:(function(){const b=document.getElementById('cookieBanner');return b&&!b.classList.contains('hidden');})(),
  migrated:localStorage.getItem('rz_cookie_consent')}));
ok('id: legacy key migrated, no banner',!st.vis && st.migrated==='accepted');
await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS');
process.exit(fail?1:0);
