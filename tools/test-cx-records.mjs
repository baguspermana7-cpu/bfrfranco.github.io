#!/usr/bin/env node
// test-cx-records.mjs — Tier 3 slice laws (TIER3_DISCOVERY.md §4 R1–R14) for js/rz-cx-records.js on data/cx/demo-records.json.
// Each law is proven GREEN on the fixture and RED on a deliberate mutation of a copy. DOM-free. Run: node tools/test-cx-records.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url)), R = (p) => resolve(here, '..', p), require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)}`); } };
globalThis.RZEngine = require(R('rz-engine.js'));
const P = require(R('js/rz-cx-plan.js')), X = require(R('js/rz-cx-records.js'));
const DB = JSON.parse(readFileSync(R('data/cx/demo-records.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(DB));
const laws = (db) => X.validate(db).findings.map((f) => f.law);
const has = (db, law) => laws(db).includes(law);

ok('fixture is clean: 0 findings', X.validate(DB).ok, X.validate(DB).findings);
ok('fixture shape: 11 assets, 10 CRAH, 2 unmapped, 1 blocked gate', DB.assets.length === 11 && DB.mappings.length === 8 && DB.gates.filter((g) => g.constraint_state === 'blocked').length === 1);
/* RED per law */
let m = clone(); m.assets.push({ ...m.assets[0] }); ok('R1 red: duplicate id', has(m, 'R1'));
m = clone(); m.assets[0].revision = 0; ok('R1 red: revision 0', has(m, 'R1'));
m = clone(); m.ports.find((p) => p.id === 'P-CRAH-01-CHW-IN').domain = 'fws'; ok('R2 red: chw → fws connection', has(m, 'R2'));
m = clone(); m.approvals.find((a) => a.entity_id === 'G-A-CRAH-01-L3').revision_hash = 'stale'; const v3 = X.validate(m);
ok('R3 red: decision hash ≠ gate hash → finding and gate invalid', has(m, 'R3') && v3.gates['G-A-CRAH-01-L3'].valid === false);
m = clone(); m.gates = m.gates.filter((g) => g.id !== 'G-A-CRAH-02-L2'); m.approvals = m.approvals.filter((a) => a.entity_id !== 'G-A-CRAH-02-L2');
ok('R4 red: L3 accepted without L2', has(m, 'R4'));
m = clone(); m.steps[0].measured_value = null; ok('R5 red: accepted pack with an empty mandatory step', has(m, 'R5'));
m = clone(); m.packs[0].workflow_state = 'accepted'; m.approvals = m.approvals.filter((a) => a.entity_id !== 'TP-L3-CRAH-01');
ok('R6 red: pass + "accepted" without an accept decision', has(m, 'R6'));
m = clone(); m.packs[1].workflow_state = 'in_progress'; ok('R6 red: result pass while state in_progress is flagged', has(m, 'R6'));
m = clone(); m.approvals.find((a) => a.entity_id === 'TP-L3-CRAH-01').signer = 'te.sari'; ok('R7 red: operator approves own attempt', has(m, 'R7'));
m = clone(); m.packs[0].segregation = false; m.approvals.find((a) => a.entity_id === 'TP-L3-CRAH-01').signer = 'te.sari'; ok('R7 green when segregation is off for the pack', !has(m, 'R7'));
m = clone(); m.gates.find((g) => g.id === 'G-A-CRAH-04-L3').constraint_state = 'clear'; const v8 = X.validate(m);
ok('R8 red: open blocking issue with constraint clear → finding, constraint forced blocked', has(m, 'R8') && v8.gates['G-A-CRAH-04-L3'].constraint === 'blocked' && v8.gates['G-A-CRAH-04-L3'].blocked_by === 'ISS-0007');
m = clone(); m.issues[0].state = 'verified_closed'; m.gates.find((g) => g.id === 'G-A-CRAH-04-L3').constraint_state = 'clear'; ok('R8 green: verified_closed does not block', !has(m, 'R8'));
m = clone(); m.scenarios[0].inputs_diff['actual_finish:T-L3-CRAH'] = '2027-03-01'; ok('R10 red: a scenario touching an actual date', has(m, 'R10'));
m = clone(); m.allocations[1].share_pct = 30; ok('R11 red: allocations 60 + 30', has(m, 'R11'));
m = clone(); delete m.observations[0].received_time; ok('R13 red: observation without received_time', has(m, 'R13'));
m = clone(); m.observations[0].cx_level = 'L3'; ok('R13 red: observation carrying a Cx level', has(m, 'R13'));

/* R9 + R12: overlay on the REAL Tier 1 status */
const plan = P.compute({ itLoadKw: 2000, coolingType: 'air', powerRedundancy: 'N+1', rackDensity: 'standard' }, {});
const st = P.statusAt(plan, 0), ov = X.overlay(st, DB), crah = ov.systems.find((s) => s.id === 'crah');
ok('R12 overlay: crah shows 3 of 10 L3 actual (Tier 3) while Tier 1 says planned', crah && crah.actual === 'L3' && crah.counts.L3 === 3 && crah.counts.L2 === 7 && crah.denominator === '3 of 10 L3' && crah.planned === st.systems.find((s) => s.id === 'crah').level, crah);
ok('R12 overlay: a system with no register says so instead of inventing a count', ov.systems.find((s) => s.id === 'ups').denominator === 'no register' && ov.systems.find((s) => s.id === 'ups').actual === null);
ok('R9 overlay: 2 unmapped CRAH keep their status and carry "Model not verified (2 of 10)"', crah.unmapped === 2 && crah.modelNote === 'Model not verified (2 of 10)' && crah.counts.L3 === 3);
ok('R8 overlay: 1 blocked asset counted on crah', crah.blocked === 1);
ok('overlay keeps all 17 systems and the month', ov.systems.length === 17 && ov.month === 0 && ov.ok === true);
m = clone(); m.approvals.find((a) => a.entity_id === 'G-A-CRAH-01-L3').revision_hash = 'stale';
ok('R12 red: an invalid L3 gate drops that asset to L2 in the overlay (2 of 10 L3)', X.overlay(st, m).systems.find((s) => s.id === 'crah').counts.L3 === 2);

/* R14 import */
const csv = ['tag,class,system_id,location_id,rating', 'CRAH-11,crah,crah,HALL-1,200 kW', 'CRAH-11,crah,crah,HALL-1,200 kW', 'PUMP-9,pump,fws_pumps,PLANT-1,30 kW', 'UPS-5,ups,ups,,500 kW', 'BAD,row', 'TX-3,transformer,main_tx,SUB-1,100 MVA'].join('\n');
const imp = X.importRegister(csv, P.SYSTEMS);
ok('R14 import: 2 accepted, 4 rejected each with a reason (duplicate tag, unknown system_id, missing parent, column count)', imp.assets.length === 2 && imp.rejected.length === 4 && /duplicate tag/.test(imp.rejected[0].reason) && /unknown system_id/.test(imp.rejected[1].reason) && /missing location_id/.test(imp.rejected[2].reason) && /5 columns/.test(imp.rejected[3].reason), imp.rejected);
ok('R14 import: a wrong header rejects the file with the expected header named', X.importRegister('a,b,c\n1,2,3', P.SYSTEMS).rejected[0].reason.indexOf('tag,class,system_id,location_id,rating') !== -1);
ok('R14 import: accepted rows carry a stable id, lifecycle and the source line', imp.assets[0].id === 'A-CRAH-11' && imp.assets[0].lifecycle === 'installed' && imp.assets[0].source.line === 2);
ok('module exposes the law texts the panel prints (12 laws)', Object.keys(X.LAWS).length === 12 && /FR-TST-01/.test(X.LAWS.R5));
console.log(`CX RECORDS — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
