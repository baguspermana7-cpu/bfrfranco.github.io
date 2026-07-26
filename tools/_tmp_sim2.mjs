import http from 'http'; import fs from 'fs'; import path from 'path'; import puppeteer from 'puppeteer';
const ROOT='/home/baguspermana7/rz-work'; const PORT=8112;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]); if(u.endsWith('/'))u+='index.html'; const fp=path.join(ROOT,u); fs.readFile(fp,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(d);});});
await new Promise(r=>server.listen(PORT,r));
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
await page.evaluateOnNewDocument(()=>localStorage.setItem('dcmoc-auth',JSON.stringify({state:{user:{email:'b@r.com',role:'root'}},version:0})));
await page.goto(`http://localhost:${PORT}/dcmoc/`,{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,800));
async function nav(group,leaf){ await page.evaluate((g)=>{const btn=[...document.querySelectorAll('aside button')].find(x=>x.textContent.toLowerCase().includes(g.toLowerCase())); if(btn)btn.click();},group); await new Promise(r=>setTimeout(r,400)); await page.evaluate((l)=>{const btns=[...document.querySelectorAll('aside button')]; const ex=btns.find(x=>x.textContent.trim()===l)||btns.filter(x=>x.textContent.toLowerCase().includes(l.toLowerCase())).sort((a,b)=>a.textContent.length-b.textContent.length)[0]; if(ex)ex.click();},leaf); await new Promise(r=>setTimeout(r,1400)); }
await nav('Operations','Staff Model Config');
const clicked=await page.evaluate(()=>{ const btn=[...document.querySelectorAll('button')].find(x=>x.title && /trace how Internal/i.test(x.title)); if(btn){btn.click(); return btn.title;} return null; });
await new Promise(r=>setTimeout(r,500));
const modal=await page.evaluate(()=>{ const t=document.body.innerText; return { hasTrace:/Trace . how this is calculated/i.test(t), hasHow:/How it is calculated/i.test(t) }; });
// also test a cause-effect lever: switch viz tab to cause
console.log('kpiClicked:',clicked,'| modal:',JSON.stringify(modal));
await b.close(); server.close();
