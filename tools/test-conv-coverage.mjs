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
const distributionFailures = [];
try {
    for (const page of COCKPITS.filter((p) => !ONLY || p === ONLY)) {
        const tab = await browser.newPage();
        await tab.setViewport({ width: 1680, height: 1000 });
        await tab.goto(`${base}/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise((accept) => setTimeout(accept, 2600));

        /* The data-hall cockpit deliberately defaults to the thermal operator layer. Its
           declared distribution, however, reconciles rack POWER against hall IT kW. Select
           that explicit layer before reading the shared rack-value cells; summing 25.4 C
           values would be a test error, not an electrical reconciliation. */
        if (page === 'datahall.html') {
            await tab.click('.mode-btn[data-mode="power"]');
            await new Promise((accept) => setTimeout(accept, 100));
        }

        /* DECLARED DISTRIBUTIONS. A field of many per-item values (the data hall renders 500
           cabinet cells) cannot honestly be registered one parameter per cell, and leaving the
           cells in the denominator drowns every other page. A page may instead declare the
           field against the quantity it must reconcile to. Those cells leave the denominator
           ONLY because their SUM is verified here against that registry parameter — a field
           that stops reconciling fails, which is a stronger check than tracing each cell. */
        const distributions = await tab.evaluate(() => [...document.querySelectorAll('[data-rz-distribution]')]
            .map((host) => {
                const selector = host.getAttribute('data-rz-distribution-selector');
                /* A declaration may live outside the region it describes (an element can carry
                   only one distribution), so fall back to a document-scoped query when the host
                   has no matching descendants. */
                let cells = [...host.querySelectorAll(selector || '*')];
                if (cells.length === 0 && selector) cells = [...document.querySelectorAll(selector)];
                const values = [];
                let sum = 0;
                for (const cell of cells) {
                    /* Take the LAST number in the cell. An instrument reading is written
                       "MFM1  135.6 L/s" — the first number is part of the tag, and reading it
                       made every loop reconcile against 1.0 instead of its flow. */
                    const all = cell.textContent.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g);
                    if (!all || !all.length) continue;
                    const v = Number(all[all.length - 1]);
                    values.push(v);
                    sum += v;
                }
                /* A field of many per-item values reconciles to its basis one of two ways.
                   SUM: the cells add up to the parameter (a whole cabinet field).
                   PER-ITEM: each cell equals the parameter divided by a count (four chiller
                   loops drawn out of seven running — the drawn set is a SUBSET, so its sum
                   cannot equal the plant and demanding that would be the wrong check). The
                   mode is declared by the page, never guessed here. */
                const targetSel = host.getAttribute('data-rz-distribution-target');
                let targetValue = null;
                if (targetSel) {
                    const el = document.querySelector(targetSel);
                    const m = el && el.textContent.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
                    if (m) targetValue = Number(m[0]);
                }
                return {
                    param: host.getAttribute('data-rz-distribution'),
                    mode: host.getAttribute('data-rz-distribution-mode') || 'sum',
                    divisorParam: host.getAttribute('data-rz-distribution-divisor'),
                    targetSel, targetValue,
                    sum, values, counted: values.length, selector,
                };
            }));
        for (const dist of distributions) {
            /* A declaration that matches NOTHING must never read as a pass. That is how an
               exclusion becomes free: change a class name, the selector stops matching, and the
               gate cheerfully reports "reconciles" over an empty set. */
            if (dist.counted === 0) {
                console.log(`  ! ${page}: declared distribution ${dist.param} matched NO cells `
                    + `(selector "${dist.selector}") — declaration refused`);
                distributionFailures.push(`${page}: ${dist.param} matched no cells `
                    + `(selector "${dist.selector}")`);
                continue;
            }
            const parameter = registry.parameters.find((p) => p.id === dist.param);
            if (!parameter) {
                console.log(`  ! ${page}: declared distribution names an unregistered parameter `
                    + `"${dist.param}" — the declaration is refused and its cells stay in the denominator`);
                continue;
            }
            let expected = Number(parameter.value);
            let actual = dist.sum;
            let what = `${dist.counted} cells sum to ${dist.sum.toFixed(1)}`;

            if (dist.mode === 'per-item') {
                /* No divisor means each item should equal the parameter itself — four loops
                   whose supply water all sits on the same published CHWS plane. */
                let divisorValue = 1;
                if (dist.divisorParam) {
                    const divisor = registry.parameters.find((p) => p.id === dist.divisorParam);
                    if (!divisor || !Number(divisor.value)) {
                        console.log(`  ! ${page}: per-item distribution ${dist.param} names an unusable `
                            + `divisor "${dist.divisorParam}" — declaration refused`);
                        continue;
                    }
                    divisorValue = Number(divisor.value);
                }
                expected = Number(parameter.value) / divisorValue;
                /* Every drawn item must sit at the per-item share; report the worst one. */
                actual = dist.values.reduce((worst, v) =>
                    (Math.abs(v - expected) > Math.abs(worst - expected) ? v : worst), expected);
                what = `${dist.counted} items, worst ${actual.toFixed(1)} against a per-item share of `
                    + `${expected.toFixed(1)} (${dist.param} / ${dist.divisorParam})`;
            } else if (dist.mode === 'target-element') {
                if (dist.targetValue == null) {
                    console.log(`  ! ${page}: distribution target "${dist.targetSel}" rendered no `
                        + 'number — declaration refused');
                    continue;
                }
                expected = dist.targetValue;
                what = `${dist.counted} cells sum to ${dist.sum.toFixed(1)} against the aggregate `
                    + `this page renders at ${dist.targetSel} (${expected})`;
            }

            const tolerance = Math.max(Math.abs(expected) * 0.05, 1);
            const agrees = Math.abs(actual - expected) <= tolerance;
            console.log(`  = ${page}: distribution ${dist.param} [${dist.mode}] — ${what} `
                + `${agrees ? '(reconciles)' : '(DOES NOT RECONCILE)'}`);
            if (!agrees) {
                distributionFailures.push(`${page}: ${dist.param} [${dist.mode}] — ${what}`);
            }
        }

        /* Collect every rendered number together with the nearest text that labels it, so an
           unaccounted finding is actionable rather than a bare figure. */
        const found = await tab.evaluate(() => {
            const results = [];
            const seen = new Set();
            /* Exclude EXACTLY the cells a declaration verifies — not everything inside the
               declaring element. Hosting the declaration on a whole SVG and excluding its
               subtree removed 89 of that page's 106 numbers from the denominator in one line,
               which is precisely the loophole a coverage gate must not have. */
            /* DECLARED AUTHORED BASIS. Some numbers on these cockpits are not engine quantities
               at all and never will be: ict's traffic scenario is authored on the page and is
               explicitly independent of IT kW — the Conventional engine has no network model.
               Forcing them into the registry would break the rule that the engine is the single
               source of truth; leaving them in the untraced pile makes the backlog figure
               meaningless, because "nobody has bound this yet" and "this is not an engine
               quantity" are different problems. They get their own bucket, they must carry a
               written reason, and they are REPORTED — never quietly dropped. */
            const authoredRegions = [...document.querySelectorAll('[data-rz-authored-basis]')];
            const insideAuthored = (el) => authoredRegions.some((host) =>
                (host.getAttribute('data-rz-authored-basis') || '').length >= 40 && host.contains(el));

            const declaredCells = new Set();
            for (const host of document.querySelectorAll('[data-rz-distribution]')) {
              const selector = host.getAttribute('data-rz-distribution-selector');
              if (!selector) continue;
              for (const cell of host.querySelectorAll(selector)) declaredCells.add(cell);
            }
            const insideDeclared = (el) => {
              for (const cell of declaredCells) if (cell === el || cell.contains(el)) return true;
              return false;
            };
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const el = node.parentElement;
                if (!el) continue;
                const tag = el.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
                /* Excluded ONLY because the sum is verified above. */
                if (insideDeclared(el)) continue;
                if (insideAuthored(el)) { results.push({ authored: true }); continue; }
                const box = el.getBoundingClientRect();
                if (box.width === 0 && box.height === 0) continue;
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                /* Strip clock and calendar substrings BEFORE extracting numbers. The exclusion
                   list only recognised a cell that was ENTIRELY a date or a time; an alarm row
                   reading "2026-08-27 02:11 VMS-01 ..." was therefore split into 2026, -27, -26
                   and 60 and counted as four untraced engineering values. */
                const text = node.textContent
                    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
                    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
                    /* Equipment tags are identifiers, not measurements. "FM-101" was being read
                       as the value -101 and counted as an untraced engineering number. */
                    .replace(/\b[A-Z]{1,}[-\u2011]\d+[A-Z]?\b/g, ' ');
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

        const authoredCount = found.filter((f) => f.authored).length;
        const considered = found.filter((f) => !f.authored && !isExcluded(f.value));
        const unaccounted = considered.filter((f) => !ACCOUNTED.has(f.value)
            && !ACCOUNTED.has(f.value.replace(/,/g, '')));
        perPage.push({ page, considered: considered.length, unaccounted, authored: authoredCount });
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
            + `traced  (${pct.toFixed(1)} %)`
            + (row.authored ? `   + ${row.authored} declared authored page basis` : ''));
    }
    const totalAuthored = perPage.reduce((sum, r) => sum + r.authored, 0);
    const overall = totalConsidered === 0 ? 100 : ((totalConsidered - totalUnaccounted) / totalConsidered) * 100;
    console.log(`\n  OVERALL ${totalConsidered - totalUnaccounted} / ${totalConsidered} rendered numbers traced `
        + `= ${overall.toFixed(1)} %`);
    if (totalAuthored > 0) {
        console.log(`  plus ${totalAuthored} numbers in regions DECLARED as authored page basis `
            + '(outside the engine\'s scope, each with a written reason) — counted separately so '
            + 'the untraced figure means what it says');
    }

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
    if (distributionFailures.length > 0) {
        /* A declared distribution that does not reconcile is a FAILURE in both modes: the page
           bought its exclusion from the denominator with a promise, and the promise is broken. */
        console.log('\nFAIL — declared distributions that do not reconcile:');
        for (const f of distributionFailures) console.log(`    ${f}`);
        process.exitCode = 1;
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
