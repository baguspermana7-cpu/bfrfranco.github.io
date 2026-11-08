#!/usr/bin/env node
// test-cx-detail.mjs — K29 (owner: "per block itu klw di klik harusnya ada sesuatu misal modal schematic lain"):
// every block on the Cx giant schematic opens the inside of that system.
//   D1 every RZCxPlan system has a sheet; each renders through RZDiagram with ZERO engine warnings (overflow,
//      transit, unplaced label, colour-only legend, node budget)
//   D2 each sheet carries an L1–L5 ladder whose every row cites a handbook anchor that EXISTS in the file
//   D3 every component says what it does (>= 20 chars) and every component id is unique in its sheet
//   D4 browser: a click on a block in each of the three sheets opens a modal dialog for THAT system; its gate
//      months equal RZCxPlan.statusAt at the viewed month; a component click fills the card; "Fed by"/"Feeds"
//      walk to the neighbour; Escape closes it and focus returns to the block; 0 page errors
//   D5 phone 390 px: the dialog fits the viewport, the page never scrolls sideways
// Usage: node tools/test-cx-detail.mjs [--root=<tree>]   (--root lets the gate run against an older tree: RED proof)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const ROOT = resolve(arg('root', resolve(here, '..')));
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${JSON.stringify(d).slice(0, 300)}`); } };

global.window = global;
['rz-eng-symbols', 'rz-diagram-metrics', 'rz-diagram-layout', 'rz-diagram'].forEach((f) => require(resolve(ROOT, 'js', f + '.js')));
global.window = global; require(resolve(ROOT, 'rz-engine.js')); require(resolve(ROOT, 'js', 'rz-cx-plan.js'));
const P = global.RZCxPlan;
const subPath = resolve(ROOT, 'js', 'rz-cx-subsheets.js');
const SS = existsSync(subPath) ? (require(subPath), global.RZCxSubsheets) : null;
ok('D1 module loads (RZCxSubsheets)', !!SS);
if (SS) {
  const anchors = {};
  const has = (cite) => { const [f, h] = cite.split('#'); const p = resolve(ROOT, f); if (!existsSync(p)) return false; anchors[f] = anchors[f] || readFileSync(p, 'utf8'); return !h || anchors[f].includes('id="' + h + '"'); };
  for (const s of P.SYSTEMS) {
    const d = SS.get(s.id); ok('D1 ' + s.id + ' has a sheet', !!d); if (!d) continue;
    const r = SS.render(s.id);
    ok('D1 ' + s.id + ' renders with 0 engine warnings', r && r.warnings.length === 0, r && r.warnings.map((w) => w.kind + ' ' + (w.message || '').slice(0, 60)));
    ok('D1 ' + s.id + ' is inside the node budget (<= 9)', d.comps.length <= 9, d.comps.length);
    ok('D2 ' + s.id + ' ladder is L1..L5 in order', d.tests.map((t) => t.level).join() === 'L1,L2,L3,L4,L5', d.tests.map((t) => t.level));
    const bad = d.tests.filter((t) => !has(t.cite)).map((t) => t.cite);
    ok('D2 ' + s.id + ' every ladder row cites an anchor that exists', bad.length === 0, bad);
    ok('D3 ' + s.id + ' every component says what it does', d.comps.every((k) => (k.does || '').length >= 20), d.comps.filter((k) => (k.does || '').length < 20).map((k) => k.id));
    ok('D3 ' + s.id + ' component ids unique', new Set(d.comps.map((k) => k.id)).size === d.comps.length);
  }
}

if (process.argv.includes('--node-only')) { console.log(`CX DETAIL — ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
const puppeteer = require(resolve(here, '..', 'node_modules', 'puppeteer'));
const port = 8000 + Math.floor(Math.random() * 900) + 100;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const base = 'http://127.0.0.1:' + port;
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message || e)));
    await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} });
    await page.goto(base + '/cx-calculator.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => window.RZCxAnalysis && document.getElementById('cxTabBtnAnalysis'), { timeout: 30000 });
    await page.click('#cxTabBtnAnalysis');
    await page.waitForFunction(() => document.querySelector('#cxAnSheets [data-rzd-hit]'), { timeout: 20000 });
    const tag = w + 'px';
    const picks = w > 500 ? [['electrical', 'ups'], ['mechanical', 'cdu'], ['controls', 'fire']] : [['electrical', 'mv_board']];
    for (const [sheet, id] of picks) {
      await page.evaluate((s) => { const b = document.querySelector('.cx-an-sheet-tabs [data-sheet="' + s + '"]'); if (b) b.click(); }, sheet);
      await page.evaluate((i) => { const n = document.querySelector('#cxAnSheets [data-rzd-hit="' + i + '"]'); n.scrollIntoView({ block: 'center', behavior: 'instant' }); }, id);
      await new Promise((r) => setTimeout(r, 200));
      const pt = await page.evaluate((i) => { const r = document.querySelector('#cxAnSheets [data-rzd-hit="' + i + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
      if (w > 500) await page.mouse.click(pt.x, pt.y); else await page.touchscreen.tap(pt.x, pt.y);
      const opened = await page.waitForFunction((i) => { const d = document.getElementById('cxDetail'); return d && d.open && d.getAttribute('data-system') === i; }, { timeout: 4000 }, id).then(() => true, () => false);
      ok('D4 ' + tag + ' click ' + id + ' on sheet ' + sheet + ' opens its modal', opened);
      if (!opened) continue;
      const v = await page.evaluate((i) => {
        const d = document.getElementById('cxDetail'), S = window.RZCxAnalysis.state, st = window.RZCxPlan.statusAt(S.plan, S.month).systems.find((x) => x.id === i);
        const gates = [...d.querySelectorAll('#cxDtGates li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim());
        const want = ['L1', 'L2', 'L3', 'L4', 'L5'].map((L) => L + ' ' + (st.gates[L] == null ? '—' : window.RZCxPlan.fmtMo(st.gates[L])));
        const r = d.getBoundingClientRect();
        return { modal: d.matches(':modal'), title: d.querySelector('#cxDtTitle').textContent, svgNodes: d.querySelectorAll('#cxDtSheet [data-rzd-hit]').length, gates, want, rows: d.querySelectorAll('#cxDtTests tr').length,
          fit: r.left >= -1 && r.right <= innerWidth + 1, scrollX: document.documentElement.scrollWidth - innerWidth };
      }, id);
      ok('D4 ' + tag + ' ' + id + ' is a real modal (:modal) with its own schematic', v.modal && v.svgNodes >= 5, v);
      ok('D4 ' + tag + ' ' + id + ' gate months equal RZCxPlan.statusAt', v.gates.join('|') === v.want.join('|'), { got: v.gates, want: v.want });
      ok('D4 ' + tag + ' ' + id + ' ladder has 5 rows', v.rows === 5, v.rows);
      if (w < 500) ok('D5 390 px dialog fits, page does not scroll sideways', v.fit && v.scrollX <= 0, v);
      const first = await page.evaluate(() => document.querySelector('#cxDtSheet [data-rzd-hit]').getAttribute('data-rzd-hit'));
      await page.evaluate((f) => { const n = document.querySelector('#cxDtSheet [data-rzd-hit="' + f + '"]'); n.scrollIntoView({ block: 'center', behavior: 'instant' }); }, first);
      const cp = await page.evaluate((f) => { const r = document.querySelector('#cxDtSheet [data-rzd-hit="' + f + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, first);
      if (w > 500) await page.mouse.click(cp.x, cp.y); else await page.touchscreen.tap(cp.x, cp.y);
      const card = await page.evaluate(() => { const c = document.getElementById('cxDtComp'); return { shown: !c.hidden, comp: c.getAttribute('data-comp'), text: c.textContent.length }; });
      ok('D4 ' + tag + ' component click fills the card', card.shown && card.comp === first && card.text > 25, card);
      const walk = await page.evaluate(() => { const b = document.querySelector('#cxDtWalk [data-cx-dt-go]'); if (!b) return null; const to = b.getAttribute('data-cx-dt-go'); b.click(); return { to, now: document.getElementById('cxDetail').getAttribute('data-system') }; });
      ok('D4 ' + tag + ' ' + id + ' walks to a neighbour', walk && walk.to === walk.now, walk);
      await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 250));
      const after = await page.evaluate(() => ({ open: document.getElementById('cxDetail').open, focus: document.activeElement && document.activeElement.getAttribute('data-rzd-hit') }));
      ok('D4 ' + tag + ' Escape closes and focus returns to a block', !after.open && !!after.focus, after);
    }
    ok('D4 ' + tag + ' 0 page errors', errs.length === 0, errs);
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
console.log(`CX DETAIL — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
