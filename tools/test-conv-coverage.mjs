/**
 * Conventional COVERAGE gate — how much of what an operator actually sees is traceable.
 *
 * WHY THE DENOMINATOR IS RENDERED TEXT, NOT ELEMENT IDS
 * ----------------------------------------------------
 * The obvious design is "every KPI element with an id must resolve to a registry entry".
 * That gate would report 100 % and be worthless here. Measured across these eight pages:
 * 216 numeric elements carry an id or a data-* hook, and roughly 390 rendered numbers carry
 * no stable identity at all — chiller-plant rebuilds its entire P&ID (72 text nodes) through
 * innerHTML, ict's link table is 216 bare <td> cells, dc-conventional has ten hand-written
 * KPI cells, fire-system hand-types five pump setpoints beside the constants the simulation
 * acts on. Every one of those is a number an operator reads and acts on, and an id-keyed
 * denominator cannot see any of them. v1.134.0 found seventeen dead bindings hiding in
 * exactly that blind spot.
 *
 * So this gate walks the RENDERED DOM, collects every number a human can read, and asks of
 * each one: can it be accounted for? A number is ACCOUNTED FOR when it matches a registry
 * parameter's value (at any of the display roundings the cockpits use), or a value derived
 * from one by the unit conversions the pages perform (kW->MW, L/s, %, thousands separator).
 * Everything else is UNACCOUNTED and is listed by page with its surrounding label.
 *
 * MODE
 * ----
 * This runs as a MONITOR (exit 0) and prints the coverage percentage plus the full
 * unaccounted list. It is deliberately not strict yet: the honest number today is well below
 * 100 %, and a gate that fails from day one gets muted rather than paid down. The strict
 * flip condition is documented in tools/ship-gate.sh next to the geometry monitor.
 *
 * Run: node tools/test-conv-coverage.mjs [--strict] [--page=datahall.html]
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';
import { COCKPITS } from './build-conv-parameter-registry.mjs';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const ONLY = (ARGS.find((a) => a.startsWith('--page=')) || '').split('=')[1] || null;

const registry = JSON.parse(await readFile(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));

/* Build the set of strings a registry value may legitimately appear as. The cockpits format
   the same number many ways, and a coverage gate that only accepts one of them would report
   a page as untraceable for using a thousands separator. */
function renderings(value) {
    const out = new Set();
    if (typeof value !== 'number' || !isFinite(value)) return out;
    const scales = [
        value,          // kW, L/s, %, degC as published
        value / 1000,   // MW, thousands
        value * 100,    // fraction rendered as %
        value / 60,     // per-hour to per-minute
        value * 60,     // per-minute to per-hour
    ];
    for (const scaled of scales) {
        if (!isFinite(scaled)) continue;
        for (const digits of [0, 1, 2, 3]) {
            const fixed = scaled.toFixed(digits);
            out.add(fixed);
            out.add(fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
            out.add(String(Number(fixed)));
        }
    }
    return out;
}

const ACCOUNTED = new Set();
for (const p of registry.parameters) {
    for (const r of renderings(p.value)) ACCOUNTED.add(r);
}
/* Small integers and calendar-shaped numbers are counters, indices, ordinals and clock
   fields — they are not engineering basis values and registering them would be noise that
   hides the real gaps. Excluded from the denominator, and the exclusion is stated here
   rather than buried, because a silent exclusion is how a coverage number becomes a lie. */
function isExcluded(text) {
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return true;      // clocks
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;           // dates
    const n = Number(text.replace(/,/g, ''));
    if (!isFinite(n)) return true;
    if (Number.isInteger(n) && Math.abs(n) <= 24) return true;   // counts, indices, hours
    return false;
}

const MIME = Object.freeze({
    '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.jsonl': 'application/json',
    '.npz': 'application/octet-stream',
});
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const full = resolve(ROOT, decodeURIComponent(relative));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try {
        res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' })
            .end(await readFile(full));
    } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const perPage = [];
try {
    for (const page of COCKPITS.filter((p) => !ONLY || p === ONLY)) {
        const tab = await browser.newPage();
        await tab.setViewport({ width: 1680, height: 1000 });
        await tab.goto(`${base}/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise((accept) => setTimeout(accept, 2600));

        /* Collect every rendered number together with the nearest text that labels it, so an
           unaccounted finding is actionable rather than a bare figure. */
        const found = await tab.evaluate(() => {
            const results = [];
            const seen = new Set();
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const el = node.parentElement;
                if (!el) continue;
                const tag = el.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
                const box = el.getBoundingClientRect();
                if (box.width === 0 && box.height === 0) continue;
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                const text = node.textContent;
                const matches = text.match(/-?\d[\d,]*(?:\.\d+)?/g);
                if (!matches) continue;
                const label = (el.closest('[data-basis],[id],.kv,.data-row,.stat-row,.metric-row') || el)
                    .textContent.replace(/\s+/g, ' ').trim().slice(0, 70);
                for (const m of matches) {
                    const key = `${m}|${label}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    results.push({ value: m, label, id: el.id || null });
                }
            }
            return results;
        });
        await tab.close();

        const considered = found.filter((f) => !isExcluded(f.value));
        const unaccounted = considered.filter((f) => !ACCOUNTED.has(f.value)
            && !ACCOUNTED.has(f.value.replace(/,/g, '')));
        perPage.push({ page, considered: considered.length, unaccounted });
    }

    console.log('\nCONVENTIONAL COVERAGE — rendered numbers accounted for by the parameter registry');
    console.log(`registry: ${registry.parameters.length} parameters, engine v${registry.engineVersion}\n`);
    let totalConsidered = 0;
    let totalUnaccounted = 0;
    for (const row of perPage) {
        const traced = row.considered - row.unaccounted.length;
        const pct = row.considered === 0 ? 100 : (traced / row.considered) * 100;
        totalConsidered += row.considered;
        totalUnaccounted += row.unaccounted.length;
        console.log(`  ${row.page.padEnd(24)} ${String(traced).padStart(4)} / ${String(row.considered).padStart(4)} `
            + `traced  (${pct.toFixed(1)} %)`);
    }
    const overall = totalConsidered === 0 ? 100 : ((totalConsidered - totalUnaccounted) / totalConsidered) * 100;
    console.log(`\n  OVERALL ${totalConsidered - totalUnaccounted} / ${totalConsidered} rendered numbers traced `
        + `= ${overall.toFixed(1)} %`);

    if (totalUnaccounted > 0) {
        console.log('\nUNACCOUNTED (a number an operator reads that no registry parameter explains):');
        for (const row of perPage) {
            if (row.unaccounted.length === 0) continue;
            console.log(`\n  ${row.page} — ${row.unaccounted.length}`);
            for (const f of row.unaccounted.slice(0, 14)) {
                console.log(`    ${String(f.value).padStart(12)}  ${f.id ? `#${f.id} ` : ''}${f.label}`);
            }
            if (row.unaccounted.length > 14) console.log(`    ... and ${row.unaccounted.length - 14} more`);
        }
    }
    if (STRICT && totalUnaccounted > 0) {
        console.log(`\nFAIL — ${totalUnaccounted} rendered numbers are untraceable.`);
        process.exitCode = 1;
    } else {
        console.log(`\n${STRICT ? 'PASS' : 'MEASURED'} — coverage reported${STRICT ? '' : ' (monitor mode, exit 0 by design)'}.`);
    }
} finally {
    await browser.close();
    await new Promise((accept) => server.close(accept));
}
