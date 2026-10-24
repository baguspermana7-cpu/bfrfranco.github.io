/* Hub tools render gate (v3.24.24). Every check here was a live defect that no other gate saw, because each one
   drew NOTHING and logged at most one line:
     T1  the TIA-942 checklist threw "Chart is not defined" while parsing and rendered 0 items (since 2026-07)
     T2  the PLN Java map showed 2 of 181 power plants: a tier-2 substation filter hid every other plant, so the
         Coal/Hydro/Solar toggles had nothing to hide
     T3  the fire checklist lost every tick on reload, and clicking an item's text did not tick it
     T4  the market tracker printed a hand-written "Q1 2025" data date over data that moved
     T5  the PUE and carbon calculators compute against the engine's industry-average PUE
   Run: node tools/test-hub-tools.mjs   (one headless browser; take the shared browser lock) */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puppeteer = (await import('puppeteer')).default;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.geojson': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
    const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, p === '/' ? 'index.html' : p);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (n, c, info) => { console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : ' — ' + JSON.stringify(info))); if (!c) fail++; };

const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(readFileSync(join(ROOT, 'js/pln-java-grid-data.js'), 'utf8'), sandbox);
const PLANTS = sandbox.window.PLN_JAVA_GRID.nodes.filter((n) => n.kind === 'plant' && typeof n.lat === 'number').length;
const COAL = sandbox.window.PLN_JAVA_GRID.nodes.filter((n) => n.kind === 'plant' && n.fuel === 'coal').length;
vm.runInContext(readFileSync(join(ROOT, 'rz-engine.js'), 'utf8'), sandbox);
const E = sandbox.window.RZEngine.data;

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-audio-output'] });
async function open(page, w = 1440) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) { /* private mode */ } });
    p._errs = []; p.on('pageerror', (e) => p._errs.push(String(e.message).slice(0, 100)));
    await p.goto(base + page, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1200);
    p._ctx = ctx; return p;
}
try {
    { // T1
        const p = await open('tia-942-checklist.html');
        const r = await p.evaluate(() => ({ items: document.querySelectorAll('#checklistContainer input[type=checkbox], .check-item input[type=checkbox], .check-ref').length, score: document.getElementById('scoreValue')?.textContent }));
        ok('T1 TIA-942: no page error, checklist items render', p._errs.length === 0 && r.items > 20, { errs: p._errs, ...r });
        await p.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')].slice(0, 5).forEach((x) => x.click()));
        await sleep(500);
        const s2 = await p.evaluate(() => document.getElementById('scoreValue')?.textContent);
        ok('T1 TIA-942: ticking items moves the score', s2 !== r.score, { before: r.score, after: s2 });
        await p._ctx.close();
    }
    { // T2
        const p = await open('pln-java-grid.html');
        const n = await p.evaluate(() => document.querySelectorAll('.leaflet-marker-pane .rzm-plant').length);
        ok(`T2 PLN map: every plant with coordinates is drawn (${PLANTS})`, n === PLANTS, { drawn: n, data: PLANTS });
        const off = await p.evaluate(async () => { const cb = document.querySelector('.pjg-toggles input[data-fuel="coal"]'); cb.click(); await new Promise((r) => setTimeout(r, 500)); const c = document.querySelectorAll('.leaflet-marker-pane .rzm-plant').length; cb.click(); return c; });
        ok(`T2 PLN map: Coal off removes the ${COAL} coal plants`, off === PLANTS - COAL, { off, expected: PLANTS - COAL });
        ok('T2 PLN: no page error', p._errs.length === 0, p._errs);
        await p._ctx.close();
    }
    { // T3
        const p = await open('fire-checklist.html', 390);
        const labels = await p.$$('.ck-list > .ck-item > .ck-label');
        if (labels.length < 2) { ok('T3 fire checklist: items are labels (text toggles the box)', false, { labels: labels.length }); await p._ctx.close(); }
        else {
        await labels[0].click(); await sleep(300); await labels[1].click(); await sleep(300);
        const before = await p.evaluate(() => document.querySelector('.ck-progress')?.textContent);
        await p.reload({ waitUntil: 'networkidle2' }); await sleep(800);
        const after = await p.evaluate(() => document.querySelector('.ck-progress')?.textContent);
        ok('T3 fire checklist: clicking item text ticks it, ticks survive reload', /^2 of /.test(before || '') && before === after, { before, after });
        await p._ctx.close();
        }
    }
    { // T4
        const p = await open('dc-market-tracker.html', 390);
        const asOf = await p.evaluate(() => document.getElementById('dmtAsOf')?.textContent);
        const [y, m] = E.sources.markets.asOf.split('-');
        const want = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y;
        ok('T4 market tracker: data date = engine provenance (' + want + ')', asOf === want, { asOf });
        await p._ctx.close();
    }
    { // T5
        const p = await open('pue-calculator.html');
        const a = await p.evaluate(() => (typeof avgPue === 'function' ? avgPue() : null));
        const c = await open('carbon-footprint.html');
        const b = await c.evaluate(() => (typeof industryAvgPue === 'function' ? industryAvgPue() : null));
        ok('T5 PUE + carbon read DATA.pueBenchmark (' + E.pueBenchmark.industryAvg + ')', a === E.pueBenchmark.industryAvg && b === E.pueBenchmark.industryAvg, { pue: a, carbon: b });
        await p._ctx.close(); await c._ctx.close();
    }
} finally {
    await browser.close(); server.close();
}
console.log(fail ? `HUB TOOLS — ${fail} failed` : 'HUB TOOLS — all checks pass');
process.exit(fail ? 1 : 0);
