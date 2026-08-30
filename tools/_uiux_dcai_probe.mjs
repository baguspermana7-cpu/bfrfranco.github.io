// DC-AI only — fixed
import puppeteer from 'puppeteer';
import { mkdir, writeFile, readFile } from 'fs/promises';
import {
  assertAuditFindingsComplete,
  assertAuthorizedAuditState,
  enterAuthorizedAuditState,
  primeCockpitAuditDocument,
} from './lib/cockpit-audit-state.mjs';
const OUT='/tmp/uiux_audit'; const BASE='http://127.0.0.1:8081';
const VIEWPORTS=[{name:'d',w:1440,h:900},{name:'m',w:390,h:844}];
const THEMES=['light','dark'];
const DC_AI_TABS=['over','hall','rack','cool','elec','net','fire','bms'];
const DC_AI_COCKPIT='dc-ai';

await mkdir(OUT,{recursive:true});
const browser=await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox'],defaultViewport:null});
let existing={}; try{ existing=JSON.parse(await readFile(`${OUT}/findings.json`,'utf8')); }catch(e){}
const findings={...existing};
const expectedKeys=VIEWPORTS.flatMap((viewport)=>THEMES.flatMap((theme)=>[
  ...DC_AI_TABS.map((tab)=>`dcai_${tab}_${theme}_${viewport.name}`),
  `dcai_bod_${theme}_${viewport.name}`,
]));

function inspectFn(){
  function rgbToHex(rgb){const m=rgb&&rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!m)return null;const h=n=>Number(n).toString(16).padStart(2,'0');return ('#'+h(m[1])+h(m[2])+h(m[3])).toUpperCase();}
  function isRed(hex){if(!hex)return false;const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return r>=170&&g<90&&b<90;}
  function isNeon(hex){if(!hex)return false;const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return (r<40&&g>=240&&b<60)||(r<40&&g>=200&&b>=200)||(r<40&&g>=200&&b<60&&r+b<100);}
  const docW=document.documentElement.clientWidth,scrollW=document.documentElement.scrollWidth,overflow=Math.max(0,scrollW-docW);
  const all=Array.from(document.querySelectorAll('*'));
  const visible=all.filter(el=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;const s=getComputedStyle(el);if(s.visibility==='hidden'||s.display==='none'||parseFloat(s.opacity||'1')<0.1)return false;return true;});
  let redCount=0,neonCount=0;const redSamples=[],neonSamples=[];
  visible.forEach(el=>{
    const cs=getComputedStyle(el);const col=rgbToHex(cs.color);const bg=rgbToHex(cs.backgroundColor);
    const txt=(el.textContent||'').trim().slice(0,40);
    const cls=el.className&&typeof el.className==='string'?el.className:(el.className&&el.className.baseVal?el.className.baseVal:'');
    const looksAlarm=/alarm|crit|alert|trip|fire|fault|leak|emerg|epo|stop|warn|hot|red|vr\b/i.test(cls+' '+(el.id||'')+' '+txt);
    if(isRed(col)&&!looksAlarm){redCount++;if(redSamples.length<8)redSamples.push({tag:el.tagName.toLowerCase(),cls:cls.slice(0,60),id:el.id,txt,color:col});}
    if(isRed(bg)&&!looksAlarm){redCount++;if(redSamples.length<8)redSamples.push({tag:el.tagName.toLowerCase(),cls:cls.slice(0,60),id:el.id,txt,bg});}
    if(isNeon(col)||isNeon(bg)){neonCount++;if(neonSamples.length<6)neonSamples.push({tag:el.tagName.toLowerCase(),cls:cls.slice(0,60),id:el.id,color:col,bg});}
  });
  let tabCount=0,numCount=0;
  visible.forEach(el=>{const cs=getComputedStyle(el);const txt=(el.textContent||'').trim();if(txt.length>0&&txt.length<14&&/[\d]/.test(txt)&&/^[\d.,\s%°CMWkVAHzhrL\/\-+]*$/.test(txt)&&el.children.length===0){numCount++;if(cs.fontVariantNumeric&&cs.fontVariantNumeric.includes('tabular'))tabCount++;}});
  const bf=getComputedStyle(document.body).fontFamily;
  const h1n=document.querySelectorAll('h1').length,h2n=document.querySelectorAll('h2').length;
  const dialogs=Array.from(document.querySelectorAll('[role="dialog"]'));
  const ariaModal=dialogs.filter(d=>d.getAttribute('aria-modal')==='true').length;
  const skip=!!document.querySelector('a[href="#main-content"], a[href^="#main"], .skip-link, .skip-to-content');
  const topBar=!!document.querySelector('.alarm-strip, .top-status, #alarmStrip, [class*="alarm-strip"], [class*="status-bar"], .tabs, nav.tabs');
  const smallLabels=visible.filter(el=>{const cs=getComputedStyle(el);const fs=parseFloat(cs.fontSize||'0');const txt=(el.textContent||'').trim();return fs>0&&fs<10&&txt.length>0&&txt.length<40&&el.children.length===0;}).length;
  return {docW,scrollW,overflow,redCount,redSamples,neonCount,neonSamples,tabCount,numCount,tabularRatio:numCount>0?(tabCount/numCount).toFixed(2):'n/a',bodyFont:bf,h1n,h2n,dialogs:dialogs.length,ariaModalCount:ariaModal,skipLink:skip,topBar,smallLabels};
}

for(const vp of VIEWPORTS){
  for(const theme of THEMES){
    const page=await browser.newPage();
    await page.setViewport({width:vp.w,height:vp.h,deviceScaleFactor:1});
    await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
    try{
      await primeCockpitAuditDocument(page, theme);
      await page.goto(BASE+'/datahallAI.html',{waitUntil:'networkidle2',timeout:30000});
      await enterAuthorizedAuditState(page,DC_AI_COCKPIT);
      await page.evaluate(t=>{document.documentElement.setAttribute('data-theme',t);document.body.setAttribute('data-theme',t);try{localStorage.setItem('theme',t);}catch(e){}},theme);
      await new Promise(r=>setTimeout(r,1200));
      for(const tab of DC_AI_TABS){
        await page.evaluate(t=>{const btn=document.querySelector('nav.tabs button[data-t="'+t+'"]');if(btn)btn.click();},tab);
        await new Promise(r=>setTimeout(r,700));
        await assertAuthorizedAuditState(page,DC_AI_COCKPIT);
        const key=`dcai_${tab}_${theme}_${vp.name}`;
        const path=`${OUT}/${key}.png`;
        await page.screenshot({path,fullPage:false});
        const facts=await page.evaluate(inspectFn);
        findings[key]={path,...facts};
      }
      // BoD drawer
      await page.evaluate(()=>{const t=document.getElementById('bodTrig');if(t)t.click();});
      await new Promise(r=>setTimeout(r,700));
      const bk=`dcai_bod_${theme}_${vp.name}`;
      await page.screenshot({path:`${OUT}/${bk}.png`,fullPage:false});
      const bod=await page.evaluate(()=>{const d=document.getElementById('bodDrawer');if(!d)return{found:false};return{found:true,ariaModal:d.getAttribute('aria-modal'),role:d.getAttribute('role'),ariaHidden:d.getAttribute('aria-hidden'),display:getComputedStyle(d).display,closeBtn:!!document.getElementById('bodDrawerClose'),escSupport:!!document.getElementById('bodDrawerClose')};});
      if(!bod.found)throw new Error('AI basis drawer capture target is missing');
      findings[bk]={path:`${OUT}/${bk}.png`,...bod};
      delete findings[`dcai_ERR_${theme}_${vp.name}`];
    }catch(e){findings[`dcai_ERR_${theme}_${vp.name}`]={error:e.message};}
    await page.close();
  }
}
await writeFile(`${OUT}/findings.json`,JSON.stringify(findings,null,2));
await browser.close();
assertAuditFindingsComplete(findings,expectedKeys);
console.log('Done DC-AI →',`${OUT}/findings.json`);
