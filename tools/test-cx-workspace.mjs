#!/usr/bin/env node
// test-cx-workspace.mjs — PRD-P06 stage 1 core (js/rz-cx-workspace.js). DOM-free.
// 13 law fixtures (FR-P06-2): each refusal law R1 R2 R3 R4 R5 R6 R7 R11 has one REFUSED write, each flag law R8 R9 R10 R13 one
// FLAGGED (committed) write, plus the referenced-asset delete refusal (PRD §17). Then: pre-existing findings never refuse an
// unrelated write, revisions increment, register import with bad lines, export/import round-trip deep-equal, corrupt store
// quarantined, 2 MB cap. Run: node tools/test-cx-workspace.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deepStrictEqual } from 'node:assert';
const here = dirname(fileURLToPath(import.meta.url)), R = (p) => resolve(here, '..', p), require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)}`); } };
globalThis.RZEngine = require(R('rz-engine.js'));
const P = require(R('js/rz-cx-plan.js'));
globalThis.RZCxRecords = require(R('js/rz-cx-records.js'));
const W = require(R('js/rz-cx-workspace.js'));
const DEMO = JSON.parse(readFileSync(R('data/cx/demo-records.json'), 'utf8'));
const set = () => ({ name: 'T', db: JSON.parse(JSON.stringify(DEMO)), rev: 1 });
const refusedBy = (r, law) => !r.ok && r.refused.some((f) => f.law === law);
const flaggedBy = (r, law) => r.ok && r.flags.some((f) => f.law === law);

/* ── refusal laws: the write is refused and the set is untouched ── */
let s = set(), r;
r = W.write(s, (db) => { db.assets.push({ id: 'A-X', tag: 'X', system_id: 'crah' }); });
ok('R1 refused: a record without revision', refusedBy(r, 'R1') && r.set === s, r);
r = W.write(s, (db) => { db.connections.push({ id: 'C-BAD', from_port_id: db.ports.find((p) => p.domain === 'chw').id, to_port_id: db.ports.find((p) => p.domain !== 'chw').id, revision: 1 }); });
ok('R2 refused: a connection across domains', refusedBy(r, 'R2'), r);
r = W.write(s, (db) => { const g = db.gates.find((x) => x.id === 'G-A-CRAH-05-L3'); g.workflow_state = 'accepted'; });
ok('R3 refused: a gate accepted without an accept decision', refusedBy(r, 'R3'), r);
r = W.write(W.createSet(W.emptyWorkspace(), { name: 'P', assets: [{ id: 'A-CRAH-01', tag: 'CRAH-01', class: 'crah', system_id: 'crah', location_id: 'H1', rating: '', revision: 1 }] }).ws.sets['set-1'],
  W.ops.decideGate({ asset_id: 'A-CRAH-01', level: 'L2', decision: 'accept', signer: 'cxa' }));
ok('R4 refused (PRD §21): L2 accepted before L1 on CRAH-01, with the law text', refusedBy(r, 'R4') && /L2 accepted on A-CRAH-01 without L1/.test(r.refused[0].message), r);
r = W.write(s, (db) => { const st = db.steps.find((x) => x.mandatory); st.measured_value = null; });
ok('R5 refused: an accepted pack with an empty mandatory step', refusedBy(r, 'R5'), r);
r = W.write(s, (db) => { db.approvals = db.approvals.filter((a) => a.entity !== 'pack'); });
ok('R6 refused: a pack accepted without an accept decision', refusedBy(r, 'R6'), r);
r = W.write(s, (db) => { const ap = db.approvals.find((a) => a.entity === 'pack'); const at = db.attempts.find((a) => a.pack_id === ap.entity_id); ap.signer = at.operator; });
ok('R7 refused: the operator approves their own attempt', refusedBy(r, 'R7'), r);
r = W.write(s, (db) => { db.allocations[0].share_pct -= 10; });
ok('R11 refused: allocations of one line sum to 90 %', refusedBy(r, 'R11'), r);
r = W.write(s, W.ops.deleteAsset('A-CRAH-01'));
ok('REF refused (PRD §17): delete an asset that ports/gates reference, references listed', refusedBy(r, 'REF') && /P-CRAH-01/.test(r.refused[0].message), r);
ok('a refused write leaves the set and its revision untouched', r.set === s && s.rev === 1);

/* ── flag laws: the write commits and carries the flag ── */
r = W.write(s, (db) => { db.issues.push({ id: 'ISS-9', title: 'x', state: 'open', blocking_gate_ids: [db.gates[0].id], assets: [db.gates[0].scope_id], revision: 1 }); });
ok('R8 flagged: an open blocking issue on a clear gate commits with the flag', flaggedBy(r, 'R8') && r.set.rev === 2, r);
r = W.write(s, W.ops.addAssets([{ id: 'A-NEW', tag: 'NEW', class: 'crah', system_id: 'crah', location_id: 'H1', rating: '', revision: 1 }]));
ok('R9 flagged: an asset without a model mapping says Model not verified', flaggedBy(r, 'R9') && r.flags[0].message === 'Model not verified', r);
r = W.write(s, (db) => { db.scenarios[0].inputs_diff.actual_finish = '2027-01-01'; });
ok('R10 flagged: a scenario touching an actual date', flaggedBy(r, 'R10'), r);
r = W.write(s, (db) => { delete db.observations[0].received_time; });
ok('R13 flagged: an observation without received_time', flaggedBy(r, 'R13'), r);

/* ── the journeys behind the PRD acceptance criteria ── */
let ws = W.createSet(W.emptyWorkspace(), { name: 'Hall 1', project_id: 'p1', assets: W.TABLES && [] }).ws;
const imp = globalThis.RZCxRecords.importRegister('tag,class,system_id,location_id,rating\nCRAH-01,crah,crah,HALL-1,200 kW\nCRAH-02,crah,nope,HALL-1,200 kW\nCRAH-01,crah,crah,HALL-1,200 kW\nbad,line\nCRAH-03,crah,crah,,200 kW', P.SYSTEMS);
ok('register import: 1 accepted, 4 rejected with reasons', imp.assets.length === 1 && imp.rejected.length === 4 && imp.rejected.every((x) => x.reason), imp);
let cur = ws.sets[ws.active];
r = W.write(cur, W.ops.addAssets(imp.assets)); cur = r.set;
ok('revision increments on a write (1 → 2)', r.ok && cur.rev === 2, r);
r = W.write(cur, W.ops.addIssue({ title: 'Valve leaks', asset_id: 'A-CRAH-01', severity: 'major', blocking: true, level: 'L3', owner: 'vendor' }, '2026-11-12')); cur = r.set;
const g3 = W.findings(cur.db).gates[W.gateId('A-CRAH-01', 'L3')];
ok('PRD §21: a blocking open issue on CRAH-01 makes its L3 gate constraint read blocked (no R8 finding: the constraint is kept in sync)', r.ok && g3 && g3.constraint === 'blocked' && !r.flags.some((f) => f.law === 'R8'), { r, g3 });
r = W.write(cur, W.ops.decideGate({ asset_id: 'A-CRAH-01', level: 'L1', decision: 'accept', signer: 'cxa' }, 't')); cur = r.set;
ok('L1 accept commits with an approval carrying the gate revision hash (self-declared signer)', r.ok && cur.db.approvals.length === 1 && cur.db.approvals[0].revision_hash === cur.db.gates.find((g) => g.level === 'L1').revision_hash && cur.db.approvals[0].self_declared === true, r);
r = W.write(cur, W.ops.decideGate({ asset_id: 'A-CRAH-01', level: 'L2', decision: 'accept', signer: 'cxa' })); cur = r.set;
r = W.write(cur, W.ops.decideGate({ asset_id: 'A-CRAH-01', level: 'L3', decision: 'accept', signer: 'cxa' }));
ok('accepting a blocked gate is refused with the R8 text', refusedBy(r, 'R8') && /open blocking issue/.test(r.refused[0].message), r);
const iss = cur.db.issues[0].id;
r = W.write(cur, W.ops.closeIssue(iss)); cur = r.set;
r = W.write(cur, W.ops.decideGate({ asset_id: 'A-CRAH-01', level: 'L3', decision: 'accept', signer: 'cxa' })); cur = r.set;
ok('closing the issue clears the constraint; L3 then accepts', r.ok && W.findings(cur.db).gates[W.gateId('A-CRAH-01', 'L3')].constraint === 'clear', r);
r = W.write(cur, W.ops.addIssue({ title: '  ', asset_id: 'A-CRAH-01' }));
ok('an issue without a title is refused (input)', !r.ok && r.refused[0].law === 'INPUT');
r = W.write(cur, W.ops.editIssue(iss, { title: 'Valve leaks <b>x</b>', state: 'reopened' }));
ok('edit bumps the issue revision and stores text as given (rendered via textContent)', r.ok && r.set.db.issues[0].revision === 3 && r.set.db.issues[0].title === 'Valve leaks <b>x</b>', r.set && r.set.db.issues[0]);

/* pre-existing refusal findings (an invalid imported set) do not refuse an unrelated write */
const bad = set(); bad.db.allocations[0].share_pct = 10;
r = W.write(bad, W.ops.addIssue({ title: 'ok', asset_id: 'A-CRAH-02' }));
ok('an invalid set still accepts an unrelated write (only NEW refusal findings refuse)', r.ok, r);

/* ── export / import ── */
const txt = W.exportSet(cur), back = W.importSet(txt);
let same = true; try { deepStrictEqual(back.set.db, cur.db); } catch (e) { same = false; }
ok('export → import round-trip is deep-equal (db, name, project, rev)', back.ok && same && back.set.name === cur.name && back.set.project_id === 'p1' && back.set.rev === cur.rev, back);
ok('import of a non-record file is refused', !W.importSet('{"a":1}').ok && !W.importSet('nope').ok && !W.importSet(JSON.stringify({ format: 'rz-cx-records', v: 1, db: { assets: 'x' } })).ok);
const inv = W.importSet(W.exportSet(bad));
ok('import of an invalid set lists its findings and marks it invalid', inv.ok && inv.set.invalid === 1 && inv.findings.some((f) => f.law === 'R11'), inv);

/* ── persistence ── */
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };
const st = mem(), S = W.store(st);
ws.sets[ws.active] = cur;
ok('save + load returns the same workspace', S.save(ws).ok && JSON.stringify(W.store(st).load()) === JSON.stringify(ws));
st.setItem(W.KEY, '{broken');
const S2 = W.store(st), l2 = S2.load();
ok('a corrupt store is quarantined with a notice, the workspace starts empty', S2.quarantined && st.getItem(W.QKEY) === '{broken' && st.getItem(W.KEY) === null && Object.keys(l2.sets).length === 0);
const big = W.emptyWorkspace(); big.sets.x = { name: 'big', db: { assets: [{ id: 'a', note: 'x'.repeat(W.CAP) }] }, rev: 1 };
ok('over the 2 MB cap nothing is written (code CAP)', W.store(mem()).save(big).code === 'CAP');
const mid = W.emptyWorkspace(); mid.sets.x = { name: 'mid', db: { assets: [{ id: 'a', note: 'x'.repeat(W.WARN) }] }, rev: 1 };
ok('over 1.5 MB the save warns', W.store(mem()).save(mid).warn === true);

/* demo stays clean through the module */
ok('demo set: 0 refusal findings, R9 labels the 3 unmapped assets', W.findings(DEMO).list.filter((f) => W.REFUSE[f.law]).length === 0 && W.findings(DEMO).list.filter((f) => f.law === 'R9').length === DEMO.assets.length - DEMO.mappings.length);

/* NFR: validate a 5,000-record set under 200 ms */
const gen = W.emptyDb(); for (let i = 0; i < 2500; i++) { gen.assets.push({ id: 'A' + i, tag: 'T' + i, system_id: 'crah', revision: 1 }); gen.mappings.push({ id: 'M' + i, asset_id: 'A' + i, revision: 1 }); }
const t0 = performance.now(); W.findings(gen); const ms = performance.now() - t0;
ok(`5,000 records validate in ${ms.toFixed(0)} ms (< 200)`, ms < 200);

console.log(`\ncx workspace (P06 stage 1) — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
