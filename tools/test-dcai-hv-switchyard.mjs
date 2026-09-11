#!/usr/bin/env node
/**
 * test-dcai-hv-switchyard.mjs — the transformation the drawing claims must be ON the drawing.
 *
 * The owner's complaint was that a 150 kV source stepped straight to 400 V through one small
 * transformer. v3.2.0 answered the arithmetic — the engine now publishes 150 kV / 20 kV / 400 V
 * and every transformer ratio is checked against adjacent levels (tools/test-dcai-voltage-chain.mjs).
 * It did NOT answer the drawing. Until v3.7.0 the per-hall SLD still began with a "PLN 150 kV"
 * box wired directly into a 20 kV vacuum breaker, and the 150/20 kV machine that makes that legal
 * existed only inside the section header's sentence: "20 kV Dual Feed from the 150/20 kV Main
 * Transformers". A reader could not click it, a scenario could not fault it, and the single line
 * showed a 150 kV conductor entering 20 kV gear.
 *
 * WHAT THIS ASSERTS, per hall single-line
 *   S1 a main-transformer block is DRAWN (data-rz-equipment="sld-main-tx:…"), one per feed
 *   S2 its label carries the engine ratio, rating and impedance — 150/20 kV, MVA, Z%
 *   S3 the block sits BELOW the 150 kV intake and ABOVE the 20 kV bus: the step is drawn where
 *      the voltage actually changes, not named somewhere else on the sheet
 *   S4 every conductor drawn above the transformer binds to an HV topology edge, and no drawn
 *      conductor binds a utility source straight to a 20 kV board
 *   S5 the switchyard states its own cost — line bays + transformer bays — from the engine
 *
 * Usage: node tools/test-dcai-hv-switchyard.mjs
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
const HV_KV = value('distribution.hv_intake_kv');
const MV_KV = value('distribution.mv_kv');
const TX_MVA = value('distribution.main_tx_mva');
const TX_Z = value('distribution.main_tx_impedance_pct');
const LINE_BAYS = value('distribution.hv_line_bays');
const TX_BAYS = value('distribution.hv_transformer_bays');

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
const report = [];
try {
    const tab = await browser.newPage();
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.setViewport({ width: 1680, height: 1000 });
    await tab.goto(`http://127.0.0.1:${server.address().port}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((accept) => setTimeout(accept, 2600));
    await enterAuthorizedAuditState(tab, set.cockpit);

    for (const entry of set.diagrams.filter((d) => /^#elecDH\d/.test(d.selector))) {
        await activateTab(tab, set, entry);
        const sheet = await tab.evaluate((sel) => {
            const svg = document.querySelector(sel);
            const yOf = (el) => { const b = el.getBBox ? el.getBBox() : null; return b ? b.y : null; };
            const texts = [...svg.querySelectorAll('text')].map((t) => ({ text: t.textContent, y: yOf(t) }));
            const tx = [...svg.querySelectorAll('[data-rz-equipment^="sld-main-tx:"]')].map((g) => ({
                id: g.getAttribute('data-rz-equipment'), y: yOf(g),
                text: g.textContent.replace(/\s+/g, ' ').trim(),
            }));
            const lines = [...svg.querySelectorAll('[data-rz-line]')].map((l) => ({
                id: l.getAttribute('data-id') || '', edge: l.getAttribute('data-topology-edge') || l.getAttribute('data-topology-prefix') || '',
                y: Math.max(Number(l.getAttribute('y1')) || 0, Number(l.getAttribute('y2')) || 0),
            }));
            return { texts, tx, lines };
        }, entry.selector);
        const row = { sheet: entry.selector.slice(1), tx: sheet.tx.length, status: 'OK' };
        const fail = (message) => { failures.push(`${row.sheet}: ${message}`); row.status = 'FAIL'; };

        /* S1 */
        if (sheet.tx.length !== 2) fail(`S1 expects one main-transformer block per feed, found ${sheet.tx.length}`);

        /* S2 */
        for (const block of sheet.tx) {
            const wants = [`${HV_KV}/${MV_KV} kV`, `${TX_MVA} MVA`, `Z ${TX_Z}%`];
            const missing = wants.filter((w) => !block.text.includes(w));
            if (missing.length) fail(`S2 ${block.id} does not state ${missing.join(' | ')} — text was "${block.text.slice(0, 160)}"`);
        }

        /* S3 — the step is drawn where the voltage changes */
        const hvLabel = sheet.texts.find((t) => new RegExp(`\\b${HV_KV}\\s*kV`, 'i').test(t.text) && t.y != null);
        const mvBus = sheet.texts.find((t) => /BUS A\b/.test(t.text) && new RegExp(`${MV_KV}\\s*kV`, 'i').test(t.text) && t.y != null);
        if (!hvLabel) fail(`S3 no ${HV_KV} kV label found`);
        if (!mvBus) fail(`S3 no ${MV_KV} kV bus label found`);
        if (hvLabel && mvBus && sheet.tx.length) {
            const txY = Math.min(...sheet.tx.map((b) => b.y));
            if (!(hvLabel.y < txY && txY < mvBus.y)) {
                fail(`S3 the main transformer is not drawn between the levels (HV y=${hvLabel.y?.toFixed(0)}, TX y=${txY.toFixed(0)}, ${MV_KV} kV bus y=${mvBus.y?.toFixed(0)})`);
            }
        }

        /* S4 */
        const direct = sheet.lines.filter((l) => /^EDGE-UTILITY-[AB]-MV-BUS/.test(l.edge));
        if (direct.length) fail(`S4 ${direct.length} conductor(s) still bind a utility source straight to a ${MV_KV} kV board`);
        const hvEdges = sheet.lines.filter((l) => /HV-INTAKE|HV-BUS|MAIN-TX/.test(l.edge));
        if (hvEdges.length < 6) fail(`S4 expects the HV chain drawn per feed (utility->intake->bus->transformer->board); found ${hvEdges.length} bound HV conductors`);

        /* S5 */
        const bays = sheet.texts.map((t) => t.text).join(' ');
        if (!(bays.includes(`${LINE_BAYS} line`) && bays.includes(`${TX_BAYS} transformer`))) {
            fail(`S5 the switchyard does not state its bay count (${LINE_BAYS} line + ${TX_BAYS} transformer bays)`);
        }
        /* S6 — the block is a real inspection target, not decoration */
        if (sheet.tx.length) {
            const handle = await tab.$(`${entry.selector} [data-rz-equipment^="sld-main-tx:"]`);
            await handle.evaluate((el) => { el.scrollIntoView({ block: 'center', inline: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, shiftKey: true })); });
            await new Promise((accept) => setTimeout(accept, 400));
            const inspector = await tab.evaluate(() => {
                const aside = document.querySelector('aside.rz-inspector');
                return {
                    open: !!aside && aside.classList.contains('open'),
                    heading: aside ? aside.textContent.replace(/\s+/g, ' ').slice(0, 200) : '',
                };
            });
            /* the panel opens on Live; the levels are in its TITLE, which is where an operator
               reads what machine they are looking at */
            if (!inspector.open || !inspector.heading.includes(`${HV_KV}/${MV_KV} kV`)) {
                fail(`S6 the main-transformer block does not open an inspector naming both levels: ${JSON.stringify({ open: inspector.open, heading: inspector.heading.slice(0, 120) })}`);
            }
            await tab.keyboard.press('Escape');
            await new Promise((accept) => setTimeout(accept, 150));
        }
        report.push(row);
    }
} finally { await browser.close(); server.close(); }

console.log(`DCAI HV SWITCHYARD — ${PAGE} · ${HV_KV} kV intake, ${TX_MVA} MVA ${HV_KV}/${MV_KV} kV, Z ${TX_Z}%`);
for (const r of report) console.log(`  ${r.sheet.padEnd(12)} main-tx blocks ${r.tx}  ${r.status}`);
if (failures.length) { console.error('\nFAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('\nPASS — every hall single-line draws the 150/20 kV step where the voltage changes');
