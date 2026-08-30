// Read-only UI/UX audit probe — captures screenshots + DOM facts for both DC dashboards.
// Writes evidence to /tmp/uiux_audit/. Deletes itself NEVER (the caller deletes).
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'fs/promises';
import {
  assertAuditFindingsComplete,
  assertAuthorizedAuditState,
  enterAuthorizedAuditState,
  primeCockpitAuditDocument,
} from './lib/cockpit-audit-state.mjs';

const OUT = '/tmp/uiux_audit';
const BASE = 'http://127.0.0.1:8081';
const VIEWPORTS = [
  { name:'d',  w:1440, h:900 },
  { name:'m',  w:390,  h:844 },
];
const THEMES = ['light','dark'];

// DC-AI panels (the ones IN-SCOPE — p-dash is OUT of scope per orchestrator note)
const DC_AI_TABS = ['over','hall','rack','cool','elec','net','fire','bms'];
const DC_AI_COCKPIT = 'dc-ai';

// Conv suite pages
const CONV_PAGES = [
  { name:'dc-conventional', url:'/dc-conventional.html', cockpit:'dc-conventional' },
  { name:'epms',            url:'/EPMS_Telemetry.html', cockpit:'epms' },
  { name:'datahall',        url:'/datahall.html', cockpit:'datahall' },
  { name:'chiller-plant',   url:'/chiller-plant.html', cockpit:'chiller-plant' },
  { name:'fire-system',     url:'/fire-system.html', cockpit:'fire-system' },
  { name:'fuel-system',     url:'/fuel-system.html', cockpit:'fuel-system' },
  { name:'water-system',    url:'/water-system.html', cockpit:'water-system' },
  { name:'ict',             url:'/ict.html', cockpit:'ict' },
];

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  args:['--no-sandbox','--disable-setuid-sandbox'],
  defaultViewport:null,
});

const findings = {};
const expectedKeys = VIEWPORTS.flatMap((viewport) => THEMES.flatMap((theme) => [
  ...DC_AI_TABS.map((tab) => `dcai_${tab}_${theme}_${viewport.name}`),
  `dcai_bod_${theme}_${viewport.name}`,
  ...CONV_PAGES.map((page) => `${page.name}_${theme}_${viewport.name}`),
]));

async function inspectPage(page, key) {
  return await page.evaluate(() => {
    function rgbToHex(rgb){
      const m = rgb && rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if(!m) return null;
      const h = (n)=> Number(n).toString(16).padStart(2,'0');
      return ('#'+h(m[1])+h(m[2])+h(m[3])).toUpperCase();
    }
    function isRed(hex){
      if(!hex) return false;
      // alarm-red family — r>=170 and g<90 and b<90
      const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
      return r>=170 && g<90 && b<90;
    }
    function isNeon(hex){
      if(!hex) return false;
      const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
      // neon greens/cyans 0xff combined with 0x00/low
      return (r<40 && g>=240 && b<60) || (r<40 && g>=200 && b>=200) || (r<40 && g>=200 && b<60 && r+b<100);
    }
    // horizontal overflow
    const docW = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    const overflow = Math.max(0, scrollW - docW);
    // count visible red elements (text or border)
    const all = Array.from(document.querySelectorAll('*'));
    const visible = all.filter(el=>{
      const r = el.getBoundingClientRect();
      if(r.width<2||r.height<2) return false;
      const s = getComputedStyle(el);
      if(s.visibility==='hidden'||s.display==='none'||parseFloat(s.opacity||'1')<0.1) return false;
      return true;
    });
    let redCount=0, neonCount=0;
    const redSamples=[], neonSamples=[];
    visible.forEach(el=>{
      const cs = getComputedStyle(el);
      const col = rgbToHex(cs.color);
      const bg = rgbToHex(cs.backgroundColor);
      const bc = rgbToHex(cs.borderColor || cs.borderTopColor);
      const txt = (el.textContent||'').trim().slice(0,40);
      // ignore alarm/red intentional uses by class hint
      const cls = el.className && typeof el.className==='string'? el.className: (el.className && el.className.baseVal? el.className.baseVal:'');
      const looksAlarm = /alarm|crit|alert|trip|fire|fault|leak|emerg|epo|stop/i.test(cls+' '+(el.id||'')+' '+txt);
      if(isRed(col) && !looksAlarm){ redCount++; if(redSamples.length<8) redSamples.push({tag:el.tagName.toLowerCase(),cls:cls.slice(0,60),id:el.id,txt:txt,color:col}); }
      if(isRed(bg) && !looksAlarm){ redCount++; if(redSamples.length<8) redSamples.push({tag:el.tagName.toLowerCase(),cls:cls.slice(0,60),id:el.id,txt:txt,bg:bg}); }
      if(isNeon(col) || isNeon(bg)){ neonCount++; if(neonSamples.length<6) neonSamples.push({tag:el.tagName.toLowerCase(),cls:cls.slice(0,60),id:el.id,color:col,bg:bg}); }
    });
    // count tabular-nums usage
    let tabCount=0, numCount=0;
    visible.forEach(el=>{
      const cs = getComputedStyle(el);
      const txt = (el.textContent||'').trim();
      // detect numeric content cells (short, mostly digits)
      if(txt.length>0 && txt.length<14 && /[\d]/.test(txt) && /^[\d.,\s%°CMWkVAHzhrL\/\-+]*$/.test(txt) && el.children.length===0){
        numCount++;
        if(cs.fontVariantNumeric && cs.fontVariantNumeric.includes('tabular')) tabCount++;
      }
    });
    // body font family
    const bf = getComputedStyle(document.body).fontFamily;
    // h1/h2 count
    const h1n = document.querySelectorAll('h1').length;
    const h2n = document.querySelectorAll('h2').length;
    // modals
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const ariaModal = dialogs.filter(d=>d.getAttribute('aria-modal')==='true').length;
    // skip-link
    const skip = !!document.querySelector('a[href="#main-content"], a[href^="#main"], .skip-link, .skip-to-content');
    // alarm strip / top status
    const topBar = !!document.querySelector('.alarm-strip, .top-status, #alarmStrip, [class*="alarm-strip"], [class*="status-bar"]');
    // labels font size
    const smallLabels = visible.filter(el=>{
      const cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize||'0');
      const txt = (el.textContent||'').trim();
      return fs>0 && fs<10 && txt.length>0 && txt.length<40 && el.children.length===0;
    }).length;
    // disabled feed-A red? feed-B red? — count "Feed A"/"Feed B" labels in red
    return { docW, scrollW, overflow, redCount, redSamples, neonCount, neonSamples,
             tabCount, numCount,
             tabularRatio: numCount>0? (tabCount/numCount).toFixed(2): 'n/a',
             bodyFont: bf, h1n, h2n, dialogs:dialogs.length, ariaModalCount:ariaModal,
             skipLink:skip, topBar, smallLabels };
  });
}

for (const vp of VIEWPORTS){
  for (const theme of THEMES){
    // ====== DC AI ======
    const page = await browser.newPage();
    await page.setViewport({ width:vp.w, height:vp.h, deviceScaleFactor:1 });
    await page.emulateMediaFeatures([{ name:'prefers-color-scheme', value:theme }]);
    try {
      await primeCockpitAuditDocument(page, theme);
      await page.goto(BASE+'/datahallAI.html', { waitUntil:'networkidle2', timeout:30000 });
      await enterAuthorizedAuditState(page, DC_AI_COCKPIT);
      // explicitly set theme attr if engine uses [data-theme]
      await page.evaluate((t)=>{ document.documentElement.setAttribute('data-theme', t); document.body.setAttribute('data-theme', t); }, theme);
      await new Promise(r=>setTimeout(r,800));

      for (const tab of DC_AI_TABS){
        await page.evaluate((t)=>{
          const btn = document.querySelector('nav.tabs button[data-t="'+t+'"]');
          if(btn) btn.click();
        }, tab);
        await new Promise(r=>setTimeout(r,500));
        await assertAuthorizedAuditState(page, DC_AI_COCKPIT);
        const key = `dcai_${tab}_${theme}_${vp.name}`;
        const path = `${OUT}/${key}.png`;
        await page.screenshot({ path, fullPage:false });
        const facts = await inspectPage(page, key);
        findings[key] = { path, ...facts };
      }
      // BoD drawer probe — open via gid('bodTrig') if present
      await page.evaluate(()=>{
        const t = document.getElementById('bodTrig'); if(t) t.click();
      });
      await new Promise(r=>setTimeout(r,500));
      const key = `dcai_bod_${theme}_${vp.name}`;
      await page.screenshot({ path:`${OUT}/${key}.png`, fullPage:false });
      const bodFacts = await page.evaluate(()=>{
        const d = document.getElementById('bodDrawer');
        if(!d) return { found:false };
        const ariaModal = d.getAttribute('aria-modal');
        const role = d.getAttribute('role');
        const visible = getComputedStyle(d).display !== 'none' && getComputedStyle(d).visibility !== 'hidden' && d.getAttribute('aria-hidden') !== 'true';
        const closeBtn = !!document.getElementById('bodDrawerClose');
        return { found:true, ariaModal, role, visible, closeBtn };
      });
      if (!bodFacts.found) throw new Error('AI basis drawer capture target is missing');
      findings[key] = { path:`${OUT}/${key}.png`, ...bodFacts };
      delete findings[`dcai_ERR_${theme}_${vp.name}`];
    } catch(e){
      findings[`dcai_ERR_${theme}_${vp.name}`] = { error: e.message };
    }
    await page.close();

    // ====== Conv suite ======
    for (const cp of CONV_PAGES){
      const cpage = await browser.newPage();
      await cpage.setViewport({ width:vp.w, height:vp.h, deviceScaleFactor:1 });
      await cpage.emulateMediaFeatures([{ name:'prefers-color-scheme', value:theme }]);
      try {
        await primeCockpitAuditDocument(cpage, theme);
        await cpage.goto(BASE+cp.url, { waitUntil:'networkidle2', timeout:30000 });
        await enterAuthorizedAuditState(cpage, cp.cockpit);
        await cpage.evaluate((t)=>{
          document.documentElement.setAttribute('data-theme', t);
          document.body.setAttribute('data-theme', t);
        }, theme);
        await new Promise(r=>setTimeout(r,1200));
        await assertAuthorizedAuditState(cpage, cp.cockpit);
        const key = `${cp.name}_${theme}_${vp.name}`;
        await cpage.screenshot({ path:`${OUT}/${key}.png`, fullPage:false });
        const facts = await inspectPage(cpage, key);
        findings[key] = { path:`${OUT}/${key}.png`, ...facts };
        delete findings[`${cp.name}_ERR_${theme}_${vp.name}`];
      } catch(e){
        findings[`${cp.name}_ERR_${theme}_${vp.name}`] = { error: e.message };
      }
      await cpage.close();
    }
  }
}

await writeFile(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
await browser.close();
assertAuditFindingsComplete(findings, expectedKeys);
console.log('Done. Findings →', `${OUT}/findings.json`);
