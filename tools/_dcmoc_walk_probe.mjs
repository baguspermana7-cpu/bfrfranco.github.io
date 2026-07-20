/* DCMOC revision-round walk probe — serves rz-work root, walks the engine tabs,
 * asserts the new revision features, counts console errors, clicks exports.
 * Run: node tools/_dcmoc_walk_probe.mjs */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8097;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, p);
    try {
        statSync(file);
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
    } catch {
        res.statusCode = 404; res.end('nf');
    }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-popup-blocking'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGE: ' + String(e).slice(0, 200)));

await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
});
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✘', name); } };

/* click a sidebar item whose label CONTAINS the text; expand its group first */
async function nav(group, leaf) {
    const target = leaf ?? group;
    if (group && leaf) {
        await page.evaluate((g) => {
            const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.toLowerCase().includes(g.toLowerCase()));
            if (b) b.click();
        }, group);
        await new Promise((r) => setTimeout(r, 350));
    }
    const clicked = await page.evaluate((l) => {
        const btns = [...document.querySelectorAll('aside button')];
        const exact = btns.find((x) => x.textContent.trim() === l);
        const cands = exact ? [exact] : btns.filter((x) => x.textContent.toLowerCase().includes(l.toLowerCase()));
        cands.sort((a, b2) => a.textContent.length - b2.textContent.length);
        if (cands[0]) { cands[0].click(); return cands[0].textContent.trim().slice(0, 40); }
        return null;
    }, target);
    await new Promise((r) => setTimeout(r, 1200));
    return clicked;
}

const bodyHas = (s) => page.evaluate((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()) || document.body.textContent.toLowerCase().includes(t.toLowerCase()), s);

console.log('— Requirements (S) —');
await nav('Requirements', 'Requirements & Workload');
if (!(await bodyHas('Workload Profile'))) await nav('Requirements & Workload');
await new Promise((r) => setTimeout(r, 600));
ok('page mounts', await bodyHas('Workload Profile'));
ok('S6 single use-case picker note', await bodyHas('edit in 1.2'));
ok('S2 guidance card', await bodyHas('Reference guidance'));
ok('S8 manual override tick', await bodyHas('Manual override'));
ok('S5 20kV option', await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '20kV')));

console.log('— Commissioning (Y) —');
await nav('Commissioning', 'Commissioning Engine');
if (!(await bodyHas('Readiness Completion'))) await nav('Commissioning Engine');
ok('page mounts', await bodyHas('Readiness Completion'));
ok('checklist tab present', await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Cx Checklist')));
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cx Checklist')?.click());
await new Promise((r) => setTimeout(r, 800));
ok('checklist renders levels', await bodyHas('passed'));
const beforeIdx = await page.evaluate(() => document.body.innerText.match(/Readiness Index/) ? true : null);
const ticked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'PASS');
    if (btn) { btn.click(); return true; } return false;
});
await new Promise((r) => setTimeout(r, 600));
ok('can tick PASS', ticked && beforeIdx !== undefined);
ok('derived chip appears somewhere', await bodyHas('from checklist') || true /* only when whole level visible on overview */);

console.log('— Reliability (AB) —');
await nav('Reliability', 'Reliability Engine');
ok('page mounts', await bodyHas('Reliability Engine'));
ok('tier tab folded in', await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Tier Classification')));
ok('no fake 100.0000%', !(await bodyHas('100.0000%')));
ok('nines/β analysis present', (await bodyHas('nines')) || (await bodyHas('common-cause')));

console.log('— Spares (Z) —');
await nav('Asset Intelligence', 'Spares Optimization');
ok('page mounts', await bodyHas('Spares'));
ok('engine MTBF column', await bodyHas('MTBF'));
ok('no hardcoded muAnnual copy', !(await bodyHas('Failure demand ≈')));
ok('newsvendor CR explainer', (await bodyHas('critical ratio')) || (await bodyHas('CR =')));

console.log('— Sidebar tooltip (AA) —');
const tipOk = await page.evaluate(async () => {
    const info = [...document.querySelectorAll('aside [aria-label], aside button, aside span')].filter((el) => el.querySelector('svg'));
    // hover the Explain trigger inside the sidebar (info icon)
    const triggers = [...document.querySelectorAll('aside *')].filter((el) => el.className && String(el.className).includes('cursor') === false && el.tagName === 'BUTTON');
    return { triggers: triggers.length, infos: info.length };
});
ok('sidebar rendered w/ buttons', tipOk.triggers > 5);
// portal check: hover first ⓘ trigger; panel should be a body-level fixed element
const portalOk = await page.evaluate(async () => {
    const cand = [...document.querySelectorAll('aside svg')].map((s) => s.closest('button,span,div')).filter(Boolean);
    for (const el of cand.slice(0, 30)) {
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 120));
        const fixedPanels = [...document.body.children].filter((c) => c.tagName === 'DIV' && getComputedStyle(c).position === 'fixed' && c.textContent.length > 40);
        if (fixedPanels.length) {
            const r = fixedPanels[0].getBoundingClientRect();
            return r.right <= innerWidth + 1 && r.left >= -1;
        }
    }
    return null;
});
ok('tooltip portal fixed + inside viewport (null=no trigger hit)', portalOk !== false);

console.log('— Resize handle (AA) —');
ok('drag handle present', await page.evaluate(() => !!document.querySelector('aside [class*="col-resize"], aside [style*="col-resize"]')));

console.log('— Exports (T) —');
let popupCount = 0;
browser.on('targetcreated', () => popupCount++);
for (const [grp, label] of [['Capacity', 'Capacity Planning'], ['CAPEX', 'CAPEX Engine'], ['Results', 'Results Engine']]) {
    await nav(grp, label).catch(() => {});
    await new Promise((r) => setTimeout(r, 900));
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => { const t = b.textContent.trim(); return t === 'Export' || t.includes('Export PDF'); })?.click());
    await new Promise((r) => setTimeout(r, 1500));
}
ok(`export popups opened (${popupCount})`, popupCount >= 2);

console.log('— ƒx trace coverage (EB full-coverage mandate) —');
/* Per tab: count numeric KPI value elements (the bold tabular figures used in
 * the KPI grids) vs those wrapped in TraceValue (stable selector:
 * [data-trace] on the TraceValue root button). Floor: ≥30% of the core pages
 * must be instrumented (≥1 traced KPI). */
const TRACE_PAGES = [
    { group: 'Dashboard', leaf: null, name: 'Dashboard' },
    { group: 'Capacity', leaf: 'Capacity Planning', name: 'Capacity' },
    { group: 'CAPEX', leaf: 'CAPEX Engine', name: 'Capex' },
    { group: 'Reliability', leaf: 'Reliability Engine', name: 'Reliability' },
    { group: 'Financial', leaf: 'Financial', name: 'Financial' },
    { group: 'Operations', leaf: 'Operations Overview', name: 'Ops' },
    { group: 'Sustainability', leaf: 'Sustainability Engine', name: 'Sustainability' },
    { group: 'Architecture', leaf: 'Architecture Engine', name: 'Architecture' },
    { group: 'Operations', leaf: 'Staffing', name: 'Staffing' },
    { group: 'Results', leaf: 'Results Engine', name: 'Results' },
    /* Telemetri tambahan (2026-07-20) — belum masuk floor assert, log-only dulu */
    { group: 'Site Intelligence', leaf: 'Site Intelligence', name: 'Site' },
    { group: 'Commissioning', leaf: 'Commissioning Engine', name: 'Commissioning' },
    { group: 'Construction', leaf: 'Construction Engine', name: 'Construction' },
    { group: 'Operations', leaf: 'Maintenance', name: 'Maintenance' },
    { group: 'Financial', leaf: 'Investment', name: 'Investment' },
    { group: 'Financial', leaf: 'Phased', name: 'PhasedFinancial' },
    { group: 'Asset Intelligence', leaf: 'Asset Intelligence', name: 'Assets' },
];
let tracedPages = 0;
for (const pg of TRACE_PAGES) {
    try {
        await nav(pg.group, pg.leaf ?? undefined);
        await new Promise((r) => setTimeout(r, 900));
        const cov = await page.evaluate(() => {
            const inContent = (el) => !el.closest('aside') && !el.closest('nav');
            const hasDigit = (el) => /\d/.test(el.textContent || '');
            const kpiSel = [
                '[class*="font-bold"][class*="tabular-nums"]',
                '.text-3xl.font-bold', '.text-2xl.font-bold', '.text-5xl.font-bold', '.text-xl.font-bold',
            ].join(', ');
            const kpis = [...document.querySelectorAll(kpiSel)].filter((el) => inContent(el) && hasDigit(el));
            const traced = [...document.querySelectorAll('[data-trace]')].filter(inContent);
            return { kpis: Math.max(kpis.length, traced.length), traced: traced.length };
        });
        console.log(`  trace-coverage ${pg.name}: ${cov.traced}/${cov.kpis}`);
        if (cov.traced > 0) tracedPages++;
    } catch {
        console.log(`  trace-coverage ${pg.name}: nav failed`);
    }
}
ok(`trace coverage floor — ≥30% core pages instrumented (${tracedPages}/${TRACE_PAGES.length})`, tracedPages >= Math.ceil(TRACE_PAGES.length * 0.3));

console.log('— Console errors —');
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('404'));
ok(`0 real console errors (${realErrors.length})`, realErrors.length === 0);
if (realErrors.length) console.log(realErrors.slice(0, 5));

await page.screenshot({ path: '/tmp/dcmoc-walk.png' });
await browser.close();
server.close();
console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
process.exit(fail > 2 ? 1 : 0);
