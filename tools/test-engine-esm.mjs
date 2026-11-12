#!/usr/bin/env node
/**
 * test-engine-esm.mjs — PRD-P19 part A gate: dist/rz-engine.mjs is fresh and behaves like the browser global.
 *
 *   E1 freshness   dist/rz-engine.mjs equals a fresh build of rz-engine.js (FR-P19-3)
 *   E2 surface     the ESM default export has the same model namespaces and functions as the vm-loaded global
 *   E3 data        RZEngine.data is deep-equal between the two
 *   E4 replay      every model call made by tools/test-rz-engine.mjs (recorded with RZ_ENGINE_RECORD) is
 *                  replayed on the ESM build and its result is deep-equal to the recorded one;
 *                  at least 30 distinct models must be covered (FR-P19-2)
 *   E5 isolation   importing the ESM in Node writes nothing to globalThis
 *   E6 types       the JSDoc typedef lists every model namespace and every public function
 *   E7 speed       a build takes under 2 s
 *
 * Run: node tools/test-engine-esm.mjs   (exit 0 = pass)
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import v8 from 'node:v8';
import { build, loadInVm, SOURCE, OUT } from './build-engine-esm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESM = process.env.RZ_ENGINE_ESM ? resolve(process.env.RZ_ENGINE_ESM) : OUT;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } };
const clone = (v) => v8.deserialize(v8.serialize(v));

const src = readFileSync(SOURCE, 'utf8');
const t0 = Date.now();
const fresh = build(src);
const ms = Date.now() - t0;
let cur = '';
try { cur = readFileSync(ESM, 'utf8'); } catch (e) { /* missing */ }
ok('E1 dist/rz-engine.mjs equals a fresh build', cur === fresh, cur ? 'stale - run node tools/build-engine-esm.mjs' : 'missing');

const before = Object.keys(globalThis).length;
const mod = await import(pathToFileURL(ESM).href);
const E = mod.default;
ok('E5 import leaves globalThis untouched', Object.keys(globalThis).length === before && typeof globalThis.RZEngine === 'undefined');

const G = loadInVm(src);
const surface = (X) => Object.keys(X.models).sort().map((m) => m + ':' + Object.keys(X.models[m] || {}).filter((f) => typeof X.models[m][f] === 'function').sort().join(','));
ok('E2 same model namespaces and functions (' + Object.keys(G.models).length + ' models)', isDeepStrictEqual(surface(E), surface(G)));
ok('E2 named exports point at the default export', mod.models === E.models && mod.data === E.data && mod.format === E.format);
ok('E3 RZEngine.data deep-equal', isDeepStrictEqual(clone(E.data), clone(G.data)));

/* E4: record the worked-example calls, replay on the ESM build */
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'rz-esm-'));
const recFile = join(dir, 'calls.bin');
const r = spawnSync(process.execPath, [join(ROOT, 'tools/test-rz-engine.mjs')], { env: { ...process.env, RZ_ENGINE_RECORD: recFile }, encoding: 'utf8' });
ok('E4 recording run of test-rz-engine.mjs exits 0', r.status === 0, (r.stdout || '').split('\n').filter(Boolean).slice(-2).join(' | '));
let rec = { calls: [], skipped: 0 };
try { rec = v8.deserialize(readFileSync(recFile)); } catch (e) { /* reported below */ }
rmSync(dir, { recursive: true, force: true });
const models = new Set(), bad = [];
let matched = 0;
for (const c of rec.calls) {
  let out, err = null;
  try { out = E.models[c.m][c.f].apply(E.models[c.m], clone(c.args)); } catch (e) { err = e; }
  let same = false;
  try { same = !err && isDeepStrictEqual(clone(out), c.result); } catch (e) { same = false; }
  if (same) { matched++; models.add(c.m); } else if (bad.length < 5) bad.push(c.m + '.' + c.f + (err ? ' threw ' + err.message : ' differs'));
}
ok('E4 ' + matched + '/' + rec.calls.length + ' recorded calls deep-equal on the ESM build (' + rec.skipped + ' not cloneable, skipped)', rec.calls.length > 0 && matched === rec.calls.length, bad.join('; '));
ok('E4 replay covers >= 30 models (' + models.size + ')', models.size >= 30);

/* E6: typedef lists every namespace and public function */
const td = (fresh.match(/@typedef \{Object\} RZModels[\s\S]*?\*\//) || [''])[0];
const missing = [];
for (const m of Object.keys(G.models)) {
  const line = (td.match(new RegExp('@property \\{\\{(.*)\\}\\} ' + m + '$', 'm')) || [])[1];
  if (line == null) { missing.push(m); continue; }
  for (const f of Object.keys(G.models[m])) if (typeof G.models[m][f] === 'function' && f[0] !== '_' && !new RegExp('(^|, )' + f + ': \\(').test(line)) missing.push(m + '.' + f);
}
ok('E6 JSDoc typedef covers every model and public function', missing.length === 0, missing.slice(0, 5).join(', '));
ok('E7 build under 2 s (' + ms + ' ms)', ms < 2000);

console.log('\nENGINE ESM — ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
