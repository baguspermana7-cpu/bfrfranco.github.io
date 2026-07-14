import puppeteer from 'puppeteer';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/baguspermana7/rz-work';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.ico':'image/x-icon'};
const srv=http.createServer((req,res)=>{let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r));
const B=`http://localhost:${srv.address().port}`;
const br=await puppeteer.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
let fail=0; const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n); if(!c)fail++;};

const STUB=`(function(){
  const user={email:'bagus@resistancezero.com',created_at:'2026-07-01T00:00:00Z'};
  let pwCalls=[];
  const stub={configured:true,error:null,
    ready:Promise.resolve(true),
    getUser:async()=>user,
    getProfile:async()=>({data:{tier:'root',created_at:'2026-07-01T00:00:00Z'},error:null}),
    listScenarios:async()=>({data:[{id:'1',name:'DC Sim A',calc:'capex-calculator',created_at:'2026-07-10T00:00:00Z',payload:{inputs:{a:1},summary:{total:1200000}}}],error:null}),
    deleteScenario:async()=>({}),
    signIn:async()=>({}),signUp:async()=>({data:{}}),signOut:async()=>({}),
    changePassword:async(p)=>{pwCalls.push(p);return {data:{},error:null};},
    onChange:()=>()=>{}};
  stub._pwCalls=pwCalls;
  Object.defineProperty(window,'rzSupa',{get:()=>stub,set:()=>{},configurable:false});
})();`;

const ctx=await br.createBrowserContext(); const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.evaluateOnNewDocument(STUB);
await pg.setViewport({width:1280,height:900});
await pg.goto(`${B}/account.html`,{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,1500));
let st=await pg.evaluate(()=>({
  grid:!getComputedStyle(document.getElementById('accountGrid')).display.includes('none'),
  auth:document.getElementById('authCard').classList.contains('hidden'),
  email:document.getElementById('pEmail').textContent,
  tier:document.getElementById('pTier').textContent,
  since:document.getElementById('pSince').textContent,
  scn:document.getElementById('scnCount').textContent,
  bg:getComputedStyle(document.body).backgroundColor}));
ok('signed-in: grid shown, auth hidden',st.grid&&st.auth);
ok('signed-in: profile filled',st.email.includes('bagus')&&st.tier==='root'&&st.since!=='—');
ok('signed-in: scenario count 1',st.scn==='1');
ok('suite dark bg',st.bg==='rgb(11, 17, 32)');
// password change flow
await pg.type('#newPw','newpass123'); await pg.type('#newPw2','newpass123');
await pg.click('#btnChangePw'); await new Promise(r=>setTimeout(r,400));
st=await pg.evaluate(()=>({msg:document.getElementById('pwStatus').textContent,calls:window.rzSupa._pwCalls.length}));
ok('password change calls changePassword + success msg',st.calls===1&&/Password changed/.test(st.msg));
// mismatch path
await pg.type('#newPw','abcdef'); await pg.type('#newPw2','abcdxx');
await pg.click('#btnChangePw'); await new Promise(r=>setTimeout(r,300));
st=await pg.evaluate(()=>document.getElementById('pwStatus').textContent);
ok('mismatch rejected client-side',/do not match/.test(st));
// theme toggle
await pg.click('#btnTheme'); await new Promise(r=>setTimeout(r,300));
st=await pg.evaluate(()=>({t:document.documentElement.getAttribute('data-theme'),bg:getComputedStyle(document.body).backgroundColor}));
ok('theme toggles to light + bg flips',st.t==='light'&&st.bg==='rgb(248, 250, 252)');
await pg.click('#btnTheme');
await pg.screenshot({path:'/tmp/account-signedin.png',fullPage:true});
ok('no page errors',errs.length===0);
if(errs.length)console.log(errs.slice(0,3));
await ctx.close(); await br.close(); srv.close();
console.log(fail?`FAILURES: ${fail}`:'ALL PASS'); process.exit(fail?1:0);
