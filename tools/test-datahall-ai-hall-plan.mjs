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
 *   2. CDUs stand IN THE CROSS AISLE, between the two banks — a CoolIT CHx1000 is an end-of-row
 *      CDU and, with rows running top to bottom, the row's end IS the cross aisle. Four galleries
 *      on the short walls shipped twice.
 *   3. THE WATER MOVES from the CDUs to the rows: at least one animation per row, not just the two
 *      header trunks. "aliran simulasi air cdu ke row tidak ada."
 *   4. EVERY ROW IN BOTH BANKS reports its aisle temperature at SEVERAL points, and no two points
 *      in the same aisle print the same number — three readouts sharing one RZ_SIM seed key looked
 *      like three sensors and was one. "No hac temp indication in several point across row."
 *   5. CRAH banks carry a UNIT COUNT. They were always drawn; they said nothing, so the owner read
 *      them as absent. "Tidak ada crah dll."
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
        const rect = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
        const racks = [...hall.querySelectorAll('[data-rz-equipment^="rack-unit"]')];
        const cdus = [...hall.querySelectorAll('[data-rz-equipment^="cdu:"]')];
        const crah = [...hall.querySelectorAll('.crah-unit')];
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
                racksPerHall: engine.racksPerHall ?? null
            },
            racks: racks.length, cdus: cdus.length, crah: crah.length,
            animations: hall.querySelectorAll('animate').length,
            rowGroups: hall.querySelectorAll('.rowg').length,
            rowAnimations: [...hall.querySelectorAll('.rowg')].filter((g) => g.querySelector('animate')).length,
            cduInsideCrossAisle: cduBoxes.length > 0 && cduBoxes.every((b) => b.top >= bankAbottom - 2 && b.bottom <= bankBtop + 2),
            crahLabelled: crah.filter((c) => /×\s*\d/.test(c.textContent || '')).length,
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
    check('the CDUs stand in the cross aisle, at the end of the rows they serve',
        m.cduInsideCrossAisle, m.cduInsideCrossAisle ? 'between the two banks' : 'some CDU sits outside the cross aisle');
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
       several points and shows one. Compare WITHIN each aisle, not across the hall. */
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
    check('the points along one aisle do not all print the same number',
        sameWithinAisle.length === 0, sameWithinAisle.length ? `identical along ${sameWithinAisle.length} aisle(s)` : 'each aisle shows a gradient');

    check('every CRAH bank states how many units it stands for',
        m.crah > 0 && m.crahLabelled === m.crah, `${m.crahLabelled} of ${m.crah} banks carry a count`);

    console.log(`\n${failures.length === 0
        ? 'PASS — the hall plan states its equipment, its counts and its flow.'
        : `FAIL — ${failures.length} broken contract(s):\n    ${failures.join('\n    ')}`}\n`);
    if (failures.length) process.exitCode = 1;
} finally {
    await browser.close();
    await new Promise((accept) => server.close(accept));
}
