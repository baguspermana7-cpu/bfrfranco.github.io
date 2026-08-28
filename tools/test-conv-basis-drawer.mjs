/**
 * Ship gate — the shared basis drawer explains what it says it explains.
 *
 * Three cockpits each carried a hand-written `basisFor` dictionary. Copying provenance by
 * hand is what let a drawer in v1.132.0 explain a density it had not derived, citing a
 * snapshot key that has never existed. js/rz-basis-drawer.js renders the GENERATED registry
 * instead, and this gate holds that arrangement honest:
 *
 *   D1 RESOLVES  every `data-basis-param` in the markup names a real registry parameter.
 *                A typo'd or retired id must fail here, not open a drawer that says
 *                "unavailable" in production.
 *   D2 LOADS     each adopting page actually ships js/conv-parameters.js AND
 *                js/rz-basis-drawer.js — a hook with no module is a dead control.
 *   D3 AGREES    the drawer's stated value equals the value the page renders in that same
 *                row. This is the trace-parity idea applied to the drawer: an explanation
 *                whose number differs from the number it explains is worse than none.
 *   D4 A11Y      every hook is keyboard reachable and announces itself as a control.
 *
 * Run: node tools/test-conv-basis-drawer.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));
const REGISTERED = new Set(registry.parameters.map((p) => p.id));

/* Pages that have adopted the shared drawer. Adding a page here is deliberate. */
const ADOPTERS = Object.freeze([
    'dc-conventional.html', 'datahall.html', 'chiller-plant.html', 'water-system.html',
    'fire-system.html', 'fuel-system.html', 'ict.html', 'EPMS_Telemetry.html',
]);

/* ── D1 + D2, statically ───────────────────────────────────────────────────── */
const HOOK_RE = /data-basis-param="([^"]+)"/g;
let hookCount = 0;
for (const page of ADOPTERS) {
    const html = await readFile(join(ROOT, page), 'utf8');
    assert.ok(html.includes('js/conv-parameters.js'),
        `${page}: adopts the basis drawer but does not load js/conv-parameters.js — the hooks would be dead controls`);
    assert.ok(html.includes('js/rz-basis-drawer.js'),
        `${page}: adopts the basis drawer but does not load js/rz-basis-drawer.js`);
    HOOK_RE.lastIndex = 0;
    let match;
    while ((match = HOOK_RE.exec(html)) !== null) {
        hookCount += 1;
        assert.ok(REGISTERED.has(match[1]),
            `${page}: data-basis-param="${match[1]}" is not a registered parameter`);
    }
}
assert.ok(hookCount > 0, 'no basis hooks found — the adoption list is stale');

/* ── D3 + D4, in a real browser ────────────────────────────────────────────── */
const MIME = Object.freeze({
    '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.woff2': 'font/woff2',
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

/* The page renders a value with a unit and its own rounding; the drawer renders the
   registered value. Compare the leading numbers, tolerating display rounding — the same
   comparison _dcmoc_trace_parity_probe.mjs makes, for the same reason. */
function leadingNumber(text) {
    const m = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
}

let checked = 0;
try {
    for (const page of ADOPTERS) {
        const tab = await browser.newPage();
        await tab.goto(`${base}/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await tab.waitForFunction(() => window.RZBasisDrawer && window.RZ_CONV_PARAMETERS, { timeout: 20000 });
        await new Promise((accept) => setTimeout(accept, 2200));

        const hooks = await tab.evaluate(() => [...document.querySelectorAll('[data-basis-param]')]
            .map((el) => ({
                param: el.getAttribute('data-basis-param'),
                shown: (el.querySelector('.v, .num, [id]') || el).textContent.trim(),
                tabindex: el.getAttribute('tabindex'),
                role: el.getAttribute('role'),
            })));

        for (const hook of hooks) {
            /* D4 — a div is not a button unless it is told to be one. */
            assert.equal(hook.tabindex, '0',
                `${page}: the ${hook.param} hook is not keyboard reachable`);
            assert.equal(hook.role, 'button',
                `${page}: the ${hook.param} hook does not announce itself as a control`);

            const drawerValue = await tab.evaluate((param) => {
                window.RZBasisDrawer.open(param);
                const panel = document.getElementById('rz-basis-drawer-panel');
                const rows = [...panel.querySelectorAll('div')]
                    .filter((d) => d.textContent.trim() === 'Value');
                const valueCell = rows.length ? rows[0].nextElementSibling : null;
                const text = valueCell ? valueCell.textContent.trim() : null;
                window.RZBasisDrawer.close();
                return text;
            }, hook.param);

            assert.ok(drawerValue, `${page}: the drawer rendered no value for ${hook.param}`);
            const shown = leadingNumber(hook.shown);
            const explained = leadingNumber(drawerValue);
            if (shown === null || explained === null) continue;   // an unavailable cell
            /* A row may legitimately display a scaled unit — "31.3 MW" beside a registered
               31,250 kW is correct, not drift. So the comparison accepts the metric scalings
               these cockpits actually use, exactly as _dcmoc_trace_parity_probe.mjs does, and
               still rejects a different NUMBER: a row showing 7.2 for a registered 19.4 fails
               at every scale. Nothing here loosens the check — it only stops the gate from
               mistaking a unit prefix for a defect. */
            const scales = [1, 1000, 1 / 1000, 100, 1 / 100, 60, 1 / 60];
            const agrees = scales.some((k) => {
                const target = explained * k;
                const tolerance = Math.max(Math.abs(target) * 0.005, 0.05);
                return Math.abs(shown - target) <= tolerance;
            });
            assert.ok(agrees,
                `${page}: the ${hook.param} row shows ${hook.shown} but its drawer explains `
                + `${drawerValue} — at no display scale do these describe the same number`);
            checked += 1;
        }
        await tab.close();
    }
    console.log(`PASS Conventional basis drawer — ${hookCount} hooks across ${ADOPTERS.length} pages, `
        + `all resolve to registered parameters; ${checked} value/explanation pairs agree`);
} finally {
    await browser.close();
    await new Promise((accept) => server.close(accept));
}
