#!/usr/bin/env node
import puppeteer from 'puppeteer';
import fs from 'fs';
const html = fs.readFileSync('spares-readiness-calculator.html','utf8');
const events = ['onclick','oninput','onchange','onkeyup','onfocus','onblur','onsubmit','onmouseover','onmouseout'];
const names = new Set();
for (const ev of events) {
  const re = new RegExp(`${ev}="([^"]+)"|${ev}='([^']+)'`, 'g');
  let m;
  while ((m = re.exec(html)) !== null) {
    const code = m[1] || m[2];
    const all = code.matchAll(/(?:^|[\s;,(])([a-zA-Z_$][\w$]*)\s*\(/g);
    for (const a of all) {
      const n = a[1];
      // skip JS built-ins + DOM API calls
      if (['if','for','while','return','function','typeof','new','document','window','setTimeout','setInterval','parseInt','parseFloat','Math','Array','Object','JSON','console','localStorage','sessionStorage','event','this','alert','confirm','prompt','encodeURIComponent','decodeURIComponent'].includes(n)) continue;
      names.add(n);
    }
  }
}
console.log('Total unique handler function names:', names.size);
const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://localhost:8081/spares-readiness-calculator.html?nc=${Date.now()}`, { waitUntil:'networkidle2'});
const missing=[];
for (const n of [...names].sort()) {
  const ty = await page.evaluate(name => typeof window[name], n);
  if (ty !== 'function') missing.push({name:n, type:ty});
}
console.log('\nMissing on window:', missing.length);
missing.forEach(m => console.log(`  ${m.name} = ${m.type}`));
console.log('\nPage errors during probe:', errs.length);
errs.slice(0,10).forEach(e => console.log('  ', e));
await browser.close();
