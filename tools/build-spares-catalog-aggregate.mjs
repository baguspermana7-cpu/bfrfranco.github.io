#!/usr/bin/env node
/* build-spares-catalog-aggregate.mjs — generate the COMPACT per-commodity
 * catalog aggregate consumed by rz-engine.js (DATA.sparesCatalog) + DCMOC.
 *
 * Reads the browse-layer catalog js/spares-parts-catalog.js (445 curated parts,
 * itself generated from the gitignored sqlite by tools/build-spares-db.py) and
 * emits p50 (median) real values per commodity: mtbf(yr), mttr(hr), leadWk(ltTyp),
 * costUsd(cTyp), alts, crit, + lifecycle mix + median eol(months) + part count n.
 *
 * Output modes:
 *   (default)         → prints the DATA.sparesCatalog JS literal to stdout
 *   --json <path>     → also writes a JSON twin for DCMOC to import
 *
 * The 13 spares-page commodities map to one-or-more catalog `sub` values. A
 * commodity aggregate is the median over ALL parts whose sub is in its list.
 * Keep this mapping in lock-step with the page's commToSub + COMMODITY_DEFAULTS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG_JS = path.join(ROOT, 'js', 'spares-parts-catalog.js');

/* Commodity key → catalog subsystem(s). Superset of the page commToSub so an
 * aggregate reflects the real fleet mix, not a single sub. */
const COMMODITY_SUBS = {
    chiller:        ['chiller', 'refrigerant-circuit'],
    crac:           ['CRAC-CRAH', 'AHU', 'dry-cooler', 'adiabatic-cooling'],
    ups:            ['UPS', 'battery-system'],
    switchgear:     ['switchgear', 'busway', 'dc-busway', 'capacitor-bank', 'ATS', 'STS'],
    transformer:    ['transformer'],
    generator:      ['diesel-generator', 'exhaust-system'],
    pump:           ['pump', 'fire-pump'],
    valve:          ['valve'],
    hx:             ['heat-exchanger', 'CDU-coolant-distribution', 'cooling-manifold'],
    'cooling-tower':['cooling-tower'],
    bms:            ['DDC-PLC-controller', 'BACnet-gateway', 'SCADA-RTU', 'sensor', 'actuator', 'DCIM-sensor', 'power-meter'],
    fuel:           ['fuel-system'],
    fire:           ['clean-agent', 'gas-suppression', 'VESDA', 'detection', 'fire-panel', 'sprinkler'],
};

function median(arr) {
    const a = arr.filter((x) => x != null && isFinite(x)).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function round(x, d) { if (x == null) return null; const p = Math.pow(10, d); return Math.round(x * p) / p; }

function loadParts() {
    const src = fs.readFileSync(CATALOG_JS, 'utf8');
    const win = {};
    // eslint-disable-next-line no-new-func
    new Function('window', src)(win);
    return win.SPARES_CATALOG.parts;
}

function lifecycleMix(parts) {
    const mix = { active: 0, nrnd: 0, ltb: 0, obsolete: 0 };
    parts.forEach((p) => { if (mix[p.life] != null) mix[p.life] += 1; });
    return mix;
}

function build() {
    const parts = loadParts();
    const out = {};
    for (const [commodity, subs] of Object.entries(COMMODITY_SUBS)) {
        const set = new Set(subs);
        const rows = parts.filter((p) => set.has(p.sub));
        if (!rows.length) continue;
        out[commodity] = {
            n: rows.length,
            mtbf: round(median(rows.map((p) => p.mtbf)), 2),   // years
            mttr: round(median(rows.map((p) => p.mttr)), 2),   // hours
            leadWk: round(median(rows.map((p) => p.ltTyp)), 0),// weeks (typical)
            costUsd: Math.round(median(rows.map((p) => p.cTyp))), // USD (typical)
            alts: Math.round(median(rows.map((p) => p.alts))),  // qualified alternates
            crit: Math.round(median(rows.map((p) => p.crit))),  // criticality 1-10
            eol: round(median(rows.map((p) => p.eol)), 0),      // months to EOL
            life: lifecycleMix(rows),                            // {active,nrnd,ltb,obsolete}
        };
    }
    return out;
}

const agg = build();
const totalParts = Object.values(agg).reduce((s, a) => s + a.n, 0);
const meta = { generated: 'tools/build-spares-catalog-aggregate.mjs', source: 'js/spares-parts-catalog.js', commodities: Object.keys(agg).length, partsAggregated: totalParts };

const jsonArg = process.argv.indexOf('--json');
if (jsonArg > -1 && process.argv[jsonArg + 1]) {
    const p = path.resolve(ROOT, process.argv[jsonArg + 1]);
    fs.writeFileSync(p, JSON.stringify({ meta, byCommodity: agg }, null, 2) + '\n');
    process.stderr.write(`wrote ${p}\n`);
}

/* Emit the DATA.sparesCatalog JS literal (single-line values, deterministic key order). */
const body = Object.entries(agg).map(([k, a]) => {
    const life = `{ active: ${a.life.active}, nrnd: ${a.life.nrnd}, ltb: ${a.life.ltb}, obsolete: ${a.life.obsolete} }`;
    return `                ${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : `'${k}'`}: { n: ${a.n}, mtbf: ${a.mtbf}, mttr: ${a.mttr}, leadWk: ${a.leadWk}, costUsd: ${a.costUsd}, alts: ${a.alts}, crit: ${a.crit}, eol: ${a.eol}, life: ${life} }`;
}).join(',\n');
process.stdout.write(`meta: { generated: '${meta.generated}', source: '${meta.source}', commodities: ${meta.commodities}, partsAggregated: ${meta.partsAggregated} },\n            byCommodity: {\n${body}\n            }\n`);
