#!/usr/bin/env node
/* ============================================================================
 * probe-clipped-elements.mjs — WHICH element is hanging outside the viewBox?
 * ----------------------------------------------------------------------------
 * `test-conv-geometry.mjs` reports that a <circle> or a <rect> is clipped and by
 * how much. That is the right thing for a gate to say, but it is not enough to
 * fix one: a cockpit drawing holds hundreds of circles.
 *
 * This prints the offending element's attributes, which edge it crosses, and its
 * parent's basis hook. Two defects that resisted source-reading fell out of it
 * in minutes:
 *
 *   - #hSvg  a pipe-rack frame 72 units tall starting at y=619, in a 690-tall
 *            viewBox — one unit over, 2.5px on screen.
 *   - #coolSvg  flow dots with a POSITIVE animateMotion `begin`, parked at the
 *            SVG origin until their delay elapsed, radius hanging outside.
 *
 * Two things it must do, both learned the hard way:
 *   - activate a tab and measure THAT tab before moving on. Activating both and
 *     measuring afterwards leaves the first one hidden at zero width.
 *   - use getBoundingClientRect, not getBBox. getBBox excludes stroke and
 *     ignores the transform an animateMotion applies, so it reported nothing
 *     while the gate reported three.
 *
 *   node tools/probe-clipped-elements.mjs
 * ==========================================================================*/
import puppeteer from 'puppeteer';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
const MIME={'.css':'text/css','.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.npz':'application/octet-stream','.jsonl':'application/json'};
const root=process.cwd();
const srv=http.createServer((req,res)=>{
  const p=join(root,decodeURIComponent(req.url.split('?')[0]).replace(/^\//,''));
  if(!existsSync(p)||p.endsWith('/')){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'});
  res.end(readFileSync(p));
});
await new Promise(r=>srv.listen(0,r));
const port=srv.address().port;
const b=await puppeteer.launch({args:['--no-sandbox']});
const pg=await b.newPage();
await pg.setViewport({width:1680,height:1000});
await pg.goto(`http://127.0.0.1:${port}/datahallAI.html`,{waitUntil:'networkidle0'});
const set=TAB_SETS['datahallAI.html'];
const out={};
for(const sel of ['#coolSvg','#hSvg']){
  const entry=set.diagrams.find(d=>d.selector===sel);
  if(entry) await activateTab(pg,set,entry);
  out[sel]=await pg.evaluate((sel)=>{
    const visible=el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.01;};
    const svg=document.querySelector(sel); if(!svg)return 'missing';
    const hostBox=svg.getBoundingClientRect();
    if(hostBox.width<2)return 'not laid out ('+Math.round(hostBox.width)+'px)';
    const bad=[];
    for(const el of svg.querySelectorAll('text, rect, circle, path, line, polygon, image, use')){
      if(!visible(el))continue;
      const box=el.getBoundingClientRect();
      if(box.width===0&&box.height===0)continue;
      const worst=Math.max(hostBox.left-box.left,hostBox.top-box.top,box.right-hostBox.right,box.bottom-hostBox.bottom);
      if(worst>1){
        const edge=[['left',hostBox.left-box.left],['top',hostBox.top-box.top],['right',box.right-hostBox.right],['bottom',box.bottom-hostBox.bottom]].sort((a,b)=>b[1]-a[1])[0][0];
        bad.push({tag:el.tagName,cls:el.getAttribute('class')||'',over:+worst.toFixed(1),edge,
          attrs:['x','y','cx','cy','r','width','height'].map(a=>el.getAttribute(a)?a+'='+el.getAttribute(a):'').filter(Boolean).join(' '),
          text:(el.textContent||'').trim().slice(0,30),
          parentBasis:el.parentElement?(el.parentElement.getAttribute('data-basis-param')||''):''});
      }
    }
    return {host:Math.round(hostBox.width)+'x'+Math.round(hostBox.height),clipped:bad};
  }, sel);
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
