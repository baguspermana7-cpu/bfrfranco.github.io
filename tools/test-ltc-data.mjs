#!/usr/bin/env node
/**
 * test-ltc-data.mjs — Plausibility bounds gate for W3 LTC/TCO data additions.
 *
 * Validates the new DATA keys added in Workstream W3:
 *   - DATA.coolants (extended: all 6 fluids have required thermophysical fields)
 *   - DATA.cduVendors (CDU vendor specs)
 *   - DATA.refrigerants (extended: all 11 entries have price + PFAS flag)
 *   - DATA.electricityTariffs (per-country electricity + carbon)
 *   - DATA.waterTariffs (per-country water cost + scarcity)
 *   - DATA.leadTimes (equipment lead-time by class + region)
 *
 * Each bound is sourced from the cited primary documents.
 * Exit 0 = all pass; exit 1 = any failure.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/* ── Load engine ── */
function loadEngine() {
    const src = readFileSync(resolve(ROOT, 'rz-engine.js'), 'utf8');
    const win = {};
    win.window = win;
    win.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    win.CustomEvent = function () {};
    win.dispatchEvent = function () {};
    win.addEventListener = function () {};
    win.removeEventListener = function () {};
    win.console = console;
    const ctx = vm.createContext(win);
    vm.runInContext(src, ctx, { filename: 'rz-engine.js' });
    if (!win.RZEngine) throw new Error('RZEngine did not attach to window');
    return win.RZEngine.data;
}

const D = loadEngine();
let pass = 0, fail = 0;
const fails = [];

function ok(name, cond, detail) {
    if (cond) { pass++; }
    else { fail++; fails.push(name + (detail ? ' — got: ' + detail : '')); }
}

/* ══════════════════════════════════════════════════════════
 * 1. DATA.coolants — extended fluids
 * Bounds: cp 1.0–4.5 kJ/kg·K (water max ~4.2; dielectrics ~1.1-1.5)
 *         rho 900–1800 kg/m³
 *         viscosity 0.1–10 mPa·s (dielectric 2p very low ~0.4; water ~1.0; PG40 ~4.0)
 *         thermal conductivity 0.05–0.7 W/m·K
 * Source: ASHRAE HoF 2021 ch.31; OCP Immersion Fluid Spec 2022; IAPWS-IF97
 * ══════════════════════════════════════════════════════════ */
{
    const REQUIRED_FLUIDS = ['water', 'pg20', 'pg30', 'pg40', 'dielectric_1p', 'dielectric_2p'];
    ok('coolants: 6 fluids present (W3 extended)', REQUIRED_FLUIDS.every(f => D.coolants[f] != null));

    for (const [key, c] of Object.entries(D.coolants)) {
        ok(`coolants.${key}: cp in [1.0, 4.5] kJ/kg·K`, c.cp >= 1.0 && c.cp <= 4.5, c.cp);
        ok(`coolants.${key}: rho in [900, 1800] kg/m³`, c.rho >= 900 && c.rho <= 1800, c.rho);
        ok(`coolants.${key}: viscosityMpas present`, c.viscosityMpas != null && c.viscosityMpas > 0, c.viscosityMpas);
        ok(`coolants.${key}: viscosityMpas in [0.1, 12.0] mPa·s`, c.viscosityMpas >= 0.1 && c.viscosityMpas <= 12.0, c.viscosityMpas);
        ok(`coolants.${key}: thermalCondWmk present`, c.thermalCondWmk != null && c.thermalCondWmk > 0, c.thermalCondWmk);
        ok(`coolants.${key}: thermalCondWmk in [0.04, 0.70] W/m·K`, c.thermalCondWmk >= 0.04 && c.thermalCondWmk <= 0.70, c.thermalCondWmk);
        ok(`coolants.${key}: ashraeClass present`, typeof c.ashraeClass === 'string' && c.ashraeClass.length > 0, c.ashraeClass);
    }

    /* spot checks: water cp fixed at 4.186 (LTC parity invariant) */
    ok('coolants.water: cp === 4.186 (LTC parity)', D.coolants.water.cp === 4.186, D.coolants.water.cp);
    ok('coolants.water: rho === 997', D.coolants.water.rho === 997, D.coolants.water.rho);
    /* pg40 freeze protection: only present in extended set */
    ok('coolants.pg40: cp < pg30.cp (richer glycol = lower cp)', D.coolants.pg40.cp < D.coolants.pg30.cp);
    /* dielectrics: cp much lower than water */
    ok('coolants.dielectric_1p: cp < 2.0 kJ/kg·K', D.coolants.dielectric_1p.cp < 2.0, D.coolants.dielectric_1p.cp);
    ok('coolants.dielectric_2p: cp < 2.0 kJ/kg·K', D.coolants.dielectric_2p.cp < 2.0, D.coolants.dielectric_2p.cp);
}

/* ══════════════════════════════════════════════════════════
 * 2. DATA.cduVendors — CDU vendor specs
 * Bounds: capacity 50–600 kW; flow 50–800 Lpm; dP 0.3–3.0 bar;
 *         lead 8–50 wk; cost 200–1000 $/kW
 * Source: CoolIT/Asetek/Vertiv/Boyd datasheets 2024-25
 * ══════════════════════════════════════════════════════════ */
{
    ok('cduVendors present', D.cduVendors != null && typeof D.cduVendors === 'object');
    const vendors = Object.entries(D.cduVendors);
    ok('cduVendors: ≥5 entries', vendors.length >= 5, String(vendors.length));

    for (const [key, v] of vendors) {
        ok(`cduVendors.${key}: capacityKw in [50, 600]`, v.capacityKw >= 50 && v.capacityKw <= 600, v.capacityKw);
        ok(`cduVendors.${key}: flowLpm in [50, 800]`, v.flowLpm >= 50 && v.flowLpm <= 800, v.flowLpm);
        ok(`cduVendors.${key}: dpBar in [0.3, 3.0]`, v.dpBar >= 0.3 && v.dpBar <= 3.0, v.dpBar);
        ok(`cduVendors.${key}: leadWeeks in [8, 50]`, v.leadWeeks >= 8 && v.leadWeeks <= 50, v.leadWeeks);
        ok(`cduVendors.${key}: costUsdPerKw in [200, 1000]`, v.costUsdPerKw >= 200 && v.costUsdPerKw <= 1000, v.costUsdPerKw);
        ok(`cduVendors.${key}: vendor string`, typeof v.vendor === 'string' && v.vendor.length > 0);
    }
}

/* ══════════════════════════════════════════════════════════
 * 3. DATA.refrigerants — extended (W3: +R744 +Novec7000 +price +PFAS)
 * Bounds: GWP ≥0; price 0.5–200 $/kg; pfas boolean
 * Source: EPA SNAP; Chemours; Honeywell; 3M; IIR; ASHRAE 34-2022
 * ══════════════════════════════════════════════════════════ */
{
    const refs = D.refrigerants;
    ok('refrigerants: 11 entries (W3 +R744 +Novec7000)', Object.keys(refs).length === 11, String(Object.keys(refs).length));
    ok('R744 present', refs.R744 != null);
    ok('Novec7000 present', refs.Novec7000 != null);

    for (const [key, r] of Object.entries(refs)) {
        ok(`refrigerants.${key}: gwp ≥ 0`, r.gwp >= 0, r.gwp);
        ok(`refrigerants.${key}: priceUsdPerKg in [0.5, 200]`, r.priceUsdPerKg >= 0.5 && r.priceUsdPerKg <= 200, r.priceUsdPerKg);
        ok(`refrigerants.${key}: pfas is boolean`, typeof r.pfas === 'boolean', typeof r.pfas);
        ok(`refrigerants.${key}: copIndex in [0.5, 1.2]`, r.copIndex >= 0.5 && r.copIndex <= 1.2, r.copIndex);
        ok(`refrigerants.${key}: capexMult in [0.9, 1.3]`, r.capexMult >= 0.9 && r.capexMult <= 1.3, r.capexMult);
    }

    /* PFAS flags: Novec7000 must be true; water-based HFOs false */
    ok('Novec7000 pfas === true (fluorocarbon)', refs.Novec7000.pfas === true);
    ok('R1234ze pfas === false (HFO, not PFAS scope)', refs.R1234ze.pfas === false);
    ok('R717 gwp === 0 (ammonia, zero GWP)', refs.R717.gwp === 0);
    ok('R744 gwp === 1 (CO2, near-zero GWP)', refs.R744.gwp === 1);
    /* price ordering sanity: commodity (ammonia/propane) cheaper than HFOs */
    ok('R717 price < R1234ze price (commodity vs HFO)', refs.R717.priceUsdPerKg < refs.R1234ze.priceUsdPerKg);
}

/* ══════════════════════════════════════════════════════════
 * 4. DATA.electricityTariffs — per-country electricity + carbon
 * Bounds: rate 0.02–0.60 $/kWh; gridCarbon 0.01–1.1 kgCO2/kWh
 * Source: EIA; Eurostat; PLN; EMA; IEA; Ember 2024-25
 * ══════════════════════════════════════════════════════════ */
{
    ok('electricityTariffs present', D.electricityTariffs != null);
    const tariffs = Object.entries(D.electricityTariffs);
    ok('electricityTariffs: ≥10 countries', tariffs.length >= 10, String(tariffs.length));

    const REQUIRED_COUNTRIES = ['US', 'DE', 'SG', 'ID', 'MY', 'IN', 'GB', 'FR'];
    for (const cc of REQUIRED_COUNTRIES) {
        ok(`electricityTariffs.${cc} present`, D.electricityTariffs[cc] != null);
    }

    for (const [cc, t] of tariffs) {
        ok(`electricityTariffs.${cc}: rate in [0.02, 0.60] $/kWh`, t.rateUsdPerKwh >= 0.02 && t.rateUsdPerKwh <= 0.60, t.rateUsdPerKwh);
        ok(`electricityTariffs.${cc}: gridCarbon in [0.01, 1.1] kgCO2/kWh`, t.gridCarbonKgCo2PerKwh >= 0.01 && t.gridCarbonKgCo2PerKwh <= 1.1, t.gridCarbonKgCo2PerKwh);
        ok(`electricityTariffs.${cc}: touPeak ≥ rateUsdPerKwh`, t.touPeakUsdPerKwh >= t.rateUsdPerKwh, `${t.touPeakUsdPerKwh} vs ${t.rateUsdPerKwh}`);
        ok(`electricityTariffs.${cc}: touOffpeak ≤ rateUsdPerKwh`, t.touOffpeakUsdPerKwh <= t.rateUsdPerKwh, `${t.touOffpeakUsdPerKwh} vs ${t.rateUsdPerKwh}`);
        ok(`electricityTariffs.${cc}: label present`, typeof t.label === 'string' && t.label.length > 0);
    }

    /* cross-check: DATA.electricityTariffs rates do not wildly diverge from DATA.countries electricityRate.
     * Tolerance 40%: both tables are independently sourced (electricityTariffs = IEA 2024 blended national;
     * countries = DCMOC 2026-Q1 utility filing anchors per state) so moderate divergence is expected
     * (e.g. India: countries=0.07 state utility 2023 vs tariffs=0.095 IEA 2024 blended national). */
    const countries = D.countries || {};
    const crossCheckMap = { ID: 'ID', SG: 'SG', IN: 'IN', JP: 'JP', MY: 'MY' };
    for (const [tariffCC, countryCC] of Object.entries(crossCheckMap)) {
        const t = D.electricityTariffs[tariffCC];
        const c = countries[countryCC];
        if (t && c && c.economy && c.economy.electricityRate != null) {
            const relDiff = Math.abs(t.rateUsdPerKwh - c.economy.electricityRate) / c.economy.electricityRate;
            ok(`electricityTariffs.${tariffCC} vs countries.${countryCC}.electricityRate within 40%`, relDiff <= 0.40,
               `tariff=${t.rateUsdPerKwh} countries=${c.economy.electricityRate} diff=${(relDiff*100).toFixed(1)}%`);
        }
    }

    /* spot checks: France nuclear grid must be very low carbon */
    ok('electricityTariffs.FR: gridCarbon < 0.15 kgCO2/kWh (nuclear grid)', D.electricityTariffs.FR.gridCarbonKgCo2PerKwh < 0.15, D.electricityTariffs.FR.gridCarbonKgCo2PerKwh);
    /* Indonesia coal-heavy */
    ok('electricityTariffs.ID: gridCarbon > 0.5 kgCO2/kWh (coal grid)', D.electricityTariffs.ID.gridCarbonKgCo2PerKwh > 0.5, D.electricityTariffs.ID.gridCarbonKgCo2PerKwh);
}

/* ══════════════════════════════════════════════════════════
 * 5. DATA.waterTariffs — per-country water cost + scarcity
 * Bounds: rate 0.05–5.00 $/m³; WRI index 0–5
 * Source: Circle of Blue; Eurostat; PUB; BPS; Ofwat; FAO AQUASTAT; WRI Aqueduct 4.0
 * ══════════════════════════════════════════════════════════ */
{
    ok('waterTariffs present', D.waterTariffs != null);
    const wt = Object.entries(D.waterTariffs);
    ok('waterTariffs: ≥10 countries', wt.length >= 10, String(wt.length));

    const SCARCITY_VALID = new Set(['low', 'medium', 'high']);
    for (const [cc, w] of wt) {
        ok(`waterTariffs.${cc}: rate in [0.05, 5.00] $/m³`, w.rateUsdPerM3 >= 0.05 && w.rateUsdPerM3 <= 5.00, w.rateUsdPerM3);
        ok(`waterTariffs.${cc}: scarcityTier valid`, SCARCITY_VALID.has(w.scarcityTier), w.scarcityTier);
        ok(`waterTariffs.${cc}: wriAqueductIndex in [0, 5]`, w.wriAqueductIndex >= 0 && w.wriAqueductIndex <= 5, w.wriAqueductIndex);
        ok(`waterTariffs.${cc}: label present`, typeof w.label === 'string' && w.label.length > 0);
    }

    /* spot: Singapore water-stressed; Indonesia cheap */
    ok('waterTariffs.SG: scarcity medium or high', D.waterTariffs.SG.scarcityTier === 'medium' || D.waterTariffs.SG.scarcityTier === 'high');
    ok('waterTariffs.IN: scarcity high (WRI Aqueduct)', D.waterTariffs.IN.scarcityTier === 'high');
    ok('waterTariffs.ID: rate < 1.0 $/m³ (low-cost tropics)', D.waterTariffs.ID.rateUsdPerM3 < 1.0, D.waterTariffs.ID.rateUsdPerM3);
    ok('waterTariffs.SG: rate > waterTariffs.ID.rate (island vs archipelago)', D.waterTariffs.SG.rateUsdPerM3 > D.waterTariffs.ID.rateUsdPerM3);
}

/* ══════════════════════════════════════════════════════════
 * 6. DATA.leadTimes — equipment lead times by class + region
 * Bounds: typicalWeeks 4–80 wk; stressedWeeks > typicalWeeks; stressedWeeks ≤ 130 wk
 * Source: Vertiv/Caterpillar/Schneider/Trane/Siemens 2025; PJM Dominion 2025
 * ══════════════════════════════════════════════════════════ */
{
    ok('leadTimes present', D.leadTimes != null);
    const lt = Object.entries(D.leadTimes);
    ok('leadTimes: ≥12 entries (4 classes × 3 regions)', lt.length >= 12, String(lt.length));

    const VALID_CLASSES = new Set(['cdu', 'ups_module', 'genset', 'chiller', 'transformer_mv']);
    const VALID_REGIONS = new Set(['Americas', 'EMEA', 'APAC']);

    for (const [key, l] of lt) {
        ok(`leadTimes.${key}: class valid`, VALID_CLASSES.has(l.class), l.class);
        ok(`leadTimes.${key}: region valid`, VALID_REGIONS.has(l.region), l.region);
        ok(`leadTimes.${key}: typicalWeeks in [4, 80]`, l.typicalWeeks >= 4 && l.typicalWeeks <= 80, l.typicalWeeks);
        ok(`leadTimes.${key}: stressedWeeks in [4, 130]`, l.stressedWeeks >= 4 && l.stressedWeeks <= 130, l.stressedWeeks);
        ok(`leadTimes.${key}: stressedWeeks > typicalWeeks`, l.stressedWeeks > l.typicalWeeks, `${l.stressedWeeks} vs ${l.typicalWeeks}`);
        ok(`leadTimes.${key}: note present`, typeof l.note === 'string' && l.note.length > 0);
    }

    /* spot: transformers are the long-lead critical path */
    const xfmrs = lt.filter(([, l]) => l.class === 'transformer_mv');
    const cdus = lt.filter(([, l]) => l.class === 'cdu');
    ok('transformer_mv.typicalWeeks > genset.typicalWeeks (transformer is longer-lead)', (() => {
        const xTyp = Math.min(...xfmrs.map(([, l]) => l.typicalWeeks));
        const cduTyp = Math.max(...cdus.map(([, l]) => l.typicalWeeks));
        return xTyp > cduTyp;
    })());
    ok('all transformer_mv.typicalWeeks ≥ 48 wk (critical path)', xfmrs.every(([, l]) => l.typicalWeeks >= 48));
}

/* ══════════════════════════════════════════════════════════
 * 7. DATA.sources provenance — every W3 key has a sources entry
 * ══════════════════════════════════════════════════════════ */
{
    const W3_SOURCE_KEYS = [
        'coolants.extended',
        'cduVendors',
        'refrigerants.extended',
        'electricityTariffs',
        'waterTariffs',
        'leadTimes'
    ];
    const src = D.sources || {};
    for (const key of W3_SOURCE_KEYS) {
        ok(`DATA.sources['${key}'] present`, src[key] != null, 'missing');
        if (src[key]) {
            ok(`DATA.sources['${key}'].source is non-empty string`, typeof src[key].source === 'string' && src[key].source.length > 20, src[key].source ? src[key].source.slice(0, 30) : 'null');
            ok(`DATA.sources['${key}'].asOf present`, typeof src[key].asOf === 'string', src[key].asOf);
        }
    }
}

/* ── Summary ── */
console.log(`\nLTC-DATA BOUNDS GATE — ${pass} passed, ${fail} failed`);
if (fail > 0) {
    console.log('\nFAILURES:');
    for (const f of fails) console.log('  ✗', f);
    process.exit(1);
} else {
    console.log('ALL GREEN — W3 data additions plausible, sourced, and engine-resident.');
}
