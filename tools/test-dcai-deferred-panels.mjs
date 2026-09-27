#!/usr/bin/env node
/**
 * The nine panels nobody is looking at must not paint before first paint.
 *
 * WHY THIS GATE EXISTS
 *
 * `datahallAI.html` opens on the `dash` tab. The other nine panels are behind
 * `.pn{display:none}` — invisible until the visitor clicks their tab. Measured on a 390px
 * viewport at 4x CPU throttling, the page painted every one of them before first paint:
 *
 *   LCP 6,672 ms · TBT 3,884 ms · longest task 1,438 ms   (index.html, for scale: 1,884 / 922)
 *
 * with `renderOverview`, `renderHall` and the four `drawDH` sheets owning ~0.4 s of self time
 * on the critical path, and each one re-triggering the `rz-svg-legible` MutationObserver pass.
 *
 * v3.11.6 moved that work behind `RZDefer`: a panel paints on the first activation of its tab,
 * or on an idle slice after `load`, whichever comes first. This gate holds that arrangement in
 * place, because it is the kind of change a later edit undoes by accident — adding one eager
 * `renderHall()` back at the top level would cost the same 0.4 s again and nothing would report it.
 *
 * WHAT IT ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * It does NOT assert a millisecond budget. Wall-clock timings on this machine move with whatever
 * else is running (a concurrent Chromium gate is enough to double them), so a timing threshold
 * here would be a flake generator. It asserts the STRUCTURAL fact that produces the win:
 *
 *   D1  at the `load` event, every deferred panel's container is still empty
 *   D2  it is STILL empty seconds later with no click — v3.11.7 removed the idle drain, because
 *       measured it only moved the work a few hundred ms later (median of 5: TBT 4,213 ms with the
 *       drain against 2,859 ms without, long tasks 29 against 17). A panel a visitor never opens
 *       must never be built, and this is the assertion that keeps it that way
 *   D3  activating a tab paints its panel, synchronously enough that it is painted by the time the
 *       panel is visible — so a panel can never be shown empty
 *   D4  a panel paints exactly once: `RZDefer.ensure` is false on a second call and the container
 *       does not grow
 *   D5  no page error on any of those paths
 *   D6  sitting on `dash`, NOTHING mutates inside a hidden panel. Measured before v3.11.7 this was
 *       1,241 mutations per 20 s — 900 of them the fire cause & effect matrix, rebuilt on a 4 s tick
 *       behind `display:none`, plus 200 electrical-overview values, 45 hall/BMS cells and the fire
 *       summary strip. Every one of those tickers now tests `.pn.on` first
 *   D7  the inverse, which matters just as much: once a panel IS active its subtree keeps mutating.
 *       A visibility guard that never releases would be a worse bug than the waste it removed
 *
 * Usage: node tools/test-dcai-deferred-panels.mjs [--json]
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
import { TAB_SETS } from './lib/cockpit-tabs.mjs';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const JSON_OUT = process.argv.includes('--json');
const COCKPIT = TAB_SETS[PAGE].cockpit;

/* tab id -> the container its builder writes into. A container that is empty at `load` and
   non-empty afterwards is the whole invariant, so these ids are the gate's contract with the
   page: if a builder is re-pointed at a different element, this list moves with it. */
const PANELS = Object.freeze([
    { tab: 'over', container: 'bldgC' },
    { tab: 'over', container: 'overCards' },
    { tab: 'hall', container: 'hc' },
    { tab: 'elec', container: 'elecDH1C' },
    /* v3.11.7 — the other four hidden diagrams, 126 KB of builder bodies between them. Added after
       a devtools.timeline trace showed the remaining load is FunctionCall (1,864 ms) and Layout
       (2,069 ms), not compile (208 ms): running these builders and laying out their DOM IS the
       cost, so deferring more of them is the lever, and extracting scripts to external files is not. */
    { tab: 'cool', container: 'coolC' },
    { tab: 'rack', container: 'rackC' },
    { tab: 'net', container: 'netC' },
    { tab: 'bms', container: 'bmsC' },
]);

const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' });
const server = createServer(async (req, res) => {
    const full = resolve(ROOT, decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1)));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); }
    catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const failures = [];
const note = (ok, msg) => { if (!ok) failures.push(msg); };
const sleep = (ms) => new Promise((accept) => setTimeout(accept, ms));

/** A page whose load-time snapshot is taken before the page's own load handler runs. */
async function open({ freezeIdle = false } = {}) {
    const tab = await browser.newPage();
    const errors = [];
    tab.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
    await tab.setViewport({ width: 1280, height: 900 });
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.evaluateOnNewDocument((ids, freeze) => {
        /* Registered first, so it runs before the page's own `load` listener schedules the drain. */
        window.__atLoad = null;
        window.addEventListener('load', () => {
            window.__atLoad = {};
            for (const id of ids) {
                const el = document.getElementById(id);
                window.__atLoad[id] = el ? el.innerHTML.length : -1;
            }
        });
        /* D3 needs the activation path measured on its own, with no idle drain to help it. */
        if (freeze) window.requestIdleCallback = () => 0;
    }, PANELS.map((p) => p.container), freezeIdle);
    await tab.goto(`${base}/${PAGE}`, { waitUntil: 'load', timeout: 120000 });
    await enterAuthorizedAuditState(tab, COCKPIT);
    return { tab, errors };
}

const sizes = (tab) => tab.evaluate((ids) => {
    const out = {};
    for (const id of ids) { const el = document.getElementById(id); out[id] = el ? el.innerHTML.length : -1; }
    return out;
}, PANELS.map((p) => p.container));

/* ---- D1 + D2: empty at load, filled by the idle drain with no click at all ---------------- */
{
    const { tab, errors } = await open();
    const atLoad = await tab.evaluate(() => window.__atLoad);
    for (const { tab: t, container } of PANELS) {
        const n = atLoad ? atLoad[container] : null;
        if (n === -1) { note(false, `D1 ${container}: element missing from the page`); continue; }
        note(n === 0, `D1 ${container} (tab ${t}) already carried ${n} chars at the load event — its builder is back on the critical path`);
    }

    /* D2 — give the page a generous window to paint something behind our back, then require that
       it did not. This is the inverse of the v3.11.6 assertion, on purpose. */
    await sleep(4000);
    const idle = await sizes(tab);
    for (const { tab: t, container } of PANELS) {
        note(idle[container] === 0, `D2 ${container} (tab ${t}) painted ${idle[container]} chars with no click — a panel the visitor never opened is being built anyway`);
    }
    const stillPending = await tab.evaluate(() => (window.RZDefer ? window.RZDefer.pending() : null));
    note(stillPending !== null, 'D2 window.RZDefer is not defined');
    note(stillPending === null || stillPending.length > 0, 'D2 the queue emptied itself with no click — something drains it');

    /* D4 — activate every tab, then prove a second ensure() does not repaint */
    for (const t of ['over', 'hall', 'elec', 'cool', 'rack', 'net', 'bms']) {
        await tab.click(`.tabs button[data-t="${t}"]`);
    }
    const after = await sizes(tab);
    for (const { tab: t, container } of PANELS) {
        note(after[container] > 0, `D4 ${container} (tab ${t}) is empty after its tab was activated`);
    }
    const again = await tab.evaluate(() => (window.RZDefer
        ? ['over', 'hall', 'elec', 'cool', 'rack', 'net', 'bms'].map((id) => window.RZDefer.ensure(id))
        : null));
    note(again !== null, 'D4 window.RZDefer is not defined — the deferred-paint queue is gone, so every panel paints eagerly');
    note(again === null || again.every((r) => r === false), `D4 RZDefer.ensure repainted an already-painted panel: ${JSON.stringify(again)}`);
    const twice = await sizes(tab);
    for (const { container } of PANELS) {
        note(twice[container] === after[container], `D4 ${container} grew from ${after[container]} to ${twice[container]} chars on a second ensure — painted twice`);
    }
    note(errors.length === 0, `D5 page errors on the lazy path: ${errors.join(' | ')}`);
    await tab.close();
}

/* ---- D3: a tab click paints its panel, and the panel is not visible before it does --------- */
{
    const { tab, errors } = await open();
    const frozen = await sizes(tab);
    for (const { tab: t, container } of PANELS) {
        note(frozen[container] === 0, `D3 ${container} (tab ${t}) painted before any click`);
    }
    for (const t of ['over', 'hall', 'elec', 'cool', 'rack', 'net', 'bms']) {
        await tab.click(`.tabs button[data-t="${t}"]`);
        const shown = await tab.evaluate((id) => {
            const panel = document.getElementById('p-' + id);
            return { on: !!(panel && panel.classList.contains('on')) };
        }, t);
        note(shown.on, `D3 tab ${t} did not become visible on click`);
    }
    const painted = await sizes(tab);
    for (const { tab: t, container } of PANELS) {
        note(painted[container] > 0, `D3 ${container} is empty after tab ${t} was activated — the panel is shown blank`);
    }
    note(errors.length === 0, `D5 page errors on the activation path: ${errors.join(' | ')}`);
    await tab.close();
}

/* ---- D6 + D7: hidden panels are inert, active panels are not --------------------------------- */
{
    const { tab, errors } = await open();
    const observe = () => tab.evaluate(() => {
        window.__mut = {};
        window.__obs = [];
        document.querySelectorAll('.pn').forEach((panel) => {
            const o = new MutationObserver((recs) => {
                window.__mut[panel.id] = (window.__mut[panel.id] || 0) + recs.length;
            });
            o.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true });
            window.__obs.push(o);
        });
    });
    const collect = () => tab.evaluate(() => {
        window.__obs.forEach((o) => o.disconnect());
        return window.__mut;
    });

    /* D6 — two 4 s ticks' worth of window, on the dash tab, touching nothing */
    await observe();
    await sleep(9000);
    const idle = await collect();
    for (const [panel, n] of Object.entries(idle)) {
        if (panel === 'p-dash') continue;                 /* the active panel may tick */
        note(n === 0, `D6 ${panel} mutated ${n} times while hidden — a ticker is repainting a panel nobody can see`);
    }

    /* D7 — the fire panel is the worst former offender and has a 4 s tick of its own: once shown,
       its subtree must change again, or the guard has frozen it. */
    await tab.click('.tabs button[data-t="fire"]');
    await observe();
    await sleep(9000);
    const live = await collect();
    note((live['p-fire'] || 0) > 0, `D7 p-fire did not mutate in 9 s while ACTIVE — the visibility guard is not releasing`);
    for (const [panel, n] of Object.entries(live)) {
        if (panel === 'p-fire') continue;
        note(n === 0, `D7 ${panel} mutated ${n} times while hidden (fire active)`);
    }
    note(errors.length === 0, `D5 page errors on the ticker path: ${errors.join(' | ')}`);
    await tab.close();
}

await browser.close();
server.close();

if (JSON_OUT) console.log(JSON.stringify({ gate: 'dcai-deferred-panels', failures }, null, 2));
else if (failures.length === 0) console.log(`DCAI LAZY PANELS — CLEAN (${PANELS.length} containers lazy; hidden panels inert, active panel still ticking)`);
else { console.log(`DCAI DEFERRED PANELS — ${failures.length} FAILURE(S)`); for (const f of failures) console.log('  ' + f); }
process.exit(failures.length ? 1 : 0);
