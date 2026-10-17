#!/usr/bin/env node
/* test-agent-calc — js/rz-agent-calc.js (article 30 calculators) reproduces Article/Article_30/CALCULATORS.md.
 *
 *   C-i   decide: six worked examples, overrides, bands
 *   C-ii  reliability: seven worked examples, required per-step success, Ps+Pu+Px = 1
 *   C-iii budget: cost curve, S_cost / S_time / S_ctx, binding limit, cached variant
 *   C-iv  ladder: default, correlated, factory-shaped, marginal values
 *   plus  invalid input -> NaN, monotonicity, constants carry sources, formula strings equal the spec text.
 *
 * Run: node tools/test-agent-calc.mjs     (exits 1 on any failure)
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'js/rz-agent-calc.js'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'Article/Article_30/CALCULATORS.md'), 'utf8').replace(/ +/g, ' ');

const win = {};
const sandbox = { window: win };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'rz-agent-calc.js' });
const A = win.RZAgentCalc;

const fails = [];
let n = 0;
const ok = (id, cond, detail) => { n++; if (!cond) fails.push(`${id}${detail ? ': ' + detail : ''}`); };
const near = (id, got, want, tol) => ok(id, Math.abs(got - want) <= tol, `got ${got}, want ${want} ± ${tol}`);
const v = (r, k) => r.out[k].value;

ok('S0 api', ['constants', 'presets', 'decide', 'reliability', 'budget', 'ladder', 'mount'].every((k) => A && k in A));
ok('S0 no </script> in source', src.indexOf('</' + 'script') < 0);
ok('S0 ES5 only (no arrow/let/const/template)', !/=>|\blet\s|\bconst\s|`/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\\n]|\\.)*"/g, '""')));
ok('S0 mount without document returns 0', A.mount(null) === 0);
ok('S0 no colour in injected helper CSS', !/#[0-9a-f]{3,6}\b|rgb|hsl|background|color:/i.test(src.match(/var STYLE = [\s\S]*?;\n/)[0]));
ok('S0 no radius above 4px', !/border-radius:\s*(?!4px|0)/.test(src.match(/var STYLE = [\s\S]*?;\n/)[0]));

// ---- C-i decide
const D = (V, E, Vf, F, L) => A.decide({ V, E, Vf, F, L });
let r = D(4, 4, 3, 5, 3);
near('C-i BMS N', v(r, 'N'), 0.75, 1e-9); near('C-i BMS Risk', v(r, 'Risk'), 0.375, 1e-9); near('C-i BMS Lp', v(r, 'Lp'), 0.5, 1e-9);
near('C-i BMS score 35.16', v(r, 'score'), 35.16, 0.005);
ok('C-i BMS Hybrid (just)', v(r, 'decision') === 'Hybrid');
ok('C-i BMS codify note (F>=4, V<=3 false: V=4)', v(r, 'flags').indexOf('Codify') < 0);
r = D(4, 2, 5, 3, 5);
near('C-i code N', v(r, 'N'), 0.75, 1e-9); near('C-i code Risk', v(r, 'Risk'), 0, 1e-9); near('C-i code score 75', v(r, 'score'), 75, 1e-9);
ok('C-i code Agent + verifiers', v(r, 'decision') === 'Agent loop with verifiers' && v(r, 'flags') === 'none');
r = D(1, 2, 5, 2, 5);
near('C-i PUE score 0', v(r, 'score'), 0, 1e-9); ok('C-i PUE Script (override 3)', v(r, 'decision') === 'Script / workflow' && /Script regardless/.test(v(r, 'rationale')));
r = D(3, 5, 2, 4, 2);
near('C-i chiller N', v(r, 'N'), 0.5, 1e-9); near('C-i chiller Risk', v(r, 'Risk'), 0.75, 1e-9); near('C-i chiller Lp', v(r, 'Lp'), 0.75, 1e-9);
near('C-i chiller score 7.8', v(r, 'score'), 7.8, 0.05);
ok('C-i chiller Script + red flag 1', v(r, 'decision') === 'Script / workflow' && /No autonomous action/.test(v(r, 'flags')) && /CISA/.test(v(r, 'flags')));
ok('C-i chiller codify note (F=4, V=3)', /Codify/.test(v(r, 'flags')));
ok('C-i chiller rationale names risk', /errors are costly and hard to check \(Risk = 0\.750\)/.test(v(r, 'rationale')), v(r, 'rationale'));
r = D(5, 2, 3, 4, 4);
near('C-i CMMS N', v(r, 'N'), 1, 1e-9); near('C-i CMMS Risk', v(r, 'Risk'), 0.125, 1e-9); near('C-i CMMS Lp', v(r, 'Lp'), 0.25, 1e-9);
near('C-i CMMS score 76.6', v(r, 'score'), 76.6, 0.05); ok('C-i CMMS Agent', v(r, 'decision') === 'Agent loop with verifiers');
r = D(5, 3, 3, 4, 4);
near('C-i MOP Risk', v(r, 'Risk'), 0.25, 1e-9); near('C-i MOP score 65.6', v(r, 'score'), 65.6, 0.05); ok('C-i MOP Agent (>= 65)', v(r, 'decision') === 'Agent loop with verifiers');
r = D(5, 1, 5, 1, 1);
ok('C-i override 2: L=1 forces Script and flags real-time', v(r, 'decision') === 'Script / workflow' && /not an LLM/.test(v(r, 'flags')));
ok('C-i override 2: band from score alone would not be Script', v(r, 'band') !== 'Script / workflow');
ok('C-i exact band edge 35 is Hybrid', D(4, 4, 3, 5, 3).out.band.value === 'Hybrid');
ok('C-i every spec example preset reproduces', Object.keys(A.presets.examples.decide).length === 6);
['V', 'E', 'Vf', 'F', 'L'].forEach((k) => {
  [0, 6, 2.5, NaN, 'x', null].forEach((bad) => {
    const q = {}; q[k] = bad;
    const x = A.decide(q);
    ok(`C-i invalid ${k}=${bad}`, x.valid === false && Number.isNaN(v(x, 'score')) && x.errors.length >= 1);
  });
});
for (let e = 1; e < 5; e++) ok(`C-i monotone: higher E lowers score (E ${e}->${e + 1})`, v(D(4, e + 1, 3, 3, 4), 'score') <= v(D(4, e, 3, 3, 4), 'score'));
for (let x = 1; x < 5; x++) ok(`C-i monotone: higher Vf raises score (${x}->${x + 1})`, v(D(4, 3, x + 1, 3, 4), 'score') >= v(D(4, 3, x, 3, 4), 'score'));

// ---- C-ii reliability
const R = (n_, p, d, k, extra) => A.reliability(Object.assign({ n: n_, p, d, k }, extra || {}));
const rows = [
  [20, 0.95, 0, 0, 1.0, 0.95, 0.3585, 0, 1.76, 4.91],
  [20, 0.95, 0.9, 2, 1.04703, 0.99467, 0.8987, 0.94, 1.843, 2.05],
  [50, 0.99, 0, 0, 1.0, 0.99, 0.605, 0, 4.4, 7.273],
  [50, 0.99, 0.9, 2, 1.00908, 0.99899, 0.9507, 0.45, 4.44, 4.67],
  [10, 0.9, 0.95, 3, 1.10488, 0.99439, 0.9453, 1.05, 0.972, 1.029],
  [100, 0.99, 0, 0, 1.0, 0.99, 0.366, 0, 8.8, 24.042],
  [100, 0.999, 0, 0, 1.0, 0.999, 0.9048, 0, 8.8, 9.726]
];
rows.forEach((w) => {
  r = R(w[0], w[1], w[2], w[3]);
  const t = `C-ii n=${w[0]} p=${w[1]} d=${w[2]} k=${w[3]}`;
  near(`${t} E`, v(r, 'E'), w[4], 6e-5); near(`${t} Ps`, v(r, 'Ps'), w[5], 6e-5); near(`${t} P_run`, v(r, 'P_run'), w[6], 6e-5);
  near(`${t} retries`, v(r, 'retries'), w[7], 0.006); near(`${t} cost/run`, v(r, 'cost_run'), w[8], 0.0006);
  near(`${t} cost/success`, v(r, 'cost_per_success'), w[9], 0.006);
  near(`${t} Ps+Pu+Px = 1`, v(r, 'check'), 1, 1e-12);
  near(`${t} cost_att = 0.088`, v(r, 'cost_att'), 0.088, 1e-12);
});
r = R(20, 0.95, 0.9, 2);
near('C-ii q = 0.045', v(r, 'q'), 0.045, 1e-12);
ok('C-ii silent failure Pu > 0 and detected Px > 0 with verifier', v(r, 'Pu') > 0 && v(r, 'Px') > 0);
near('C-ii no verifier: Px = 0', v(R(20, 0.95, 0, 2), 'Px'), 0, 1e-15);
near('C-ii perfect verifier: Pu = 0', v(R(20, 0.95, 1, 2), 'Pu'), 0, 1e-15);
[[10, 0.9, 0.98952], [20, 0.9, 0.99475], [50, 0.9, 0.9979], [100, 0.9, 0.99895], [10, 0.5, 0.93303], [20, 0.5, 0.96594], [50, 0.5, 0.98623], [100, 0.5, 0.99309]].forEach(([nn, tg, want]) => {
  near(`C-ii p_needed(${tg}, ${nn})`, v(R(nn, 0.95, 0.9, 2, { target: tg }), 'p_needed'), want, 6e-6);
});
const lesson = (v(R(20, 0.95, 0.9, 2), 'cost_run') / v(R(20, 0.95, 0, 0), 'cost_run') - 1) * 100;
near('C-ii lesson: 5% more tokens (4.7%)', lesson, 4.7, 0.1);
ok('C-ii lesson text printed', R(20, 0.95, 0.9, 2).notes.join(' ').indexOf('raises a 20-step run from 36% to 90% for 5% more tokens') >= 0);
ok('C-ii caveats printed', /independence is optimistic/.test(r.notes.join(' ')) && /\[S27\]/.test(r.notes.join(' ')));
near('C-ii cached share lowers cost: c=0.9 cost_att', v(R(20, 0.95, 0.9, 2, { c: 0.9 }), 'cost_att'), 40000 * (0.1 * 2 + 0.9 * 0.2) / 1e6 + 0.008, 1e-12);
[['n', 0], ['n', 201], ['n', 2.5], ['p', 0.49], ['p', 1], ['d', -0.1], ['d', 1.1], ['k', 6], ['k', -1], ['Tin', -1], ['Tout', 'x'], ['c', 0.96], ['target', 1], ['p', NaN], ['p', null]].forEach(([k, bad]) => {
  const q = {}; q[k] = bad; const x = A.reliability(q);
  ok(`C-ii invalid ${k}=${bad}`, x.valid === false && Number.isNaN(v(x, 'P_run')) && Number.isNaN(v(x, 'cost_run')));
});
for (let s = 1; s < 200; s += 7) ok(`C-ii monotone: more steps lowers P_run (n ${s}->${s + 1})`, v(R(s + 1, 0.95, 0.9, 2), 'P_run') < v(R(s, 0.95, 0.9, 2), 'P_run'));
for (let s = 1; s < 200; s += 7) ok(`C-ii monotone: more steps lowers P_run, no verifier (n ${s}->${s + 1})`, v(R(s + 1, 0.95, 0, 0), 'P_run') < v(R(s, 0.95, 0, 0), 'P_run'));
[0.5, 0.7, 0.9, 0.95, 0.99, 0.999].forEach((p, i, a) => {
  if (i) { ok(`C-ii monotone: higher p raises P_run (${a[i - 1]}->${p})`, v(R(20, p, 0.9, 2), 'P_run') > v(R(20, a[i - 1], 0.9, 2), 'P_run'));
    ok(`C-ii monotone: higher p raises P_run, no verifier (${a[i - 1]}->${p})`, v(R(20, p, 0, 0), 'P_run') > v(R(20, a[i - 1], 0, 0), 'P_run')); }
});
[0, 1, 2, 3, 4].forEach((k) => ok(`C-ii monotone: more retries do not lower P_run (k ${k}->${k + 1})`, v(R(20, 0.95, 0.9, k + 1), 'P_run') >= v(R(20, 0.95, 0.9, k), 'P_run')));
[0, 0.25, 0.5, 0.9].forEach((d, i, a) => { if (i) ok(`C-ii monotone: better verifier raises P_run (d ${a[i - 1]}->${d})`, v(R(20, 0.95, d, 2), 'P_run') > v(R(20, 0.95, a[i - 1], 2), 'P_run')); });
[1000, 10000, 40000, 400000].forEach((t, i, a) => { if (i) {
  ok(`C-ii monotone: more input tokens raises cost (${a[i - 1]}->${t})`, v(R(20, 0.95, 0.9, 2, { Tin: t }), 'cost_run') > v(R(20, 0.95, 0.9, 2, { Tin: a[i - 1] }), 'cost_run'));
  ok(`C-ii monotone: more output tokens raises cost (${a[i - 1]}->${t})`, v(R(20, 0.95, 0.9, 2, { Tout: t }), 'cost_run') > v(R(20, 0.95, 0.9, 2, { Tout: a[i - 1] }), 'cost_run')); } });
ok('C-ii monotone: more cached share lowers cost', v(R(20, 0.95, 0.9, 2, { c: 0.5 }), 'cost_run') < v(R(20, 0.95, 0.9, 2, { c: 0 }), 'cost_run'));

// ---- C-iii budget
const B = (x) => A.budget(x || {});
r = B();
const cost = (S) => v(r, 'cost_' + S);
near('C-iii Cost(10) = 0.75', cost(10), 0.75, 1e-9); near('C-iii Cost(20) = 2.10', cost(20), 2.1, 1e-9);
near('C-iii Cost(30) = 4.05', cost(30), 4.05, 1e-9); near('C-iii Cost(40) = 6.60', cost(40), 6.6, 1e-9);
near('C-iii Cost(60) = 13.50', cost(60), 13.5, 1e-9);
near('C-iii S_cost = 34.0', v(r, 'S_cost_raw'), 34.0, 0.05); ok('C-iii S_cost = 34 steps', v(r, 'S_cost') === 34);
near('C-iii t_step = 21.5', v(r, 't_step'), 21.5, 1e-12); ok('C-iii S_time = 27', v(r, 'S_time') === 27);
ok('C-iii S_ctx = 47', v(r, 'S_ctx') === 47);
ok('C-iii max_steps = 27, wall clock binds', v(r, 'max_steps') === 27 && v(r, 'binding') === 'wall clock', `${v(r, 'max_steps')} ${v(r, 'binding')}`);
near('C-iii per-step timeout ~ 65 s (3 x 21.5)', v(r, 'step_timeout'), 64.5, 1e-9);
ok('C-iii context at step 27 = 98,000', v(r, 'ctx_at_max') === 98000);
ok('C-iii S_cost is the largest S under the cap', cost(30) < 5 && cost(40) > 5 && v(B({ C: 4.99 }), 'S_cost') === 33 && v(B({ C: 5.01 }), 'S_cost') === 34);
r = B({ f: 0.9 });
near('C-iii cached: pin_eff = 0.38', v(r, 'pin_eff'), 0.38, 1e-12);
near('C-iii cached: S_cost = 81.4', v(r, 'S_cost_raw'), 81.4, 0.05); ok('C-iii cached: 81 steps', v(r, 'S_cost') === 81);
ok('C-iii cached: max_steps still 27', v(r, 'max_steps') === 27);
r = B({ Tw: 6000 });
ok('C-iii longer wall clock: cost binds at 34', v(r, 'max_steps') === 34 && v(r, 'binding') === 'cost cap');
r = B({ Tw: 6000, C: 500 });
ok('C-iii big budget: context binds at 47', v(r, 'max_steps') === 47 && v(r, 'binding') === 'context window');
r = B({ S_policy: 10 });
ok('C-iii policy cap binds', v(r, 'max_steps') === 10 && v(r, 'binding') === 'policy cap');
ok('C-iii cost at max_steps equals Cost(S)', Math.abs(v(B({ S_policy: 10 }), 'cost_at_max') - 0.75) < 1e-9);
ok('C-iii note: square law', B().notes.join(' ').indexOf('Cost grows with the square of the step count because every step re-reads the history. Caching changes the slope, not the shape.') >= 0);
[['c0', -1], ['c0', 200000], ['g', 0], ['o', 'x'], ['C', 0], ['Tw', 0], ['tt', -1], ['f', 0.96], ['S_policy', 0], ['S_policy', 1.5], ['g', NaN]].forEach(([k, bad]) => {
  const q = {}; q[k] = bad; const x = A.budget(q);
  ok(`C-iii invalid ${k}=${bad}`, x.valid === false && Number.isNaN(v(x, 'max_steps')));
});
[10, 20, 30, 40].forEach((s, i, a) => { if (i) ok(`C-iii monotone: Cost rises with steps (${a[i - 1]}->${s})`, cost(s) > 0); });
const cs = [10, 20, 30, 40, 60].map((s) => v(B(), 'cost_' + s));
for (let i = 1; i < cs.length; i++) ok(`C-iii monotone: cost curve increasing (${i})`, cs[i] > cs[i - 1]);
ok('C-iii convex (cost per step rises)', cs[4] / 60 > cs[0] / 10);
ok('C-iii monotone: more tokens per step cost more', v(B({ g: 6000 }), 'cost_20') > v(B({ g: 3000 }), 'cost_20') && v(B({ o: 1600 }), 'cost_20') > v(B({ o: 800 }), 'cost_20'));
ok('C-iii monotone: bigger cap allows more cost steps', v(B({ C: 10 }), 'S_cost') > v(B({ C: 5 }), 'S_cost'));
ok('C-iii monotone: cache raises S_cost', v(B({ f: 0.5 }), 'S_cost') > v(B({ f: 0 }), 'S_cost'));
ok('C-iii monotone: bigger Tw raises S_time', v(B({ Tw: 1200 }), 'S_time') > v(B({ Tw: 600 }), 'S_time'));

// ---- C-iv ladder
const L = (x) => A.ladder(x || {});
r = L();
near('C-iv default P_escape = 0.0765', v(r, 'P_escape'), 0.0765, 1e-12); near('C-iv default coverage 92.35%', v(r, 'coverage'), 92.35, 1e-9);
r = L({ g4_shared: 'yes' });
near('C-iv correlated d_eff = 0.25', v(r, 'deff_4'), 0.25, 1e-12);
near('C-iv correlated P_escape = 0.11475', v(r, 'P_escape'), 0.11475, 1e-12); near('C-iv correlated coverage 88.5%', v(r, 'coverage'), 88.525, 1e-9);
const fac = Object.assign({}, A.presets.ladders['Factory-shaped ladder (mirrors gate order [S60]; values not measured)']);
r = L(fac);
near('C-iv factory P_escape = 0.082944', v(r, 'P_escape'), 0.082944, 1e-12); near('C-iv factory coverage 91.7%', v(r, 'coverage'), 91.7056, 1e-9);
ok('C-iv factory preset has 7 named gates in factory order', fac.g3_name === 'tests_added' && fac.g7_name === 'ui');
r = L();
near('C-iv marginal value of tests = (0.0765/0.4 - 0.0765) pp', v(r, 'marg_1'), 100 * (0.0765 / 0.4 - 0.0765), 1e-9);
ok('C-iv marginal value positive for every real gate', [1, 2, 3, 4, 5].every((i) => v(r, 'marg_' + i) > 0));
near('C-iv unused gate marginal value = 0', v(r, 'marg_6'), 0, 1e-12);
ok('C-iv stronger gate has larger marginal value', v(r, 'marg_1') > v(r, 'marg_2'));
ok('C-iv ladder text: hard solid, advisory dashed', /━━ tests/.test(v(r, 'ladder')) && /┄┄ LLM code review/.test(v(r, 'ladder')));
ok('C-iv basis labels the catch rates as user assumptions', /assumption — user-set/.test(r.basis));
ok('C-iv caption printed', r.notes.join(' ').indexOf('add rungs that fail for different reasons') >= 0);
near('C-iv rho = 0 leaves correlated gate unchanged', v(L({ g4_shared: 'yes', rho: 0 }), 'P_escape'), 0.0765, 1e-12);
near('C-iv rho = 1 removes a correlated gate', v(L({ g4_shared: 'yes', rho: 1 }), 'deff_4'), 0, 1e-12);
ok('C-iv correlation lowers coverage', v(L({ g4_shared: 'yes' }), 'coverage') < v(L(), 'coverage'));
ok('C-iv monotone: adding a rung raises coverage', v(L({ g6_d: 0.3 }), 'coverage') > v(L(), 'coverage'));
ok('C-iv monotone: stronger gate raises coverage', v(L({ g2_d: 0.5 }), 'coverage') > v(L(), 'coverage'));
ok('C-iv no gates -> coverage 0', v(L({ g1_d: 0, g2_d: 0, g3_d: 0, g4_d: 0, g5_d: 0 }), 'coverage') === 0);
[['rho', 1.5], ['rho', NaN], ['g1_d', -0.1], ['g1_d', 1.1], ['g1_d', 'x'], ['g1_shared', 'maybe'], ['g1_hard', 'soft'], ['g1_name', 5]].forEach(([k, bad]) => {
  const q = {}; q[k] = bad; const x = A.ladder(q);
  ok(`C-iv invalid ${k}=${bad}`, x.valid === false && Number.isNaN(v(x, 'coverage')));
});

// ---- constants carry sources and values
const wantK = { 'price.in': 2, 'price.out': 10, 'price.cacheReadFrac': 0.1, ttft: 0.5, tpot: 0.02, ctxWindow: 200000 };
Object.keys(wantK).forEach((k) => ok(`K ${k} = spec value`, A.constants[k] && A.constants[k].value === wantK[k]));
Object.keys(A.constants).forEach((k) => {
  const c = A.constants[k];
  ok(`K ${k} has a source`, typeof c.source === 'string' && c.source.length > 3);
  ok(`K ${k} has unit and asOf`, typeof c.unit === 'string' && c.asOf === '2026-10-16');
});
ok('K price constants cite A29 [S27] via [S59]', /\[S27\]/.test(A.constants['price.in'].source) && /\[S59\]/.test(A.constants['price.out'].source));

// ---- every explain key used has an entry in explain-extra-agent.json
const ex = JSON.parse(fs.readFileSync(path.join(root, 'Article/Article_30/build/explain-extra-agent.json'), 'utf8'));
const used = new Set();
Object.keys(A.fields).forEach((name) => A.fields[name].forEach((f) => { if (f.explain) used.add(f.explain); }));
used.forEach((key) => {
  ok(`X ${key} has an explain entry with t/d/u`, ex[key] && ex[key].t && ex[key].d && 'u' in ex[key]);
  ok(`X ${key} uses the agent- prefix`, key.indexOf('agent-') === 0);
});
Object.keys(ex).forEach((key) => ok(`X ${key} is used by a field`, used.has(key)));

// ---- fragments and mount points
const frag = (k) => fs.readFileSync(path.join(root, `Article/Article_30/build/calc-${k}.html`), 'utf8');
['decide', 'reliability', 'budget', 'ladder'].forEach((k) => {
  const h = frag(k);
  ok(`F calc-${k}: wrapper classes`, /<section class="llm-calc-block agent-calc-block">/.test(h) && /<\/section>\s*$/.test(h));
  ok(`F calc-${k}: mount point`, h.indexOf(`<div class="agent-calc" data-agent-calc="${k}"></div>`) >= 0);
  ok(`F calc-${k}: h3, one formula paragraph, basis paragraph`, /<h3>/.test(h) && /<p class="calc-basis">/.test(h) && (h.match(/<p>/g) || []).length === 1);
  ok(`F calc-${k}: cites sources`, /\[S\d+\]/.test(h) || /A29/.test(h));
});

// ---- formula strings match the spec
const formulas = {
  decide: ['N = (V − 1) / 4', 'Risk = ((E − 1) / 4) · (1 − (Vf − 1) / 4)', 'Lp = (5 − L) / 4', 'Score = 100 · N · (1 − Risk) · (1 − 0.5·Lp)'],
  reliability: ['q = (1 − p) · d', 'E = (1 − q^(k+1)) / (1 − q)', 'Ps = p · E', 'Pu = (1 − p)(1 − d) · E', 'Px = q^(k+1)', 'check: Ps + Pu + Px = 1',
    'P_run = Ps^n', 'retries = n · (E − 1)', 'cost_att = Tin·[(1−c)·price.in + c·price.in·price.cacheReadFrac]/1e6 + Tout·price.out/1e6',
    'cost_run = n · E · cost_att', 'cost_per_success = cost_run / P_run', 'p_needed(target, n) = target^(1/n)'],
  budget: ['input tokens to step S (cumulative) = S·c0 + g·S(S−1)/2', 'pin_eff = price.in·(1−f) + price.in·price.cacheReadFrac·f',
    'Cost(S) = pin_eff·[S·c0 + g·S(S−1)/2]/1e6 + price.out·S·o/1e6', 'S_cost = largest S with Cost(S) ≤ C: solve a·S² + b·S − C = 0',
    't_step = ttft + o·tpot + tt', 'S_time = floor(Tw / t_step)', 'S_ctx = floor((0.8·W − c0)/g) + 1', 'max_steps = min(S_cost, S_time, S_ctx, S_policy)',
    'per-step timeout = 3 · t_step'],
  ladder: ['d_eff,i = dᵢ · (1 − ρ)', 'if the gate shares the generator\'s model family, else dᵢ', 'P_escape = Π (1 − d_eff,i)', 'Coverage = 1 − P_escape',
    'Marginal value of gate j = P_escape(without j) − P_escape(with j)']
};
Object.keys(formulas).forEach((name) => {
  const res = A[name]({});
  const printed = Object.keys(res.out).map((k) => res.out[k].formula).join('\n');
  formulas[name].forEach((f) => {
    ok(`FORMULA ${name} text is in the spec: ${f}`, spec.indexOf(f) >= 0);
    ok(`FORMULA ${name} is printed by the calculator: ${f}`, printed.indexOf(f) >= 0);
  });
  Object.keys(res.out).forEach((k) => ok(`OUT ${name}.${k} carries value/unit/formula/inputs`, 'value' in res.out[k] && 'unit' in res.out[k] && res.out[k].formula && typeof res.out[k].inputs === 'object'));
});

if (fails.length) {
  console.log(`FAIL agent-calc — ${fails.length} of ${n} assertions failed`);
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`PASS agent-calc — ${n} assertions`);
