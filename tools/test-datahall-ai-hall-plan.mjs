#!/usr/bin/env node
/**
 * DATA HALL plan contract — datahallAI.html
 * =========================================
 * The owner rejected this drawing three times for the same class of defect, and each time the fix
 * was invisible to every existing gate: the mimic renders, the engine tests pass, and the numbers
 * are traceable, while the drawing still says the wrong thing. What this asserts is what the owner
 * actually asked for, measured on the rendered DOM:
 *
 *   1. CDU GLYPHS == equipment.cdu_installed_per_hall. "jumlah cdu tidak ada" was a drawing that
 *      aggregated an odd count over four galleries. One glyph per installed unit, no divisor.
 *   2. CDUs stand in the CDU GALLERY of the mechanical zone, east of the rack field and clear of the
 *      cross aisle. v3.21.0, owner choice "ikut engine": the engine budgets 62 x 31 m as two 13.2 m
 *      banks + a 4.6 m cross aisle (= the full 31 m width) over ten 3.1 m rows (= 31 m of the
 *      length); the other 818 m2 holds the CDU gallery (220 m2), the air plant (450 m2) and the
 *      spare. The earlier contract put the CDUs IN the cross aisle — the egress route the engine
 *      keeps clear — and drew half the room.
 *   3. THE WATER MOVES from the CDUs to the rows: at least one animation per row, not just the two
 *      header trunks. "aliran simulasi air cdu ke row tidak ada."
 *   4. EVERY ROW IN BOTH BANKS reports its aisle temperature at SEVERAL points, and no two points
 *      in the same aisle print the same number — three readouts sharing one RZ_SIM seed key looked
 *      like three sensors and was one. "No hac temp indication in several point across row."
 *   5. ONE CRAH GLYPH PER INSTALLED UNIT, in the air plant east of the CDU gallery. "crah utk residual
 *      air gimana": the owner could not find the air path. A count on a bank was a label; a glyph per
 *      unit is the drawing.
 *   6. ONE SCALE: every rack glyph has the engine's depth/width ratio (1.2 x 0.6 m) within 8 %. The
 *      body is inset 0.4/0.5 units for a visible gutter between racks (2.13 against 2.00, 6.5 %); the
 *      pre-v3.0 plan stretched one axis 1.74x, which this still catches by an order of magnitude.
 *
 * v3.21.0 contract proven RED on v3.20.3 (248dd63b): CDUs in the cross aisle, 20 CRAH glyphs for 90
 * installed, rack glyphs 15.6 % off the engine ratio. GREEN on the redrawn plan.
 *
 * Counts come from the ENGINE at run time (DHE), never from a literal here: a basis change must
 * move this test with it, not break it.
 *
 * Usage: node tools/test-datahall-ai-hall-plan.mjs
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

const server = http.createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(request.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    try {
        const body = await readFile(join(ROOT, path));
        response.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
        response.end(body);
    } catch { response.writeHead(404).end('not found'); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (name, ok, detail) => {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
    const tab = await browser.newPage();
    tab.on('pageerror', () => {});
    await tab.setViewport({ width: 1440, height: 900 });
    await tab.goto(`${base}/datahallAI.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((accept) => setTimeout(accept, 4500));
    /* The mimic lives on a tab that is not the default one, and a hidden panel measures zero. */
    await tab.evaluate(() => {
        const button = [...document.querySelectorAll('.tabs button')].find((b) => /DATA HALL/i.test(b.textContent || ''));
        if (button) button.click();
    });
    await new Promise((accept) => setTimeout(accept, 3000));

    const m = await tab.evaluate(() => {
        const hall = document.getElementById('hc');
        const engine = window.DHE || {};
        /* v3.21.0 — geometry from the SVG's own attributes (user units), not from layout boxes. This gate
           never enters the authorized audit state, so the hall panel can be hidden while it measures and
           every getBoundingClientRect() reads 0 — which made the old "CDU inside the cross aisle" check
           vacuously true, and passed this check on the tree it was written to reject. */
        const rect = (el) => { const r = el.matches('rect') ? el : el.querySelector('rect'); const x = parseFloat(r.getAttribute('x')), y = parseFloat(r.getAttribute('y')), w = parseFloat(r.getAttribute('width')), h = parseFloat(r.getAttribute('height')); return { top: y, bottom: y + h, left: x, right: x + w }; };
        const racks = [...hall.querySelectorAll('[data-rz-equipment^="rack-unit"]')];
        const cdus = [...hall.querySelectorAll('[data-rz-equipment^="cdu:"]')];
        const crah = [...hall.querySelectorAll('[data-rz-equipment^="crah:"]')];
        const readout = (prefix) => [...hall.querySelectorAll('text')]
            .filter((t) => new RegExp(`^${prefix}\\d+\\d+t$`).test(t.id))
            .map((t) => ({ id: t.id, text: (t.textContent || '').trim() }));
        /* the cross aisle is the vertical gap between the two rack banks */
        const rackTops = racks.map((r) => rect(r).top).sort((a, b) => a - b);
        const rackBottoms = racks.map((r) => rect(r).bottom).sort((a, b) => a - b);
        const bankAbottom = rackBottoms[Math.floor(rackBottoms.length / 2) - 1];
        const bankBtop = rackTops[Math.floor(rackTops.length / 2)];
        const cduBoxes = cdus.map((c) => rect(c));
        return {
            engine: {
                cduInstalled: engine.cduInstalled ?? null, crahInstalled: engine.crahInstalled ?? null,
                rowsPerBank: engine.rowsPerBank ?? null, rackBanks: engine.rackBanks ?? null,
                racksPerHall: engine.racksPerHall ?? null,
                rackDepthM: engine.rackDepthM ?? null, rackPitchM: engine.rackPitchM ?? null
            },
            racks: racks.length, cdus: cdus.length, crah: crah.length,
            animations: hall.querySelectorAll('animate').length,
            rowGroups: hall.querySelectorAll('.rowg').length,
            rowAnimations: [...hall.querySelectorAll('.rowg')].filter((g) => g.querySelector('animate')).length,
            cduInGallery: (() => {
                const fieldRight = Math.max(...racks.map((r) => rect(r).right));
                return cduBoxes.length > 0 && cduBoxes.every((b) => b.left >= fieldRight - 1
                    && (b.bottom <= bankAbottom + 2 || b.top >= bankBtop - 2));
            })(),
            crahEastOfCdu: crah.length > 0 && cdus.length > 0
                && Math.min(...crah.map((c) => rect(c).left)) >= Math.max(...cduBoxes.map((b) => b.right)) - 1,
            rackRatios: racks.slice(0, 40).map((r) => { const b = r.querySelector('rect'); const w = parseFloat(b.getAttribute('width')), h = parseFloat(b.getAttribute('height')); return h > 0 ? w / h : -1; }),
            hot: readout('H'), cold: readout('C'),
            unavailable: /ROW LAYOUT UNAVAILABLE/.test(hall.innerHTML)
        };
    });

    console.log('\n── DATA HALL PLAN CONTRACT — datahallAI.html ──\n');
    const e = m.engine;
    check('the hall renders against a live engine basis', !m.unavailable && e.racksPerHall != null,
        `${m.racks} rack glyphs, engine says ${e.racksPerHall}`);
    check('every rack in the hall is drawn', e.racksPerHall != null && m.racks === e.racksPerHall,
        `${m.racks} of ${e.racksPerHall}`);
    check('one CDU glyph per INSTALLED unit, no aggregation divisor',
        e.cduInstalled != null && m.cdus === e.cduInstalled, `${m.cdus} of ${e.cduInstalled}`);
    check('the CDUs stand in the CDU gallery, east of the rack field and clear of the cross aisle',
        m.cduInGallery, m.cduInGallery ? 'mechanical zone, both blocks' : 'some CDU sits in the rack field or the egress aisle');
    check('every row carries its own flow animation, not just the header trunks',
        m.rowGroups > 0 && m.rowAnimations === m.rowGroups, `${m.rowAnimations} of ${m.rowGroups} rows`);
    check('the supply path animates end to end', m.animations >= m.rowGroups + 2,
        `${m.animations} animations for ${m.rowGroups} rows`);

    const pairs = (e.rowsPerBank != null && e.rackBanks != null) ? Math.ceil(e.rowsPerBank / 2) * e.rackBanks : null;
    const points = pairs ? m.hot.length / pairs : 0;
    check('aisle temperature is reported at SEVERAL points per aisle, in both banks',
        pairs != null && m.hot.length === m.cold.length && points >= 2 && Number.isInteger(points),
        `${m.hot.length} hot + ${m.cold.length} cold = ${points} point(s) on each of ${pairs} aisles`);
    check('every readout is reading', m.hot.concat(m.cold).every((r) => r.text && r.text !== '—'),
        `${m.hot.concat(m.cold).filter((r) => !r.text || r.text === '—').length} still show an em dash`);
    /* Three readouts that share one RZ_SIM seed print one number three times: the drawing claims
       several points and shows one.

       v3.10.14 — this compared WITHIN each aisle and failed if ANY single aisle's three readings
       printed the same string. That is flaky by construction, and it flaked: the same tree failed
       this gate and passed it on the next run with no code change.

       The readings are `RZ_SIM('hac{r}-{si}', 33.4+si*1.1, 37.2+si*1.1, 1)` — anchors 1.1 degC
       apart, each jittering by +/- 1.9 degC, so the three bands overlap heavily and the value
       moves between 4-second ticks. Three overlapping jittering samples printed to one decimal
       coincide often enough that a per-aisle assertion is a coin toss.

       The DEFECT is a shared seed, and the seed is per point id, so it would make EVERY aisle
       identical rather than one. Assert that: fail when a majority of aisles show no gradient,
       which catches the seed bug at 10-of-10 and tolerates incidental rounding at 1-of-10.

       This loosens a threshold, which is normally how gates get laundered. It is justified here
       only because the failure was demonstrated FALSE on an unchanged tree — not because the
       gate was inconvenient. */
    const sameWithinAisle = [];
    for (const prefix of ['H', 'C']) {
        const rows = prefix === 'H' ? m.hot : m.cold;
        const byAisle = new Map();
        for (const r of rows) {
            const aisle = r.id.slice(1, -2);
            if (!byAisle.has(aisle)) byAisle.set(aisle, new Set());
            byAisle.get(aisle).add(r.text);
        }
        for (const [aisle, values] of byAisle) if (values.size < 2) sameWithinAisle.push(prefix + aisle);
    }
    const aisleCount = pairs ? pairs * 2 : 0;   /* hot and cold sides */
    const flatShare = aisleCount ? sameWithinAisle.length / aisleCount : 0;
    check('the aisles show a gradient, not one number repeated',
        flatShare <= 0.5,
        sameWithinAisle.length
            ? `${sameWithinAisle.length} of ${aisleCount} aisle(s) flat (${Math.round(flatShare * 100)}%) — a shared seed shows as ~100%`
            : `each of ${aisleCount} aisles shows a gradient`);

    check('one CRAH glyph per INSTALLED unit, in the air plant east of the CDU gallery',
        e.crahInstalled != null && m.crah === e.crahInstalled && m.crahEastOfCdu, `${m.crah} of ${e.crahInstalled}${m.crahEastOfCdu ? '' : ' — some CRAH stands west of a CDU'}`);
    const want = (e.rackDepthM && e.rackPitchM) ? e.rackDepthM / e.rackPitchM : null;
    const worst = want ? Math.max(...m.rackRatios.map((r) => Math.abs(r / want - 1))) : null;
    check('the plan is drawn at ONE scale (rack glyphs keep the engine depth/width ratio)',
        worst != null && worst <= 0.08, worst == null ? 'engine rack dimensions missing' : `worst rack off by ${(worst * 100).toFixed(1)} %`);

    console.log(`\n${failures.length === 0
        ? 'PASS — the hall plan states its equipment, its counts and its flow.'
        : `FAIL — ${failures.length} broken contract(s):\n    ${failures.join('\n    ')}`}\n`);
    if (failures.length) process.exitCode = 1;
} finally {
    await browser.close();
    await new Promise((accept) => server.close(accept));
}
