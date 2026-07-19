/* DCMOC export-standard probe (BA3) — clicks every page's Export button and
 * asserts the print-window HTML carries the min-standard sections: Executive
 * Assessment (algorithmic profile + narrative) + Prioritized Action Items.
 * window.open is stubbed to CAPTURE the document instead of opening/printing.
 * Run: node tools/_dcmoc_export_probe.mjs */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8098;
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
page.on('pageerror', (e) => errors.push(String(e).slice(0, 180)));

await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
    // capture the print-window document instead of opening it
    window.__pdfCaptures = [];
    window.open = () => {
        const cap = { html: '' };
        window.__pdfCaptures.push(cap);
        return {
            document: { write: (h) => { cap.html += h; }, close() {} },
            print() {}, close() {}, focus() {},
        };
    };
});
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✘', name); } };

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
    await new Promise((r) => setTimeout(r, 1200));
}

async function exportAndCheck(label) {
    const before = await page.evaluate(() => window.__pdfCaptures.length);
    const clicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find((x) => /export|generate report/i.test(x.textContent) && !x.disabled && x.offsetParent);
        if (b) { b.click(); return true; }
        return false;
    });
    if (!clicked) { ok(`${label}: export button found`, false); return; }
    await new Promise((r) => setTimeout(r, 2200));
    const cap = await page.evaluate((i) => window.__pdfCaptures[i]?.html ?? '', before);
    ok(`${label}: report captured`, cap.length > 500);
    ok(`${label}: Executive Assessment present`, /Executive Assessment/.test(cap));
    ok(`${label}: Prioritized Action Items present`, /Prioritized Action Items/.test(cap));
    ok(`${label}: summary band present`, /display:flex;gap:8px;background:#1e3a5f/.test(cap));
}

/* pages wired with the narrative engine (group nav mirrors the walk probe) */
const TARGETS = [
    ['CAPEX', 'CAPEX Engine', 'capex'],
    ['Financial', 'Financial Engine', 'financial'],
    ['Capacity', 'Capacity Planning', 'capacity'],
    ['Construction', 'Construction Engine', 'construction'],
    ['Reliability', 'Reliability Engine', 'reliability'],
    ['Sustainability', 'Sustainability Engine', 'sustainability'],
    ['Commissioning', 'Commissioning Engine', 'commissioning'],
    ['Operations', 'Operations Overview', 'operations'],
    ['Results', 'Results Engine', 'results'],
    ['Asset', 'Asset Intelligence', 'assets'],
    ['Spares', 'Spares Optimization', 'spares'],
];

for (const [group, leaf, label] of TARGETS) {
    await nav(group, leaf);
    await exportAndCheck(label);
}

console.log(`\nEXPORT PROBE: ${pass} pass / ${fail} fail · page errors: ${errors.length}`);
errors.slice(0, 5).forEach((e) => console.log('  ERR:', e));
await browser.close();
server.close();
process.exit(fail || errors.length ? 1 : 0);
