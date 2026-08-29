/**
 * Ship gate — hall selection is a real scope swap where it should be, and honestly a view
 * label where it should not.
 *
 * Three cockpits shipped a Campus | A | B | C | D selector. All three were cosmetic: they
 * changed headings and left the data untouched. That is a dead control dressed as an
 * operator tool, the same class of defect as a hooked element nothing ever assigns.
 *
 * The correct behaviour is NOT the same on every page, and this gate encodes the difference:
 *
 *   H1 datahall.html — REAL SWAP. The page draws one hall's cabinet field, so selecting a
 *      different hall must rebuild it. The per-cabinet distribution must change.
 *   H2 datahall.html — TOTALS INVARIANT. The governed four-hall study gives every hall the
 *      same 10,000 kW design and 7,500 kW adopted load, so a hall swap changes WHICH
 *      cabinets carry the load, not how much there is. Rack load and power density must not
 *      move. (A page that changed them would be inventing a difference the study does not
 *      have — the opposite failure, and just as wrong.)
 *   H3 datahall.html — STILL RECONCILES. After the swap the cabinet field must still sum to
 *      the hall's registered IT load. A rebuild that loses the reconciliation is worse than
 *      no rebuild.
 *   H4 chiller-plant.html — NOT A DATA SWAP. The chilled-water plant is central, so its
 *      existing Hall selector remains view context and must not mutate plant telemetry.
 *   H5 water-system.html — SITE-WIDE ONLY. The municipal treatment train has no published
 *      downstream hall submeters. It must not expose a Hall A-D selector or fabricate a
 *      per-hall split; the site balance stays visible and hall allocation fails closed.
 *
 * Run: node tools/test-conv-hall-scope.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));
const hallItLoad = registry.parameters.find((p) => p.id === 'hall.it_load_kw');
assert.ok(hallItLoad, 'registry must carry hall.it_load_kw');

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

async function openPage(page) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1680, height: 1000 });
    await tab.goto(`${base}/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((accept) => setTimeout(accept, 2600));
    return tab;
}

try {
    /* ── H1..H3 datahall ───────────────────────────────────────────────────── */
    const hall = await openPage('datahall.html');
    /* `.rk-val` is mode-sensitive (temperature is the current first-paint mode).
       Reconciliation must explicitly inspect the power layer, never sum temperatures. */
    await hall.evaluate(() => window.setMode('power'));
    const readField = () => hall.evaluate(() => {
        const cells = [...document.querySelectorAll('.rack .rk-val')].map((e) => e.textContent.trim());
        const sum = cells.reduce((acc, c) => {
            const m = c.match(/-?\d+(?:\.\d+)?/);
            return acc + (m ? Number(m[0]) : 0);
        }, 0);
        const id = (x) => document.getElementById(x);
        return {
            fingerprint: cells.join('|'),
            cells: cells.length,
            sum: Math.round(sum * 10) / 10,
            rackLoad: id('dh-rack-load') ? id('dh-rack-load').textContent.trim() : null,
            density: id('dh-pd') ? id('dh-pd').textContent.trim() : null,
        };
    });

    const before = await readField();
    assert.ok(before.cells > 0, 'datahall rendered no cabinet cells');
    await hall.evaluate(() => window.selectHall('C'));
    await new Promise((accept) => setTimeout(accept, 1400));
    const after = await readField();

    assert.notEqual(after.fingerprint, before.fingerprint,
        'datahall: selecting a different hall did not change the cabinet field — the selector '
        + 'is relabelling, not re-scoping');
    assert.equal(after.cells, before.cells,
        'datahall: the cabinet count changed with the hall; the study gives every hall 500');
    assert.equal(after.rackLoad, before.rackLoad,
        'datahall: rack load moved with the hall. Every hall carries the same adopted load in '
        + 'the governed study, so a difference here is invented');
    assert.equal(after.density, before.density,
        'datahall: power density moved with the hall — same reason');

    /* H3 — the rebuilt field must still reconcile to the registered hall load. Per-cell values
       are displayed to one decimal, so the sum carries rounding: allow 0.5 %, which is far
       tighter than any real drift and looser than 500 roundings. */
    const expected = Number(hallItLoad.value);
    const tolerance = Math.max(expected * 0.005, 1);
    assert.ok(Math.abs(after.sum - expected) <= tolerance,
        `datahall: after the hall swap the cabinet field sums to ${after.sum} kW but the `
        + `registered hall load is ${expected} kW — the rebuild lost the reconciliation`);
    await hall.close();

    /* ── H4 central chiller plant must NOT re-scope ────────────────────────── */
    for (const [page, cells, labelId] of [
        ['chiller-plant.html', ['kChws', 'kChwr', 'kFlow', 'kCool'], 'chillerHallLabel'],
    ]) {
        const tab = await openPage(page);
        const read = () => tab.evaluate((ids) => ids.map((i) => {
            const el = document.getElementById(i);
            return el ? el.textContent.trim() : null;
        }).join('|'), cells);

        const plantBefore = await read();
        const switched = await tab.evaluate(() => {
            const button = document.querySelector('[data-hall="C"]');
            if (!button) return false;
            button.click();
            return true;
        });
        assert.ok(switched, `${page}: no hall control found — the adoption list is stale`);
        await new Promise((accept) => setTimeout(accept, 1200));
        const plantAfter = await read();

        assert.equal(plantAfter, plantBefore,
            `${page}: hall selection changed central-plant telemetry. This plant serves all four `
            + 'halls and no hydronic distribution design exists to split it — the engine says so '
            + 'explicitly (hall.chillers_allocated is null with its reason attached). A per-hall '
            + 'split here would be fabricated.');

        const label = await tab.evaluate((id) => {
            const el = document.getElementById(id);
            return el ? el.textContent.trim() : null;
        }, labelId);
        assert.ok(label && /hall/i.test(label),
            `${page}: the hall control must still say which hall is in view (got ${label})`);
        await tab.close();
    }

    /* ── H5 municipal water treatment is one site-wide plant ──────────────── */
    const water = await openPage('water-system.html');
    const waterScope = await water.evaluate(() => ({
        hallControls: document.querySelectorAll('[data-hall]').length,
        activeHall: document.body.dataset.activeHall,
        label: document.getElementById('waterSiteLabel')?.textContent.trim(),
        basis: document.querySelector('[data-basis="current"]')?.textContent.replace(/\s+/g, ' ').trim(),
        hallAllocation: document.getElementById('alloc-hall')?.textContent.trim(),
        note: document.getElementById('water-scope-note')?.textContent.replace(/\s+/g, ' ').trim(),
    }));
    assert.equal(waterScope.hallControls, 0,
        'water-system: a site-wide municipal plant must not expose Hall A-D controls');
    assert.equal(waterScope.activeHall, undefined,
        'water-system: site-wide plant must not carry an active-hall state');
    assert.match(waterScope.label, /site-wide/i);
    assert.match(waterScope.basis, /site scope/i);
    assert.match(waterScope.hallAllocation, /UNAVAILABLE/i);
    assert.match(waterScope.note, /submeter/i);
    await water.close();

    console.log('PASS Conventional hall scope — datahall re-scopes, chiller remains view-only, '
        + 'and municipal water is site-wide with hall allocation unavailable');
} finally {
    await browser.close();
    await new Promise((accept) => server.close(accept));
}
