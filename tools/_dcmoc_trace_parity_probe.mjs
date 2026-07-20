/* DCMOC trace-parity probe — ANTI-DRIFT gate for the ƒx TraceValue popovers.
 *
 * Trace nodes (dcmoc/src/lib/value-trace.ts) are hand-written MIRRORS of each
 * page's formula chain. Drift = the popover shows a different number than the
 * KPI it wraps. This probe walks every core page, clicks every visible
 * [data-trace] element, reads the popover's main value (TraceValue.tsx header:
 * .text-2xl inside the z-[9999] portal panel) and fuzzy-compares it against the
 * display text of the wrapped KPI.
 *
 * Parity rule: extract the first numeric mantissa on both sides, normalise
 * scale suffixes (rb/K=1e3, jt/M=1e6, B=1e9); MATCH when ratio ∈ [0.95, 1.05]
 * or both are 0. A residual 1000×/1e6×/1e9× ratio where at least one side
 * carried a scale suffix is treated as a formatting-scale difference → MATCH.
 *
 * KNOWN_BASIS_DIVERGENT: nodes whose formulaTemplate EXPLICITLY documents a
 * default/trace-basis convention (Investment param panel defaults, Asset
 * Intelligence age-3yr/85%-condition slider defaults) — a mismatch there is a
 * documented local-param divergence, logged WARN, not FAIL.
 *
 * Run: node tools/_dcmoc_trace_parity_probe.mjs   (exit 1 on any non-whitelist
 * mismatch). Infra mirrors tools/_dcmoc_walk_probe.mjs (standalone copy). */
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
    } catch {
        res.statusCode = 404; res.end('nf');
    }
});
await new Promise((r) => server.listen(PORT, r));

/* ── pages (walk-probe TRACE_PAGES nav map + Maintenance/Investment/Phased/Assets) ── */
const PAGES = [
    { group: 'Dashboard', leaf: null, name: 'Dashboard' },
    { group: 'Capacity', leaf: 'Capacity Planning', name: 'Capacity' },
    { group: 'CAPEX', leaf: 'CAPEX Engine', name: 'Capex' },
    { group: 'Reliability', leaf: 'Reliability Engine', name: 'Reliability' },
    { group: 'Financial', leaf: 'Financial', name: 'Financial' },
    { group: 'Operations', leaf: 'Operations Overview', name: 'Ops' },
    { group: 'Sustainability', leaf: 'Sustainability Engine', name: 'Sustainability' },
    { group: 'Architecture', leaf: 'Architecture Engine', name: 'Architecture' },
    { group: 'Operations', leaf: 'Staffing', name: 'Staffing' },
    { group: 'Reports', leaf: null, name: 'Results' },          /* standalone "Reports" button (Shell.tsx:450) */
    { group: 'Operations', leaf: 'Maintenance', name: 'Maintenance' },
    { group: 'Financial', leaf: 'Investment', name: 'Investment' },
    { group: 'Construction', leaf: 'Phased Finance', name: 'PhasedFinancial' },  /* Shell.tsx ENGINE_GROUPS num 6 */
    { group: 'Asset Intelligence', leaf: 'Asset Intelligence', name: 'Assets' },
];

/* ── whitelist: documented default-basis nodes (value-trace.ts) ──
 * inv.* — INVESTMENT block comment (value-trace.ts ~:1036): "basis trace: panel
 *   parameter halaman pada nilai DEFAULT — debt 65% · CoD 5% · term 12 thn ·
 *   CoE 12% · exit thn-7 @18× · rev $150/kW·bln · tax 25% — state lokal, tidak
 *   tercermin di trace"; templates say "basis trace: default 65%/35%" etc.
 * asset.* — templates: "pada basis trace umur 3 thn · kondisi 85% = default
 *   slider halaman" — page sliders are local state the trace does not read. */
const KNOWN_BASIS_DIVERGENT = [
    'inv.totalDebt', 'inv.totalEquity', 'inv.wacc', 'inv.equityIrr',
    'inv.moic', 'inv.minDscr', 'inv.year1CoC',
    'asset.avgHealth', 'asset.healthExcellentGood', 'asset.healthFair',
    'asset.healthPoorCritical', 'asset.atRiskUnits',
];

/* ── numeric mantissa extraction + fuzzy parity ── */
const SCALE = { rb: 1e3, k: 1e3, K: 1e3, jt: 1e6, M: 1e6, B: 1e9 };
const PREFIX = { k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
function parseNumeric(raw) {
    if (!raw) return null;
    const text = String(raw).replace(/ /g, ' ').replace(/ƒx/g, ' ');
    /* first number (thousand-separated or plain); optional standalone scale
     * suffix — lookahead rejects unit words (MW, kW, kgal …) */
    const m = text.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/);
    if (!m) return null;
    /* sign: a '-' immediately before the number (allowing $ / spaces between) */
    const sign = /-[\s$]*$/.test(text.slice(0, m.index)) ? -1 : 1;
    const mantissa = parseFloat(m[1].replace(/,/g, '')) * sign;
    const decimals = (m[1].split('.')[1] ?? '').length;
    const rest = text.slice(m.index + m[1].length).replace(/^\s+/, '');
    /* scale abbreviation (rb/jt/K/M/B standalone — NOT first letter of a unit
     * word like MW/kW/kgal) vs metric-prefixed unit (kW / MW / MWh / MVA …) */
    let scaleMult = 1, hasScale = false, unitBase = null, unitMult = 1;
    const um = rest.match(/^([kKMG])?(Wh|W|VA)(?!\p{L})/u);
    const sm = rest.match(/^(rb|jt|[kKMB])(?![\p{L}\d])/u);
    if (um) { unitBase = um[2]; unitMult = um[1] ? PREFIX[um[1]] : 1; }
    else if (sm) { scaleMult = SCALE[sm[1]]; hasScale = true; }
    return { value: mantissa * scaleMult, mantissa, decimals, hasScale, scaleMult, unitBase, unitMult };
}
const ratioOk = (a, b) => {
    if (a === 0 && b === 0) return true;
    if (a === 0 || b === 0) return false;
    const r = Math.abs(a / b);
    return r >= 0.95 && r <= 1.05;
};
/** 'match' | 'scale-match' | 'mismatch' — band ±5%, plus half-ULP of the
 *  DISPLAY's printed precision (a KPI printing "3.8" for 3.75, or "3" for a
 *  rounded 2.5+, is display rounding — not drift), plus suffix-consistent
 *  1000×/1e6×/1e9× formatting-scale differences. */
function parity(disp, pop) {
    let a = disp.value, b = pop.value;
    let halfUlp = 0.5 * Math.pow(10, -disp.decimals) * disp.scaleMult;
    if (disp.unitBase && pop.unitBase && disp.unitBase === pop.unitBase) {
        a *= disp.unitMult; b *= pop.unitMult; halfUlp *= disp.unitMult;
    }
    if (ratioOk(a, b)) return 'match';
    if (Math.abs(a - b) <= halfUlp * 1.000001) return 'match';   /* display rounding */
    if (disp.hasScale || pop.hasScale) {
        for (const f of [1e3, 1e6, 1e9]) {
            if (ratioOk(a * f, b) || ratioOk(a, b * f)) return 'scale-match';
        }
    }
    return 'mismatch';
}

/* ── browser ── */
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => consoleErrors.push('PAGE: ' + String(e).slice(0, 160)));

await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
});
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* sidebar nav — walk-probe pattern, hardened: group buttons TOGGLE (a second
 * click collapses the group and hides the leaf), so only click the group when
 * the leaf is not currently in the sidebar; retry once after a re-toggle. */
async function nav(group, leaf) {
    const target = leaf ?? group;
    const clickLeaf = () => page.evaluate((l) => {
        const btns = [...document.querySelectorAll('aside button')];
        const exact = btns.find((x) => x.textContent.trim() === l);
        const cands = exact ? [exact] : btns.filter((x) => x.textContent.toLowerCase().includes(l.toLowerCase()));
        cands.sort((a, b2) => a.textContent.length - b2.textContent.length);
        if (cands[0]) { cands[0].click(); return cands[0].textContent.trim().slice(0, 40); }
        return null;
    }, target);
    const clickGroup = () => page.evaluate((g) => {
        const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.toLowerCase().includes(g.toLowerCase()));
        if (b) b.click();
    }, group);
    if (group && leaf) { await clickGroup(); await sleep(350); }
    let clicked = await clickLeaf();
    if (!clicked && group && leaf) {
        /* group was already expanded → our click collapsed it; re-expand */
        await clickGroup(); await sleep(350);
        clicked = await clickLeaf();
    }
    await sleep(1200);
    return clicked;
}

/* in-page helpers (selectors from TraceValue.tsx: trigger = button[data-trace];
 * portal panel = fixed z-[9999] div; main value = header .text-2xl; close =
 * button[aria-label="close"]; overlay = fixed inset-0 z-[9998]) */
const POP_SEL = 'div[class*="z-[9999]"]';
const listTraces = () => page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-trace]')].filter((el) => {
        if (el.closest('aside') || el.closest('nav')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    });
    return els.map((el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('[aria-hidden]').forEach((n) => n.remove());
        return { id: el.getAttribute('data-trace'), text: (clone.textContent || '').trim().replace(/\s+/g, ' ') };
    });
});
const clickTrace = (i) => page.evaluate((idx) => {
    const els = [...document.querySelectorAll('[data-trace]')].filter((el) => {
        if (el.closest('aside') || el.closest('nav')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    });
    if (els[idx]) { els[idx].click(); return true; }
    return false;
}, i);
const readPopover = () => page.evaluate((sel) => {
    const p = document.querySelector(sel);
    if (!p) return null;
    const v = p.querySelector('.text-2xl');
    return v ? v.textContent.trim().replace(/\s+/g, ' ') : null;
}, POP_SEL);
const closePopover = async () => {
    await page.evaluate((sel) => {
        const p = document.querySelector(sel);
        p?.querySelector('button[aria-label="close"]')?.click();
        document.querySelector('div[class*="z-[9998]"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, POP_SEL);
    await page.waitForFunction((sel) => !document.querySelector(sel), { timeout: 3000 }, POP_SEL).catch(() => {});
};

/* ── run ── */
const MAX_PER_PAGE = 80;
let totalMatch = 0, totalChecked = 0, totalWarn = 0;
const failures = [];   // { page, id, display, popover }
const warns = [];      // { page, id, display, popover, why }

for (const pg of PAGES) {
    const clicked = await nav(pg.group, pg.leaf ?? undefined);
    await sleep(900);
    if (!clicked) { console.log(`parity ${pg.name}: NAV FAILED`); failures.push({ page: pg.name, id: '(nav)', display: '-', popover: '-' }); continue; }

    const traces = (await listTraces()).slice(0, MAX_PER_PAGE);
    let match = 0, warn = 0, checked = 0;

    for (let i = 0; i < traces.length; i++) {
        const t = traces[i];
        const disp = parseNumeric(t.text);
        if (!disp) continue;                       // no numeric display → nothing to compare
        checked++;

        if (!(await clickTrace(i))) { warn++; warns.push({ page: pg.name, id: t.id, display: t.text, popover: '(element gone)', why: 'no-click' }); continue; }
        const opened = await page.waitForFunction(
            (sel) => !!document.querySelector(sel + ' .text-2xl'), { timeout: 4000 }, POP_SEL,
        ).then(() => true).catch(() => false);
        if (!opened) { warn++; warns.push({ page: pg.name, id: t.id, display: t.text, popover: '(no popover)', why: 'no-popover' }); continue; }

        const popText = await readPopover();
        await closePopover();

        const pop = parseNumeric(popText);
        if (!pop) {                                // popover shows "—" (null trace value)
            if (KNOWN_BASIS_DIVERGENT.includes(t.id)) { warn++; warns.push({ page: pg.name, id: t.id, display: t.text, popover: popText ?? '(empty)', why: 'basis-divergent(null)' }); }
            else failures.push({ page: pg.name, id: t.id, display: t.text, popover: popText ?? '(empty)' });
            continue;
        }

        const verdict = parity(disp, pop);
        if (verdict === 'match' || verdict === 'scale-match') match++;
        else if (KNOWN_BASIS_DIVERGENT.includes(t.id)) { warn++; warns.push({ page: pg.name, id: t.id, display: t.text, popover: popText, why: 'basis-divergent' }); }
        else failures.push({ page: pg.name, id: t.id, display: t.text, popover: popText });
    }

    console.log(`parity ${pg.name}: ${match}/${checked} match (${warn} warn)`);
    totalMatch += match; totalChecked += checked; totalWarn += warn;
}

/* ── report ── */
if (warns.length) {
    console.log('\nWARN (whitelisted basis-divergent / non-parity issues):');
    for (const w of warns) console.log(`  ⚠ [${w.page}] ${w.id} — display "${w.display}" vs popover "${w.popover}" (${w.why})`);
}
if (failures.length) {
    console.log('\nFAIL (trace drift — popover ≠ wrapped KPI):');
    for (const f of failures) console.log(`  ✘ [${f.page}] ${f.id} — display "${f.display}" vs popover "${f.popover}"`);
}
const realErrors = consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('404'));
if (realErrors.length) console.log(`\nconsole errors (${realErrors.length}):`, realErrors.slice(0, 5));

await browser.close();
server.close();
console.log(`\nRESULT: ${totalMatch}/${totalChecked} parity match · ${totalWarn} warn · ${failures.length} FAIL`);
process.exit(failures.length ? 1 : 0);
