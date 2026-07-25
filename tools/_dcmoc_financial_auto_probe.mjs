/* Financial AUTO/OVERRIDE probe — every Pro-Forma field defaults to AUTO (real
 * sourced value), a per-field tick flips just that field to OVERRIDE, revenue
 * writes through to the sim-store SSOT. Run: node tools/_dcmoc_financial_auto_probe.mjs */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8096;
const SHOTS = join(ROOT, 'tools', '_shots_y_verify');
mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, p);
    try { statSync(file); res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream'); createReadStream(file).pipe(res); }
    catch { res.statusCode = 404; res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1100 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc.tour.v1', 'seen');
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
    // seed a real market (Northern Virginia) — capex store persist version MUST be 1
    localStorage.setItem('dcmoc-capex', JSON.stringify({ state: { inputs: { cityMarket: 'northern_virginia' } }, version: 1 }));
});
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };

async function toFinancialProForma() {
    await page.evaluate(() => { const g = [...document.querySelectorAll('aside button')].find(x => x.textContent.trim().startsWith('12') || x.textContent.trim() === 'Financial'); if (g) g.click(); });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => { const b = [...document.querySelectorAll('aside button')].find(x => x.textContent.trim() === 'Financial'); if (b) b.click(); });
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('Pro Forma')); if (t) t.click(); });
    await new Promise((r) => setTimeout(r, 1500));
}
const countText = (t) => page.evaluate((x) => [...document.querySelectorAll('span,button')].filter(e => e.textContent.trim() === x).length, t);

await toFinancialProForma();

/* 1 · every field defaults to AUTO (15 fields) */
const autoChips = await countText('auto');
const ticks = await countText('tick to edit');
ok('all fields default to AUTO (chips)', autoChips >= 15, `(${autoChips})`);
ok('every field has a tick-to-override control', ticks >= 15, `(${ticks})`);
await page.screenshot({ path: join(SHOTS, 'financial-auto.png') });

/* 2 · revenue AUTO = the selected market's real colo rate, written through to
 *     the sim-store SSOT (N.Virginia coloPrice $215 — regression guard for the
 *     broken northern_virginia→n-virginia alias that fell back to the band). */
const storeRev = await page.evaluate(() => JSON.parse(localStorage.getItem('dcmoc-simulation')).state.inputs.revenuePerKwMonth);
ok('revenue AUTO resolves the market colo rate + writes through (N.Virginia $215)', storeRev === 215, `($${storeRev})`);

/* 3 · tick a field → OVERRIDE appears; the rest stay AUTO */
const overrideBefore = await countText('override');
await page.evaluate(() => { const btns = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'tick to edit'); if (btns[1]) btns[1].click(); });
await new Promise((r) => setTimeout(r, 600));
const overrideAfter = await countText('override');
const autoAfter = await countText('auto');
ok('tick flips just that field to OVERRIDE', overrideAfter === overrideBefore + 1, `(${overrideBefore}→${overrideAfter})`);
ok('other fields stay AUTO after one override', autoAfter >= 14, `(${autoAfter})`);

/* 4 · un-tick returns it to AUTO */
await page.evaluate(() => { const btns = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === '✓ manual'); if (btns[0]) btns[0].click(); });
await new Promise((r) => setTimeout(r, 600));
const overrideEnd = await countText('override');
ok('un-tick returns the field to AUTO', overrideEnd === overrideBefore, `(${overrideEnd})`);

/* 5 · AUTO reacts to the country — discount = Damodaran WACC, tax = country
 *     corporate rate. Switch to Singapore (WACC 7.0% / tax 17.0%). */
const readDiscTax = () => page.evaluate(() => {
    const lbls = [...document.querySelectorAll('label')];
    const get = (name) => { const l = lbls.find(x => x.textContent.includes(name)); if (!l) return null; const box = l.parentElement.querySelector('div.rounded'); return box ? box.textContent.trim() : null; };
    return { disc: get('Discount Rate'), tax: get('Tax Rate') };
});
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('dcmoc-simulation')); raw.state.selectedCountry = { id: 'SG' }; localStorage.setItem('dcmoc-simulation', JSON.stringify(raw)); });
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
await toFinancialProForma();
const sg = await readDiscTax();
ok('discount AUTO = country WACC (SG 7.0%)', sg.disc === '7.0', `(${sg.disc})`);
ok('tax AUTO = country corporate rate (SG 17.0%)', sg.tax === '17.0', `(${sg.tax})`);

ok('0 page errors', errors.length === 0, errors[0] || '');
console.log(`\nFINANCIAL-AUTO PROBE: ${pass} pass / ${fail} fail`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
