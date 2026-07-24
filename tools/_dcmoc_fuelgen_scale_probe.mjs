/* Y-slice verification probe — genset unit class switches 2,500→3,000 kW above
 * 100 MW IT (DATA.fuelGen.genUnitScaleMw), FuelGen page reflects it live.
 * Also screenshots the finance surfaces for visual verification.
 * Run: node tools/_dcmoc_fuelgen_scale_probe.mjs */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8099;
const SHOTS = join(ROOT, 'tools', '_shots_y_verify');
mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, p);
    try {
        statSync(file);
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
    } catch { res.statusCode = 404; res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc.tour.v1', 'seen');
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
});
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };

async function nav(group, leaf) {
    const target = leaf ?? group;
    if (group && leaf) {
        await page.evaluate((g) => {
            const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.toLowerCase().includes(g.toLowerCase()));
            if (b) b.click();
        }, group);
        await new Promise((r) => setTimeout(r, 350));
    }
    await page.evaluate((l) => {
        const btns = [...document.querySelectorAll('aside button')];
        const exact = btns.find((x) => x.textContent.trim() === l);
        const cands = exact ? [exact] : btns.filter((x) => x.textContent.toLowerCase().includes(l.toLowerCase()));
        cands.sort((a, b2) => a.textContent.length - b2.textContent.length);
        if (cands[0]) cands[0].click();
    }, target);
    await new Promise((r) => setTimeout(r, 900));
}
const bodyHas = (t) => page.evaluate((x) => document.body.innerText.includes(x), t);
const shot = (n) => page.screenshot({ path: join(SHOTS, n), fullPage: false });

/* ── 1. baseline 2.5 MW project: unit class must be 2,500 kW ── */
await nav('Capacity Planning', 'Fuel & Generator');
if (!(await bodyHas('Genset'))) await nav(null, 'Fuel & Generator');
const onFuelGen1 = await bodyHas('Fuel');
const baseHas2500 = await page.evaluate(() => /x ?2\.5 ?MW/i.test(document.body.innerText));
ok('FuelGen page reached (baseline)', onFuelGen1);
ok('≤100MW project shows 2,500 kW genset class', baseHas2500);
await shot('fuelgen-2500-base.png');

/* ── 2. set IT load 150 MW via sim store → unit class must switch to 3,000 kW ── */
await page.evaluate(() => {
    // zustand store hook exposed on window? use the Requirements input path instead:
    // simplest deterministic path — write store via localStorage persist then reload
    const raw = JSON.parse(localStorage.getItem('dcmoc-simulation') || '{"state":{},"version":1}');
    raw.state.inputs = { ...(raw.state.inputs || {}), itLoad: 150000 };
    localStorage.setItem('dcmoc-simulation', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
await nav('Capacity Planning', 'Fuel & Generator');
if (!(await bodyHas('Genset'))) await nav(null, 'Fuel & Generator');
const bigHas3000 = await page.evaluate(() => /x ?3\.0 ?MW/i.test(document.body.innerText));
ok('150MW project shows 3,000 kW genset class (Y-slice scale rule)', bigHas3000);
await shot('fuelgen-3000-150mw.png');

/* ── 3. finance surfaces screenshots (revenue-basis unification, visual verify) ── */
await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('dcmoc-simulation') || '{"state":{},"version":1}');
    raw.state.inputs = { ...(raw.state.inputs || {}), itLoad: 2500 };
    localStorage.setItem('dcmoc-simulation', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
for (const [grp, leaf, file] of [
    [null, 'Dashboard', 'exec.png'],
    ['Financial', 'Financial', 'financial.png'],
    ['Construction', 'Phased Finance', 'phasedfin.png'],
]) {
    await nav(grp, leaf);
    await shot(file);
}
/* PhasedFin runs on the live $150 tunable — the page prints the DERIVED
 * break-even revenue ("Revenue can fall up to −X% (to $N/kW/mo)"); N must sit
 * just under the 150 basis (a 280-basis regression would print ~$27x). */
const pfRev = await page.evaluate(() => {
    const m = document.body.innerText.match(/to \$(\d+)\/kW\/mo/);
    return m ? Number(m[1]) : null;
});
ok('Phased Finance break-even derives from the $150 basis', pfRev != null && pfRev > 100 && pfRev <= 150, `(saw $${pfRev})`);

ok('0 page errors', errors.length === 0, errors[0] || '');
console.log(`\nY-VERIFY PROBE: ${pass} pass / ${fail} fail`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
