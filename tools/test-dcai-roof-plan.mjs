#!/usr/bin/env node
/**
 * test-dcai-roof-plan.mjs — the roof carries the plant the engine sizes, not the retired one.
 *
 * The roof plan was the last drawing still on the GB200-era plant. It drew EIGHT dry coolers
 * against an engine that sizes 631, said its risers "correspond to the 8 chillers on Ground
 * Floor" against an engine that sizes 143, and named the array "BAC TrilliumSeries Adiabatic"
 * in the same tooltip that claimed "WUE 0.00, zero water evap".
 *
 * That last pair is not a stale number, it is a contradiction: an adiabatic cooler spends water
 * by design, and the whole reason this facility runs a 40 °C cold-plate inlet is to reject heat
 * DRY so that the published WUE of 0.00 is true rather than flattering. A drawing may aggregate
 * (one glyph standing for a bank) but it may not describe a different machine.
 *
 * WHAT THIS ASSERTS on the roof view of #floorSvg
 *   R1 the drawn dry-cooler count is declared as an aggregation whose arithmetic closes against
 *      the engine: banks x units per bank = equipment.dry_coolers_installed, with the duty count
 *      stated beside it
 *   R2 wherever the roof names chillers it states the engine count, never a drawn-glyph count
 *   R3 no water-spending rejection technology is claimed while the engine publishes WUE 0 —
 *      adiabatic / evaporative / spray / wet-bulb may appear only in a sentence that says the
 *      option was NOT adopted
 *   R4 the roof's engine numbers are HOOKED, not swept under one wholesale declaration
 *   R5 the ground floor's chiller hall tells the same story: eight glyphs are a bank aggregation
 *      whose caption carries the engine's installed / duty / worst-bin counts, not an "N+1 of 8"
 *
 * Usage: node tools/test-dcai-roof-plan.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const set = TAB_SETS[PAGE];
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'));
const value = (id) => {
    const found = registry.parameters.find((p) => p.id === id);
    assert.ok(found, `registry has no ${id}`);
    return found.value;
};
const DC_INSTALLED = value('equipment.dry_coolers_installed');
const DC_RUNNING = value('equipment.dry_coolers_running_design');
const CHILLERS = value('equipment.chillers_installed');
const CH_DESIGN = value('equipment.chillers_running_design');
const CH_WORST = value('equipment.chillers_running_worst_bin');
const WUE = value('wue.l_per_kwh');

const WATER_WORDS = /adiabatic|evaporative|evap\b|spray|wet[- ]?bulb|cooling tower/i;
const NOT_ADOPTED = /not adopted|rejected|retired|would (?:cost|spend|consume)|instead of|no (?:adiabatic|evaporative)/i;

const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' });
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const full = resolve(ROOT, decodeURIComponent(pathname.slice(1)));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const failures = [];
let view = null;
let gfView = null;
try {
    const tab = await browser.newPage();
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.setViewport({ width: 1680, height: 1000 });
    await tab.goto(`http://127.0.0.1:${server.address().port}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((accept) => setTimeout(accept, 2600));
    await enterAuthorizedAuditState(tab, set.cockpit);
    const roof = set.diagrams.find((d) => d.selector === '#floorSvg' && /roof/i.test(d.label || ''));
    assert.ok(roof, 'TAB_SETS must carry the roof view of the floor plan');
    await activateTab(tab, set, roof);
    view = await tab.evaluate(() => {
        const svg = document.querySelector('#floorSvg');
        const texts = [...svg.querySelectorAll('text')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
        const tips = [...svg.querySelectorAll('[data-tip]')].map((n) => n.getAttribute('data-tip'));
        const titles = [...svg.querySelectorAll('title')].map((n) => n.textContent);
        const banks = svg.querySelectorAll('[data-rz-equipment^="roof-dry-cooler-bank:"]').length;
        const hooks = svg.querySelectorAll('[data-basis-param]').length;
        return { texts, tips, titles, banks, hooks, all: texts.concat(tips, titles).join(' · ') };
    });
    const ground = set.diagrams.find((d) => d.selector === '#floorSvg' && /ground/i.test(d.label || ''));
    assert.ok(ground, 'TAB_SETS must carry the ground floor of the floor plan');
    await activateTab(tab, set, ground);
    gfView = await tab.evaluate(() => {
        const svg = document.querySelector('#floorSvg');
        return {
            texts: [...svg.querySelectorAll('text')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
            tips: [...svg.querySelectorAll('[data-tip]')].map((n) => n.getAttribute('data-tip')),
            titles: [...svg.querySelectorAll('title')].map((n) => n.textContent),
        };
    });
} finally { await browser.close(); server.close(); }

const fail = (message) => failures.push(message);

/* R1 */
if (!view.banks) fail('R1 the roof draws no dry-cooler bank blocks');
const perBank = view.banks ? Math.ceil(DC_INSTALLED / view.banks) : 0;
if (!view.all.includes(String(DC_INSTALLED))) fail(`R1 the roof does not state the engine's installed dry-cooler count (${DC_INSTALLED})`);
if (!view.all.includes(String(DC_RUNNING))) fail(`R1 the roof does not state the dry-cooler duty count at design (${DC_RUNNING})`);
if (view.banks && !view.all.includes(String(perBank))) {
    fail(`R1 the aggregation divisor is invisible: ${view.banks} banks drawn for ${DC_INSTALLED} units is ${perBank} per bank, and no text says so`);
}

/* R2 */
/* only a sentence that COUNTS chillers has to match the engine; "Risers from Chiller Plant (GF)"
   names the plant without claiming a size, and a gate that cannot tell those apart teaches the
   author to delete the sentence rather than fix the number. */
const chillerLines = view.texts.concat(view.tips).filter((t) => /chiller/i.test(t) && /\d/.test(t));
if (!chillerLines.length) fail('R2 the roof never states how many chillers its risers serve');
for (const line of chillerLines) {
    if (!line.includes(String(CHILLERS))) {
        fail(`R2 a chiller sentence states a count that is not the engine's ${CHILLERS}: "${line.slice(0, 120)}"`);
    }
}

/* R3 */
if (WUE === 0) {
    for (const line of view.texts.concat(view.tips, view.titles)) {
        if (WATER_WORDS.test(line) && !NOT_ADOPTED.test(line)) {
            fail(`R3 the roof claims a water-spending rejection technology while the engine publishes WUE ${WUE}: "${line.slice(0, 140)}"`);
        }
    }
}

/* R4 */
if (view.hooks === 0) fail('R4 the roof carries no traceability hook — every engine number on it is swept under one wholesale declaration');

/* R5 — the ground floor, measured in the same run */
{
    const gf = gfView;
    const chillerText = gf.texts.concat(gf.tips, gf.titles).join(' \u00b7 ');
    for (const n of [CHILLERS, CH_DESIGN, CH_WORST]) {
        if (!chillerText.includes(String(n))) fail(`R5 the chiller hall does not state ${n} — the engine's installed / duty / worst-bin counts must all be on the drawing`);
    }
    const nPlusOne = gf.texts.concat(gf.tips, gf.titles).filter((t) => /N\+1 standby|CH-8 STB/i.test(t));
    if (nPlusOne.length) fail(`R5 the chiller hall still tells an "N+1 of 8" story: "${nPlusOne[0].slice(0, 120)}"`);
}

console.log(`DCAI ROOF PLAN — ${view.banks} bank glyphs for ${DC_INSTALLED} installed dry coolers (${DC_RUNNING} duty), ${CHILLERS} chillers, WUE ${WUE}, ${view.hooks} hooks`);
if (failures.length) { console.error('\nFAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('PASS — the roof draws the plant the engine sizes, and spends no water it does not have');
