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
}

const total = pass + fails.length;
if (fails.length) {
  console.log(`FAIL LTC workbench — ${fails.length} of ${total} assertions failed\n`);
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log(`PASS LTC workbench — ${pass}/${total} assertions (ASHRAE · Tier · NFPA 2001 · TIA · ISO 30134/50006 · page frame)`);
