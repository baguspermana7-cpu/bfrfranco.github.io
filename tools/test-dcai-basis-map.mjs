#!/usr/bin/env node
/**
 * test-dcai-basis-map.mjs — DH_BASIS (DHE field -> registry id) must be true, complete and used.
 *
 *   R1 every id in window.DH_BASIS exists in data/dcai-parameters.json
 *   R2 every field the page reads through bo('<field>') has a DH_BASIS entry
 *   R3 for every mapped NUMERIC field, window.DHE[field] equals the registry value at an
 *      accepted scale (x1, /1000, x1000, x100, /60, x60) — the drawn number and the record
 *      behind its mark are the same quantity (the D3 parity rule, applied to the adapter)
 *   R4 every field that DH_BASIS names exists on the adapter (a map entry to a dead field is a
 *      hook that can never draw)
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const src = await readFile(join(ROOT, PAGE), 'utf8');
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'));
const byId = new Map(registry.parameters.map((p) => [p.id, p]));

const mapMatch = src.match(/window\.DH_BASIS=(\{[\s\S]*?\});/);
assert.ok(mapMatch, 'window.DH_BASIS={...}; must be present as a JSON literal');
const map = JSON.parse(mapMatch[1]);
const fields = Object.keys(map);
assert.ok(fields.length >= 60, `DH_BASIS has ${fields.length} entries; expected the diagram fields (>= 60)`);

/* R1 */
const unknown = fields.filter((f) => !byId.has(map[f]));
assert.deepEqual(unknown, [], `DH_BASIS ids not in the registry: ${unknown.map((f) => `${f}->${map[f]}`).join(', ')}`);

/* R2 */
const read = new Set([...src.matchAll(/\bbo\('([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
const unmapped = [...read].filter((f) => !map[f]);
assert.deepEqual(unmapped, [], `fields read through bo() with no DH_BASIS entry: ${unmapped.join(', ')}`);

/* R3 + R4 need the live adapter */
const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' });
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const full = resolve(ROOT, decodeURIComponent(pathname.slice(1)));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
let adapter;
try {
    const tab = await browser.newPage();
    await primeCockpitAuditDocument(tab, 'dark');
    await tab.goto(`http://127.0.0.1:${server.address().port}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((accept) => setTimeout(accept, 2000));
    await enterAuthorizedAuditState(tab, 'dc-ai');
    adapter = await tab.evaluate((fs) => { const D = window.DHE; if (!D) return null; const o = { __all: {} }; for (const k of Object.keys(D)) o.__all[k] = true; for (const f of fs) o[f] = { has: f in D, value: D[f] }; return o; }, fields);
} finally { await browser.close(); server.close(); }
assert.ok(adapter, 'window.DHE adapter must be live on the page');

function renderings(value) {
    const out = new Set();
    for (const s of [value, value / 1000, value * 1000, value * 100, value / 60, value * 60]) {
        for (const d of [0, 1, 2, 3]) { const f = s.toFixed(d); out.add(f); out.add(String(Number(f))); }
    }
    return out;
}
const dead = fields.filter((f) => !adapter[f].has);
assert.deepEqual(dead, [], `DH_BASIS names adapter fields that do not exist: ${dead.join(', ')}`);
const parity = [];
let numeric = 0;
for (const f of fields) {
    const v = adapter[f].value;
    if (typeof v !== 'number' || !isFinite(v)) continue;
    numeric++;
    const reg = byId.get(map[f]).value;
    const ok = [0, 1, 2, 3].some((d) => renderings(reg).has(v.toFixed(d))) || Math.abs(v - reg) <= Math.abs(reg) * 1e-6;
    if (!ok) parity.push(`${f}=${v} vs ${map[f]}=${reg}`);
}
assert.deepEqual(parity, [], `adapter value differs from its registry record:\n  ${parity.join('\n  ')}`);
/* v3.7.0 — the SECOND adapter has to resolve too. DHAX() is the drawing-side view every SLD and
 * the electrical overview read through (`var X=DHAX()`), and it is hand-maintained: when the
 * four-level chain landed in v3.2.0 the seven MV/HV fields went into DHE and nobody added them
 * here, so `X.hvIntakeKv` was undefined and the per-hall single-line printed "PLN — kV" and
 * "— kV Dual Feed from the 150/20 kV Main Transformers" for five releases. Failing closed to an
 * em dash is correct behaviour; an em dash no gate ever looked at is how a whole voltage level
 * goes missing in plain sight. This assertion is static: every X.<field> the page reads must be
 * assigned by DHAX. */
{
    const lines = src.split('\n');
    const start = lines.findIndex((l) => l.startsWith('function DHAX()'));
    assert.ok(start >= 0, 'DHAX() must exist — the drawings read every number through it');
    const end = lines.findIndex((l, i) => i > start && /^\/\* number -> fixed-decimal/.test(l));
    /* strip comments before scanning: this very file's fix note names `d.dryCoolers` in prose,
       and a gate that reads its own explanation as code fails forever after it is fixed. */
    const decomment = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    const body = decomment(lines.slice(start, end).join('\n'));
    const defined = new Set([...body.matchAll(/\bo\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]));
    const reads = new Set([...decomment(src).matchAll(/\bX\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
    const undefinedReads = [...reads].filter((f) => !defined.has(f)).sort();
    assert.deepEqual(undefinedReads, [], `the drawings read DHAX fields the adapter never assigns (they render as em dashes): ${undefinedReads.join(', ')}`);

    /* v3.8.0 — and the mirror rule. DHAX assigns from DHE by name, and two of those names were
     * published by nothing: `d.dryCoolers` (the adapter calls it dryCoolersInstalled) and
     * `d.rowsPerHall` (rackRows). o.rows survived on an identity further down; o.dryCoolers was
     * simply null, waiting for the first drawing that printed a count to print an em dash. A
     * silent null in an adapter is the same defect as a silent em dash in a drawing. */
    const liveFields = new Set(Object.keys(adapter.__all || {}));
    if (liveFields.size) {
        const deadAssignments = [...new Set([...body.matchAll(/\bd\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))]
            .filter((f) => !liveFields.has(f)).sort();
        assert.deepEqual(deadAssignments, [], `DHAX reads adapter fields window.DHE does not publish (they resolve to null): ${deadAssignments.join(', ')}`);
    }
}

console.log(`PASS DCAI basis map — ${fields.length} fields mapped, ${numeric} numeric at parity, ${read.size} bo() reads all mapped`);
