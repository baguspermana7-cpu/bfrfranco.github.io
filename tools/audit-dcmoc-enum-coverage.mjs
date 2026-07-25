#!/usr/bin/env node
/**
 * audit-dcmoc-enum-coverage.mjs — STRICT gate against the silent enum→DATA-key
 * fallback bug class.
 *
 * A UI <select>/button emits a value that CapexEngine (and other engines) use as
 * a KEY into an engine DATA map: `(cd.xMult ?? xMultipliers)[uiValue] || 1.0`.
 * When the value is not a key, the lookup silently falls back to a neutral
 * default (1.0 multiplier / $1M shared substation) — mis-costing a real design
 * choice with NO warning. This bit us twice:
 *   • v1.115.61 — market `northern_virginia` → non-existent key → $185 band not $215.
 *   • v1.115.62 — `ultra` rack / `inert`+`sprinkler` fire / `beam` alarm /
 *     `pad_mounted_11kv`+`dedicated_66kv` substation all fell back.
 *
 * This gate mechanically verifies that EVERY option value of each cost-/value-
 * impacting UI enum resolves to a real key in the DATA map it indexes. Adding an
 * option to a select is auto-picked-up (option domains are extracted from the
 * component source); the gate FAILS if the DATA map lacks a matching key.
 *
 * Self-test: remove a key from DATA.capexDetail (e.g. rackMult.ultra) and this
 * gate fails with `rackType "ultra" → capexDetail.rackMult has no key`. Restore.
 *
 * Run: node tools/audit-dcmoc-enum-coverage.mjs [--strict]   (exit 1 on any gap)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/* ── load the engine DATA (same vm-sandbox pattern as test-value-bindings) ── */
function loadEngine() {
    const src = readFileSync(join(ROOT, 'rz-engine.js'), 'utf8');
    const win = {};
    win.window = win;
    win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    win.CustomEvent = function () {};
    win.dispatchEvent = function () {};
    win.addEventListener = function () {};
    win.removeEventListener = function () {};
    win.console = console;
    vm.runInContext(src, vm.createContext(win), { filename: 'rz-engine.js' });
    return win.RZEngine;
}
const E = loadEngine();
const DATA = E?.data ?? E?.DATA ?? {};   // engine exposes `.data` (lowercase)
const CD = DATA.capexDetail ?? {};
const MARKETS = DATA.markets ?? {};

/* ── resolveMarketKey (mirror of dcmoc/src/lib/market-key.ts) — the gate applies
 *    the same alias so aliased cityMarket values count as covered. ── */
const MARKET_ALIAS = { northern_virginia: 'n-virginia', virginia: 'n-virginia', malaysia: 'kuala-lumpur' };
const resolveMarketKey = (v) => MARKET_ALIAS[v] ?? String(v ?? 'none').replace(/_/g, '-');

/* ── extract <option value="X"> domains from a component, grouped by the
 *    handleChange('field', …) that immediately precedes each <select>. ── */
function extractOptionEnums(relPath) {
    const src = readFileSync(join(ROOT, relPath), 'utf8');
    const out = {};
    // find each `handleChange('field'` and capture the <option value="..."> that
    // follow it up to the closing </select>.
    const re = /handleChange\(\s*'([a-zA-Z]+)'[\s\S]{0,400}?<select[\s\S]*?<\/select>/g;
    let m;
    // simpler: iterate selects, then find the nearest preceding handleChange('field'
    const selectRe = /<select\b[\s\S]*?<\/select>/g;
    let sel;
    while ((sel = selectRe.exec(src)) !== null) {
        const block = sel[0];
        const fieldM = block.match(/handleChange\(\s*'([a-zA-Z]+)'/);
        if (!fieldM) continue;
        const field = fieldM[1];
        const vals = [...block.matchAll(/<option\s+value="([^"]*)"/g)].map((x) => x[1]).filter((v) => v && v !== 'none' && !/^\d/.test(v));
        if (vals.length) out[field] = vals;
    }
    void re; void m;
    return out;
}

const capexEnums = extractOptionEnums('dcmoc/src/components/modules/CapexDashboard.tsx');

/* ── REGISTRY: field → { options, keys, label } ─────────────────────────────
 * options come from the extracted <option> domains where available, else a
 * curated list (array-style selects). keys = the real DATA map key domain.  */
const keysOf = (o) => Object.keys(o ?? {});
const registry = [
    { field: 'rackType',       label: 'capexDetail.rackMult',           options: capexEnums.rackType,       keys: keysOf(CD.rackMult) },
    { field: 'coolingType',    label: 'capexDetail.coolingMult',        options: capexEnums.coolingType,    keys: keysOf(CD.coolingMult) },
    { field: 'buildingType',   label: 'capexDetail.buildingMult',       options: capexEnums.buildingType,   keys: keysOf(CD.buildingMult) },
    { field: 'fireType',       label: 'capexDetail.fireSuppressionMult', options: capexEnums.fireType,      keys: keysOf(CD.fireSuppressionMult) },
    { field: 'alarmType',      label: 'capexDetail.fireAlarmMult',      options: capexEnums.alarmType,      keys: keysOf(CD.fireAlarmMult) },
    { field: 'upsType',        label: 'capexDetail.upsMult',            options: capexEnums.upsType,        keys: keysOf(CD.upsMult) },
    { field: 'genType',        label: 'capexDetail.genMult',            options: capexEnums.genType,        keys: keysOf(CD.genMult) },
    { field: 'substationType', label: 'capexDetail.substationCosts',    options: capexEnums.substationType, keys: keysOf(CD.substationCosts) },
    // array-style selects (curated from source; not <option> markup):
    { field: 'redundancy',     label: 'capexDetail.redundancyMult',     options: ['n', 'n1', '2n', '2n1'],                       keys: keysOf(CD.redundancyMult), note: "CapexDashboard button array ['n','n1','2n','2n1']" },
    { field: 'seismicZone',    label: 'capexDetail.seismicMult',        options: ['zone0', 'zone1', 'zone2', 'zone3', 'zone4'],   keys: keysOf(CD.seismicMult), note: 'Requirements InfrastructureOptionsSection SEISMIC' },
    // market colo (alias-aware): every CapexDashboard cityMarket option must resolve to a DATA.markets key
    { field: 'cityMarket',     label: 'DATA.markets (via resolveMarketKey)', options: capexEnums.cityMarket, keys: keysOf(MARKETS), resolve: resolveMarketKey },
    // FOM quality/site/market factors (wired v1.115.64 — were dead controls):
    { field: 'powerDistribution', label: 'capexDetail.fomDistMult',        options: capexEnums.powerDistribution, keys: keysOf(CD.fomDistMult) },
    { field: 'pduType',        label: 'capexDetail.fomPduMult',            options: capexEnums.pduType,        keys: keysOf(CD.fomPduMult) },
    { field: 'cablingType',    label: 'capexDetail.fomCablingMult',        options: capexEnums.cablingType,    keys: keysOf(CD.fomCablingMult) },
    { field: 'floorType',      label: 'capexDetail.fomFloorMult',          options: capexEnums.floorType,      keys: keysOf(CD.fomFloorMult) },
    { field: 'securityLevel',  label: 'capexDetail.fomSecurityMult',       options: capexEnums.securityLevel,  keys: keysOf(CD.fomSecurityMult) },
    { field: 'fiberEntry',     label: 'capexDetail.fomFiberEntryMult',     options: capexEnums.fiberEntry,     keys: keysOf(CD.fomFiberEntryMult) },
    { field: 'siteCondition',  label: 'capexDetail.fomSiteMult',           options: capexEnums.siteCondition,  keys: keysOf(CD.fomSiteMult) },
    { field: 'marketCondition', label: 'capexDetail.fomMarketMult',        options: capexEnums.marketCondition, keys: keysOf(CD.fomMarketMult) },
    // Requirements InfrastructureOptionsSection selects (array-style; curated), wired v1.115.65:
    { field: 'transformerLead', label: 'capexDetail.fomTxLeadMult',        options: ['standard', 'expedited', 'long_lead'],       keys: keysOf(CD.fomTxLeadMult), note: 'Requirements transformer-lead Segmented' },
    { field: 'transformerType', label: 'capexDetail.fomTxTypeMult',        options: ['dry', 'oil'],                                keys: keysOf(CD.fomTxTypeMult), note: 'Requirements transformer-type Segmented' },
    { field: 'deliveryMethod', label: 'capexDetail.fomDeliveryMult',       options: ['design_build', 'design_bid_build', 'epc'],   keys: keysOf(CD.fomDeliveryMult), note: 'Requirements delivery-method Select' },
];

let gaps = 0;
const rows = [];
for (const r of registry) {
    if (!r.options || r.options.length === 0) { rows.push(`⚠︎ ${r.field} — no option domain extracted (check the registry/extractor)`); continue; }
    if (!r.keys || r.keys.length === 0) { rows.push(`⚠︎ ${r.field} → ${r.label} — DATA map empty/absent (engine not loaded?)`); continue; }
    const keySet = new Set(r.keys);
    for (const opt of r.options) {
        const resolved = r.resolve ? r.resolve(opt) : opt;
        if (!keySet.has(resolved)) {
            gaps++;
            rows.push(`✘ ${r.field} "${opt}"${resolved !== opt ? ` → "${resolved}"` : ''} → ${r.label} has NO key (silent fallback)`);
        }
    }
}

console.log('audit-dcmoc-enum-coverage — every cost/value UI option must resolve to a real engine DATA key\n');
for (const r of registry) {
    const n = (r.options ?? []).length;
    const covered = (r.options ?? []).filter((o) => new Set(r.keys).has(r.resolve ? r.resolve(o) : o)).length;
    console.log(`  ${covered === n && n > 0 ? '✔' : '·'} ${r.field.padEnd(15)} ${covered}/${n} → ${r.label}`);
}
if (rows.length) { console.log('\n' + rows.join('\n')); }
console.log(`\n${gaps === 0 ? 'CLEAN' : gaps + ' GAP(S)'} — ${registry.length} enum→DATA mappings checked.`);

if (gaps > 0) process.exit(1);
process.exit(0);
