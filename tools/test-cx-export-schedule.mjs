#!/usr/bin/env node
// test-cx-export-schedule.mjs — PRD-P12: the Cx plan as MS Project XML (MSPDI) and ICS.
// U1 mapping on the default plan (start 2027-01-04): 7 level tasks (L2–L4 summary) + 17 systems × 3 subtasks + 7 gate
//    milestones = 65; each summary's subtasks sum to its work days; level dates = the calendar panel's dates.
// U2 links: every FS link + lag reproduces the successor's start from the predecessor's finish (dates survive a
//    reschedule), including the witness-slot gaps; every PredecessorUID exists; no task links to itself or forward.
// U3 XML escaping of <&>"' and control characters; U4 ICS: CRLF, every line <= 75 octets, unfolding restores the
//    text, unique UIDs @resistancezero.com, DTSTAMP UTC, one all-day event per gate; non-ASCII folds on characters.
// U5 an undated plan exports nothing (errors); 2,000+ tasks build in < 500 ms.
// B1 browser: without a start date both buttons are disabled and say why; with one they download; the XML parses
//    with DOMParser (no parsererror, MSPDI namespace) and its task count, durations and links equal the plan;
//    the .ics has 7 events. No page errors.
// Run: node tools/test-cx-export-schedule.mjs [--base=http://127.0.0.1:PORT]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d !== undefined ? ' ' + JSON.stringify(d).slice(0, 400) : '')); } };
globalThis.RZEngine = require(join(ROOT, 'rz-engine.js'));
const P = require(join(ROOT, 'js/rz-cx-plan.js'));
const IO = globalThis.RZCxIo = require(join(ROOT, 'js/rz-cx-io.js'));
const X = require(join(ROOT, 'js/rz-cx-export-schedule.js'));
const ENG = globalThis.RZEngine.models.commissioning;
const dated = (overrides = {}, anchor = '2027-01-04') => { const plan = P.compute(undefined, overrides); const base = ENG.calendarPlan(IO.calendarSpec(plan, { anchor, slot: true }, {})); return ENG.calendarPlan(IO.calendarSpec(plan, { anchor, slot: true }, overrides, base.levels)); };
const DAY = 86400000, t = (s) => Date.parse(s + 'T00:00:00Z'), work = (ms) => { const d = new Date(ms).getUTCDay(); return d > 0 && d < 6; };
const nextWorkAfter = (iso, lag) => { let ms = t(iso), n = lag + 1; while (n > 0) { ms += DAY; if (work(ms)) n--; } return new Date(ms).toISOString().slice(0, 10); };

/* U1 */
const cp = dated(), r = X.tasks(cp, P.SYSTEMS), T = r.tasks;
ok('U1 65 tasks: 7 levels + 51 subtasks + 7 gates', T.length === 65 && T.filter((x) => x.outline === 1 && !x.milestone).length === 7 && T.filter((x) => x.outline === 2).length === 51 && T.filter((x) => x.milestone).length === 7, { n: T.length, e: r.errors });
ok('U1 summaries are L2, L3, L4', T.filter((x) => x.summary).map((x) => x.level).join() === 'L2,L3,L4');
ok('U1 level tasks carry the calendar panel dates and work days', cp.levels.every((L) => { const lt = T.find((x) => x.outline === 1 && !x.milestone && x.level === L.id); return lt && lt.start === L.start && lt.finish === L.end && lt.days === L.workDays; }), cp.levels.map((L) => [L.id, L.workDays]));
ok('U1 subtasks of each summary sum to its work days, run back to back inside it', ['L2', 'L3', 'L4'].every((id) => { const lt = T.find((x) => x.summary && x.level === id), sub = T.filter((x) => x.outline === 2 && x.level === id); return sub.reduce((a, x) => a + x.days, 0) === lt.days && sub[0].start === lt.start && t(sub[sub.length - 1].finish) <= t(lt.finish) && sub.every((x) => t(x.start) >= t(lt.start)); }));
ok('U1 systems inside a level keep the electrical → mechanical → controls order', T.filter((x) => x.level === 'L3' && x.outline === 2).map((x) => x.system).join() === P.SYSTEMS.map((s) => s.id).join());

/* U2 */
const byUid = Object.fromEntries(T.map((x) => [x.uid, x]));
const linkBad = [];
for (const x of T) for (const p of x.preds) {
  const pr = byUid[p.uid];
  if (!pr || pr.uid >= x.uid) { linkBad.push(x.name + ' ← missing/forward'); continue; }
  if (x.milestone) { if (x.start !== pr.finish) linkBad.push(x.name + ' gate date'); continue; }
  if (pr.days === 0 || x.days === 0) continue;
  if (nextWorkAfter(pr.finish, p.lag) !== x.start) linkBad.push(x.name + ' start ' + x.start + ' ≠ ' + pr.name + ' finish ' + pr.finish + ' + lag ' + p.lag);
}
ok('U2 every FS link + lag reproduces the successor start (incl. witness-slot gaps)', linkBad.length === 0, linkBad.slice(0, 4));
ok('U2 the witness slot leaves at least one non-zero lag that the export keeps', T.some((x) => x.preds.some((p) => p.lag > 0)));
const cpMoved = dated({ L3: { start: 2.4 } });
const Tm = X.tasks(cpMoved, P.SYSTEMS).tasks, l4 = Tm.find((x) => x.level === 'L4' && x.summary), l3 = Tm.find((x) => x.level === 'L3' && x.summary);
ok('U2 an edited level moves its task and the lag still restates the dates', l3.start === cpMoved.levels.find((L) => L.id === 'L3').start && nextWorkAfter(l3.finish, l4.preds[0].lag) === l4.start, { l3: l3.start, l4: l4.start });

/* U3 */
ok('U3 XML escaping of <&>"\' and control characters', X.xml('a<b>&"c\'\u0001') === 'a&lt;b&gt;&amp;&quot;c&apos;');
const xmlText = X.mspdi(cp, [{ id: 'q', label: 'Pump <A&B> "east"', block: 'mechanical', days: { l2: 1, l3: 1, l4: 1 } }]);
ok('U3 a system name with <&>" is written escaped, the file has no raw "<A&B>"', xmlText.includes('Pump &lt;A&amp;B&gt; &quot;east&quot;') && !xmlText.includes('<A&B>'));
ok('U3 the basis comment holds no "--" and no entity', !/<!--[\s\S]*?(--[^>]|&apos;)[\s\S]*?-->/.test(X.mspdi(cp, P.SYSTEMS, { basis: "a -- b's" })));
ok('U3 MSPDI shell: XML declaration UTF-8, namespace, calendar, 8 h days', /^<\?xml version="1.0" encoding="UTF-8"/.test(xmlText) && xmlText.includes('<Project xmlns="http://schemas.microsoft.com/project">') && xmlText.includes('<MinutesPerDay>480</MinutesPerDay>') && (xmlText.match(/<WeekDay>/g) || []).length === 7);

/* U4 */
const icsText = X.ics(cp, P.SYSTEMS, '2026-11-12T03:04:05.678Z');
const phys = icsText.split('\r\n');
ok('U4 CRLF only, ends with CRLF', !/[^\r]\n/.test(icsText) && icsText.endsWith('\r\n'));
ok('U4 every physical line ≤ 75 octets', phys.every((l) => Buffer.byteLength(l, 'utf8') <= 75), phys.filter((l) => Buffer.byteLength(l, 'utf8') > 75).slice(0, 2));
const logical = icsText.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
const uids = logical.filter((l) => l.startsWith('UID:'));
ok('U4 7 events, unique UIDs @resistancezero.com, DTSTAMP UTC, all-day dates', (icsText.match(/BEGIN:VEVENT/g) || []).length === 7 && new Set(uids).size === 7 && uids.every((u) => /^UID:\d+@resistancezero\.com$/.test(u)) && logical.filter((l) => l.startsWith('DTSTAMP:')).every((l) => l === 'DTSTAMP:20261112T030405Z') && logical.filter((l) => l.startsWith('DTSTART')).every((l) => /^DTSTART;VALUE=DATE:\d{8}$/.test(l)));
ok('U4 event dates = the gate dates (last work day of each level)', logical.filter((l) => l.startsWith('DTSTART')).map((l) => l.slice(-8)).join() === cp.levels.map((L) => L.end.replace(/-/g, '')).join());
const longLine = 'SUMMARY:' + 'Übergabe — 検収 '.repeat(12);
const folded = X.fold(longLine);
ok('U4 non-ASCII folds on character boundaries: ≤ 75 octets per line, unfold restores the text', folded.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75) && folded.replace(/\r\n /g, '') === longLine && !folded.includes('�'));
ok('U4 TEXT escaping of \\ ; , and newlines', X.icsText('a\\b;c,d\ne') === 'a\\\\b\\;c\\,d\\ne');

/* U5 */
ok('U5 an undated plan exports nothing and says why', X.tasks(null, P.SYSTEMS).errors.length === 1 && (() => { try { X.mspdi({ levels: [] }, P.SYSTEMS); return false; } catch (e) { return /start date/.test(e.message); } })());
const many = Array.from({ length: 670 }, (_, i) => ({ id: 's' + i, label: 'System ' + i, block: 'mechanical', days: { l2: 1 + (i % 5), l3: 2, l4: 1 } }));
const t0 = performance.now(); const big = X.mspdi(cp, many); const ms = performance.now() - t0;
const nBig = (big.match(/<Task>/g) || []).length;
ok(`U5 ${nBig} tasks export in ${ms.toFixed(0)} ms (< 500)`, nBig >= 2000 && ms < 500);

/* B1 browser */
const puppeteer = require('puppeteer');
let base = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7), server = null;
if (!base) {
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port; await new Promise((res) => setTimeout(res, 900));
}
{ const served = await fetch(base + '/js/rz-version.js').then((x) => x.text()).catch(() => '');
  if (served !== readFileSync(join(ROOT, 'js/rz-version.js'), 'utf8')) { console.error('FAIL — ' + base + ' does not serve this tree'); if (server) server.kill(); process.exit(1); } }
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 120000 });
const errors = [];
try {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluateOnNewDocument(() => { localStorage.removeItem('rz-cx-plan'); window.__dl = []; const orig = URL.createObjectURL; URL.createObjectURL = function (b) { window.__dl.push(b); return orig.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { window.__names = (window.__names || []).concat(this.download || ''); }; });
  await p.goto(base + '/cx-calculator.html?tab=analysis', { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForSelector('[data-export="mspdi"]', { timeout: 20000 });
  const before = await p.evaluate(() => [...document.querySelectorAll('[data-export="mspdi"], [data-export="ics"]')].map((b) => ({ d: b.disabled, t: b.title })));
  ok('B1 no start date: both buttons disabled, the reason on the button', before.length === 2 && before.every((b) => b.d && /Set a project start date/.test(b.t)), before);
  await p.evaluate(() => { const a = document.getElementById('cxExAnchor'); a.value = '2027-01-04'; a.dispatchEvent(new Event('change', { bubbles: true })); });
  await new Promise((res) => setTimeout(res, 300));
  const after = await p.evaluate(() => [...document.querySelectorAll('[data-export="mspdi"], [data-export="ics"]')].map((b) => ({ d: b.disabled, t: b.title })));
  ok('B1 with a start date both are enabled and say what they write', after.every((b) => !b.d) && /MSPDI/.test(after[0].t), after);
  const res = await p.evaluate(async (NS) => {
    window.__dl = []; window.__names = [];
    document.querySelector('[data-export="mspdi"]').click(); document.querySelector('[data-export="ics"]').click();
    const [xmlB, icsB] = window.__dl; const xml = await xmlB.text(), ics = await icsB.text();
    const d = new DOMParser().parseFromString(xml, 'application/xml');
    const q = (el, n) => { const x = el.getElementsByTagNameNS(NS, n)[0]; return x ? x.textContent : null; };
    const tasks = [...d.getElementsByTagNameNS(NS, 'Task')].map((t) => ({ uid: +q(t, 'UID'), name: q(t, 'Name'), outline: +q(t, 'OutlineLevel'), dur: q(t, 'Duration'), ms: q(t, 'Milestone'), sum: q(t, 'Summary'), start: q(t, 'Start'), preds: [...t.getElementsByTagNameNS(NS, 'PredecessorUID')].map((x) => +x.textContent) }));
    const cp = (() => { const S = window.RZCxAnalysis.state, P = window.RZCxPlan, IO = window.RZCxIo, E = window.RZEngine.models.commissioning; const base = E.calendarPlan(IO.calendarSpec(S.plan, S.extra.calendar, {})); const spec = IO.calendarSpec(S.plan, S.extra.calendar, S.overrides, base.levels); spec.lines = S.extra.lines || []; return E.calendarPlan(spec); })();
    return { names: window.__names, types: [xmlB.type, icsB.type], err: d.getElementsByTagName('parsererror').length, root: d.documentElement.namespaceURI, tasks, cpLevels: cp.levels.map((L) => ({ id: L.id, wd: L.workDays, start: L.start })), events: (ics.match(/BEGIN:VEVENT/g) || []).length, crlf: !/[^\r]\n/.test(ics) };
  }, X.NS);
  ok('B1 files download as cx-plan-2027-01-04.xml / .ics with XML and calendar types', res.names.join() === 'cx-plan-2027-01-04.xml,cx-plan-2027-01-04.ics' && /xml/.test(res.types[0]) && /calendar/.test(res.types[1]), res.names);
  ok('B1 DOMParser: well-formed, MSPDI namespace', res.err === 0 && res.root === X.NS, { err: res.err, root: res.root });
  const lv = res.tasks.filter((x) => x.outline === 1 && x.ms === '0');
  ok('B1 round-trip: 65 tasks, 7 levels, 3 summaries, 7 milestones', res.tasks.length === 65 && lv.length === 7 && res.tasks.filter((x) => x.sum === '1').length === 3 && res.tasks.filter((x) => x.ms === '1').length === 7);
  ok('B1 round-trip: each level duration (h ÷ 8) and start equal the page plan', lv.every((x, i) => +/PT(\d+)H/.exec(x.dur)[1] / 8 === res.cpLevels[i].wd && x.start === res.cpLevels[i].start + 'T08:00:00'), { lv: lv.map((x) => x.dur), cp: res.cpLevels });
  const uids = new Set(res.tasks.map((x) => x.uid));
  ok('B1 round-trip: 61 predecessor links (6 level, 48 system, 7 gate), every one resolves', res.tasks.reduce((a, x) => a + x.preds.length, 0) === 6 + 48 + 7 && res.tasks.every((x) => x.preds.every((u) => uids.has(u))), res.tasks.reduce((a, x) => a + x.preds.length, 0));
  ok('B1 the .ics holds 7 events, CRLF', res.events === 7 && res.crlf);
  ok('B1 no page errors', errors.length === 0, errors.slice(0, 4));
} finally {
  await browser.close();
  if (server) server.kill();
}
if (fail) { console.error(`FAIL test-cx-export-schedule — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`PASS test-cx-export-schedule — ${pass} checks: MSPDI mapping + links restate the dates, escaping, RFC 5545 folding, DOMParser round-trip equals the plan, buttons disabled with the reason`);
