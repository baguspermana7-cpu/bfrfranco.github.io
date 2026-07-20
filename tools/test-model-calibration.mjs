/* MODEL-CALIBRATION GATE (Arc-1, 2026-07-20) — validates engine constants against
 * the LIVE public-data corpus distributions, per DATA.calibrationSpec (single
 * source shared with the DCMOC "Model Calibration" UI). Severity 'fail' mappings
 * exit 1 when out of band; 'warn' mappings print but never fail (small-n honesty).
 * POLICY: corpus regen may flip a verdict — that is a REPORTED finding
 * (CHANGELOG), bands are never silently loosened. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const DIR = dirname(fileURLToPath(import.meta.url));
const win = {}; win.window = win;
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
win.CustomEvent = function () {}; win.dispatchEvent = function () {}; win.addEventListener = function () {}; win.removeEventListener = function () {}; win.console = console;
vm.runInContext(readFileSync(join(DIR, '..', 'rz-engine.js'), 'utf8'), vm.createContext(win));
const D = win.RZEngine.data;
const CORPUS = D.benchmarksCorpus ?? {};
const SPEC = D.calibrationSpec;

let pass = 0, fail = 0, warns = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`); }
    else { fail++; fails.push(name + (detail ? ' — ' + detail : '')); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
function warn(name, condOk, detail) {
    if (condOk) console.log(`  ✔ (warn-tier) ${name}${detail ? ' — ' + detail : ''}`);
    else { warns++; console.log(`  ⚠ WARN ${name}${detail ? ' — ' + detail : ''}`); }
}

/* piecewise percentile interpolation — port of dcmoc pctileOf (single algorithm) */
function pctileOf(v, d) {
    const pts = [[10, d.p10], [25, d.p25], [50, d.p50], [75, d.p75], [90, d.p90]];
    if (v < pts[0][1]) return 10;
    if (v > pts[4][1]) return 90;
    for (let i = 0; i < 4; i++) {
        const [pa, va] = pts[i], [pb, vb] = pts[i + 1];
        if (v <= vb) return vb === va ? pb : pa + (pb - pa) * ((v - va) / (vb - va));
    }
    return 90;
}
/* pooled min/max of a percentile key across segments (conservative envelope) */
const segLow = (metric, segs, key) => Math.min(...segs.map((s) => CORPUS[metric]?.[s]?.[key]).filter(Number.isFinite));
const segHigh = (metric, segs, key) => Math.max(...segs.map((s) => CORPUS[metric]?.[s]?.[key]).filter(Number.isFinite));

console.log('MODEL-CALIBRATION GATE — engine constants vs live corpus\n');

/* ── structural asserts ── */
ok('calibrationSpec present', !!SPEC && Array.isArray(SPEC.mappings));
ok('4 mappings + notMappable list', SPEC.mappings.length === 4 && SPEC.notMappable.length >= 4);
for (const m of SPEC.mappings) {
    ok(`mapping ${m.id}: limitation non-empty`, typeof m.limitation === 'string' && m.limitation.length > 20);
    ok(`mapping ${m.id}: severity valid`, m.severity === 'fail' || m.severity === 'warn');
}

/* ── mapping 1: PUE design vs fleet (FAIL tier) ── */
{
    const m = SPEC.mappings.find((x) => x.id === 'pue.design.vs.fleet');
    const lo = segLow('pue', m.rule.pooledLow, 'p10');
    const hi = segHigh('pue', m.rule.pooledHigh, 'p90');
    ok('pue corpus envelope resolves', Number.isFinite(lo) && Number.isFinite(hi), `[${lo}, ${hi}]`);
    for (const cooling of ['liquid', 'rdhx', 'inrow', 'air']) {
        const v = D.pueMatrix[cooling]?.tier3;
        ok(`pue band: ${cooling} tier3 ${v} ∈ [${lo}, ${hi}]`, v >= lo && v <= hi);
    }
    const bd = m.rule.bestDesign;
    const cap = CORPUS.pue?.[bd.mustBeAtOrBelow.segment]?.[bd.mustBeAtOrBelow.pctile];
    const best = D.pueMatrix[bd.cooling]?.[bd.tier];
    ok(`pue sharp rule: best design ${bd.cooling}.${bd.tier} ${best} ≤ fleet ${bd.mustBeAtOrBelow.segment} ${bd.mustBeAtOrBelow.pctile} ${cap}`, best <= cap);
    /* percentile positions (informational) */
    for (const cooling of ['liquid', 'air']) {
        const v = D.pueMatrix[cooling]?.tier3;
        const dist = CORPUS.pue?.hyperscale;
        if (dist) console.log(`    · ${cooling} t3 ${v} ≈ p${Math.round(pctileOf(v, dist))} of hyperscale fleet (n=${dist.n})`);
    }
}

/* ── mapping 2: CAPEX aggregate ratio (FAIL tier) ── */
{
    const m = SPEC.mappings.find((x) => x.id === 'capex.aggregate.ratio');
    const enginePerMw = D.capexPerMw[m.rule.engineKey];
    ok('capexPerMw engine key resolves', Number.isFinite(enginePerMw), m.rule.engineKey);
    for (const seg of m.rule.segments) {
        const inv = CORPUS.investment_busd?.[seg], cap = CORPUS.capacity_mw?.[seg];
        if (!inv || !cap) { ok(`capex segment ${seg} present`, false); continue; }
        if (inv.n < m.rule.nFloor) { warn(`capex segment ${seg}: n=${inv.n} < floor ${m.rule.nFloor}`, false, 'skipped from FAIL tier'); continue; }
        const corpusPerMw = (inv.p50 * 1e9) / cap.p50; // USD per MW (total-project scope)
        const r = corpusPerMw / enginePerMw;
        ok(`capex ratio ${seg}: corpus $${(corpusPerMw / 1e6).toFixed(1)}M/MW ÷ engine $${(enginePerMw / 1e6).toFixed(1)}M/MW = ${r.toFixed(2)} ∈ [${m.rule.ratioLow}, ${m.rule.ratioHigh}]`,
            r >= m.rule.ratioLow && r <= m.rule.ratioHigh);
    }
}

/* ── mapping 3: WUE binned (WARN tier) ── */
{
    const m = SPEC.mappings.find((x) => x.id === 'wue.binned');
    const dist = CORPUS.wue?.[m.rule.segment];
    if (!dist) warn('wue distribution present', false, 'missing segment');
    else {
        const hv = D.waterFootprint?.wueBase?.[m.rule.highType];
        const p50 = dist[m.rule.highBand[0]], p90 = dist[m.rule.highBand[1]];
        warn(`wue high-bin: engine ${m.rule.highType} ${hv} ∈ [${p50}, ${p90}] (n=${dist.n} — indicative)`, hv >= p50 && hv <= p90);
        const ceil = dist[m.rule.lowCeilPctile];
        for (const t of m.rule.lowTypes) {
            const lv = D.waterFootprint?.wueBase?.[t];
            warn(`wue low-bin: engine ${t} ${lv} ≤ ${m.rule.lowCeilPctile} ${ceil}`, lv <= ceil);
        }
    }
}

/* ── mapping 4: energy↔capacity coherence (WARN tier) ── */
{
    const m = SPEC.mappings.find((x) => x.id === 'energy.capacity.coherence');
    for (const seg of m.rule.segments) {
        const e = CORPUS.energy_gwh?.[seg], c = CORPUS.capacity_mw?.[seg];
        if (!e || !c) { warn(`coherence segment ${seg} present`, false); continue; }
        const cf = (e.p50 * 1000) / (c.p50 * 8760); // MWh ÷ (MW×h)
        warn(`coherence ${seg}: implied capacity factor ${(cf * 100).toFixed(1)}% ∈ (${m.rule.cfLow * 100}%, ${m.rule.cfHigh * 100}%)`, cf > m.rule.cfLow && cf <= m.rule.cfHigh,
            'disclosure campuran pipeline vs operasi — CF rendah wajar');
    }
}

console.log(`\nCALIBRATION GATE — ${pass} passed, ${fail} failed, ${warns} warn`);
if (fail) {
    console.log('\nFAILURES (drift = temuan; laporkan di CHANGELOG, JANGAN longgarkan band diam-diam):');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
}
console.log('ALL GREEN — engine constants in-band vs live corpus (aggregate-only validation).');
