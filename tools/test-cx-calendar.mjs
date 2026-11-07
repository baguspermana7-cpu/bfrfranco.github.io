#!/usr/bin/env node
// test-cx-calendar.mjs — laws for RZEngine.models.commissioning.calendarPlan (v3.26.1, PRD v1.1 §17 Tier 1.5,
// §19–20 extension lines, §21 fixture). The v1.0 §21 worked example is reproduced exactly: five one-week levels
// Jan–May 2027, witness slots on the first full Mon–Fri week of a month, Scenario A (L3 slips to 5–9 Apr → L4
// 3–7 May → L5 7–11 Jun, release 14 Jun = +35 days, cost profile shifts, total unchanged), Scenario B (standby
// Rp2 juta per work day 10 May–11 Jun = 25 days = 16 + 9, remobilisation Rp20 juta in June → +70).
// Run: node tools/test-cx-calendar.mjs [engine.js]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '..', 'rz-engine.js');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${typeof d === 'string' ? d : JSON.stringify(d)}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
global.window = {}; require(ENGINE); const C = global.window.RZEngine.models.commissioning;
ok('calendarPlan exists', typeof C.calendarPlan === 'function');
if (typeof C.calendarPlan !== 'function') { console.log(`CX CALENDAR — ${pass} passed, ${fail} failed`); process.exit(1); }

// the §21 fixture (Rp juta, MH)
const FIX = {
  anchor: '2027-01-01',
  levels: [
    { id: 'L1', label: 'L1 Factory witness', workDays: 5, cost: 50, manHours: 160, start: '2027-01-04' },
    { id: 'L2', label: 'L2 Standalone', workDays: 5, cost: 80, manHours: 240, start: '2027-02-01' },
    { id: 'L3', label: 'L3 System functional', workDays: 5, cost: 120, manHours: 320, start: '2027-03-01' },
    { id: 'L4', label: 'L4 Integration', workDays: 5, cost: 210, manHours: 480, witness: true },
    { id: 'L5', label: 'L5 IST', workDays: 5, cost: 300, manHours: 640, witness: true }
  ],
  slotRule: 'first-full-week'
};
const deep = (o) => JSON.parse(JSON.stringify(o));
const specCopy = deep(FIX);
const base = C.calendarPlan(FIX);
ok('spec not mutated', eq(FIX, specCopy));
const win = (p, id) => { const l = p.levels.find((x) => x.id === id); return l ? l.start + '..' + l.end : null; };
ok('baseline: L4 takes April\'s first full week, L5 May\'s', win(base, 'L4') === '2027-04-05..2027-04-09' && win(base, 'L5') === '2027-05-03..2027-05-07', [win(base, 'L4'), win(base, 'L5')]);
ok('baseline release = first work day after L5 (Mon 10 May 2027)', base.release === '2027-05-10' && base.baselineRelease === '2027-05-10', base.release);
ok('baseline months Jan–May', eq(base.months.slice(0, 5), ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05']), base.months);
ok('baseline monthly cost 50/80/120/210/300', eq(base.monthly.cost.slice(0, 5), [50, 80, 120, 210, 300]), base.monthly.cost);
ok('baseline monthly MH 160/240/320/480/640', eq(base.monthly.manHours.slice(0, 5), [160, 240, 320, 480, 640]), base.monthly.manHours);
ok('baseline totals 760 / 1,840', base.total === 760 && base.manHours === 1840 && base.extensionTotal === 0, [base.total, base.manHours]);
ok('baseline: nothing moved, release delta 0', base.levels.every((l) => !l.moved) && base.releaseDeltaDays === 0);

// Scenario A — L3 loses the March slot
const A = C.calendarPlan(Object.assign(deep(FIX), { overrides: { L3: { start: '2027-04-05' } } }));
ok('A: L3 5–9 Apr, L4 3–7 May, L5 7–11 Jun', win(A, 'L3') === '2027-04-05..2027-04-09' && win(A, 'L4') === '2027-05-03..2027-05-07' && win(A, 'L5') === '2027-06-07..2027-06-11', [win(A, 'L3'), win(A, 'L4'), win(A, 'L5')]);
ok('A: release 14 Jun 2027, +35 calendar days', A.release === '2027-06-14' && A.releaseDeltaDays === 35, [A.release, A.releaseDeltaDays]);
ok('A: months Jan–Jun', eq(A.months, ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06']), A.months);
ok('A: monthly cost 50/80/0/120/210/300', eq(A.monthly.cost, [50, 80, 0, 120, 210, 300]), A.monthly.cost);
ok('A: baseline series carried, June 0', eq(A.monthly.baselineCost, [50, 80, 120, 210, 300, 0]), A.monthly.baselineCost);
ok('A: delta 0/0/−120/−90/−90/+300', eq(A.monthly.delta, [0, 0, -120, -90, -90, 300]), A.monthly.delta);
ok('A: MH 160/240/0/320/480/640, total 1,840', eq(A.monthly.manHours, [160, 240, 0, 320, 480, 640]) && A.manHours === 1840, A.monthly.manHours);
ok('A: total unchanged 760 (a shift, not a saving)', A.total === 760 && A.baselineTotal === 760 && A.totalDelta === 0, [A.total, A.totalDelta]);
ok('A: L4 and L5 flagged moved with the slot explained', A.levels.find((l) => l.id === 'L4').moved && /slot/i.test(A.levels.find((l) => l.id === 'L4').explain) && /May/.test(A.levels.find((l) => l.id === 'L4').explain), A.levels.find((l) => l.id === 'L4').explain);
ok('A: L1, L2 untouched', !A.levels.find((l) => l.id === 'L1').moved && win(A, 'L2') === '2027-02-01..2027-02-05');
const Ad = C.calendarPlan(Object.assign(deep(FIX), { overrides: { L3: { start: '2027-04-05' } }, dataDate: '2027-03-01' }));
ok('A at data date 1 Mar: actual 130, ETC 630, EAC 760', Ad.eac && Ad.eac.actual === 130 && Ad.eac.etc === 630 && Ad.eac.eac === 760, Ad.eac);

// Scenario B — extension lines
const B = C.calendarPlan(Object.assign(deep(FIX), { overrides: { L3: { start: '2027-04-05' } }, lines: [
  { id: 'standby', label: 'Retained test-equipment standby', kind: 'standby', perWorkDay: 2, from: 'baselineRelease', to: 'release' },
  { id: 'remob', label: 'Remobilisation', kind: 'lump', amount: 20, on: 'release' }
] }));
const sb = B.lines.find((l) => l.id === 'standby'), rm = B.lines.find((l) => l.id === 'remob');
ok('B: standby 25 work days (16 May + 9 Jun) = 50', sb && sb.days === 25 && sb.amount === 50 && eq(sb.byMonth, [0, 0, 0, 0, 32, 18]), sb);
ok('B: remobilisation 20 in June', rm && rm.amount === 20 && eq(rm.byMonth, [0, 0, 0, 0, 0, 20]), rm);
ok('B: extension series 0/0/0/0/32/38, total +70', eq(B.monthly.extension, [0, 0, 0, 0, 32, 38]) && B.extensionTotal === 70, B.monthly.extension);
ok('B: scenario cost incl. extension 50/80/0/120/242/338 = 830', eq(B.monthly.costWithExtension, [50, 80, 0, 120, 242, 338]) && B.totalWithExtension === 830, B.monthly.costWithExtension);
ok('B: delta vs baseline 0/0/−120/−90/−58/+338', eq(B.monthly.deltaWithExtension, [0, 0, -120, -90, -58, 338]), B.monthly.deltaWithExtension);
ok('B: non-labour lines leave MH at 1,840', B.manHours === 1840);
ok('B: EAC at 1 Mar = 130 + 700 = 830', (C.calendarPlan(Object.assign(deep(FIX), { overrides: { L3: { start: '2027-04-05' } }, dataDate: '2027-03-01', lines: B.lines.map((l) => ({ id: l.id, label: l.label, kind: l.kind, perWorkDay: l.perWorkDay, amount: l.kind === 'lump' ? l.amount : undefined, from: l.from, to: l.to, on: l.on })) })).eac.eac) === 830);

// robustness
const early = C.calendarPlan(Object.assign(deep(FIX), { overrides: { L4: { start: '2027-03-08' } } }));   // before L3 acceptance (5 Mar)? no — 8 Mar is after; use 1 Mar
const early2 = C.calendarPlan(Object.assign(deep(FIX), { overrides: { L4: { start: '2027-03-01' } } }));
ok('override before predecessor acceptance is clamped to the next slot and explained', win(early2, 'L4') === '2027-04-05..2027-04-09' && /predecessor|acceptance/i.test(early2.levels.find((l) => l.id === 'L4').explain), early2.levels.find((l) => l.id === 'L4').explain);
const wk = C.calendarPlan(Object.assign(deep(FIX), { overrides: { L3: { start: '2027-04-03' } } }));   // a Saturday
ok('a weekend override starts on the next work day (Mon 5 Apr)', win(wk, 'L3') === '2027-04-05..2027-04-09', win(wk, 'L3'));
ok('an explicitly started witness level without the slot rule is left on its day', win(C.calendarPlan(Object.assign(deep(FIX), { slotRule: null })), 'L4') === '2027-03-08..2027-03-12');
const spread = C.calendarPlan({ anchor: '2027-01-01', levels: [{ id: 'X', label: 'x', workDays: 60, cost: 100, manHours: 1000, start: '2027-01-04' }] });
ok('largest-remainder: a 60-day level over three months sums to its cost and MH exactly', spread.monthly.cost.reduce((a, b) => a + b, 0) === 100 && spread.monthly.manHours.reduce((a, b) => a + b, 0) === 1000 && spread.monthly.cost.every(Number.isInteger), spread.monthly.cost);
ok('unknown line kind is ignored with a note', C.calendarPlan(Object.assign(deep(FIX), { lines: [{ id: 'z', kind: 'nope', amount: 5 }] })).notes.some((n) => /nope|unknown/i.test(n)));
ok('basis sentence names the slot rule and the rounding', /first full/i.test(base.basis) && /largest remainder/i.test(base.basis));

// baseline durations / costs: a level may carry baselineWorkDays / baselineCost / baselineManHours — the engine's
// baseline schedule uses those, so a duration or cost EDIT shows as a slip and a delta (reviewer HIGH, 2026-11-07)
const dur = C.calendarPlan({ anchor: '2027-01-04', levels: [
  { id: 'A', label: 'a', workDays: 5, cost: 10, manHours: 50 },
  { id: 'B', label: 'b', workDays: 44, baselineWorkDays: 22, cost: 300, baselineCost: 100, manHours: 400, baselineManHours: 200 } ] });
ok('baseline schedule uses baselineWorkDays (22), scenario uses workDays (44)', dur.baseline.levels[1].workDays === 22 && dur.levels[1].workDays === 44, dur.baseline.levels[1]);
ok('a +22 work-day duration edit slips the release by ≥ 28 calendar days and marks the level moved', dur.releaseDeltaDays >= 28 && dur.levels[1].moved === true, [dur.releaseDeltaDays, dur.levels[1].moved]);
ok('baselineTotal uses baselineCost; totalDelta = +200; baseline MH 250 vs 450', dur.baselineTotal === 110 && dur.totalDelta === 200 && dur.baselineManHours === 250 && dur.manHours === 450, [dur.baselineTotal, dur.totalDelta, dur.baselineManHours, dur.manHours]);
ok('without baseline fields the baseline equals the scenario (unchanged contract)', base.releaseDeltaDays === 0 && base.totalDelta === 0, [base.releaseDeltaDays, base.totalDelta]);
console.log(`CX CALENDAR — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
