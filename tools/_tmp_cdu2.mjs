import http from 'http'; import fs from 'fs'; import path from 'path'; import puppeteer from 'puppeteer';
const ROOT='/home/baguspermana7/rz-work'; const PORT=8106;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]); if(u.endsWith('/'))u+='index.html'; const fp=path.join(ROOT,u); fs.readFile(fp,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(d);});});
await new Promise(r=>server.listen(PORT,r));
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
await page.evaluateOnNewDocument(()=>localStorage.setItem('dcmoc-auth',JSON.stringify({state:{user:{email:'b@r.com',role:'root'}},version:0})));
await page.goto(`http://localhost:${PORT}/dcmoc/`,{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,700));
async function nav(group,leaf){ await page.evaluate((g)=>{const btn=[...document.querySelectorAll('aside button')].find(x=>x.textContent.toLowerCase().includes(g.toLowerCase())); if(btn)btn.click();},group); await new Promise(r=>setTimeout(r,400)); await page.evaluate((l)=>{const btns=[...document.querySelectorAll('aside button')]; const ex=btns.find(x=>x.textContent.trim()===l)||btns.filter(x=>x.textContent.toLowerCase().includes(l.toLowerCase())).sort((a,b)=>a.textContent.length-b.textContent.length)[0]; if(ex)ex.click();},leaf); await new Promise(r=>setTimeout(r,1200)); }
await nav('Capacity Planning','CDU');
const evap=await page.evaluate(()=>{ const t=document.body.innerText; return { hasWater:/Water\s*&\s*Glycol Balance/i.test(t), annual:(t.match(/Annual Water[\s\S]{0,30}?([\d,]+)\s*m³/)||[])[1], wue:(t.match(/WUE\s*([\d.]+)\s*L\/kWh/)||[])[1], evap:(t.match(/Evaporation[\s\S]{0,20}?([\d,]+)\s*m³/)||[])[1] }; });
await page.evaluate(()=>{ for(const s of document.querySelectorAll('select')){ if([...s.options].map(o=>o.value).includes('dry')){ const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; set.call(s,'dry'); s.dispatchEvent(new Event('change',{bubbles:true})); return; } } });
await new Promise(r=>setTimeout(r,800));
const dry=await page.evaluate(()=>{ const t=document.body.innerText; return { annual:(t.match(/Annual Water[\s\S]{0,30}?([\d,]+)\s*m³/)||[])[1], evap:(t.match(/Evaporation[\s\S]{0,20}?([\d,]+)\s*m³/)||[])[1] }; });
console.log('evaporative:',JSON.stringify(evap));
console.log('dry        :',JSON.stringify(dry));
await b.close(); server.close();
