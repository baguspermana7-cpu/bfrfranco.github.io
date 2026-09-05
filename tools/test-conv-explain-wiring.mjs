/**
 * Ship gate — the cockpit glossary tooltips are wired FROM THE REGISTRY, and they resolve.
 *
 * Plan B2 asked for RZExplain on the Conventional cockpits with the mapping generated rather
 * than hand-authored: "the generator emits the mapping, the pages do not hand-author text."
 * Before v1.134.25 those eight pages carried ZERO `data-explain` attributes — an operator
 * reading "approach temperature" or "cycles of concentration" had nowhere to go, on the only
 * substantial pages of the site with no glossary access at all.
 *
 * Two surfaces, deliberately separate, because they answer different questions:
 *   the BASIS DRAWER on the value cell says where THIS NUMBER came from;
 *   the TOOLTIP on the label says what the TERM means.
 * An element carrying both would have two panels and two focus behaviours, so E4 forbids it.
 *
 *   E1 RESOLVES   every registry `explainKey` names a real entry in js/rz-explain-db.js. A
 *                 typo'd key is silent: rz-explain.js skips unknown keys, so the tooltip
 *                 simply never appears and nothing says why.
 *   E2 LOADS      each cockpit ships rz-explain-db.js AND rz-explain.js, both BEFORE
 *                 rz-basis-drawer.js — the drawer is what applies the keys.
 *   E3 WIRES      in a real render every cockpit wires at least one tooltip, and every
 *                 `[data-explain]` it produced actually became an rz-explain trigger.
 *   E4 SEPARATE   no element carries both data-explain and data-basis-param.
 *
 * Run: node tools/test-conv-explain-wiring.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));

const COCKPITS = Object.freeze([
    'dc-conventional.html', 'datahall.html', 'chiller-plant.html', 'water-system.html',
    'fire-system.html', 'fuel-system.html', 'ict.html', 'EPMS_Telemetry.html',
]);

/* ── E1 keys resolve ───────────────────────────────────────────────────────── */
globalThis.window = globalThis.window || {};
require(join(ROOT, 'js', 'rz-explain-db.js'));
const DB = (globalThis.window.RZ_EXPLAIN_DB || {}).entries || {};
assert.ok(Object.keys(DB).length > 100, 'the explain database did not load');

const keyed = registry.parameters.filter((p) => p.explainKey);
assert.ok(keyed.length >= 20,
    `only ${keyed.length} parameters carry an explainKey — the registry mapping has been lost`);
for (const p of keyed) {
    assert.ok(DB[p.explainKey],
        `${p.id}: explainKey "${p.explainKey}" is not in js/rz-explain-db.js. rz-explain.js skips `
        + 'unknown keys silently, so this tooltip would never appear and nothing would say why.');
}

/* ── E2 the modules are loaded, in the right order ─────────────────────────── */
for (const page of COCKPITS) {
    const html = await readFile(join(ROOT, page), 'utf8');
    /* Match the SCRIPT TAG, not the filename: these pages also mention js/rz-basis-drawer.js
       in comments explaining why the hand-written provenance dictionaries were deleted, and a
       bare indexOf found the comment first and reported a load-order fault that did not exist. */
    const at = (file) => {
        const m = html.match(new RegExp('<script[^>]+src="' + file.replace(/[.\/]/g, '\\$&') + '\\?'));
        return m ? m.index : -1;
    };
    const db = at('js/rz-explain-db.js');
    const engine = at('js/rz-explain.js');
    const drawer = at('js/rz-basis-drawer.js');
    assert.ok(db > -1, `${page}: does not load js/rz-explain-db.js`);
    assert.ok(engine > -1, `${page}: does not load js/rz-explain.js`);
    assert.ok(drawer > -1, `${page}: does not load js/rz-basis-drawer.js`);
    assert.ok(db < drawer && engine < drawer,
        `${page}: loads rz-basis-drawer.js BEFORE the explain engine it calls into`);
}

/* ── E3 + E4 in a real browser ─────────────────────────────────────────────── */
const MIME = Object.freeze({
    '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.jsonl': 'application/json',
});
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const full = resolve(ROOT, decodeURIComponent(relative));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    let body;
    try { body = await readFile(full); } catch { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(body);
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

let totalWired = 0;
try {
    for (const page of COCKPITS) {
        const tab = await browser.newPage();
        await tab.goto(`${base}/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await tab.waitForFunction(() => window.RZExplain && window.RZBasisDrawer, { timeout: 20000 });
        await new Promise((accept) => setTimeout(accept, 1800));

        const seen = await tab.evaluate(() => {
            const wired = [...document.querySelectorAll('[data-explain]')];
            return {
                wired: wired.length,
                untriggered: wired.filter((el) => !el.classList.contains('rzx-trigger'))
                    .map((el) => el.getAttribute('data-explain')),
                both: document.querySelectorAll('[data-explain][data-basis-param]').length,
                keys: [...new Set(wired.map((el) => el.getAttribute('data-explain')))],
            };
        });

        assert.ok(seen.wired > 0,
            `${page}: rendered with no glossary tooltips at all — the registry mapping did not reach it`);
        assert.deepEqual(seen.untriggered, [],
            `${page}: ${seen.untriggered.length} data-explain element(s) never became a trigger `
            + `(${seen.untriggered.join(', ')}) — the attribute is there and the tooltip is dead`);
        assert.equal(seen.both, 0,
            `${page}: ${seen.both} element(s) carry BOTH data-explain and data-basis-param. The `
            + 'tooltip explains the term and the drawer explains the number; one element cannot '
            + 'be both without two panels fighting over the same focus.');
        totalWired += seen.wired;
        await tab.close();
    }
    console.log(`PASS Conventional glossary wiring — ${keyed.length} registry parameters carry an `
        + `explainKey, all resolve; ${totalWired} tooltips wired from the registry across `
        + `${COCKPITS.length} cockpits, none sharing an element with a basis hook`);
} finally {
    await browser.close();
    await new Promise((accept) => server.close(accept));
}
