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
 *   W13 every hub view and the lab overview, desktop and phone, on 60 plants: zero diagram-engine warnings
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
  for (const f of ['js/ltc-plant.js', 'js/ltc-dh01.js', 'js/ltc-tier.js', 'js/ltc-report.js']) vm.runInContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
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
