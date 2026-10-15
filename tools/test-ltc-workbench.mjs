#!/usr/bin/env node
/* ============================================================================
 * test-ltc-workbench.mjs — the LTC Workbench: its arithmetic and its frame
 * ----------------------------------------------------------------------------
 * The six standards pages (hub + ASHRAE, Tier, TIA, NFPA, ISO) were rebuilt in
 * v3.12 from long-form articles into tools. A tool that computes the wrong
 * number is worse than the article it replaced, so this gate pins each
 * module's arithmetic to values that can be checked by hand or against the
 * cited standard, and pins the frame every page must keep:
 *
 *   W1  ASHRAE psychrometrics and envelope classes (TC 9.9, 5th ed.)
 *   W2  Tier simulator: the four Tiers must reach their own objectives —
 *       I/II not concurrently maintainable, III maintainable but not fault
 *       tolerant, IV both. A topology edit that breaks a Tier fails here.
 *   W3  NFPA 2001 flooding equations against the published per-m³ figures
 *   W4  TIA fiber budget, copper channel, TIA-607 conductor sizing
 *   W5  ISO/IEC 30134 KPIs and the ISO 50006 regression recovering a known model
 *   W13 every hub view and the lab overview, desktop and phone, on 132 plants (sizes, captures, configurations × TCS × climates): zero diagram-engine warnings
 *   W12 exported report: Sankey and power closure, engine numbers, every trace / input / fault / transient, embedded data
 *   W11 manuals: the lab manual's worked example equals the engine output; the hub manual covers the plant
 *   W10 model lab on the plant engine: load order, computeModel delegation, adapter parity, screening passthrough
 *   W9  Tier groups (IT AND mechanical power; liquid AND air sinks), ≤ 9 blocks per Tier layout, DH01 on the hub
 *   W8  every page loads the plant + strip; ISO defaults to the plant; derived inputs are bound
 *   W7  hub: the full plant (air path, CHW, electrical rooms), ≤ 9 blocks per view,
 *       traceable connector ids, a script at every commissioning gate, HLT at L4
 *   W6  every page: workbench shell, engine before the shell, the IEC symbol
 *       library, inline diagram tokens, and the fail-closed access gate with
 *       its own page key
 *
 *   node tools/test-ltc-workbench.mjs
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const fails = [];
function ok(id, cond, detail) { if (cond) pass++; else fails.push(`${id} — ${detail}`); }
function near(id, got, want, tol, what) { ok(id, Math.abs(got - want) <= tol, `${what}: got ${got}, want ${want} ±${tol}`); }

/* Load a module with no DOM: boot() waits for DOMContentLoaded, which never fires. */
function load(rel) {
  const sb = { console, Math, JSON };
  sb.window = sb;
  sb.document = { readyState: 'loading', addEventListener() {} };
  sb.LTC = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(join(root, rel), 'utf8'), sb, { filename: rel });
  return sb;
}

/* ---- W1 ASHRAE ----------------------------------------------------------- */
{
  const A = load('js/ltc-ashrae.js').LTCAshrae;
  /* Magnus (17.62 / 243.12) is within ~0.3 % of the steam tables from −45 to 60 °C: 2.333 vs 2.339 kPa here */
  near('W1a', A.es(20), 2.339, 0.008, 'saturation pressure at 20 °C, kPa');
  near('W1b', A.pAlt(1500), 84.56, 0.05, 'standard-atmosphere pressure at 1,500 m, kPa');
  near('W1c', A.dpFromPv(A.es(10)), 10, 1e-9, 'dew point inverts saturation pressure');
  const A1 = A.CLASSES.find(c => c.id === 'A1'), A3 = A.CLASSES.find(c => c.id === 'A3');
  near('W1d', A.derated(A1, 1500), 30.0, 1e-9, 'A1 max dry-bulb at 1,500 m (1 °C / 300 m above 900 m)');
  near('W1e', A.derated(A3, 1500), 40 - 600 / 175, 1e-9, 'A3 max dry-bulb at 1,500 m (1 °C / 175 m)');
  const r1 = A.check(24, 10, 0);
  ok('W1f', r1.rec, '24 °C / 10 °C DP at sea level must be inside the recommended envelope');
  const r2 = A.check(30, 16, 0);
  ok('W1g', !r2.rec && r2.rows.find(x => x.c.id === 'A1').allow, '30 °C / 16 °C DP must be A1 allowable, not recommended');
  const r3 = A.check(33, 10, 0);
  ok('W1h', !r3.rows.find(x => x.c.id === 'A1').allow && r3.rows.find(x => x.c.id === 'A2').allow, '33 °C must leave A1 and stay in A2');
  ok('W1i', A.REC.rhHi === 70 && A.REC.dpHi === 15 && A.REC.lo === 18 && A.REC.hi === 27, 'recommended envelope is the 2021 edition: 18–27 °C, 15 °C DP, 70 % RH');
  const cls = t => A.LIQUID.find(k => t <= k.max).id;
  ok('W1j', cls(32) === 'W32' && cls(33) === 'W40' && cls(46) === 'W+' && cls(17) === 'W17', 'W-class by maximum supply temperature');
}

/* ---- W2 Tier objectives --------------------------------------------------- */
{
  const T = load('js/ltc-tier.js').LTCTier;
  const v = t => { const s = T.sweep(t); return { cm: s.every(r => r.maint), ft: s.every(r => r.fault) }; };
  const t1 = v(1), t2 = v(2), t3 = v(3), t4 = v(4);
  ok('W2a', !t1.cm && !t1.ft, 'Tier I must be neither maintainable nor fault tolerant');
  ok('W2b', !t2.cm && !t2.ft, 'Tier II must not be concurrently maintainable (single path)');
  ok('W2c', t3.cm && !t3.ft, `Tier III must be maintainable and NOT fault tolerant: cm=${t3.cm} ft=${t3.ft}`);
  ok('W2d', t4.cm && t4.ft, `Tier IV must be maintainable and fault tolerant: cm=${t4.cm} ft=${t4.ft}`);
  ok('W2e', T.powered(2, { 'ups#1': 1 }, false) && !T.powered(1, { 'ups#1': 1 }, false), 'an N+1 UPS survives one unit out, an N UPS does not');
  near('W2f', T.kOfN(0.9, 3, 2), 0.972, 1e-12, '2-of-3 availability at A = 0.9');
  /* the cooling topologies must reach the same objectives as the power ones */
  T.system('cooling');
  const c1 = v(1), c2 = v(2), c3 = v(3), c4 = v(4);
  ok('W2g', !c1.cm && !c2.cm && c3.cm && !c3.ft && c4.cm && c4.ft,
     `cooling Tier objectives: I ${c1.cm}/${c1.ft} II ${c2.cm}/${c2.ft} III ${c3.cm}/${c3.ft} IV ${c4.cm}/${c4.ft}`);
  T.system('power');
}

/* ---- W3 NFPA 2001 -------------------------------------------------------- */
{
  const N = load('js/ltc-nfpa.js').LTCNfpa;
  const h = N.agentCalc({ agent: 'HFC-227ea', v: 100, tMin: 21, tMax: 21, z: 0, c: 7 });
  near('W3a', h.qty, 54.67, 0.05, 'HFC-227ea, 100 m³ at 21 °C and 7 % (≈ 0.547 kg/m³)');
  near('W3b', h.cMax, 7, 1e-9, 'same temperature must give back the design concentration');
  const f = N.agentCalc({ agent: 'FK-5-1-12', v: 100, tMin: 18, tMax: 32, z: 0, c: 4.5 });
  ok('W3c', f.cMax > 4.5 && f.cMax < 10, `a hotter room raises the halocarbon concentration, still under NOAEL: ${f.cMax}`);
  const i = N.agentCalc({ agent: 'IG-541', v: 1, tMin: 21, tMax: 21, z: 0, c: 38 });
  near('W3d', i.X, 0.478, 0.002, 'IG-541 flooding factor at 38 % and 21 °C, m³/m³');
  near('W3e', i.cMax, 38, 1e-6, 'inert gas at the same temperature returns the design concentration');
  const hot = N.agentCalc({ agent: 'IG-541', v: 1, tMin: 18, tMax: 32, z: 0, c: 38 });
  ok('W3f', hot.cMax > 38, `inert gas concentration must rise with room temperature: ${hot.cMax}`);
  const alt = N.agentCalc({ agent: 'HFC-227ea', v: 100, tMin: 21, tMax: 21, z: 1500, c: 7 });
  ok('W3g', alt.qty < h.qty && Math.abs(alt.cMax - 7) < 1e-9, 'altitude reduces mass, not concentration');
  ok('W3h', N.areaPerDetector(60) === 125 && N.areaPerDetector(30) === 250 && N.areaPerDetector(40) === 125 && N.areaPerDetector(5) === 900,
     'NFPA 72 high-airflow spacing, conservative between rows');
}

/* ---- W4 TIA -------------------------------------------------------------- */
{
  const X = load('js/ltc-tia.js').LTCTia;
  const a = X.fiberCalc({ fiber: 'OM4', app: '100GBASE-SR4', len: 90, pairs: 2, splices: 0 });
  near('W4a', a.loss, 1.77, 1e-9, 'OM4 90 m + 2 pairs (3.0 dB/km, 0.75 dB/pair)');
  ok('W4b', a.lossOk && a.reachOk, '90 m OM4 with two pairs fits 100GBASE-SR4');
  const b = X.fiberCalc({ fiber: 'OM4', app: '100GBASE-SR4', len: 120, pairs: 2, splices: 0 });
  ok('W4c', !b.reachOk, '120 m exceeds the 100 m reach of 100GBASE-SR4 on OM4');
  ok('W4d', X.APPS['100GBASE-SR4'].OM4[0] === 100 && X.APPS['10GBASE-SR'].OM3[0] === 300, 'IEEE 802.3 reaches');
  ok('W4e', !X.copperCalc({ app: '10GBASE-T', cat: '6', pl: 50, cords: 10 }).chanOk, '10GBASE-T on Cat 6 is limited to 55 m');
  ok('W4f', X.copperCalc({ app: '10GBASE-T', cat: '6A', pl: 90, cords: 10 }).chanOk, '10GBASE-T on Cat 6A carries a full 100 m channel');
  ok('W4g', X.tbbSize(14)[1] === '1/0 AWG' && X.tbbSize(3)[1] === '6 AWG' && X.tbbSize(25)[1] === '3/0 AWG', 'TIA-607 TBB sizing by length');
}

/* ---- W5 ISO -------------------------------------------------------------- */
{
  const I = load('js/ltc-iso.js').LTCIso;
  const k = I.kpi({ e: 130000, it1: 108000, it2: 105500, it3: 103800, ren: 40000, reuse: 0, water: 4200, ef: 0.72 });
  near('W5a', k.pue3, 130000 / 103800, 1e-12, 'PUE category 3');
  ok('W5b', k.pue1 < k.pue2 && k.pue2 < k.pue3, 'PUE rises as the metering point moves toward the IT input');
  near('W5c', k.wue, 4200 / 103800, 1e-12, 'WUE L/kWh');
  const rows = [];
  for (let m = 0; m < 12; m++) { const it = 900 + 13 * m, cdd = 150 + (m * 37) % 50; rows.push({ m, it, cdd, fac: 520 + 1.18 * it + 0.62 * cdd }); }
  const o = I.ols(rows);
  near('W5d', o.b[0], 520, 1e-6, 'OLS intercept recovered'); near('W5e', o.b[1], 1.18, 1e-9, 'OLS IT slope recovered'); near('W5f', o.b[2], 0.62, 1e-9, 'OLS CDD slope recovered');
}

/* ---- W6 page frame -------------------------------------------------------- */
const PAGES = {
  'standards-ltc-lab.html': 'js/ltc-hub.js', 'ltc-ashrae-thermal-control.html': 'js/ltc-ashrae.js',
  'ltc-uptime-tier-alignment.html': 'js/ltc-tier.js', 'ltc-ansi-tia-topology-readiness.html': 'js/ltc-tia.js',
  'ltc-nfpa-fire-risk.html': 'js/ltc-nfpa.js', 'ltc-iso-energy-governance.html': 'js/ltc-iso.js'
};
for (const [page, mod] of Object.entries(PAGES)) {
  const h = readFileSync(join(root, page), 'utf8');
  const at = s => h.indexOf(s);
  ok(`W6a:${page}`, at('css/ltc-app.css') > 0, 'loads the workbench stylesheet');
  ok(`W6b:${page}`, at('js/rz-eng-symbols.js') > 0 && at('js/rz-eng-symbols.js') < at('js/rz-diagram.js') && at('js/rz-diagram.js') < at('js/ltc-app.js') && at('js/ltc-app.js') < at(mod),
     'script order: symbols → engine → shell → module');
  ok(`W6c:${page}`, /--bg1:/.test(h) && /:root\[data-theme="light"\]\{--bg1:/.test(h), 'defines the diagram tokens for both themes');
  const key = page.replace('.html', '');
  ok(`W6d:${page}`, h.includes(`enforceTierFeatureAccess('${key}')`) && h.includes('id="rootLoginBtn"') && /<body class="locked">/.test(h),
     'fail-closed access gate with its own page key');
  ok(`W6e:${page}`, !/Interview Prep|TPM Decision Framework|Microsoft TPM/i.test(h), 'no interview-prep filler');
  /* v3.12.0 shipped these pages with bare asset URLs: a returning visitor could run the
   * previous release's JS against new markup. Every local script and stylesheet carries a token. */
  const bare = [...h.matchAll(/(?:src|href)="((?:js|css)\/[^"]+\.(?:js|css))"/g)].map(m => m[1]);
  ok(`W6g:${page}`, bare.length === 0, `local assets without a ?v= cache token: ${bare.join(', ')}`);
}
{
  /* comments may NAME the old defect; only code may not reintroduce it */
  const lab = readFileSync(join(root, 'js/ltc-lab-ui.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  ok('W6f', !/ISO 14644/.test(lab) && !/'Compliant'/.test(lab), 'the model lab screens standards; it does not claim compliance (ISO 14644 is a cleanroom standard)');
}

{
  /* W7 (v3.14.0) — one plant, drawn as overview + details, with scripts at every gate.
   * The plant map used to stop at the dry cooler: the residual air heat and the electrical
   * losses had no block. Pin the blocks, the view budget and the lifecycle scripts. */
  const hub = readFileSync(join(root, 'js/ltc-hub.js'), 'utf8');
  const html = readFileSync(join(root, 'standards-ltc-lab.html'), 'utf8');
  ok('W7a', html.indexOf('js/ltc-plant.js') > 0 && html.indexOf('js/ltc-plant.js') < html.indexOf('js/ltc-hub.js'), 'hub loads the shared plant model before the hub module');
  for (const id of ['tx', 'mcc', 'elec', 'fws', 'trim', 'crah', 'chw', 'chiller', 'tower'])
    ok('W7b:' + id, new RegExp("\\{ id: '" + id + "', sym:").test(hub), `plant block "${id}" exists (air path, chilled water, electrical rooms)`);
  for (const m of hub.matchAll(/(\w+): \{ label: '([^']+)'(?:, stack: -?1)?, nodes: \[([\s\S]*?)\],\s*edges:/g)) {
    const n = (m[3].match(/\['\w+', \d/g) || []).length;
    ok('W7c:' + m[1], n >= 6 && n <= 9, `view "${m[2]}" has ${n} blocks; the engine budget is 9`);
  }
  ok('W7d', /o\.id = o\.fromId \+ '>' \+ o\.toId/.test(hub), "connectors carry 'from>to' ids, so the hover trace reads connectivity from the drawing");
  ok('W7e', (hub.match(/hold: '/g) || []).length === 6 && (hub.match(/expect: \[/g) || []).length === 6, 'every commissioning stage has tests, expectations and a hold point');
  ok('W7f', /id: 'l4'[\s\S]*?hlt: \[[\s\S]*?25 → 50 → 75 → 100 %[\s\S]*?\]/.test(hub), 'L4 carries the heat load test with its load steps');
}

{
  /* W8 (v3.15.0) — the plant is edited in one place and the tools take their inputs from it.
   * Owner: "minimize inputan, tapi di belakangnya ada otomatis calculation". */
  for (const page of Object.keys(PAGES)) {
    const h = readFileSync(join(root, page), 'utf8');
    const at = (x) => h.indexOf(x);
    ok(`W8a:${page}`, at('js/ltc-plant.js') > 0 && at('js/ltc-plant.js') < at('js/ltc-plant-strip.js') && at('js/ltc-plant-strip.js') < at(PAGES[page]),
       'loads the plant model, then the plant strip, before its module');
  }
  const iso = readFileSync(join(root, 'js/ltc-iso.js'), 'utf8'), isoH = readFileSync(join(root, 'ltc-iso-energy-governance.html'), 'utf8');
  ok('W8b', /var src = 'plant'/.test(iso) && /id="kMeter" hidden/.test(isoH), 'ISO energies default to the plant; metered inputs are the opt-in');
  const binds = { 'js/ltc-ashrae.js': ['lSup', 'lAmb', 'lApp', 'cSup'], 'js/ltc-tia.js': ['pRacks'], 'js/ltc-nfpa.js': ['fL', 'fW', 'fH', 'dL', 'dW', 'dAch'] };
  for (const [f, ids] of Object.entries(binds)) {
    const src = readFileSync(join(root, f), 'utf8');
    for (const id of ids) ok(`W8c:${id}`, src.includes(`bind('${id}'`), `${f} takes ${id} from the plant`);
  }
  const hubH = readFileSync(join(root, 'standards-ltc-lab.html'), 'utf8');
  ok('W8d', !/Tier, ASHRAE and model pages read the same plant/.test(hubH), 'the hub does not claim pages read the plant before they do');
}

{
  /* W9 (v3.16.0) — Tier on the plant topology; DH01 on the hub */
  const T = load('js/ltc-tier.js').LTCTier;
  T.system('power');
  ok('W9a', !T.powered(3, { 'mcc#1': 1, 'mcc#2': 1 }, true), 'IT is lost when the mechanical power group is lost, even with both IT paths healthy');
  ok('W9b', T.powered(3, { 'mcc#1': 1 }, false), 'one MCC of a dual-fed pair out: mechanical power holds');
  ok('W9c', T.lostGroups(3, { mcc: 1 }, false).includes('mech'), 'the sweep names the group that failed');
  T.system('cooling');
  ok('W9d', !T.powered(4, { chwA: 1, chwB: 1 }, true) && T.powered(4, { chwA: 1 }, false), 'cooling needs both sinks: both CHW loops out loses the air sink; one is tolerated at Tier IV');
  ok('W9e', !T.powered(2, { fws: 1 }, true), 'Tier II: the single FWS loop is a component the sweep must take out whole');
  ok('W9h', T.redLabel(18, 9) === '2N' && T.redLabel(2, 1) === '2N' && T.redLabel(17, 16) === 'N+1' && T.redLabel(9, 9) === 'N',
     `redundancy reads as the industry writes it: 18 for 9 is 2N, not N+9 (got ${T.redLabel && T.redLabel(18, 9)})`);
  T.system('power');
  const tier = readFileSync(join(root, 'js/ltc-tier.js'), 'utf8');
  for (const m of tier.matchAll(/(power[12]|cool[12]): \{ nodes: \[([\s\S]*?)\],\s*edges:/g)) {
    const n = (m[2].match(/\['\w+', \d/g) || []).length;
    ok('W9f:' + m[1], n <= 9, `Tier layout ${m[1]} has ${n} blocks; the engine budget is 9`);
  }
  const hubH = readFileSync(join(root, 'standards-ltc-lab.html'), 'utf8');
  ok('W9g', hubH.includes('id="ltcDh01"') && hubH.indexOf('js/ltc-dh01.js') > 0 && hubH.indexOf('js/ltc-dh01.js') < hubH.indexOf('js/ltc-hub.js'), 'the hub carries the DH01 thermal view');
}

{
  /* W10 (v3.17.0) — the model lab on the shared plant engine */
  const html = readFileSync(join(root, 'ltc-system-modelling-lab.html'), 'utf8');
  const at = (x) => html.indexOf(x);
  ok('W10a', at('js/ltc-plant.js') > 0 && at('js/ltc-lab-plant.js') > at('js/ltc-plant.js') && at('js/ltc-lab-plant.js') < at('js/ltc-system-modelling-lab.js'),
     'the lab loads the plant engine and its adapter before the lab model');
  const labJs = readFileSync(join(root, 'js/ltc-system-modelling-lab.js'), 'utf8');
  ok('W10b', /window\.LTCLabPlant && !window\.__ltcLegacy[\s\S]{0,80}LTCLabPlant\.compute\(input, legacy\)/.test(labJs), 'computeModel returns the plant-based model unless the legacy toggle is on');
  const sb = { console, Math, JSON, localStorage: { getItem() { return null; }, setItem() {} } };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(readFileSync(join(root, 'js/ltc-plant.js'), 'utf8'), sb);
  vm.runInContext(readFileSync(join(root, 'js/ltc-lab-plant.js'), 'utf8'), sb);
  const lab = { itLoadMw: 40, liquidCapture: 80, supplyTemp: 32, returnTemp: 42, pumpHead: 25, pumpEff: 75, cduUnit: 1500, redundancy: 'N1', upsEff: 97, distLoss: 0.5,
                rackDensityTarget: 120, climate: 'temperate', elecPrice: 0.1, waterTariff: 1.5, carbonIntensity: 0.4, heatReuse: 0, targetPue: 1.2, targetCop: 8 };
  const pre = sb.LTCLabPlant.compute(lab, {});
  ok('W10g', pre.itKw === 100000, 'before the lab has read the plant it shows the plant, not its own defaults');
  sb.LTCLabPlant.ready();
  const m = sb.LTCLabPlant.compute(lab, { scores: { total: 77 }, riskIndex: 12 });
  const r = sb.LTCPlant.compute(sb.LTCLabPlant.toPlant(lab));
  near('W10c', m.pue, r.totals.pueAnnual, 1e-9, 'lab PUE equals the plant annual PUE for the same inputs');
  near('W10d', m.itKw, 40000, 1e-6, 'lab IT kW equals the plant IT');
  ok('W10e', m.scores.total === 77 && m.riskIndex === 12, 'the screening layer (scores, risk) passes through from the lab model');
  near('W10f', m.pueGap, m.pue - 1.2, 1e-12, 'PUE gap is recomputed against the plant PUE, not the legacy one');
  /* review defects: 2N persists as a number the lab can read back; a custom climate is not relabelled */
  const store = {};
  sb.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  sb.LTCLabPlant.sync(Object.assign({}, lab, { redundancy: '2N' }));
  const saved = JSON.parse(store[sb.LTCPlant.KEY] || '{}');
  ok('W10h', saved.cduRedundancy >= 2, `2N is stored as a resolved spare count (got ${saved.cduRedundancy})`);
  store[sb.LTCPlant.KEY] = JSON.stringify({ climate: 'custom', climateBins: [[30, 26, 8760]], designDbC: 30, designWbC: 26 });
  // the select shows 'tropical' because it cannot show 'custom'; the reader did not choose it
  sb.LTCLabPlant.ready('tropical');
  sb.LTCLabPlant.sync(Object.assign({}, lab, { climate: 'tropical' }));
  const kept = JSON.parse(store[sb.LTCPlant.KEY]);
  ok('W10i', kept.climate === 'custom' && Array.isArray(kept.climateBins), `a custom climate survives a lab run (got ${kept.climate})`);
  // the reader picks another climate in the lab: it is written and the old bins go with it
  sb.LTCLabPlant.sync(Object.assign({}, lab, { climate: 'dry' }));
  const moved = JSON.parse(store[sb.LTCPlant.KEY]);
  ok('W10j', moved.climate === 'arid' && !moved.climateBins, 'a climate the reader picks in the lab replaces the custom bins');
}

{
  /* W11 (v3.17.2) — the manuals describe the engine the tools run. The lab manual explained the
   * retired computeModel with a 12 MW example for a release after the lab had moved to the plant
   * engine; its worked example is now checked against the engine's own output. */
  const man = readFileSync(join(root, 'manual/ltc-system-modelling-lab.html'), 'utf8');
  const sb2 = { console, Math, JSON }; sb2.window = sb2; sb2.globalThis = sb2; vm.createContext(sb2);
  vm.runInContext(readFileSync(join(root, 'js/ltc-plant.js'), 'utf8'), sb2);
  const r = sb2.LTCPlant.compute({}), f = (x) => Math.round(x).toLocaleString('en-US');
  const want = [['design PUE', r.totals.pue.toFixed(3)], ['annual PUE', r.totals.pueAnnual.toFixed(3)], ['TCS pumps', f(r.liquid.tcsPumpKw) + ' kW'],
                ['coolers', r.liquid.coolerUnitsTotal + ' coolers'], ['CRAHs per hall', r.air.crahPerHall + ' CRAHs'], ['facility', f(r.totals.facilityKw) + ' kW'],
                ['M0', f(r.annual.m0MWh)], ['WUE', r.annual.wue.toFixed(2) + ' L/kWh'], ['chiller COP', 'COP ' + r.air.chillerCop.toFixed(2)]];
  for (const [what, v] of want) ok('W11a:' + what, man.includes(v), `lab manual worked example states the engine's ${what} (${v})`);
  ok('W11b', /js\/ltc-plant\.js/.test(man) && /Legacy screening model/.test(man), 'lab manual names the plant engine and labels the legacy model');
  const hubMan = readFileSync(join(root, 'manual/standards-ltc-lab.html'), 'utf8');
  ok('W11c', /One plant behind every tool/.test(hubMan) && /heat load test/i.test(hubMan) && /DH01 thermal map/.test(hubMan), 'hub manual covers the plant, the HLT and the DH01 map');
}

{
  /* W12 (v3.19.0) — the exported report. Owner: "bisa di export jadi super detail report …
   * bener2 comprehensive". A report that disagrees with the engine is worse than none, so every
   * figure is checked against the result it was drawn from, on several plants. */
  for (const page of Object.keys(PAGES)) {
    const h = readFileSync(join(root, page), 'utf8'), at = (x) => h.indexOf(x);
    ok(`W12a:${page}`, at('js/ltc-report.js') > at('js/ltc-plant-strip.js') && at('js/ltc-plant-strip.js') > 0, 'loads the report exporter after the plant strip');
  }
  const sb = { console, Math, JSON, Date }; sb.window = sb; sb.globalThis = sb; sb.document = { readyState: 'loading', addEventListener() {} };
  vm.createContext(sb);
  for (const f of ['js/ltc-plant.js', 'js/ltc-dh01.js', 'js/ltc-dh01-3d.js', 'js/ltc-cfd.js', 'js/ltc-cfd-view.js', 'js/ltc-tier.js', 'js/ltc-report.js']) vm.runInContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
  const P = sb.LTCPlant, X = sb.LTCReport, D = sb.LTCDH01;
  {
    /* the plant map views the report embeds: drawn by the hub's own build on any result, no engine warnings */
    const hb = { console, Math, JSON }; hb.window = hb; hb.globalThis = hb; hb.document = { readyState: 'loading', addEventListener() {}, documentElement: { getAttribute() { return null; } } };
    vm.createContext(hb);
    for (const f of ['js/rz-eng-symbols.js', 'js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js', 'js/rz-diagram.js', 'js/ltc-app.js', 'js/ltc-plant.js', 'js/ltc-hub.js'])
      vm.runInContext(readFileSync(join(root, f), 'utf8'), hb, { filename: f });
    const r37 = hb.LTCPlant.compute({ itMw: 37 }), vs = hb.LTCHub.views();
    ok('W12n', vs.length === 4 && vs.every((v) => { const x = hb.LTCHub.svg(v.id, r37); return x.warnings === 0 && /<svg/.test(x.svg); })
       && hb.LTCHub.svg('overview', r37).svg.includes(r37.it.racks + ' racks'),
       'every plant-map view renders for the report with zero engine warnings, on the result it is given (37 MW: ' + r37.it.racks + ' racks)');
  }
  {
    /* direction of the swing the report prints, and the air-cooled plant costs more power on the design day than the water-cooled one */
    const O = X.options(P, P.compute({})), sv = (k) => O.sens.find((x) => x.key === k);
    ok('W12p', ['capturePct', 'tcsSupplyC', 'upsEff', 'chillerCopRated'].every((k) => sv(k).hi.r.pue < sv(k).lo.r.pue)
       && O.presets.find((o) => o.id === 'baseline').pueD > O.presets.find((o) => o.id === 'dry').pueD && O.presets.find((o) => o.id === 'baseline').wue === 0,
       'more capture, warmer TCS, better UPS and chiller each lower annual PUE; air-cooled chillers (and trim) draw more on the design day than water-cooled, with no water');
  }
  {
    /* DH01 plenum: what one aisle cannot take is offered to the aisles still short, so the air pulled
       back out of the hot aisle is the hall's real shortfall — and N+1 CRAHs carry one unit out */
    const bad = [];
    for (const k of Object.keys(P.PRESETS)) for (const mw of [37, 100, 300]) for (const cap of [70, 85]) {
      const R = P.compute(Object.assign({}, P.PRESETS[k], { itMw: mw, capturePct: cap }));
      for (const f of ['none', 'crah1', 'crah2', 'crah4']) {
        const s = D.solveHall(R, f, 'common', 5, 'throttled'), short = Math.max(0, s.airDemand - s.airSupply);
        if (Math.abs(s.recircM3s - short) > 0.01 * s.airDemand) bad.push(`${k}/${mw}/${cap}/${f}: recirc ${s.recircM3s.toFixed(1)} vs short ${short.toFixed(1)}`);
        if ((f === 'none' || f === 'crah1') && s.over27) bad.push(`${k}/${mw}/${cap}/${f}: ${s.over27} racks over 27 °C with N+1 CRAHs`);
      }
      if (!D.solveHall(P.compute(Object.assign({}, P.PRESETS[k], { itMw: mw, capturePct: cap, crahRedundancy: 0 })), 'crah1', 'common', 5, 'throttled').over27) bad.push(`${k}/${mw}/${cap}: N CRAHs carried one out`);
    }
    ok('W12r', !bad.length, 'DH01: recirculated air equals the hall\'s airflow shortfall (±1 %), N+1 CRAHs hold every rack ≤ 27 °C with one out and N do not — 24 plants' + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
  }
  {
    /* DH01 at the HLT steps: a fault never bites harder at a lower load; the CDU feeder holds exactly
       up to the step the surviving CDUs can carry; a lost loop rides through in proportion to 1 / load;
       load 1 is the design solve */
    const bad = [];
    for (const k of Object.keys(P.PRESETS)) for (const st of [{}, { cduFeed: 'dual' }, { cduRedundancy: 0 }, { crahRedundancy: 0, itMw: 37 }]) {
      const R = P.compute(Object.assign({}, P.PRESETS[k], st)), tag = k + JSON.stringify(st);
      for (const [f] of D.FAULTS) {
        const sv = D.LOADS.map((L) => D.solveHall(R, f, 'common', 5, 'throttled', L)), d = D.solveHall(R, f, 'common', 5, 'throttled');
        for (let i = 1; i < sv.length; i++) if (sv[i].maxInlet < sv[i - 1].maxInlet - 1e-6 || sv[i].itLostKw < sv[i - 1].itLostKw - 1e-6) bad.push(`${tag}/${f}: eases as load rises`);
        if (Math.abs(sv[3].maxInlet - d.maxInlet) > 1e-9 || Math.abs(sv[3].itLostKw - d.itLostKw) > 1e-9) bad.push(`${tag}/${f}: load 1 differs from design`);
      }
      const ov = P.compute(R.input, { kind: 'cdu-feeder' }).fault, duty = R.liquid.dutyKw / R.input.halls, cap = duty - ov.liquidShortKw;
      const want = Math.max(0, ...D.LOADS.filter((L) => L * duty <= cap + 1e-6).map((L) => L * 100)), got = X.hlt(R).fails.find((x) => x.id === 'cdu-feeder').holdsTo;
      if (want !== got) bad.push(`${tag}: feeder holds to ${got} %, survivors carry ${want} %`);
      const t1 = P.transient(R, 'fws-pump').secondsToLimit, t4 = P.transient(R, 'fws-pump', { load: 0.25 }).secondsToLimit;
      if (Math.abs(t4 / t1 - 4) > 0.02) bad.push(`${tag}: FWS ride-through at 25 % is ${(t4 / t1).toFixed(2)}× full load, not 4×`);
    }
    ok('W12s', !bad.length, 'DH01 at the HLT steps: no fault eases as load rises, load 1 equals the design solve, the CDU feeder holds exactly to the step the survivors carry, FWS ride-through ∝ 1/load — 16 plants × every fault' + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
  }
  {
    /* the plant as configured against the Tier objectives: every configuration reaches the Tier
       its redundancy and feeds allow, worked out here independently of LTCTier.fit */
    const bad = [], T = sb.LTCTier;
    for (const k of Object.keys(P.PRESETS)) for (const feed of ['single', 'dual']) for (const ups of ['N+1', '2N']) for (const onUps of [true, false]) for (const cr of [0, 1]) {
      const st = Object.assign({}, P.PRESETS[k], { cduFeed: feed, upsTopology: ups, cduOnUps: onUps, crahRedundancy: cr }), R = P.compute(st), F = T.fit(R, D);
      const feederShort = P.compute(R.input, { kind: 'cdu-feeder' }).fault.liquidShortKw > 0;
      const want = !cr ? 1 : feederShort ? 2 : ups !== '2N' || !onUps ? 3 : 4;
      if (F.reached !== want) bad.push(`${k}/${feed}/${ups}/${onUps}/crah+${cr}: Tier ${F.reached}, want ${want}`);
      if (F.reached < 4 && !F.blockers.length) bad.push(`${k}/${feed}/${ups}: below Tier IV with no blocker named`);
      if (F.rows.some((x) => x.status === 'verify' && x.tier <= F.reached) !== (F.verify.length > 0)) bad.push(`${k}: verify list out of step`);
    }
    ok('W12t', !bad.length, 'this plant against each Tier: 64 configurations (presets × CDU feed × UPS N+1/2N × CDU pumps on UPS × CRAH N/N+1) reach the Tier worked out independently, each short of IV naming its blocker' + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
  }
  {
    /* sequence of events: every time is solved — each timed threshold holds at its second and not
       one second earlier, the FWS throttle is the transient's own crossing, the feeder sheds what
       the hall solve sheds, and the list runs in time order with steady state last */
    const bad = [];
    for (const k of Object.keys(P.PRESETS)) for (const st of [{}, { cduFeed: 'dual' }, { chillerRedundancy: 0 }]) {
      const R = P.compute(Object.assign({}, P.PRESETS[k], st)), tag = k + JSON.stringify(st);
      for (const [f] of D.FAULTS) {
        const E = D.timeline(R, f, 'common', 'throttled', 1);
        if (f === 'none') { if (E.length) bad.push(`${tag}: events with no fault`); continue; }
        if (!E.length || E[0].t !== 0) bad.push(`${tag}/${f}: first event is not the fault at T+0`);
        for (let i = 1; i < E.length; i++) if (E[i - 1].t == null ? E[i].t != null : E[i].t != null && E[i].t < E[i - 1].t) bad.push(`${tag}/${f}: out of order`);
        if (f === 'chw' || f === 'chiller') for (const [re, test] of [[/coils lose/, (s) => s.coilLimited], [/above 27/, (s) => s.over27 > 0], [/above 32/, (s) => s.over32 > 0]]) {
          const e = E.find((x) => x.t > 0 && x.t < 1800 && re.test(x.text));
          if (e && (!test(D.solveHall(R, f, 'common', e.t / 60, 'throttled')) || test(D.solveHall(R, f, 'common', (e.t - 1) / 60, 'throttled')))) bad.push(`${tag}/${f}: ${re} not crossed at ${e.t} s`);
          if (!e && test(D.solveHall(R, f, 'common', 30, 'throttled')) && !test(D.solveHall(R, f, 'common', 0, 'throttled'))) bad.push(`${tag}/${f}: ${re} crossed in 30 min, no event`);
        }
        if (f === 'fws-pump') { const lim = P.transient(R, 'fws-pump').secondsToLimit, e = E.find((x) => x.sev === 'trip'); if ((lim == null) !== !e || (e && Math.abs(e.t - lim) > 1)) bad.push(`${tag}: FWS throttle at ${e && e.t}, transient ${lim}`); }
        if (f === 'cdu-feeder') {
          const s = D.solveHall(R, f, 'common', 5, 'throttled'), e = E.find((x) => x.sev === 'trip');
          if (!!s.itLostKw !== !!e || (e && !e.text.includes((s.itLostKw / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MW'))) bad.push(`${tag}: feeder trip event disagrees with the hall solve`);
        }
      }
    }
    ok('W12v', !bad.length, 'DH01 sequence of events: each timed threshold is crossed at its stated second and not before, FWS throttle at the transient\'s crossing, feeder shed = hall solve, time order — 12 plants × every fault' + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
  }
  {
    /* DH01 in 3D draws the solve, it does not re-solve: supply streams per aisle mouth and wall equal
       the solver's marching, recirculation equals the hall's, every stream carries its rack's inlet and
       exhaust, TCS per CDU is the plant flow (zero on a dead per-CDU loop), FWS stops with the pumps,
       CHW stops with the chilled water — 8 plants × every fault × both headers */
    const bad = [], G = sb.LTCDH013D;
    for (const st0 of [{}, { itMw: 37 }, { cduFeed: 'dual' }, { capturePct: 70 }].concat(Object.keys(P.PRESETS).map((k) => P.PRESETS[k]))) for (const [f] of D.FAULTS) for (const hd of ['common', 'per-cdu']) {
      const R = P.compute(Object.assign({}, st0)), s = D.solveHall(R, f, hd, 5, 'throttled'), M = G.flowModel(R, s, { fault: f, header: hd, phase: 'throttled', load: 1, minute: 5 });
      const tag = JSON.stringify(st0).slice(0, 40) + '/' + f + '/' + hd, of = (k) => M.streams.filter((x) => x.kind === k), sum = (a) => a.reduce((t, x) => t + x.flow, 0);
      for (const a of s.aisles) for (const w of ['west', 'east']) {
        const got = sum(of('air').filter((x) => s.racks[x.rack].aisle === a.i && x.wall === w));
        if (Math.abs(got - a[w]) > 1e-6 * Math.max(1, a.demand)) bad.push(`${tag}: aisle ${a.i} ${w} ${got.toFixed(3)} vs ${a[w].toFixed(3)}`);
      }
      if (Math.abs(sum(of('recirc')) - s.recircM3s) > 1e-6 * s.airDemand) bad.push(`${tag}: recirculation ${sum(of('recirc'))} vs ${s.recircM3s}`);
      for (const x of of('air').concat(of('recirc'))) { const k = s.racks[x.rack], ins = x.pts.find((q, j) => j > 0 && q[3] === k.inlet), ex = x.pts.find((q) => q[3] === k.exhaust); if (!ins || !ex) { bad.push(`${tag}: rack ${x.rack} stream lacks its inlet/exhaust`); break; } }
      const perCdu = R.liquid.tcsLps / R.input.halls / R.liquid.cduPerHall;
      for (const c of R.hall.cdus) {
        const got = sum(of('tcs').filter((x) => R.hall.racks[x.rack].cdu === c.i)), dead = !!s.lostCdu[c.i];
        const want = hd === 'per-cdu' ? (dead ? 0 : perCdu) : perCdu * R.hall.cdus.filter((u) => !s.lostCdu[u.i]).length / R.hall.cdus.length;
        if (Math.abs(got - want) > 1e-6 * perCdu) { bad.push(`${tag}: CDU ${c.i} TCS ${got.toFixed(2)} vs ${want.toFixed(2)} L/s`); break; }
      }
      if ((f === 'fws-pump') !== (of('fws').length === 0)) bad.push(`${tag}: FWS streams ${of('fws').length}`);
      if ((f === 'chw') !== (of('chw').length === 0)) bad.push(`${tag}: CHW streams ${of('chw').length}`);
      if (M.streams.some((x) => !(x.cycle > 0) || x.legT.some((t) => !isFinite(t)))) bad.push(`${tag}: a stream with no finite cycle`);
    }
    ok('W12x', !bad.length, 'DH01 3D streams equal the solve: supply per aisle mouth and wall, recirculation, every rack\'s inlet and exhaust, TCS per CDU, FWS and CHW stopping with their fault — 8 plants × every fault × both headers' + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
  }
  {
    /* DH01 CFD: mass and energy close, and the solve agrees with the balance solve where it must —
       normal operation inside the envelope and at its supply/return, a CRAH fault overheating the
       same side; what only a CFD can say (where the recirculation lands) is reported, not gated */
    const bad = [], F = sb.LTCCFD, R = P.compute({}), facts = [];
    for (const f of ['none', 'crah2', 'crah4']) {
      const s = D.solveHall(R, f, 'common', 5, 'throttled'), C = F.run(R, s, { dx: 0.6, steps: 250 }), r = F.report(C);
      const err = Math.abs(r.qCrahKw - r.qRacksKw) / r.qRacksKw;
      if (!(err <= 0.01)) bad.push(`${f}: heat removed ${r.qCrahKw.toFixed(0)} of ${r.qRacksKw.toFixed(0)} kW`);
      if (!(r.residual <= 5e-3)) bad.push(`${f}: mass residual ${r.residual.toExponential(1)}`);
      if (Math.abs(r.ret - s.returnC) > 1 || Math.abs(r.supply - s.supply) > 0.5) bad.push(`${f}: return ${r.ret.toFixed(2)} / supply ${r.supply.toFixed(2)} vs balance ${s.returnC.toFixed(2)} / ${s.supply.toFixed(2)}`);
      if (f === 'none' && (r.over27 || r.maxInlet - s.maxInlet > 0.5)) bad.push(`normal: CFD hottest inlet ${r.maxInlet.toFixed(2)} °C, ${r.over27} racks over 27`);
      if (f !== 'none' && (!r.over27) !== (!s.over27)) bad.push(`${f}: CFD ${r.over27} racks over 27 °C, balance ${s.over27}`);
      if (f !== 'none') {
        const half = (west) => C.racks.filter((x) => (R.hall.racks[x.n].x < R.hall.lengthM / 2) === west), m = (a) => a.reduce((t, x) => t + x.tin, 0) / a.length;
        if (!(m(half(true)) > m(half(false)))) bad.push(`${f}: a west-wall fault does not heat the west half (${m(half(true)).toFixed(2)} vs ${m(half(false)).toFixed(2)})`);
      }
      facts.push(`${f} ${r.maxInlet.toFixed(1)} °C / ${r.over27} racks`);
    }
    {
      /* the containment is whole: the only free faces between a hot aisle and the room are the
         declared leakage openings (a short row blanked, doors and chimney walls closed) */
      const C = F.setup(R, D.solveHall(R, 'none', 'common', 5, 'throttled'), { dx: 0.6 }), { nx, ny, nz } = C, ci = (i, j, k) => i + nx * (j + ny * k), jC = C.jC;
      let open = 0;
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const c = ci(i, j, k); if (C.solid[c]) continue;
        for (const [a, b, d, fx] of [[i + 1, j, k, C.fu[i + 1 + (nx + 1) * (j + ny * k)]], [i, j, k + 1, C.fw[i + nx * (j + ny * (k + 1))]], [i, j + 1, k, j + 1 > jC ? 1 : C.fv[i + nx * (j + 1 + (ny + 1) * k)]]]) {
          if (a >= nx || b >= ny || d >= nz || fx || C.solid[ci(a, b, d)]) continue;
          if (C.hot[c] !== C.hot[ci(a, b, d)]) open++;
        }
      }
      if (open !== C.leaks) bad.push(`containment: ${open} open faces between hot aisles and the room, ${C.leaks} declared`);
    }
    ok('W12y', !bad.length, 'DH01 CFD (0.6 m): containment closed but for its declared leakage openings, heat removed = rack heat within 1 %, mass residual < 5e-3, supply/return within 0.5/1 K of the balance solve, normal operation inside 27 °C, a west-wall CRAH fault heats the west half and puts racks over 27 °C when the balance does (' + facts.join(', ') + ')' + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
  }
  {
    /* DH01 CFD view: the numbers behind the colours are the frame's — vorticity of a known field,
       the probe on cell centres, the texels the GPU ray-marches, trails that never enter a solid —
       and the solver's limited energy scheme invents no temperature outside its sources */
    const bad = [], V3 = sb.LTCCFDView, F = sb.LTCCFD;
    {
      const n = 8, dx = 0.5, Om = 0.7, c0 = n * dx / 2, Fr = { nx: n, ny: n, nz: n, dx, u: new Float32Array((n + 1) * n * n), v: new Float32Array(n * (n + 1) * n), w: new Float32Array(n * n * (n + 1)), T: new Float32Array(n * n * n), Tm: new Float32Array(n * n * n) };
      for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) Fr.u[i + (n + 1) * (j + n * k)] = -Om * ((k + 0.5) * dx - c0);
      for (let k = 0; k <= n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) Fr.w[i + n * (j + n * k)] = Om * ((i + 0.5) * dx - c0);
      for (let c = 0; c < n * n * n; c++) Fr.Tm[c] = 20 + (c % n);
      const om = V3.vorticity(Fr, null), mid = 3 + n * (3 + n * 3);
      if (Math.abs(om[mid] - 2 * Om) > 1e-5) bad.push(`vorticity of a solid-body rotation ${om[mid].toFixed(5)}, expected ${2 * Om}`);
      const q = V3.probe(Fr, null, null, om, 3.5 * dx, 2.5 * dx, 4.5 * dx), q2 = V3.probe(Fr, null, null, om, 4 * dx, 2.5 * dx, 4.5 * dx);
      if (Math.abs(q.T - 23) > 1e-5 || Math.abs(q2.T - 23.5) > 1e-5) bad.push(`probe: ${q.T} at a cell centre (23), ${q2.T} between two (23.5)`);
      Fr.Tm[mid] = 31.5; const S = new Uint8Array(n * n * n), cont = new Uint8Array(n * n * n), slab = new Uint8Array(n * n * n); S[0] = 1; S[1] = 1; slab[1] = 1; cont[2] = 1;
      const D = V3.pack(Fr, 'heat', S, cont, om, slab).data;
      if (D[mid * 4] !== 128 || D[3] !== 0 || D[7] !== 64 || D[11] !== 153 || D[15] !== 255) bad.push(`texels: T ${D[mid * 4]} (128), kinds ${[D[3], D[7], D[11], D[15]]} (0,64,153,255)`);
    }
    const R = P.compute({}), s = D.solveHall(R, 'crah4', 'common', 5, 'throttled'), C = F.setup(R, s, { dx: 0.6 });
    let tmin = s.supply, tmax = s.supply;                    // every temperature a source has carried in
    for (let i = 0; i < 150; i++) { F.step(C, 0.2, 12); tmin = Math.min(tmin, ...C.src); tmax = Math.max(tmax, ...C.src); }
    {
      let lo = Infinity, hi = -Infinity;
      for (let c = 0; c < C.T.length; c++) if (!C.solid[c]) { lo = Math.min(lo, C.T[c]); hi = Math.max(hi, C.T[c]); }
      if (!(lo >= tmin - 0.05 && hi <= tmax + 0.05)) bad.push(`energy: air ${lo.toFixed(2)}…${hi.toFixed(2)} °C outside its sources ${tmin.toFixed(2)}…${tmax.toFixed(2)}`);
    }
    {
      const Fr = { nx: C.nx, ny: C.ny, nz: C.nz, dx: C.dx, T: C.T, Tm: C.T, u: C.u, v: C.v, w: C.w }, K = V3.TRAIL_K, N = 300;
      const V = { cfd: Fr, cfdSolid: C.solid, r: R, s, col: () => ({ r: 1, g: 1, b: 1 }), tp: [], trail: { visible: true, geometry: { attributes: { position: { array: new Float32Array(N * (K - 1) * 6) }, color: { array: new Float32Array(N * (K - 1) * 8) } } } } };
      for (let i = 0; i < N; i++) V.tp.push({ h: new Float32Array(K * 3), c: new Float32Array(K * 3), age: 1e9, life: 1, rec: 0, still: 0 });
      let inSolid = 0, moved = 0;
      for (let t = 0; t < 120; t++) {
        V3.trailStep(V, 0.05);
        for (const q of V.tp) if (q.age < 1e8 && V3.solidAt(Fr, C.solid, q.h[0], q.h[1], q.h[2])) inSolid++;
      }
      for (const q of V.tp) if (Math.hypot(q.h[0] - q.h[3 * (K - 1)], q.h[1] - q.h[3 * (K - 1) + 1], q.h[2] - q.h[3 * (K - 1) + 2]) > 0.05) moved++;
      if (inSolid) bad.push(`trails: ${inSolid} particle positions inside a rack, CDU or slab`);
      if (moved < N * 0.5) bad.push(`trails: only ${moved} of ${N} particles carry a tail`);
    }
    {
      // smoke: a puff released in the room drifts with the flow, spreads, and never sits inside a solid
      const Fr = { nx: C.nx, ny: C.ny, nz: C.nz, dx: C.dx, T: C.T, Tm: C.T, u: C.u, v: C.v, w: C.w }, M = V3.SMOKE_N, arr = (n) => ({ array: new Float32Array(n) });
      const V = { cfd: Fr, cfdSolid: C.solid, col: () => ({ r: 1, g: 1, b: 1 }), renderer: { domElement: { height: 800 } }, cam: { fov: 42 },
        smoke: { visible: true, material: { uniforms: { uScale: { value: 0 } } }, geometry: { attributes: { position: arr(M * 3), aLife: arr(M), color: arr(M * 3) } } }, sp: [], spNext: 0 };
      for (let i = 0; i < M; i++) V.sp.push({ x: 0, y: 0, z: 0, age: 0, life: 0 });
      let c0 = -1; for (let c = 0; c < C.T.length && c0 < 0; c++) { const i = c % C.nx, j = Math.floor(c / C.nx) % C.ny; if (j === 1 && i > C.nx / 3 && !C.solid[c] && !C.hot[c]) c0 = c; }
      const x0 = (c0 % C.nx + 0.5) * C.dx, z0 = (Math.floor(c0 / (C.nx * C.ny)) + 0.5) * C.dx, live = () => V.sp.filter((q) => q.life > 0 && q.age >= 0 && q.age <= q.life);
      V3.smoke(V, x0, 0.9, z0);
      let inSolid = 0;
      for (let t = 0; t < 100; t++) { V3.smokeStep(V, 0.05); for (const q of live()) if (V3.solidAt(Fr, C.solid, q.x, q.y, q.z)) inSolid++; }
      const L = live(), cx = L.reduce((a, q) => a + q.x, 0) / L.length, cz = L.reduce((a, q) => a + q.z, 0) / L.length, sd = Math.sqrt(L.reduce((a, q) => a + (q.x - cx) ** 2 + (q.z - cz) ** 2, 0) / L.length);
      if (inSolid) bad.push(`smoke: ${inSolid} particle positions inside a solid`);
      if (!(L.length > V3.PUFF_N * 0.2 && Math.hypot(cx - x0, cz - z0) > 0.3 && sd > 0.1)) bad.push(`smoke: ${L.length} alive, drifted ${Math.hypot(cx - x0, cz - z0).toFixed(2)} m, spread ${sd.toFixed(2)} m`);
    }
    ok('W12z', !bad.length, 'DH01 CFD view: vorticity of a solid-body rotation = 2Ω, the probe reads cell centres and interpolates between them, volume texels carry temperature and cell kind (solid stops the ray, slab see-through, contained faint), trails never enter a solid and carry tails, a smoke puff drifts with the flow and spreads without entering a solid; the limited energy scheme keeps the air inside its source temperatures' + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
  }
  {
    /* DH01 CFD grid check: the fast 0.6 m solve against the same fault on the 0.3 m grid with the
       second-order schemes (MacCormack momentum + TVD energy), recorded 2026-10-14 from
       LTCCFD.run(dx 0.3, 900 steps of 0.2 s, rack inlets averaged over the last 250): crah4 hottest
       inlet 34.78 °C, 64 racks over 27 °C, 13 over 32 °C. The 0.6 m default must land within 1 K and
       a few racks of it — MacCormack on 0.6 m cells gave 31.9 °C / 82 / 0 and is why it is off there. */
    const F = sb.LTCCFD, R = P.compute({}), s = D.solveHall(R, 'crah4', 'common', 5, 'throttled'), C = F.setup(R, s, { dx: 0.6 }), REF = { max: 34.78, o27: 64, o32: 13 };
    const avg = new Float64Array(C.racks.length); let n = 0;
    for (let i = 1; i <= 600; i++) { F.step(C, 0.2, 12); if (i > 400) { C.racks.forEach((x, k) => { avg[k] += x.tin; }); n++; } }
    const a = Array.from(avg, (x) => x / n), mx = Math.max(...a), o27 = a.filter((t) => t > 27).length, o32 = a.filter((t) => t > 32).length;
    const good = Math.abs(mx - REF.max) <= 1 && Math.abs(o27 - REF.o27) <= 6 && Math.abs(o32 - REF.o32) <= 4;
    {
      /* air-management indices: the formulas on hand-made inlets, then the crah4 solve's own —
         the inlet profile by height averages back to the rack's inlet, and four CRAHs out reads as
         recirculation (RTI over 100 %, SHI up, RCI HI below good) */
      const bad = [], k = 1.2 * 1.006 * 10, mk = (tin, tret) => F.indices({ tsup: 20, tret, racks: tin.map(() => ({ q: k, dem: 1 })) }, tin);
      const a1 = mk([27, 32], 30), a2 = mk([17, 18], 30), a3 = mk([20, 20], 30), a4 = mk([25, 25], 35);
      if (Math.abs(a1.rciHi - 50) > 1e-9 || Math.abs(a2.rciLo - 100 * (1 - 1 / 6)) > 1e-9 || Math.abs(a3.rti - 100) > 1e-9 || a3.shi !== 0 || Math.abs(a4.shi - 1 / 3) > 1e-9 || Math.abs(a4.rti - 150) > 1e-9)
        bad.push(`formulas: RCI HI ${a1.rciHi} (50), RCI LO ${a2.rciLo} (83.3), RTI ${a3.rti} (100) / ${a4.rti} (150), SHI ${a3.shi} (0) / ${a4.shi} (0.333)`);
      const r = F.report(C), x = r.idx, off = r.profile.map((p, i) => Math.abs(p.reduce((u, v) => u + v, 0) / p.length - r.inletMean[i]));
      if (!r.averaged || !(Math.max(...off) <= 0.05)) bad.push(`profile: averaged ${r.averaged}, worst rack ${Math.max(...off).toFixed(3)} K from its inlet`);
      if (!(x.rti > 105 && x.shi > 0.05 && x.rciHi < 96 && x.rciLo === 100)) bad.push(`crah4: RTI ${x.rti.toFixed(0)} %, SHI ${x.shi.toFixed(3)}, RCI HI ${x.rciHi.toFixed(1)} %, RCI LO ${x.rciLo.toFixed(1)} %`);
      // the charts under the stage draw this solve: one dot per rack carrying its index, the RMS they print, three history lines
      const V3 = sb.LTCCFDView, bi = s.racks.map((k) => k.inlet), sv = V3.scatterSvg(r.inletMean, bi, () => [1, 2, 3]), stt = V3.scatterStats(r.inletMean, bi);
      const rms = Math.sqrt(r.inletMean.reduce((u, t, i) => u + (t - bi[i]) ** 2, 0) / bi.length), dots = sv.match(/<circle data-rack="\d+"/g) || [];
      const hv = V3.historySvg([{ t: 1, max: 30, mean: 25, ret: 35 }, { t: 2, max: 31, mean: 26, ret: 36 }], s.maxInlet, 400);
      if (dots.length !== bi.length || !sv.includes('RMS ' + rms.toFixed(1) + ' K') || Math.abs(stt.rms - rms) > 1e-9 || stt.both + stt.onlyCfd !== r.inletMean.filter((t) => t > 27).length || (hv.match(/<path /g) || []).length !== 3 || /NaN|undefined/.test(sv + hv))
        bad.push(`charts: ${dots.length} dots for ${bi.length} racks, RMS ${stt.rms.toFixed(3)} vs ${rms.toFixed(3)}, ${(hv.match(/<path /g) || []).length} history lines`);
      // guided tour: six steps read off this solve, the hottest rack named, the smoke released in room air in front of it
      const tp = V3.tourPlan(R, s, r, { fault: '4 CRAHs lost' }), hi = r.inletMean.indexOf(Math.max(...r.inletMean)), sm = tp.steps.find((q) => q.smoke), Fr2 = { nx: C.nx, ny: C.ny, nz: C.nz, dx: C.dx };
      const smc = sm && C.solid[Math.floor(sm.smoke[0] / C.dx) + C.nx * (Math.floor(sm.smoke[1] / C.dx) + C.ny * Math.floor(sm.smoke[2] / C.dx))];
      if (tp.steps.length !== 6 || tp.rack !== hi || !tp.steps[0].caption.includes(r.inletMean[hi].toFixed(1)) || !sm || smc || V3.solidAt(Fr2, C.solid, ...sm.smoke) || C.hot[Math.floor(sm.smoke[0] / C.dx) + C.nx * (Math.floor(sm.smoke[1] / C.dx) + C.ny * Math.floor(sm.smoke[2] / C.dx))]
          || (() => { const k = R.hall.racks[hi], ai = R.hall.aisles[k.aisle], az = (ai.y0 + ai.y1) / 2, fr = ai.y1 <= k.y + 1e-9 ? k.y : k.y + R.input.rackDepthM; return !(Math.abs(sm.smoke[2] - az) < Math.abs(fr - az)); })()
          || tp.steps.some((q) => /NaN|undefined/.test(q.caption) || q.p.concat(q.t).some((v) => !isFinite(v))))
        bad.push(`tour: ${tp.steps.length} steps, rack ${tp.rack} vs hottest ${hi}, smoke ${sm && sm.smoke.map((v) => v.toFixed(2))}`);
      ok('W12a', !bad.length, `DH01 CFD air management: RCI HI/LO, RTI and SHI match their formulas on hand-made inlets; on crah4 the inlet profile by height averages back to each rack's inlet and the solve reads as recirculation (RTI ${x.rti.toFixed(0)} %, SHI ${x.shi.toFixed(2)}, RCI HI ${x.rciHi.toFixed(0)} %); the charts carry one dot per rack and the RMS they print; the guided tour names the hottest rack and releases its smoke in room air` + (bad.length ? ' — ' + bad.join('; ') : ''));
    }
    ok('W12g', good, `DH01 CFD grid check: the 0.6 m solve (crah4, inlets averaged over 40 s) agrees with the 0.3 m second-order solve — hottest inlet ${mx.toFixed(2)} °C vs ${REF.max}, racks > 27 °C ${o27} vs ${REF.o27}, > 32 °C ${o32} vs ${REF.o32} (within 1 K, 6 and 4 racks)`);
  }
  {
    /* the balance solve against the CFD it is calibrated on (tools/fixtures/dh01-cfd-reference.json):
       per-rack RMS within a quarter kelvin of the fit, the hottest inlet within 1.5 K, racks over 27 °C
       whenever the CFD has them and racks over 32 °C within 4 of its count (the hot tail). The plug-flow march alone gave RMS 1.5–4.4 K and a hottest inlet
       7–10 K high, at the dead units' end of the aisle where the CFD has it where the jets meet. */
    const ref = JSON.parse(readFileSync(join(root, 'tools/fixtures/dh01-cfd-reference.json'), 'utf8')), FIT = { crah2: 0.70, crah4: 1.72, N100: 0.83, N300: 1.02, N37: 0.98 }, bad = [], facts = [];
    for (const c of ref.cases) {
      const s = D.solveHall(P.compute(Object.assign({}, c.preset ? P.PRESETS[c.preset] : {}, c.plant)), c.fault, 'common', 5, 'throttled'), b = s.racks.map((k) => k.inlet), r = c.inlet;
      const rms = b.length === r.length ? Math.sqrt(r.reduce((u, t, i) => u + (t - b[i]) ** 2, 0) / r.length) : NaN, mx = Math.max(...r), o27 = r.filter((t) => t > 27).length, o32 = r.filter((t) => t > 32).length;
      facts.push(`${c.id} RMS ${rms.toFixed(2)} K, hottest ${s.maxInlet.toFixed(1)}/${mx.toFixed(1)}, >27 ${s.over27}/${o27}, >32 ${s.over32}/${o32}`);
      if (!(rms <= FIT[c.id] + 0.25)) bad.push(`${c.id}: RMS ${rms.toFixed(2)} K (fit ${FIT[c.id]})`);
      if (!(Math.abs(s.maxInlet - mx) <= 1.5)) bad.push(`${c.id}: hottest ${s.maxInlet.toFixed(1)} vs CFD ${mx.toFixed(1)} °C`);
      if ((o27 > 0) !== (s.over27 > 0)) bad.push(`${c.id}: ${s.over27} racks over 27 °C, CFD ${o27}`);
      if (!(Math.abs(s.over32 - o32) <= 4)) bad.push(`${c.id}: ${s.over32} racks over 32 °C, CFD ${o32}`);
    }
    ok('W12cal', !bad.length, 'DH01 balance solve against the CFD it is calibrated on: per-rack RMS within 0.25 K of the fit, hottest inlet within 1.5 K, racks over 27 °C when the CFD has them, racks over 32 °C within 4 (' + facts.join('; ') + ')' + (bad.length ? ' — ' + bad.join('; ') : ''));
  }
  {
    /* DH01 CFD fault transient: normal operation for PRE_T seconds, then four CRAHs trip at t = 0. The
       hall starts inside 27 °C, the first rack crosses 27 °C within seconds (fans stop at once in the
       model; real coast-down adds 10–20 s), the solve stays divergence-free across the switch and climbs
       toward the steady four-out reference (W12g: 34.78 °C) rather than overshooting past it. */
    const F = sb.LTCCFD, R = P.compute({}), s0 = D.solveHall(R, 'none', 'common', 5, 'throttled'), s4 = D.solveHall(R, 'crah4', 'common', 5, 'throttled');
    const A = F.setup(R, s0, { dx: 0.6 }); while (A.t < F.PRE_T - 1e-9) F.step(A, 0.2, 12);
    const pre = F.report(A), C = F.faultFrom(F.setup(R, s4, { dx: 0.6 }), A), res0 = C.res, trace = [];
    let carried = 0; for (let c = 0; c < C.T.length; c++) if (!C.solid[c]) carried = Math.max(carried, Math.abs(C.T[c] - A.T[c]));
    let own = null;
    for (let i = 0; i < 200; i++) { F.step(C, 0.2, 12); if (own == null && C.racks.some((k) => k.tin > 27)) own = C.t; if (i % 25 === 24) trace.push(F.report(C).maxInlet); }
    const r = F.report(C), bad = [];
    if (!(pre.maxInlet <= 27)) bad.push(`before the fault the hottest inlet is ${pre.maxInlet.toFixed(2)} °C`);
    if (!(res0 <= 5e-3)) bad.push(`projection after the switch leaves ${res0}`);
    if (!readFileSync(join(root, 'js/ltc-dh01-3d.js'), 'utf8').includes(`${F.PRE_T} s of the no-fault solve`)) bad.push(`the 3D legend does not state PRE_T (${F.PRE_T} s)`);
    if (!(carried === 0)) bad.push(`the fault does not start from the normal field (max |ΔT| ${carried})`);
    if (!(r.transient && r.first27 != null && r.first27 <= 10 && Math.abs(r.first27 - own) < 1e-9)) bad.push(`first rack over 27 °C reported at ${r.first27} s, crossed at ${own} s`);
    if (!(trace[0] < trace[trace.length - 1] && Math.max(...trace) <= 34.78 + 2 && Math.abs(trace[trace.length - 1] - 34.78) <= 2)) bad.push(`hottest inlet over time ${trace.map((x) => x.toFixed(1)).join(' ')}`);
    ok('W12tr', !bad.length, `DH01 CFD fault transient: normal operation (hottest ${pre.maxInlet.toFixed(1)} °C), four CRAHs trip at t = 0, first rack over 27 °C at ${r.first27 != null ? r.first27.toFixed(1) : '—'} s, hottest inlet ${trace.map((x) => x.toFixed(1)).join(' → ')} °C toward the steady 34.8` + (bad.length ? ' — ' + bad.join('; ') : ''));
  }
  ok('W12b', !!(X && X.build && D && D.solveHall), 'the report module and the DH01 solver load without a DOM');
  const plants = [{}, { itMw: 37 }, { cduFeed: 'dual' }, { capturePct: 70, tcsSupplyC: 40 }].concat(Object.keys(P.PRESETS).map((k) => Object.assign({}, P.PRESETS[k])));
  for (const [i, st] of plants.entries()) {
    const R = P.compute(st), id = 'p' + i;
    const F = X.heatFlows(R), L = F.left.reduce((a, n) => a + n[2], 0), Rt = F.right.reduce((a, n) => a + n[2], 0);
    near('W12c:' + id, L, Rt, 0.5, 'heat Sankey: heat into the paths equals heat into the rejection equipment, kW');
    near('W12d:' + id, X.powerItems(R).reduce((a, n) => a + n[1], 0), R.design.facility, 0.5, 'facility power items sum to the engine facility total, kW');
    const ctx = X.context(P, R, st), html = X.build(R, ctx), text = html.replace(/<script[\s\S]*?<\/script>/g, '');
    ok('W12e:' + id, !/NaN|undefined|\[object Object\]|Infinity/.test(text), 'no NaN / undefined / [object Object] in the rendered report');
    const fmt = (v, d) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
    for (const [what, v] of [['design PUE', fmt(R.totals.pue, 3)], ['annual PUE', fmt(R.totals.pueAnnual, 3)], ['M0 MWh', fmt(R.annual.m0MWh, 0)], ['PUE cat 1', fmt(R.annual.pue1, 3)],
                             ['CUE', fmt(R.annual.cue, 3)], ['trim hours', fmt(R.totals.trimHours, 0) + ' h']])
      ok(`W12f:${id}:${what}`, text.includes(v), `the report states the engine's ${what} (${v})`);
    ok('W12g:' + id, R.totals.bins.every((b) => text.includes(fmt(b.pue, 3))), 'every climate bin PUE is in the report');
    ok('W12h:' + id, Object.values(R.trace).every((t) => text.includes(t.label.replace(/&/g, '&amp;'))) && Object.keys(R.input).every((k) => text.includes('<code>' + k + '</code>')),
       'every calculation trace and every engine input is in the report');
    ok('W12i:' + id, ctx.faults.length === D.FAULTS.length && ctx.faults.every((x) => text.includes(x.label)) && (text.match(/<figure class="plan">/g) || []).length === D.FAULTS.length,
       'DH01 is drawn and tabulated under every fault the workbench models');
    const tv = (sys, t) => ctx.tier.find((x) => x.system === sys && x.tier === t);
    ok('W12m:' + id, ctx.tier && ctx.tier.length === 8 && ['power', 'cooling'].every((sys) => !tv(sys, 1).maint && !tv(sys, 2).maint && tv(sys, 3).maint && !tv(sys, 3).fault && tv(sys, 4).maint && tv(sys, 4).fault)
       && text.includes('Tier topology') && sb.LTCTier.system() === 'power',
       'the report carries the Tier sweep for power and cooling, each Tier reaching its own objective, and leaves the page on the system it was showing');
    const O = ctx.options, cur = (l) => l.filter((o) => o.current), same = (o) => Math.abs(o.pue - R.annual.pue3) < 1e-9 && Math.abs(o.cost - R.annual.energyCost - R.annual.waterCost) < 1e-6;
    ok('W12o:' + id, O && O.presets.length === 4 && cur(O.presets).length === 1 && same(cur(O.presets)[0]) && cur(O.climates).length === 1 && same(cur(O.climates)[0])
       && new Set(O.climates.map((o) => o.pue.toFixed(6))).size === O.climates.length && O.sens.every((s) => s.lo.v <= s.base && s.hi.v >= s.base && s.lo.v < s.hi.v)
       && text.includes('Options &amp; sensitivity') && O.presets.every((o) => text.includes(o.label)),
       'options: every configuration and climate re-solved (this plant\'s row equals the result, each climate differs), every sensitivity step brackets the input');
    const H = ctx.hlt, s100 = H.steps[3], hf = (fid) => H.fails.find((x) => x.id === fid);
    ok('W12q:' + id, H.steps.length === 4 && Math.abs(H.liquidKw + H.airKw - R.it.hallKw) < 1e-6 && Math.abs(H.liquidKw - R.it.hallKw * R.input.capturePct / 100) < 1e-6
       && Math.abs(s100.dT - H.steps[0].dT * 4) < 1e-9 && Math.abs(s100.dT - R.liquid.tcsDeltaK) / R.liquid.tcsDeltaK < 0.02 && Math.abs(s100.returnC - R.input.tcsSupplyC - s100.dT) < 1e-9
       && hf('cdu').pass === (R.input.cduRedundancy > 0) && hf('crah1').pass === (R.input.crahRedundancy > 0) && hf('cdu-feeder').pass === (R.input.cduFeed === 'dual')
       && text.includes('Heat load test plan') && text.includes(Number(s100.liquidKw).toLocaleString('en-US', { maximumFractionDigits: 0 })),
       'HLT plan: load banks split the hall load by capture, ΔT scales with load and reaches the design ΔT at 100 %, each single failure holds exactly when the design has the redundancy (CDU N+1, CRAH N+1, dual CDU feed)');
    ok('W12u:' + id, ctx.fit && text.includes('This plant, as configured, against each Tier') && ctx.fit.rows.every((x) => text.includes(x.req.replace(/&/g, '&amp;'))),
       'the report carries this plant against each Tier, every requirement listed');
    ok('W12w:' + id, text.includes('Sequence of events') && ctx.faults.every((x) => x.soe.every((e) => text.includes(e.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')))),
       'the report carries the sequence of events for every fault');
    ok('W12j:' + id, ctx.transients.length === 4 && ctx.transients.every((t) => t.series.length > 2), 'four transients, each with a time series');
    const data = JSON.parse(html.match(/<script type="application\/json" id="rz-data">([\s\S]*?)<\/script>/)[1]);
    ok('W12k:' + id, data.result.totals.pueAnnual === R.totals.pueAnnual && data.result.design.facility === R.design.facility, 'the embedded data is the engine result itself');
    const csv = X.csv(R).trim().split('\n');
    ok('W12l:' + id, csv[0] === 'key,value' && csv.length > 500 && csv.includes('totals.pueAnnual,' + R.totals.pueAnnual), `CSV carries every scalar of the result (${csv.length} rows)`);
  }
}

{
  /* W13 (v3.20.1) — every plant diagram holds on every plant, not only the 100 MW default the
   * other gates draw. The report's first sweep found the hub's liquid-heat arrow label unplaced on
   * 102 of 240 plant/view pairs (any label longer than "85 MW" did not fit the 40 px column gap)
   * and, on phones, "Engine generators" and the cooler block overflowing — each a console error
   * on the live page that no gate looked at. */
  const sb = { console: { log() {}, error() { sb.errs.push([...arguments].join(' ')); } }, Math, JSON, Date, errs: [], localStorage: { getItem() { return null; }, setItem() {} } };
  sb.window = sb; sb.globalThis = sb; sb.addEventListener = () => {};
  sb.document = { readyState: 'loading', addEventListener() {}, documentElement: { getAttribute() { return null; } } };
  vm.createContext(sb);
  for (const f of ['js/rz-eng-symbols.js', 'js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js', 'js/rz-diagram.js', 'js/ltc-app.js', 'js/ltc-plant.js', 'js/ltc-hub.js', 'js/ltc-lab-plant.js'])
    vm.runInContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
  const P = sb.LTCPlant, plants = [];
  for (const it of [5, 7, 10, 15, 20, 37, 50, 75, 100, 150, 200, 250, 300]) for (const cap of [50, 70, 85, 98]) plants.push({ itMw: it, capturePct: cap });
  for (const k of Object.keys(P.PRESETS)) plants.push(Object.assign({ itMw: 300 }, P.PRESETS[k]), Object.assign({ itMw: 5 }, P.PRESETS[k]));
  // the options table and tornado apply configurations, climates and TCS steps: a cold TCS needs 100+ coolers
  for (const k of Object.keys(P.PRESETS)) for (const it of [100, 300]) for (const tcs of [28, 32, 45]) for (const climate of Object.keys(P.CLIMATES))
    plants.push(Object.assign({ itMw: it, tcsSupplyC: tcs, tcsReturnC: tcs + 10, climate }, P.PRESETS[k]));
  const bad = {};
  let n = 0;
  for (const st of plants) {
    const r = P.compute(st);
    for (const narrow of [false, true]) {
      for (const v of sb.LTCHub.views()) {
        n++;
        const x = sb.LTCHub.svg(v.id, r, narrow);
        for (const w of x.why) bad[`hub ${v.id}${narrow ? ' (phone)' : ''}: ${w.replace(/[\d.,]+/g, '#')}`] = JSON.stringify(st);
      }
      sb.errs = []; n++;
      sb.LTCLabPlant.overview({ clientWidth: narrow ? 390 : 1000, __traced: true, set innerHTML(v) {}, querySelector() { return null; } }, r);
      for (const e of sb.errs) bad[`lab overview${narrow ? ' (phone)' : ''}: ${e.replace(/[\d.,]+/g, '#')}`] = JSON.stringify(st);
    }
  }
  const kinds = Object.keys(bad);
  ok('W13', kinds.length === 0, `${n} diagrams over ${plants.length} plants; engine warnings:\n    ` + kinds.map((k) => k + '  e.g. ' + bad[k]).join('\n    '));
}

const total = pass + fails.length;
if (fails.length) {
  console.log(`FAIL LTC workbench — ${fails.length} of ${total} assertions failed\n`);
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log(`PASS LTC workbench — ${pass}/${total} assertions (ASHRAE · Tier · NFPA 2001 · TIA · ISO 30134/50006 · page frame)`);
