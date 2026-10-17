#!/usr/bin/env node
/* test-llm-calc — js/rz-llm-calc.js (article 29 calculators) reproduces Article/Article_29/CALCULATORS.md.
 *
 *   C-i    fit: defaults, 131,072 ctx, batch 8, KV by architecture, hardware levels
 *   C-ii   training: defaults at goodput 1 and 0.9, Chinchilla, Llama 3.1 405B + DeepSeek-V3 validation
 *   C-iii  serve: defaults on 1xH200, batch table 1/8/16/32, TTFT, batch-1 ceiling, does-not-fit
 *   C-iv   lora: QLoRA 8B, Full 8B, 70B QLoRA, activations off
 *   C-v    tokens: Sonnet 5.5 EN, o200k ID, cl100k ID
 *   plus   invalid input -> NaN, monotonicity, constants carry sources, formula strings equal the spec text.
 *
 * Run: node tools/test-llm-calc.mjs     (exits 1 on any failure)
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'js/rz-llm-calc.js'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'Article/Article_29/CALCULATORS.md'), 'utf8').replace(/ +/g, ' ');

const win = {};
const sandbox = { window: win };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'rz-llm-calc.js' });
const L = win.RZLlmCalc;

const fails = [];
let n = 0;
const ok = (id, cond, detail) => { n++; if (!cond) fails.push(`${id}${detail ? ': ' + detail : ''}`); };
const near = (id, got, want, tol) => ok(id, Math.abs(got - want) <= tol, `got ${got}, want ${want} ± ${tol}`);
const rel = (id, got, want, r) => ok(id, Math.abs(got - want) <= Math.abs(want) * r, `got ${got}, want ${want} ± ${r * 100}%`);
const v = (r, k) => r.out[k].value;

ok('S0 api', ['constants', 'presets', 'fit', 'training', 'serve', 'lora', 'tokens', 'mount'].every((k) => L && k in L));
ok('S0 no </script> in source', src.indexOf('</' + 'script') < 0);
ok('S0 ES5 only (no arrow/let/const/template)', !/=>|\blet\s|\bconst\s|`/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\\n]|\\.)*"/g, '""')));
ok('S0 mount without document returns 0', L.mount(null) === 0);

// ---- C-i
let r = L.fit({});
ok('C-i defaults valid', r.valid);
rel('C-i W = 70.6 GB', v(r, 'W'), 70.6, 1e-9);
ok('C-i KV per token = 327,680 B', v(r, 'KV_tok') === 327680);
near('C-i KV = 2.68 GB', v(r, 'KV'), 2.68, 0.005);
near('C-i KV = 2.50 GiB', v(r, 'KV_GiB'), 2.50, 0.005);
near('C-i Total = 80.6 GB', v(r, 'Total'), 80.6, 0.05);
ok('C-i does not fit 1xH100', v(r, 'fit_h100x1') === false);
ok('C-i fits 1xH200', v(r, 'fit_h200x1') === true);
ok('C-i smallest datacentre level = 1x H200', v(r, 'smallest_dc') === '1x H200 (141 GB)', v(r, 'smallest_dc'));
ok('C-i smallest overall is by usable memory (M4 Max 96 GB)', v(r, 'smallest') === 'Apple M4 Max (128 GB x 0.75)', v(r, 'smallest'));
ok('C-i does not fit RTX 5090', v(r, 'fit_rtx5090') === false);
r = L.fit({ context: 131072 });
near('C-i ctx 131,072: KV = 42.9 GB', v(r, 'KV'), 42.9, 0.05);
near('C-i ctx 131,072: KV = 40 GiB', v(r, 'KV_GiB'), 40, 0.005);
near('C-i ctx 131,072: Total = 124.9 GB', v(r, 'Total'), 124.9, 0.05);
ok('C-i ctx 131,072 still fits one H200', v(r, 'fit_h200x1') === true && v(r, 'smallest_dc') === '1x H200 (141 GB)');
r = L.fit({ context: 131072, batch: 8 });
near('C-i batch 8: KV = 343.6 GB', v(r, 'KV'), 343.6, 0.05);
near('C-i batch 8: Total = 455.7 GB', v(r, 'Total'), 455.7, 0.15);
ok('C-i batch 8 does not fit 1xH200', v(r, 'fit_h200x1') === false);
ok('C-i batch 8 needs 8xH100', v(r, 'fit_h100x8') === true && v(r, 'smallest_dc') === '8x H100 (640 GB)');
ok('C-i batch 8: GPUs needed on H100 = ceil(455.7/80) = 6', v(r, 'gpus_h100x8') === 6, v(r, 'gpus_h100x8'));
r = L.fit({ N_total: 671e9, kv_type: 'mla', layers: 61, mla_width: 576, precision: 8 });
ok('C-i MLA KV per token = 61 x 576 x 2 = 70,272 B', v(r, 'KV_tok') === 70272, v(r, 'KV_tok'));
r = L.fit({ kv_type: 'none' });
ok('C-i KV not modelled -> weights only', v(r, 'KV') === 0 && r.notes.join(' ').indexOf('KV not modelled — architecture not published in sources') >= 0);
near('C-i Apple usable = 128 x 0.75 = 96 GB', L.presets.levels.filter((x) => x.id === 'm4max')[0].usable / 1e9, 96, 1e-9);
near('C-i 8xB200 = 1,440 GB', L.presets.levels.filter((x) => x.id === 'b200x8')[0].usable / 1e9, 1440, 1e-9);
near('C-i 8xMI355X = 2,304 GB', L.presets.levels.filter((x) => x.id === 'mi355x8')[0].usable / 1e9, 2304, 1e-9);
near('C-i 8xH200 = 1,128 GB', L.presets.levels.filter((x) => x.id === 'h200x8')[0].usable / 1e9, 1128, 1e-9);

// ---- C-ii
r = L.training({ goodput: 1 });
rel('C-ii C = 6.30e24 FLOP', v(r, 'C'), 6.3e24, 1e-9);
rel('C-ii rate = 3.956e14 FLOP/s', v(r, 'rate'), 3.956e14, 1e-9);
rel('C-ii GPU-h = 4.424e6', v(r, 'gpu_hours'), 4.424e6, 5e-4);
near('C-ii wall = 11.25 days', v(r, 'wall_days'), 11.25, 0.01);
near('C-ii cost = $11.06M', v(r, 'cost') / 1e6, 11.06, 0.01);
near('C-ii E_IT = 5,640 MWh', v(r, 'E_IT'), 5640, 2);
near('C-ii facility = 6,768 MWh', v(r, 'E_fac'), 6768, 3);
near('C-ii average power = 25.1 MW', v(r, 'avg_MW'), 25.1, 0.05);
rel('C-ii N_opt = 229B', v(r, 'N_opt'), 229e9, 2e-3);
rel('C-ii D_opt = 4.6T', v(r, 'D_opt'), 4.6e12, 5e-3);
near('C-ii 214 tokens per parameter', v(r, 'tok_per_param'), 214, 0.5);
r = L.training({});
near('C-ii defaults (goodput 0.9): wall = 12.5 days', v(r, 'wall_days'), 12.5, 0.01);
near('C-ii defaults (goodput 0.9): cost = $12.29M', v(r, 'cost') / 1e6, 12.29, 0.01);
r = L.training({ N: 405e9, D: 15.6e12 });
rel('C-ii Llama 3.1 405B C = 3.79e25', v(r, 'C'), 3.79e25, 2e-3);
rel('C-ii Llama 3.1 405B C vs paper 3.8e25 within 1%', v(r, 'C'), 3.8e25, 0.01);
const impliedRate = v(r, 'C') / (30.84e6 * 3600);
near('C-ii Llama 405B implied rate = 342 TF', impliedRate / 1e12, 342, 1);
near('C-ii Llama 405B implied MFU = 34.6%', impliedRate / 989e12, 0.346, 0.002);
rel('C-ii Llama 405B at MFU 0.346 gives 30.84M GPU-h', v(L.training({ N: 405e9, D: 15.6e12, MFU: 0.346, goodput: 1 }), 'gpu_hours'), 30.84e6, 0.01);
r = L.training({ N: 37e9, D: 14.8e12, price: 2 });
rel('C-ii DeepSeek-V3 C = 3.29e24', v(r, 'C'), 3.29e24, 2e-3);
near('C-ii DeepSeek-V3 implied rate at 2.664M GPU-h = 343 TF/s', v(r, 'C') / (2.664e6 * 3600) / 1e12, 343, 1);
near('C-ii DeepSeek-V3 2.788M GPU-h x $2 = $5.576M', 2.788e6 * 2 / 1e6, 5.576, 1e-9);

// ---- C-iii
r = L.serve({});
ok('C-iii defaults valid', r.valid);
near('C-iii W = 70.6 GB', v(r, 'W'), 70.6, 0.001);
near('C-iii KV_seq = 1.342 GB', v(r, 'KV_seq'), 1.342, 0.001);
near('C-iii Mem = 113.5 GB', v(r, 'Mem'), 113.5, 0.05);
ok('C-iii fits 141 GB', v(r, 'fits') === true);
near('C-iii t_mem = 23.7 ms', v(r, 't_mem'), 23.7, 0.05);
near('C-iii t_comp = 2.3 ms', v(r, 't_comp'), 2.3, 0.05);
ok('C-iii memory-bound', v(r, 'bound') === 'memory-bound');
near('C-iii t_step = 39.4 ms', v(r, 't_step'), 39.4, 0.05);
near('C-iii per-user 25.4 tok/s', v(r, 'user_tps'), 25.4, 0.05);
near('C-iii throughput 812 tok/s', v(r, 'throughput'), 812, 0.6);
near('C-iii $/Mtok = 1.20', v(r, 'cost_mtok'), 1.2, 0.005);
near('C-iii J/token = 1.60', v(r, 'j_tok'), 1.6, 0.005);
near('C-iii TTFT = 0.571 s', v(r, 'ttft'), 0.571, 0.0005);
near('C-iii batch-1 ceiling = 68 tok/s', v(r, 'ceiling_b1'), 68, 0.1);
near('C-iii ridge = 412 FLOP/B', v(r, 'ridge'), 412, 0.5);
near('C-iii intensity = 64 FLOP/B', v(r, 'intensity'), 64, 1e-9);
[[1, 40], [8, 283], [16, 500], [32, 812]].forEach(([B, t]) => {
  near(`C-iii RESEARCH 6.6 B=${B} -> ${t} tok/s`, v(L.serve({ B }), 'throughput'), t, 1);
});
r = L.serve({ B: 1024 });
ok('C-iii B=1024 does not fit -> fits false, throughput NaN', v(r, 'fits') === false && Number.isNaN(v(r, 'throughput')) && r.notes.join(' ').indexOf('does not fit') >= 0);
r = L.serve({ B: 1024, ctx_avg: 100, n_gpus: 1, F: 1e13, BW: 5e13 });
ok('C-iii compute-bound regime is reachable', v(r, 'bound') === 'compute-bound', v(r, 'bound'));
r = L.serve({ N_total: 235e9, N_active: 22e9, B: 1 });
rel('C-iii MoE batch 1 reads active bytes only', v(r, 'W'), 22, 1e-9);
ok('C-iii MoE at B=256 reads more than active, at most total', v(L.serve({ N_total: 235e9, N_active: 22e9, B: 256, n_gpus: 8 }), 'W') > 22 && v(L.serve({ N_total: 235e9, N_active: 22e9, B: 256, n_gpus: 8 }), 'W') <= 235);
ok('C-iii N_active > N_total is invalid', L.serve({ N_total: 1e10, N_active: 2e10 }).valid === false);
near('C-iii basis says ceiling', L.serve({}).basis.indexOf('ceiling-based estimate, not a benchmark') >= 0 ? 1 : 0, 1, 0);

// ---- C-iv
r = L.lora({});
ok('C-iv defaults valid', r.valid);
ok('C-iv P_lora = 41.94M (1,310,720 per layer)', v(r, 'P_lora') === 1310720 * 32, v(r, 'P_lora'));
near('C-iv P_lora share = 0.52%', v(r, 'fraction') * 100, 0.52, 0.005);
near('C-iv QLoRA base = 4.14 GB', v(r, 'base'), 4.14, 0.005);
near('C-iv train state = 0.67 GB', v(r, 'state'), 0.67, 0.005);
near('C-iv activations = 1.07 GB', v(r, 'act'), 1.07, 0.005);
near('C-iv total = 5.9 GB', v(r, 'total'), 5.9, 0.05);
ok('C-iv fits an RTX 4090 class card', v(r, 'smallest') === 'RTX 4090 (24 GB)', v(r, 'smallest'));
ok('C-iv activations band is plus or minus 50%', Math.abs(v(r, 'act_low') / v(r, 'act') - 0.5) < 1e-9 && Math.abs(v(r, 'act_high') / v(r, 'act') - 1.5) < 1e-9 && v(r, 'total_low') < v(r, 'total') && v(r, 'total_high') > v(r, 'total'));
r = L.lora({ mode: 'full' });
near('C-iv Full: base + state = 8.03e9 x 16 = 128.5 GB', v(r, 'base') + v(r, 'state'), 128.5, 0.05);
ok('C-iv Full: needs more than one 80 GB GPU', v(r, 'total') > 80 && v(r, 'smallest') === '8x H100 (640 GB)' || v(r, 'smallest') === '1x H200 (141 GB)', v(r, 'smallest'));
near('C-iv LoRA BF16 base = 16.06 GB', v(L.lora({ mode: 'lora' }), 'base'), 16.06, 0.005);
r = L.lora({ N_base: 70.6e9, layers: 80, d_model: 8192, kv_dim: 1024, d_ff: 28672 });
near('C-iv 70B P_lora = 207M', v(r, 'P_lora') / 1e6, 207.09, 0.01);
near('C-iv 70B QLoRA base = 36.4 GB', v(r, 'base'), 36.4, 0.05);
near('C-iv 70B adapters x16 = 3.3 GB', v(r, 'state'), 3.3, 0.05);
ok('C-iv 70B QLoRA total in 41-45 GB (rounded) and lands on a 48 GB class card', v(r, 'total') >= 41 && v(r, 'total') <= 45.5, v(r, 'total'));
r = L.lora({ grad_ckpt: 'off' });
ok('C-iv no checkpointing: activations not modelled, total NaN', Number.isNaN(v(r, 'act')) && Number.isNaN(v(r, 'total')) && v(r, 'smallest') === 'activations not modelled');
ok('C-iv q+v targets are fewer params than all', v(L.lora({ targets: 'qv' }), 'P_lora') < v(L.lora({}), 'P_lora'));

// ---- C-v
r = L.tokens({});
ok('C-v defaults valid', r.valid);
near('C-v Claude: tokens_in = 18,018', v(r, 'tokens_in'), 18018, 0.5);
near('C-v Claude: input cost $0.0360', v(r, 'cost_in'), 0.036, 0.0001);
near('C-v Claude: tokens_out = 1,802', v(r, 'tokens_out'), 1802, 0.5);
near('C-v Claude: output cost $0.0180', v(r, 'cost_out'), 0.018, 0.0001);
near('C-v Claude: total $0.054', v(r, 'total'), 0.054, 0.0001);
r = L.tokens({ language: 'id', tokenizer: 'o200k' });
near('C-v ID o200k: 16,000 in', v(r, 'tokens_in'), 16000, 1e-6);
near('C-v ID o200k: input $0.032', v(r, 'cost_in'), 0.032, 1e-9);
near('C-v ID o200k: 1,600 out', v(r, 'tokens_out'), 1600, 1e-6);
near('C-v ID o200k: output $0.016', v(r, 'cost_out'), 0.016, 1e-9);
near('C-v ID o200k: total $0.048', v(r, 'total'), 0.048, 1e-9);
r = L.tokens({ language: 'id', tokenizer: 'cl100k' });
near('C-v ID cl100k: 20,500 in', v(r, 'tokens_in'), 20500, 1e-6);
near('C-v ID cl100k: input $0.041', v(r, 'cost_in'), 0.041, 1e-9);
near('C-v ID cl100k: output $0.0205', v(r, 'cost_out'), 0.0205, 1e-9);
near('C-v ID DeepSeek 1.72 tok/word', v(L.tokens({ language: 'id', tokenizer: 'deepseek' }), 'tokens_in') / 10000, 1.72, 1e-9);
near('C-v EN o200k 1.20 tok/word', v(L.tokens({ tokenizer: 'o200k' }), 'tokens_in') / 10000, 1.2, 1e-9);
ok('C-v Claude + Indonesian has no measured ratio -> invalid', L.tokens({ language: 'id', tokenizer: 'claude' }).valid === false);
near('C-v code uses chars / 2.85', v(L.tokens({ language: 'code', tokenizer: 'o200k', chars: 28500 }), 'tokens_in'), 10000, 1e-6);
near('C-v cache: 50% cached at 0.05 mult -> input cost x0.525', v(L.tokens({ cached_fraction: 0.5 }), 'cost_in') / v(L.tokens({}), 'cost_in'), 0.525, 1e-9);
near('C-v calls = 10 multiplies total', v(L.tokens({ calls: 10 }), 'total') / v(L.tokens({}), 'total'), 10, 1e-9);
ok('C-v 18,018 tokens fit 1M, not 10k context', v(L.tokens({}), 'within_context') === true && v(L.tokens({ context_limit: 10000 }), 'within_context') === false);

// ---- invalid input -> NaN
const allNaN = (res) => Object.keys(res.out).every((k) => typeof res.out[k].value === 'number' && Number.isNaN(res.out[k].value));
[
  ['fit N_total below range', L.fit({ N_total: 1e7 })],
  ['fit context 0', L.fit({ context: 0 })],
  ['fit batch above range', L.fit({ batch: 5000 })],
  ['fit overhead 0.6', L.fit({ overhead: 0.6 })],
  ['fit non-integer layers', L.fit({ layers: 80.5 })],
  ['fit text input', L.fit({ precision: 'abc' })],
  ['fit NaN input', L.fit({ precision: NaN })],
  ['fit null input', L.fit({ N_total: null })],
  ['fit Infinity', L.fit({ context: Infinity })],
  ['fit bad enum', L.fit({ kv_type: 'xyz' })],
  ['training MFU 0.9', L.training({ MFU: 0.9 })],
  ['training PUE 1.0', L.training({ PUE: 1.0 })],
  ['training goodput 0.2', L.training({ goodput: 0.2 })],
  ['serve eff_bw 0.1', L.serve({ eff_bw: 0.1 })],
  ['serve n_gpus 100', L.serve({ n_gpus: 100 })],
  ['lora r = 0', L.lora({ r: 0 })],
  ['lora bad mode', L.lora({ mode: 'dpo' })],
  ['tokens ratio 6', L.tokens({ output_ratio: 6 })],
  ['tokens cached 1.5', L.tokens({ cached_fraction: 1.5 })]
].forEach(([name, res]) => {
  ok(`INVALID ${name}: valid false, errors listed, all outputs NaN`, res.valid === false && res.errors.length > 0 && allNaN(res));
});
ok('INVALID numeric strings are accepted', L.fit({ context: '8192' }).valid === true);
ok('INVALID empty string rejected', L.fit({ context: '' }).valid === false);
ok('INVALID input object is not mutated', (() => { const i = { context: 4096 }; L.fit(i); return Object.keys(i).length === 1 && i.context === 4096; })());

// ---- monotonicity
const mono = (id, fn, xs, dir) => {
  const ys = xs.map(fn);
  ok(id, ys.every((y, i) => i === 0 || (dir > 0 ? y > ys[i - 1] : y < ys[i - 1])), ys.join(' | '));
};
mono('MONO more tokens (words) -> more cost', (w) => v(L.tokens({ words: w }), 'total'), [100, 1000, 10000, 100000], +1);
mono('MONO higher output ratio -> more cost', (x) => v(L.tokens({ output_ratio: x }), 'total'), [0, 0.1, 1, 5], +1);
mono('MONO higher output price -> more cost', (x) => v(L.tokens({ out_price: x }), 'total'), [0, 1, 10, 50], +1);
mono('MONO higher cached share -> less cost', (x) => v(L.tokens({ cached_fraction: x }), 'total'), [0, 0.3, 0.7, 1], -1);
mono('MONO higher precision bytes -> more memory', (p) => v(L.fit({ precision: p }), 'Total'), [4, 8, 16, 32], +1);
mono('MONO higher KV precision -> more memory', (p) => v(L.fit({ kv_bits: p }), 'Total'), [4, 8, 16], +1);
mono('MONO longer context -> more memory', (c) => v(L.fit({ context: c }), 'Total'), [1, 1000, 100000, 1e7], +1);
mono('MONO bigger batch -> more memory', (b) => v(L.fit({ batch: b }), 'Total'), [1, 8, 64, 4096], +1);
mono('MONO more parameters -> more memory', (x) => v(L.fit({ N_total: x }), 'Total'), [1e8, 1e10, 1e12], +1);
mono('MONO more training tokens -> more cost', (d) => v(L.training({ D: d }), 'cost'), [1e9, 1e12, 15e12, 1e14], +1);
mono('MONO more MFU -> fewer GPU-hours', (m) => v(L.training({ MFU: m }), 'gpu_hours'), [0.1, 0.3, 0.6], -1);
mono('MONO more GPUs -> shorter wall time', (g) => v(L.training({ n_gpus: g }), 'wall_days'), [1, 100, 16384], -1);
mono('MONO higher batch -> higher serve throughput', (b) => v(L.serve({ B: b }), 'throughput'), [1, 8, 16, 32], +1);
mono('MONO higher batch -> lower $/Mtok', (b) => v(L.serve({ B: b }), 'cost_mtok'), [1, 8, 16, 32], -1);
mono('MONO more weight bits -> lower per-user speed', (w) => v(L.serve({ w_bits: w }), 'user_tps'), [4, 8], -1);
mono('MONO higher rank -> more adapter params', (x) => v(L.lora({ r: x }), 'P_lora'), [1, 8, 16, 256], +1);
mono('MONO longer sequence -> more activations', (s) => v(L.lora({ seq_len: s }), 'act'), [128, 2048, 8192], +1);
ok('MONO QLoRA < LoRA < Full memory', v(L.lora({ mode: 'qlora' }), 'total') < v(L.lora({ mode: 'lora' }), 'total') && v(L.lora({ mode: 'lora' }), 'total') < v(L.lora({ mode: 'full' }), 'total'));

// ---- constants
const keys = Object.keys(L.constants);
ok('CONST table is non-trivial', keys.length > 60, String(keys.length));
keys.forEach((k) => {
  const c = L.constants[k];
  ok(`CONST ${k}: source, asOf, unit field, finite value`, typeof c.source === 'string' && c.source.length > 0 && c.asOf === '2026-10-16' && typeof c.unit === 'string' && Number.isFinite(c.value));
});
[['H100.bw', 3.35e12], ['H100.mem', 80e9], ['H100.bf16', 989e12], ['H100.fp8', 1979e12], ['H200.bw', 4.8e12], ['H200.mem', 141e9],
  ['B200.bw', 8e12], ['B200.mem', 180e9], ['B200.fp8', 9e15], ['MI355X.bw', 8e12], ['MI355X.mem', 288e9], ['MI355X.bf16', 2.5e15],
  ['MI355X.fp8', 5e15], ['MI355X.tbp', 1400], ['GB200.gpu_mem', 186e9], ['GB200.gpu_bw', 8e12], ['GB200.bf16', 2.5e15],
  ['TPUv7.bw', 7.37e12], ['TPUv7.mem', 192e9], ['TPUv7.fp8', 4.614e15], ['RTX4090.bw', 1.008e12], ['RTX4090.mem', 24e9],
  ['RTX5090.bw', 1.792e12], ['RTX5090.mem', 32e9], ['RTX5090.tgp', 575], ['M4Max.bw', 546e9], ['M4Max.mem', 128e9],
  ['M3Ultra.bw', 819e9], ['M3Ultra.mem', 512e9], ['kW_per_GPU.H100_node', 1.275], ['kW_per_GPU.B200_node', 1.79],
  ['kW_per_GPU.GB200_rack', 1.83], ['bpw.BF16', 16], ['bpw.FP8', 8], ['bpw.INT8', 8], ['bpw.Q8_0', 8.5008], ['bpw.Q6_K', 6.5633],
  ['bpw.Q5_K_M', 5.7036], ['bpw.Q4_K_M', 4.8944], ['bpw.IQ4_XS', 4.4597], ['bpw.Q3_K_M', 3.996], ['bpw.Q2_K', 3.1593],
  ['bpw.NF4+DQ', 4.127], ['train_bytes_per_param', 16], ['tok_per_word.en.o200k', 1.2], ['tok_per_word.id.o200k', 1.6],
  ['tok_per_word.id.cl100k', 2.05], ['tok_per_word.id.deepseek', 1.72]].forEach(([k, want]) => {
  ok(`CONST spec value ${k} = ${want}`, L.constants[k] && L.constants[k].value === want, L.constants[k] && String(L.constants[k].value));
});
near('CONST Claude tok/word = 1e6/555,000 ~ 1.80', L.constants['tok_per_word.en.claude'].value, 1.8, 0.002);
ok('CONST every spec constant row appears in the table (sources [S8] .. [S72] present in spec)', keys.every((k) => !/^(H100|H200)/.test(k) || /\[S[89]\]/.test(L.constants[k].source)));
ok('CONST model presets carry a source', Object.keys(L.presets.models).length === 9 && Object.keys(L.presets.models).every((k) => L.presets.models[k].source));
ok('CONST UNVERIFIED-layer presets have no KV (kv_type none)', ['Llama 4 Scout', 'gpt-oss-120b', 'Kimi K2'].every((k) => L.presets.models[k].kv_type === 'none'));
ok('CONST price presets carry source + as-of date', L.presets.prices.length >= 9 && L.presets.prices.every((p) => p.source && p.asOf === '2026-10-16'));
ok('CONST preset Sonnet 5.5 = $2 / $10', L.presets.prices[0].name === 'Claude Sonnet 5.5' && L.presets.prices[0].in_price === 2 && L.presets.prices[0].out_price === 10);

// ---- every output carries {value, unit, formula, inputs}
['fit', 'training', 'serve', 'lora', 'tokens'].forEach((name) => {
  const res = L[name]({});
  const outs = Object.keys(res.out);
  ok(`TRACE ${name}: every output has value/unit/formula/inputs`, outs.length > 0 && outs.every((k) => 'value' in res.out[k] && typeof res.out[k].unit === 'string' && typeof res.out[k].formula === 'string' && res.out[k].formula.length > 0 && typeof res.out[k].inputs === 'object'));
  ok(`TRACE ${name}: result carries a basis chip text`, typeof res.basis === 'string' && res.basis.length > 10);
  ok(`TRACE ${name}: unit on every numeric output`, outs.every((k) => typeof res.out[k].value !== 'number' || res.out[k].unit.length > 0 || k === 'ratio'), outs.filter((k) => typeof res.out[k].value === 'number' && !res.out[k].unit).join(','));
});
ok('TRACE inputs echo the numbers used', L.fit({ context: 4096 }).out.KV.inputs.context === 4096 && L.fit({}).out.W.inputs.N_total === 70.6e9);

// ---- formula strings equal the spec text
const formulas = {
  fit: ['W_bytes = N_total × precision / 8', 'KV_tok = 2 × layers × kv_heads × d_head × kv_bits/8', 'KV_tok = layers × mla_width × kv_bits/8',
    'KV_bytes = KV_tok × context × batch', 'Total = (W_bytes + KV_bytes) × (1 + overhead)', 'Fit(level) = Total ≤ usable_mem(level)'],
  training: ['C = 6 × N × D', 'rate = peak × MFU', 'GPU_hours = C / rate / 3600', 'wall_days = GPU_hours / n_gpus / goodput / 24',
    'cost_$ = GPU_hours / goodput × price', 'E_IT_MWh = GPU_hours / goodput × kW_per_GPU / 1000', 'E_fac_MWh = E_IT_MWh × PUE',
    'avg_MW = n_gpus × kW_per_GPU × PUE / 1000', 'N_opt = sqrt(C/120)', 'D_opt = 20·N_opt'],
  serve: ['KV_seq = KV_tok × ctx_avg', 'Mem = N_total × w_bits/8 + B × KV_seq', 't_mem = (W + B × KV_seq) / (n_gpus × BW)',
    't_comp = 2 × N_active × B / (n_gpus × F)', 't_step = max(t_mem, t_comp) / eff_bw', 'per-user tok/s = 1 / t_step',
    'throughput = B / t_step', 'TTFT ≈ 2 × N_active × prompt / (n_gpus × F × mfu_prefill)', '$/Mtok = (n_gpus × price) / (throughput × 3600) × 1e6',
    'J/token = n_gpus × kW_per_GPU × 1000 / throughput', 'Ridge = F / BW', 'decode intensity ≈ 2B/(w_bits/8)'],
  lora: ['P_lora = layers × Σ_targets r × (d_in + d_out)', 'Base mem = N_base × {Full: 2, LoRA: 2, QLoRA: 4.127/8} bytes',
    'Train-state mem = {Full: N_base × 14 (grad 2 + Adam/master 12); LoRA/QLoRA: P_lora × 16}',
    'Activations ≈ layers × seq_len × micro_batch × d_model × k_act × 2 B', 'Total = Base + Train-state + Activations'],
  tokens: ['tokens_in = words × tok_per_word[language][tokenizer]', 'tokens_out = tokens_in × output_ratio',
    'tokens_in × [(1−cached)×in_price + cached×in_price×cache_read_mult]/1e6', 'tokens_out × out_price/1e6', 'total = cost/call × calls']
};
Object.keys(formulas).forEach((name) => {
  const res = L[name]({});
  const printed = Object.keys(res.out).map((k) => res.out[k].formula).join('\n');
  formulas[name].forEach((f) => {
    ok(`FORMULA ${name} text is in the spec: ${f}`, spec.indexOf(f) >= 0);
    ok(`FORMULA ${name} is printed by the calculator: ${f}`, printed.indexOf(f) >= 0);
  });
});

if (fails.length) {
  console.log(`FAIL llm-calc — ${fails.length} of ${n} assertions failed`);
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`PASS llm-calc — ${n} assertions`);
