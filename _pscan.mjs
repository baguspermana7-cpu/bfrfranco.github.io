import puppeteer from "puppeteer";
const pages=process.argv.slice(2);
const b=await puppeteer.launch({args:["--no-sandbox"]});
const probe=()=>{
  const hit=[];
  for(const el of document.querySelectorAll('*')){
    const s=getComputedStyle(el);
    for(const k of ['color','backgroundColor','borderTopColor','borderLeftColor','fill','stroke']){
      const v=s[k]; if(!v) continue;
      const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(v); if(!m) continue;
      if(m[4]!==undefined && parseFloat(m[4])<0.04) continue;
      const r=+m[1],g=+m[2],bl=+m[3];
      const mx=Math.max(r,g,bl),mn=Math.min(r,g,bl),d=mx-mn; if(d<28) continue;
      let h; if(mx===r)h=((g-bl)/d)%6; else if(mx===g)h=(bl-r)/d+2; else h=(r-g)/d+4;
      h*=60; if(h<0)h+=360;
      if(h>=238&&h<=310&&!(r===0&&g===0&&bl===238)){
        const cls=(el.className&&el.className.toString?el.className.toString():'').trim().split(/\s+/)[0]||'';
        hit.push(el.tagName+(cls?'.'+cls:'')+' '+k+' '+v);
      }
    }
  }
  return [...new Set(hit)];
};
for(const page of pages){
  const out={};
  for(const th of ['light','dark']){
    const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
    await p.evaluateOnNewDocument(t=>{try{localStorage.setItem('theme',t)}catch(e){}},th);
    try{ await p.goto('http://127.0.0.1:8081/'+page,{waitUntil:'networkidle2',timeout:45000}); }catch(e){ out[th]=['LOAD-FAIL']; await p.close(); continue; }
    await p.evaluate(t=>document.documentElement.setAttribute('data-theme',t),th);
    await new Promise(r=>setTimeout(r,1800));
    out[th]=await p.evaluate(probe);
    await p.close();
  }
  const n=out.light.length+out.dark.length;
  console.log(`${n===0?'OK  ':'HIT '} ${page}  light=${out.light.length} dark=${out.dark.length}`);
  if(n) for(const th of ['light','dark']) out[th].slice(0,8).forEach(x=>console.log('     ',th,x));
}
await b.close();
