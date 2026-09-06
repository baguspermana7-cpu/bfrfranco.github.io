#!/usr/bin/env node
/**
 * test-dcai-coverage.mjs — hook-aware traceability coverage for datahallAI.html.
 *
 * The Conventional coverage gate (test-conv-coverage.mjs) traces by VALUE-STRING membership:
 * a number is accounted for when some registry parameter renders to the same string. On the
 * AI page the owner asked for the symbol itself — "dikasi traceability symbol juga di
 * parameter" — so here a numeral counts ONLY when it sits inside a [data-basis-param] hook
 * whose id resolves and whose drawn string equals the registry value, or inside a declared
 * [data-rz-authored-basis] reason. See tools/lib/dcai-coverage-walker.mjs for the buckets.
 *
 * Rows: the 13 diagrams of TAB_SETS['datahallAI.html'] (SVG text only, activated one by one),
 * plus one HTML row (every visible non-SVG text node across all tabs).
 *
 *   node tools/test-dcai-coverage.mjs                 MONITOR — table, exit 0
 *   node tools/test-dcai-coverage.mjs --strict        every row must read 0 untraced + 0 mismatch
 *   node tools/test-dcai-coverage.mjs --strict-rows=a,b   only the named rows (selector ids / HTML) are strict
 *   node tools/test-dcai-coverage.mjs --json=path     write the full result (samples included)
 *   node tools/test-dcai-coverage.mjs --only=hSvg,HTML  measure a subset while sweeping
 *
 * Flip condition (written here so it is a rule, not a mood): a row enters --strict-rows in
 * ship-gate.sh the commit it first reads 0/0; the page moves to --strict when all 14 do.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState, assertAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
import { WALKER_SOURCE } from './lib/dcai-coverage-walker.mjs';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const STRICT_ROWS = new Set(((ARGS.find((a) => a.startsWith('--strict-rows=')) || '').split('=')[1] || '').split(',').filter(Boolean));
const JSON_OUT = (ARGS.find((a) => a.startsWith('--json=')) || '').split('=')[1] || null;
const ONLY = new Set(((ARGS.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean));
/* --settle=ms waits before measuring so every ticker has fired: a hook whose value a die roll
   overwrites shows up as MISMATCH here — that is the Rule 2 check for the live page. */
const SETTLE = Number((ARGS.find((a) => a.startsWith('--settle=')) || '').split('=')[1] || 0);
const SAMPLES = Number((ARGS.find((a) => a.startsWith('--samples=')) || '').split('=')[1] || 12);
const PAGE = 'datahallAI.html';
const REGISTRY_GLOBAL = 'RZ_DCAI_PARAMETERS';

const registry = JSON.parse(await readFile(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'));
assert.ok(registry.parameters.length > 100, 'registry loaded');
const set = TAB_SETS[PAGE];
assert.ok(set, `${PAGE} must declare a tab set`);

const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' });
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const full = resolve(ROOT, decodeURIComponent(relative));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); }
    catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const rows = [];
try {
    const tab = await browser.newPage();
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.setViewport({ width: 1680, height: 1000 });
    await tab.goto(`${base}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((accept) => setTimeout(accept, 2600));
    await enterAuthorizedAuditState(tab, set.cockpit);
    await assertAuthorizedAuditState(tab, set.cockpit);
    if (SETTLE > 0) await new Promise((accept) => setTimeout(accept, SETTLE));
    const hasRegistry = await tab.evaluate((g) => !!(window[g] && window[g].parameters), REGISTRY_GLOBAL);
    assert.ok(hasRegistry, `${REGISTRY_GLOBAL} must be on the page (js/dcai-parameters.js)`);

    const run = (selector, opts) => tab.evaluate(
        (src, sel, o) => (new Function('return ' + src)())(document.querySelector(sel), o),
        WALKER_SOURCE, selector, { registryGlobal: REGISTRY_GLOBAL, sampleLimit: SAMPLES, ...opts },
    );

    /* HTML row: walk every tab's panel + the chrome outside the panels, dedup by tab activation. */
    const html = { numerals: 0, hooked: 0, mismatch: 0, declared: 0, untraced: 0, valueMatchUnhooked: 0, samples: [], mismatches: [] };
    const seenTabs = new Set();
    const addHtml = (r) => { for (const k of ['numerals', 'hooked', 'mismatch', 'declared', 'untraced', 'valueMatchUnhooked']) html[k] += r[k]; html.samples.push(...r.samples); html.mismatches.push(...r.mismatches); };
    addHtml(await run('body', { htmlOnly: true }));            // default tab (dash) + sidebar + KPI strip
    seenTabs.add('dash');

    for (const entry of set.diagrams) {
        const wantSvg = !ONLY.size || ONLY.has(entry.selector.slice(1)) || (entry.selector === '#floorSvg' && ONLY.has('floorSvg'));
        const wantHtml = !ONLY.size || ONLY.has('HTML');
        if (!wantSvg && !wantHtml) continue;
        await activateTab(tab, set, entry);
        if (wantHtml && !seenTabs.has(entry.tab)) {
            seenTabs.add(entry.tab);
            addHtml(await run(`#${set.panelPrefix}${entry.tab}`, { htmlOnly: true }));
        }
        if (wantHtml && entry.sub) { addHtml(await run(`#${set.subPanelPrefix}${entry.sub}`, { htmlOnly: true })); }
        if (!wantSvg) continue;
        if (entry.selector === '#floorSvg') {
            /* the floor plan is drawn on a floor click in the isometric; two floors carry engine numbers */
            for (const floor of ['f2', 'gf']) {
                const opened = await tab.evaluate((key) => {
                    const poly = document.querySelector('#bldgSvg [data-floor="' + key + '"]');
                    if (!poly) return 'no polygon';
                    poly.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    const detail = document.getElementById('floorDetail');
                    return detail && detail.style.display === 'block' ? 'ok' : 'floorDetail not shown';
                }, floor);
                try {
                    if (opened !== 'ok') throw new Error(opened);
                    await tab.waitForFunction(() => { const t = document.querySelector('#floorSvg text'); return !!t && t.getBoundingClientRect().height > 0; }, { timeout: 10000 });
                    const rf = await run(entry.selector, { svgOnly: true });
                    rows.push({ row: `floorSvg:${floor}`, label: `floor plan ${floor}`, ...rf });
                } catch (err) {
                    /* a floor that cannot be opened is an UNMEASURED row, reported as such — never a silent CLEAN */
                    rows.push({ row: `floorSvg:${floor}`, label: `floor plan ${floor}`, numerals: 0, hooked: 0, declared: 0, mismatch: 0, untraced: 1, valueMatchUnhooked: 0, samples: [{ svg: 'floorSvg', id: '', text: `UNMEASURED: ${err.message}`, num: '', valueMatch: false }], mismatches: [] });
                }
                await tab.evaluate(() => { const b = document.getElementById('floorBack'); if (b) b.click(); });
            }
            continue;
        }
        const r = await run(entry.selector, { svgOnly: true });
        rows.push({ row: entry.selector.slice(1), label: entry.label, ...r });
    }
    if (!ONLY.size || ONLY.has('HTML')) rows.push({ row: 'HTML', label: 'HTML cells, all tabs', ...html });
} finally {
    await browser.close();
    server.close();
}

/* ---- report ---------------------------------------------------------------------------- */
const pad = (s, n, right) => (right ? String(s).padStart(n) : String(s).padEnd(n));
console.log(`DCAI COVERAGE — ${PAGE} · registry ${registry.parameters.length} params · hook-aware (a number counts only under a resolving hook or a declared reason)`);
console.log(`${pad('row', 12)} ${pad('numerals', 9, 1)} ${pad('hooked', 7, 1)} ${pad('declared', 9, 1)} ${pad('mismatch', 9, 1)} ${pad('untraced', 9, 1)}  ${pad('(value-only)', 12, 1)}  status`);
let failures = 0;
for (const r of rows) {
    const strictRow = STRICT || STRICT_ROWS.has(r.row);
    const open = r.untraced + r.mismatch;
    const status = open === 0 ? 'CLEAN' : strictRow ? 'FAIL' : 'monitor';
    if (open > 0 && strictRow) failures++;
    console.log(`${pad(r.row, 12)} ${pad(r.numerals, 9, 1)} ${pad(r.hooked, 7, 1)} ${pad(r.declared, 9, 1)} ${pad(r.mismatch, 9, 1)} ${pad(r.untraced, 9, 1)}  ${pad(r.valueMatchUnhooked, 12, 1)}  ${status}`);
}
const tot = rows.reduce((a, r) => { for (const k of ['numerals', 'hooked', 'declared', 'mismatch', 'untraced']) a[k] += r[k]; return a; }, { numerals: 0, hooked: 0, declared: 0, mismatch: 0, untraced: 0 });
console.log(`${pad('TOTAL', 12)} ${pad(tot.numerals, 9, 1)} ${pad(tot.hooked, 7, 1)} ${pad(tot.declared, 9, 1)} ${pad(tot.mismatch, 9, 1)} ${pad(tot.untraced, 9, 1)}`);
for (const r of rows) {
    if (r.mismatches.length) { console.log(`\n  ${r.row} MISMATCH (hook present, drawn value is not the registry value):`); for (const m of r.mismatches.slice(0, 8)) console.log(`    ${m.id} drawn=${m.drawn} registry=${m.registry} · "${m.ctx}"`); }
}
if (!STRICT && STRICT_ROWS.size === 0) {
    for (const r of rows) {
        if (r.untraced && r.samples.length) { console.log(`\n  ${r.row} samples:`); for (const s of r.samples.slice(0, SAMPLES)) console.log(`    ${s.valueMatch ? '=' : ' '} ${s.id ? '#' + s.id + ' ' : ''}"${s.text}"`); }
    }
}
if (JSON_OUT) { await writeFile(JSON_OUT, JSON.stringify({ page: PAGE, rows, total: tot, at: new Date().toISOString() }, null, 1)); console.log(`\nwritten ${JSON_OUT}`); }
if (failures) { console.error(`\nFAIL ${failures} strict row(s) still carry untraced or mismatched numerals`); process.exit(1); }
console.log(STRICT || STRICT_ROWS.size ? `\nPASS strict rows clean (${STRICT ? 'all' : [...STRICT_ROWS].join(',')})` : `\nMONITOR — no strict rows; flip a row with --strict-rows when it reads 0/0`);
