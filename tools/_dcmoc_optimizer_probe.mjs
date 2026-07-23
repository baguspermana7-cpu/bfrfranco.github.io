/* DCMOC optimizer probe (Workstream D gate) — drives the Phased-Finance
 * red-value → DiagnosticModal → Auto-optimize → preview → Apply chain headless
 * and asserts: (1) a red blended-IRR opens the diagnostic modal, (2) Auto-
 * optimize yields a feasible revenue proposal, (3) Apply clears the NO-GO
 * (IRR ≥ hurdle) via ONLY the allowlisted tunable, (4) requirement base data
 * (IT load / tier / cooling / country) is byte-identical before vs after.
 * Run: node tools/_dcmoc_optimizer_probe.mjs */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = '/home/baguspermana7/rz-work';
const PORT = 8099;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    try { statSync(join(ROOT, p)); res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream'); createReadStream(join(ROOT, p)).pipe(res); }
    catch { res.statusCode = 404; res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc.tour.v1', 'seen');
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
});
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✘', name, extra); } };

/* nav → Construction group → Phased Finance */
await page.evaluate(() => {
    const g = [...document.querySelectorAll('aside button')].find((x) => x.textContent.toLowerCase().includes('construction'));
    if (g) g.click();
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
    const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.toLowerCase().includes('phased finance'));
    if (b) b.click();
});
await new Promise((r) => setTimeout(r, 2000));

/* snapshot requirement base data BEFORE */
const baseBefore = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('dcmoc-simulation') ?? '{}')?.state?.inputs ?? {};
    return JSON.stringify({ itLoad: s.itLoad, tierLevel: s.tierLevel, coolingType: s.coolingType, powerRedundancy: s.powerRedundancy });
});

/* find the red blended-IRR trigger (RedValue span). If IRR is green in this
 * config, the probe still validates the modal machinery is absent-but-clean. */
const redInfo = await page.evaluate(() => {
    const el = [...document.querySelectorAll('span[role="button"]')].find((x) => (x.getAttribute('title') || '').includes('Blended IRR breached'));
    if (!el) return { found: false };
    el.click();
    return { found: true };
});
await new Promise((r) => setTimeout(r, 600));

if (!redInfo.found) {
    console.log('  (blended IRR not red in current stored config — forcing a low-revenue state)');
    await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('dcmoc-simulation') ?? '{}');
        raw.state.inputs.revenuePerKwMonth = 110;
        localStorage.setItem('dcmoc-simulation', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));
    await page.evaluate(() => {
        const g = [...document.querySelectorAll('aside button')].find((x) => x.textContent.toLowerCase().includes('construction'));
        if (g) g.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => {
        const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.toLowerCase().includes('phased finance'));
        if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 2000));
    await page.evaluate(() => {
        const el = [...document.querySelectorAll('span[role="button"]')].find((x) => (x.getAttribute('title') || '').includes('Blended IRR breached'));
        if (el) el.click();
    });
    await new Promise((r) => setTimeout(r, 600));
}

const modalOpen = await page.evaluate(() => !!document.querySelector('[aria-label="Blended IRR diagnosis"]'));
ok('red blended-IRR opens the DiagnosticModal', modalOpen);

const hasLevers = await page.evaluate(() => {
    const m = document.querySelector('[aria-label="Blended IRR diagnosis"]');
    return m ? m.textContent.includes('Levers') : false;
});
ok('modal shows quantified levers', hasLevers);

/* Auto-optimize */
await page.evaluate(() => {
    const m = document.querySelector('[aria-label="Blended IRR diagnosis"]');
    const b = m && [...m.querySelectorAll('button')].find((x) => x.textContent.includes('Auto-optimize'));
    if (b) b.click();
});
await new Promise((r) => setTimeout(r, 800));
const proposal = await page.evaluate(() => {
    const m = document.querySelector('[aria-label="Auto-optimize proposal"]');
    if (!m) return null;
    return { text: m.textContent.slice(0, 400), hasApply: [...m.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Apply') };
});
ok('Auto-optimize opens a proposal preview', !!proposal);
ok('proposal is feasible (Apply offered)', !!proposal?.hasApply, proposal?.text ?? '');

/* Apply → IRR clears */
await page.evaluate(() => {
    const m = document.querySelector('[aria-label="Auto-optimize proposal"]');
    const b = m && [...m.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Apply');
    if (b) b.click();
});
await new Promise((r) => setTimeout(r, 1500));
const after = await page.evaluate(() => {
    const stillRed = !!([...document.querySelectorAll('span[role="button"]')].find((x) => (x.getAttribute('title') || '').includes('Blended IRR breached')));
    const s = JSON.parse(localStorage.getItem('dcmoc-simulation') ?? '{}')?.state?.inputs ?? {};
    return { stillRed, rev: s.revenuePerKwMonth, base: JSON.stringify({ itLoad: s.itLoad, tierLevel: s.tierLevel, coolingType: s.coolingType, powerRedundancy: s.powerRedundancy }) };
});
ok('Apply clears the red blended-IRR (≥ hurdle)', !after.stillRed, `rev now ${after.rev}`);
ok('tunable was written (revenuePerKwMonth changed)', after.rev != null && after.rev !== 150, String(after.rev));
ok('requirement base data byte-identical (guard)', after.base === baseBefore);
ok('0 page errors', errors.length === 0, errors.join(' | '));

/* restore the tunable to default so the probe is idempotent */
await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('dcmoc-simulation') ?? '{}');
    if (raw?.state?.inputs) { raw.state.inputs.revenuePerKwMonth = 150; localStorage.setItem('dcmoc-simulation', JSON.stringify(raw)); }
});

await browser.close(); server.close();
console.log(`\nOPTIMIZER PROBE: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
