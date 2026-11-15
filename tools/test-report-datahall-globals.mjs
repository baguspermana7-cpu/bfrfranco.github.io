#!/usr/bin/env node
// PRD-P09 FR-P09-1 — the global-map analyser is proven on code whose answer is known, then the committed map must be fresh.
// G1 program-level function/var/let/const/class are defined; `var` inside a top-level if/for hoists to global.
// G2 names declared inside functions, params, catch params, block let/const and destructuring are NOT globals or free reads.
// G3 an assignment to an undeclared name is an implicit global (with its line); `window.X =` defines X; `window.Y` reads Y.
// G4 property keys, member properties and labels are not references; optional chaining parses.
// G5 cross-block: block 2 reading a name block 1 defines is listed under uses; builtins stay external.
// G6 (--fresh, required before each P09 move stage; not in the ship gate so other sessions' page edits do not turn it red)
//    the committed map (05-test-evidence/P09-global-map.json) matches the current datahallAI.html.
import { analyse, globalMap } from './report-datahall-globals.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let a = analyse(`function f(){} var v=1; let l=2; const c=3; class K{} if(true){ var hv=1; let inner=2; } for(var i=0;i<1;i++){}`);
ok('G1 program-level declarations + hoisted var', eq(a.defines, ['K', 'c', 'f', 'hv', 'i', 'l', 'v']), a.defines);
a = analyse(`(function(p,{q,r:[t]}){ var loc=1; let bl=2; try{}catch(err){ err; } const z=p+q+t+loc+bl; return z; })(1,{});`);
ok('G2 locals, params, destructuring, catch param are not globals', eq(a.defines, []) && eq(a.reads, []), a);
a = analyse(`(function(){ leak = 1; window.Pub = 2; return window.Other + leak; })();`);
ok('G3 implicit global with its line, window write defines, window read reads', eq(a.defines, ['Pub', 'leak']) && eq(a.reads, ['Other', 'window']) && eq(a.implicit, [{ name: 'leak', line: 1 }]), a);
a = analyse(`var o={key:1}; o.prop; lbl: for(;;){ break lbl; } var x = o?.key ?? 0;`);
ok('G4 keys, member properties, labels ignored; ?. and ?? parse', eq(a.reads, []) && eq(a.defines, ['o', 'x']), a);
const r = globalMap(`<script>function shared(){}</script><script>(function(){ shared(); Math.max(1); })();</script><script type="application/json">{"x":1}</script>`);
ok('G5 cross-block use listed, builtin external, json skipped', r.blocks.length === 2 && eq(r.blocks[1].uses, { B1: ['shared'] }) && r.blocks[1].external.includes('Math'), r.blocks);
let fresh = true;
if (process.argv.includes('--fresh')) try { execFileSync('node', [resolve(ROOT, 'tools/report-datahall-globals.mjs'), '--check'], { stdio: 'pipe' }); } catch (e) { fresh = false; }
if (process.argv.includes('--fresh')) ok('G6 committed global map is fresh for datahallAI.html', fresh);
if (fail) { console.error(`FAIL test-report-datahall-globals — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`PASS test-report-datahall-globals — ${pass} laws: scope analysis proven on known code${process.argv.includes('--fresh') ? ', map fresh' : ''}`);
