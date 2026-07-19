/* DCMOC synergy probe (Phase AH3) — asserts the SAME bound number renders
 * identically on every page that consumes it (value-bindings.ts contract). */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8105;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    try { statSync(join(ROOT, p)); res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream'); createReadStream(join(ROOT, p)).pipe(res); }
    catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
await page.evaluateOnNewDocument(() => localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 })));
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

async function nav(group, leaf) {
    if (group) {
        await page.evaluate((g) => { [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes(g))?.click(); }, group);
        await new Promise((r) => setTimeout(r, 400));
    }
    await page.evaluate((l) => {
        const btns = [...document.querySelectorAll('aside button')];
        (btns.find((x) => x.textContent.trim() === l) ?? btns.find((x) => x.textContent.trim().startsWith(l)))?.click();
    }, leaf);
    await new Promise((r) => setTimeout(r, 1500));
    return page.evaluate(() => document.body.innerText);
}
const grab = (txt, re) => { const m = txt.match(re); return m ? m[1] : null; };

let pass = 0, fail = 0;
const eq = (name, vals) => {
    const defined = vals.filter((v) => v != null);
    const ok = defined.length >= 2 && defined.every((v) => v === defined[0]);
    if (ok) { pass++; console.log(`  ✔ ${name}: ${defined[0]} on ${defined.length} pages`); }
    else { fail++; console.log(`  ✘ ${name}:`, JSON.stringify(vals)); }
};

/* capture per page */
const dash = await page.evaluate(() => document.body.innerText);
const capexT = await nav('CAPEX', 'CAPEX Engine');
const financeT = await nav('Financial', 'Financial');
const investT = await nav('Financial', 'Investment');
const archT = await nav('Architecture', 'Architecture Engine');
const opsT = await nav('Operations', 'Operations Overview');
const reqT = await nav('Requirements', 'Requirements & Workload');
const capT = await nav('Capacity', 'Capacity Planning');

console.log('— capex.total everywhere —');
eq('CAPEX total ($M)', [
    grab(dash, /TOTAL CAPEX\s*\$?([\d.]+)M/i),
    grab(capexT, /P50(?:\s*BASE)?[^$]{0,40}\$([\d.]+)M/i) ?? grab(capexT, /\$([\d.]+)M/),
    grab(financeT, /BUDGET[^$]{0,60}\$([\d.]+)M/i) ?? grab(financeT, /\$([\d.]+)M/),
    grab(investT, /TOTAL CAPEX[^$]{0,30}\$([\d.]+)M/i) ?? grab(investT, /\$([\d.]+)M/),
]);

console.log('— design PUE (dashboard = architecture) —');
const pueDash = grab(dash, /PUE[\s\S]{0,26}?(\d\.\d{1,2})/);
const pueArch = grab(archT, /PUE\s*\(?Design\)?[\s\S]{0,20}?(\d\.\d{1,2})/i) ?? grab(archT, /PUE\s+(\d\.\d{1,2})/);
eq('Design PUE', [pueDash && Number(pueDash).toFixed(2), pueArch && Number(pueArch).toFixed(2)]);
// Ops PUE is PARTIAL-LOAD (occupancy-adjusted) — a DIFFERENT documented basis;
// assert it is >= design PUE (partial load can only worsen PUE), not equal.
const pueOps = grab(opsT, /PUE[\s\S]{0,26}?(\d\.\d{1,2})/);
if (pueOps && pueDash && Number(pueOps) >= Number(pueDash) - 0.01) { pass++; console.log(`  ✔ Ops partial-load PUE ${pueOps} ≥ design ${pueDash} (documented basis)`); }
else { fail++; console.log(`  ✘ Ops PUE ${pueOps} vs design ${pueDash}`); }

console.log('— IT load everywhere —');
void reqT; // requirements IT load lives in an <input> — innerText can't see it
eq('IT Load (MW)', [
    grab(archT, /(\d\.\d) \/ [\d.]+ MW/) ?? grab(archT, /Total IT[\s\S]{0,30}?([\d.]+)/i),
    grab(capT, /IT LOAD[\s\S]{0,26}?([\d.]+) MW/i) ?? grab(capT, /([\d.]+) MW/),
]);
// Dashboard "Project Capacity" = IT × (1+margin) — a DIFFERENT documented value
// (value-bindings id dashboard.projectCapacity); assert it is ≥ the IT load.
const dashCap = grab(dash, /([\d.]+) MW/);
const itArch = grab(archT, /(\d\.\d) \/ [\d.]+ MW/) ?? grab(capT, /IT LOAD[\s\S]{0,26}?([\d.]+) MW/i) ?? grab(capT, /([\d.]+) MW/);
if (dashCap && itArch && Number(dashCap) >= Number(itArch)) { pass++; console.log(`  ✔ Dashboard design capacity ${dashCap} MW ≥ IT ${itArch} MW (margin basis, documented)`); }
else { fail++; console.log(`  ✘ Dashboard capacity ${dashCap} vs IT ${itArch}`); }

console.log('— tier label everywhere —');
eq('Tier', [
    grab(dash, /Tier (\d)/),
    grab(archT, /Tier (\d)/),
    grab(opsT, /Tier (\d)/),
]);

console.log(`\nSYNERGY RESULT: ${pass} pass / ${fail} fail`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
