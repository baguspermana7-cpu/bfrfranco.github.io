#!/usr/bin/env node
// test-cx-io.mjs — laws for js/rz-cx-io.js (v3.26.1 P5: calendar spec from a plan, extension lines, CSV in/out) and the
// store v2 in js/rz-cx-plan.js. DOM-free. Run: node tools/test-cx-io.mjs [engine.js]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '..', 'rz-engine.js');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${typeof d === 'string' ? d : JSON.stringify(d)}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
global.window = {}; require(ENGINE); const E = global.window.RZEngine;
const P = require(resolve(here, '..', 'js', 'rz-cx-plan.js'));
let IO = null; try { IO = require(resolve(here, '..', 'js', 'rz-cx-io.js')); } catch (e) { IO = null; }
ok('rz-cx-io.js loads', !!IO && typeof IO.calendarSpec === 'function');
if (!IO) { console.log(`CX IO — ${pass} passed, ${fail} failed`); process.exit(1); }

const inp = { itLoadKw: 40000, coolingType: 'liquid', powerRedundancy: '2N', countryId: 'ID', rackDensity: 'ai_hpc' };
const plan = P.compute(inp, {});
// calendar spec from a plan
const spec = IO.calendarSpec(plan, { anchor: '2027-01-01', slot: true }, {});
ok('spec: 7 levels in order, work days = months × 22, cost and MH carried', spec.levels.length === 7 && spec.levels[0].id === 'L0' && spec.levels.every((l, i) => l.workDays === Math.max(1, Math.round(plan.levels[i].months * 22)) && l.cost === plan.levels[i].cost && l.manHours === plan.levels[i].manHours), spec.levels.map((l) => [l.id, l.workDays]));
ok('spec: L4 and L5 are witness levels, slot rule on', spec.levels.filter((l) => l.witness).map((l) => l.id).join() === 'L4,L5' && spec.slotRule === 'first-full-week' && spec.anchor === '2027-01-01');
ok('spec: no overrides → no starts (serial from the anchor)', spec.levels.every((l) => !l.start) && !spec.overrides);
const planO = P.compute(inp, { L3: { start: plan.levels[3].start + 1 } });
const specO = IO.calendarSpec(planO, { anchor: '2027-01-01', slot: false }, { L3: { start: plan.levels[3].start + 1 } });
ok('spec: an edited start becomes a dated override (anchor month + whole months + 22 work days per month fraction)', specO.overrides && /^\d{4}-\d{2}-\d{2}$/.test(specO.overrides.L3.start) && specO.slotRule === null, specO.overrides);
ok('monthToDate: M0 = first work day of the anchor month; M1.5 = first work day of the next month + 11 work days', IO.monthToDate('2027-01-01', 0) === '2027-01-01' && IO.monthToDate('2027-01-01', 1.5) === '2027-02-16', [IO.monthToDate('2027-01-01', 0), IO.monthToDate('2027-01-01', 1.5)]);
// with the engine's baseline calendar, an edit is a WORK-DAY SHIFT from that level's dated baseline start (an absolute date would be clamped back to the predecessor's acceptance whenever the calendar runs behind 22 days/month)
const baseCal = E.models.commissioning.calendarPlan(IO.calendarSpec(plan, { anchor: '2027-01-01', slot: true }, {}));
const planH = P.compute(inp, { L3: { start: plan.levels[3].start + 0.5 } });
const specH = IO.calendarSpec(planH, { anchor: '2027-01-01', slot: true }, { L3: { start: plan.levels[3].start + 0.5 } }, baseCal.levels);
ok('spec (with baseline calendar): L3 +0.5 mo = baseline L3 start + 11 work days', specH.overrides && specH.overrides.L3.start === IO.addWorkDays(baseCal.levels[3].start, 11), { base: baseCal.levels[3].start, got: specH.overrides && specH.overrides.L3.start });
const cpH = E.models.commissioning.calendarPlan(specH);
ok('…and the engine moves L3 by exactly that (no clamp); 11 work days sit inside the L4 witness-slot float, so the release holds', cpH.levels[3].start === specH.overrides.L3.start && cpH.levels[3].moved && cpH.releaseDeltaDays === 0 && /Witness slot/.test(cpH.levels[4].explain), { l3: cpH.levels[3].start, delta: cpH.releaseDeltaDays, l4: cpH.levels[4].explain });
const specH2 = IO.calendarSpec(P.compute(inp, { L3: { start: plan.levels[3].start + 1.5 } }), { anchor: '2027-01-01', slot: true }, { L3: { start: plan.levels[3].start + 1.5 } }, baseCal.levels);
const cpH2 = E.models.commissioning.calendarPlan(specH2);
ok('L3 +1.5 mo (33 work days) crosses a month boundary: L4 takes a later slot and the release slips by whole weeks', cpH2.releaseDeltaDays >= 28 && cpH2.releaseDeltaDays % 7 === 0 && cpH2.levels[4].moved, { delta: cpH2.releaseDeltaDays, l4: cpH2.levels[4].start, base: baseCal.levels[4].start });
ok('workDaysBetween: Fri→Mon = 1, Mon→Fri(prev) = −1, same day 0, +11 inverts addWorkDays', IO.workDaysBetween('2027-01-08', '2027-01-11') === 1 && IO.workDaysBetween('2027-01-11', '2027-01-08') === -1 && IO.workDaysBetween('2027-01-06', '2027-01-06') === 0 && IO.workDaysBetween(baseCal.levels[3].start, IO.addWorkDays(baseCal.levels[3].start, 11)) === 11);
ok('addWorkDays: Fri + 1 = Mon, Mon − 1 = Fri, Sat + 1 = Mon, 0 = same day', IO.addWorkDays('2027-01-08', 1) === '2027-01-11' && IO.addWorkDays('2027-01-11', -1) === '2027-01-08' && IO.addWorkDays('2027-01-09', 1) === '2027-01-11' && IO.addWorkDays('2027-01-06', 0) === '2027-01-06');
const specZ = IO.calendarSpec(plan, { anchor: '2027-01-01', slot: true }, { L3: { start: plan.levels[3].start } }, baseCal.levels);
ok('spec (with baseline calendar): an edit equal to the baseline start produces no override', !specZ.overrides);
const cp = E.models.commissioning.calendarPlan(Object.assign(spec, { lines: [{ id: 'sb', label: 'standby', kind: 'standby', perWorkDay: 1000, from: 'baselineRelease', to: 'release' }] }));
ok('the spec runs through the engine: release after the last level, lines resolved', /^\d{4}-\d{2}-\d{2}$/.test(cp.release) && cp.lines.length === 1 && cp.lines[0].days === 0, [cp.release, cp.lines[0] && cp.lines[0].days]);

// extension lines
const L = IO.sanitizeLines([
  { id: 'sb', label: 'Standby', kind: 'standby', perWorkDay: '2', from: 'baselineRelease', to: 'release' },
  { id: 'rm', label: 'Remob', kind: 'lump', amount: 20, on: '2027-06-01' },
  { id: 'sb', kind: 'standby', perWorkDay: 3 },                       // duplicate id → dropped
  { id: 'x', kind: 'nope', amount: 5 },                               // unknown kind → dropped
  { id: 'neg', kind: 'lump', amount: -5, on: 'release' },             // negative → dropped
  { id: 'bad', kind: 'lump', amount: 5, on: 'tomorrow' },             // bad date → dropped
  'junk', null
]);
ok('sanitizeLines keeps the two valid lines, coerces numbers, drops duplicates / unknown kinds / negatives / bad dates', L.length === 2 && L[0].perWorkDay === 2 && L[0].from === 'baselineRelease' && L[1].amount === 20 && L[1].on === '2027-06-01', L);
ok('sanitizeLines(null) = []', eq(IO.sanitizeLines(null), []) && eq(IO.sanitizeLines('x'), []));

// CSV parse
const rows = IO.csv.parse('a,b,c\r\n1,"x, y","he said ""hi"""\n\n2,,3\n');
ok('csv.parse: CRLF, quoted commas, doubled quotes, blank lines skipped', eq(rows, [['a', 'b', 'c'], ['1', 'x, y', 'he said "hi"'], ['2', '', '3']]), rows);
// plan import
const imp = IO.csv.importPlan('Level,Start,Months,Crew,Shift\nL3,5.5,,6,2x12\nL9,1,1,1,1x8\nL4,,0,,\nL3,6,,,\nL5,,,,\nfoo\n', P);
ok('importPlan: accepted rows become sanitized overrides', eq(imp.overrides, { L3: { start: 5.5, crew: 6, shift: '2x12' } }), imp.overrides);
ok('importPlan: every bad row is reported with its line number and reason', imp.errors.length === 5 && imp.errors.map((e) => e.row).join() === '3,4,5,6,7' && /unknown level/i.test(imp.errors[0].reason) && /months/i.test(imp.errors[1].reason) && /duplicate/i.test(imp.errors[2].reason) && /no value|empty/i.test(imp.errors[3].reason) && /unknown level/i.test(imp.errors[4].reason), imp.errors);
ok('importPlan: missing header → one error, nothing imported', (() => { const r = IO.csv.importPlan('L3,5,,,\n', P); return r.errors.length === 1 && /header/i.test(r.errors[0].reason) && eq(r.overrides, {}); })());
ok('importPlan: start beyond the plan limit is rejected, not clamped', (() => { const r = IO.csv.importPlan('level,start,months,crew,shift\nL2,500,,,\n', P); return eq(r.overrides, {}) && r.errors.length === 1 && /start/i.test(r.errors[0].reason); })());
// lines import
const li = IO.csv.importLines('id,label,kind,perWorkDay,amount,from,to,on\nsb,Standby,standby,2,,baselineRelease,release,\nrm,Remob,lump,,20,,,release\nzz,Bad,lump,,x,,,release\n');
ok('importLines: two lines in, the bad amount reported', li.lines.length === 2 && li.errors.length === 1 && li.errors[0].row === 4, li);
// exports
const csvPlan = IO.csv.exportPlan(plan);
ok('exportPlan: header + 7 level rows, numbers unformatted', csvPlan.split('\n')[0] === 'level,label,start,end,months,crew,shift,crew_needed,man_hours,cost,cost_delta' && csvPlan.trim().split('\n').length === 8 && /^L0,"?/.test(csvPlan.split('\n')[1]), csvPlan.split('\n').slice(0, 2));
const csvMonthly = IO.csv.exportMonthly(plan);
ok('exportMonthly: one row per month with baseline, scenario, man-hours, crew', csvMonthly.split('\n')[0] === 'month,baseline_cost,scenario_cost,man_hours,crew_on_site' && csvMonthly.trim().split('\n').length === plan.months + 1);
const csvStatus = IO.csv.exportStatus(P.statusAt(plan, 6));
ok('exportStatus: 17 system rows with level, tag, next gate', csvStatus.split('\n')[0] === 'system,label,block,level,tag,next_gate,in_test' && csvStatus.trim().split('\n').length === 18);
ok('csv quoting: a label with a comma is quoted', /"[^"]*,[^"]*"/.test(IO.csv.exportStatus(P.statusAt(plan, 6))) || !/,/.test(P.SYSTEMS.map((s) => s.label).join('')));
const csvCal = IO.csv.exportCalendar(cp);
ok('exportCalendar: dated level windows + release row', /^level,label,start,end,work_days,cost,man_hours,moved,explain/.test(csvCal) && /release,/.test(csvCal));

// store v2 (rz-cx-plan.js)
const mem = (() => { let m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })();
const S = P.store(mem);
ok('store v2: saves calendar + lines and loads them back', S.save({ L3: { start: 5 } }, 24, { calendar: { anchor: '2027-01-01', slot: true }, lines: L }) && (() => { const r = S.load(); return r.siteCrewCap === 24 && r.calendar.anchor === '2027-01-01' && r.calendar.slot === true && r.lines.length === 2; })(), S.load());
mem.setItem(P.KEY, JSON.stringify({ version: 1, overrides: { L3: { start: 5 } }, siteCrewCap: 20 }));
ok('store v2: a v1 payload still loads (no calendar, no lines)', (() => { const r = S.load(); return r.overrides.L3.start === 5 && r.calendar.anchor === null && r.calendar.slot === false && eq(r.lines, []); })(), S.load());
mem.setItem(P.KEY, JSON.stringify({ version: 2, overrides: {}, siteCrewCap: null, calendar: { anchor: 'bogus', slot: 'yes' }, lines: 'nope' }));
ok('store v2: junk calendar / lines fail soft', (() => { const r = S.load(); return r.calendar.anchor === null && r.calendar.slot === false && eq(r.lines, []); })(), S.load());

// reviewer findings 2026-11-07 — baseline durations reach the engine; CSV hygiene
const planDur = P.compute(inp, { L3: { months: plan.levels[3].baseline.months + 1 } });
const specDur = IO.calendarSpec(planDur, { anchor: '2027-01-04', slot: false }, {});
ok('calendarSpec carries baselineWorkDays/baselineCost/baselineManHours from L.baseline', specDur.levels[3].baselineWorkDays === Math.round(planDur.levels[3].baseline.months * IO.WORK_DAYS) && specDur.levels[3].workDays === specDur.levels[3].baselineWorkDays + IO.WORK_DAYS && specDur.levels[3].baselineCost === planDur.levels[3].baseline.cost, specDur.levels[3]);
const cpDur = E.models.commissioning.calendarPlan(Object.assign(specDur, { lines: [{ id: 'sb', label: 'standby', kind: 'standby', perWorkDay: 100, from: 'baselineRelease', to: 'release' }] }));
ok('L3 +1 mo (duration edit): release slips ≥ 28 days, standby line costs ≥ 22 work days × 100', cpDur.releaseDeltaDays >= 28 && cpDur.lines[0].days >= 22 && cpDur.lines[0].amount === cpDur.lines[0].days * 100, [cpDur.releaseDeltaDays, cpDur.lines[0]]);
const inj = IO.csv.exportLines([{ id: 'x', label: '=HYPERLINK("http://e.vil")', kind: 'lump', amount: 5, on: 'release' }, { id: 'y', label: '+1 day', kind: 'lump', amount: -5, on: 'release' }]);
ok('CSV export neutralises a leading = + - @ in text cells, leaves plain numbers alone', /,'=HYPERLINK|,"'=HYPERLINK/.test(inj) && /,'\+1 day/.test(inj) && /,-5,/.test(inj), inj);
const dupe = IO.csv.importLines('id,kind,amount,on\nq,lump,5,release\nq,lump,7,release\n');
ok('a duplicate id in a lines CSV is reported as a rejected row, not dropped silently', dupe.lines.length === 1 && dupe.errors.length === 1 && dupe.errors[0].row === 3 && /duplicate/i.test(dupe.errors[0].reason), dupe);
const calCsv = IO.csv.exportCalendar(cpDur).trim().split('\n');
const relRow = calCsv.find((r) => r.startsWith('release,')), baseRow = calCsv.find((r) => r.startsWith('baseline_release,'));
ok('calendar CSV: release row start=end=release; a baseline_release row carries the baseline date and total', !!relRow && relRow.split(',')[2] === cpDur.release && relRow.split(',')[3] === cpDur.release && !!baseRow && baseRow.split(',')[2] === cpDur.baselineRelease && +baseRow.split(',')[5] === cpDur.baselineTotal, [relRow, baseRow]);
console.log(`CX IO — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
