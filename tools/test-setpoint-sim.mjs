/*
 * test-setpoint-sim.mjs — PRD-SETPOINT-SIM browser laws (documentation/prd/PRD_SETPOINT_SIM.md §B3). P1 laws:
 *
 *   S2 shown = registry: every live value on a Conventional cockpit whose point is held to a setpoint
 *      (js/rz-control-points.js spOf(id) != null) carries the setpoint in its tooltip, word for word tipFor(id),
 *      and the value equals data/control-points.json (read independently here, not through the page)
 *   S3 trend SP line: opening that point's trend draws exactly one reference line for it, labelled with the SP text
 *      ("SP 19.4"), and the limit lines are unchanged in number
 *   S6 page setpoint sliders (chiller-plant MAINT, P2): the slider ranges are bound to the engine at first paint;
 *      in MAINT every running loop sits exactly at the setpoints and does not move between ticks; the DP slider shows
 *      the engine's secondary pump response (SIMULATED, dynamics not modelled) = a Node recompute ± 0.1 %
 *   S8 control loops on the P&ID (P4): every registry loop drawn once as an ISA-5.1 bubble, PV and MV joined by signals,
 *      SP = registry, OUT = engine, hover marks PV -> controller -> MV, double-click opens the modal naming the loop;
 *      0 orphan bubbles
 *      RZ_SP_PLANT=no-loops  serve the twin without loops(): S8 must fail; =no-loop-hover: the hover law must fail
 *   S8b unit loops on the inside view (P4b): TIC-CHWS inside a chiller, TIC-SAT inside a CRAH, each one instPanel with SP =
 *      registry, OUT = engine, PV and MV joined by signals, no orphan, hover marks the loop. S8c a reset names its slave.
 *   S11 control authority (P10): each loop's OUT / authority left = the engine, SATURATED within 2 % of a limit (modal,
 *       bubble); S11c the chiller-plant Loops table has one row per registry loop on its sheets and in its machines
 *   S9 (part) 0 page errors on the pages visited
 *
 * Red first: on v3.102.0 (no control registry in the browser) S2 and S3 fail on every page.
 *   node tools/test-setpoint-sim.mjs        run inside a browser lane (rz-lane)
 *   RZ_SP_PLANT=no-registry                 serve js/rz-control-points.js as 404 (the old state): S2 and S3 must fail
 *   S4w at 1440 the Setpoints table fits its frame (no column scrolled out of view; red on v3.109.0)
 *   S8d phone: the loop bubble tooltip and every value cell inside it stay inside a 390 px screen (red on v3.107.0)
 *   S6 red: on v3.105.0 chiller-plant.html (sliders unbound until a scenario, lag + noise in MAINT, no DP response)
 *   RZ_SP_PLANT=no-sequence                 serve js/conv/sequence-view.js as 404 (before P3): S7 must fail
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRequire } from 'node:module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const PAGES = ['chiller-plant.html', 'datahall.html'];
const fails = []; let passes = 0;
const ok = (c, law, msg) => { if (c) passes++; else fails.push(`${law} ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the registry, read here without the page: pv point -> { value, label, evidence } */
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows;
const ENG = (() => { const E = createRequire(import.meta.url)(path.join(ROOT, 'js/conv-engine.js')); return (E.CONV_CALC || E).snapshot; })();
const engineOf = (id) => id.split('.').reduce((o, k) => (o == null ? o : o[k]), ENG);
const { CONV_MODEL: ENGM, CONV_CALC: ENGC } = createRequire(import.meta.url)(path.join(ROOT, 'js/conv-engine.js'));
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const setPath = (o, p, v) => { const k = p.split('.'); k.slice(0, -1).reduce((x, y) => x[y], o)[k[k.length - 1]] = v; };
/* the sequences twin, read without the page (PRD-SETPOINT-SIM P3) */
const SEQ = (() => { const g = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'js/rz-sequences.js'), 'utf8'))(g); return g.RZSequences ? Object.fromEntries(g.RZSequences.classes().map((k) => [k, g.RZSequences.get(k)])) : {}; })();
const WANT = {};
REG.filter((r) => r.cockpit === 'conv' && r.sp && r.sp.pv).forEach((r) => r.sp.pv.forEach((p) => { WANT[p] = r; }));

const srv = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split(/[?#]/)[0]).replace(/^\/+/, '') || 'index.html', p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  if (process.env.RZ_SP_PLANT === 'no-registry' && rel === 'js/rz-control-points.js') { r.writeHead(404); r.end(); return; }
  if (process.env.RZ_SP_PLANT === 'no-loops' && rel === 'js/rz-control-points.js') { fs.readFile(p, 'utf8', (e, d) => { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end(String(d).replace('loops: loops, ', '')); }); return; }
  if (process.env.RZ_SP_PLANT === 'no-loop-hover' && rel === 'js/rz-hmi-sheet.js') { fs.readFile(p, 'utf8', (e, d) => { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end(String(d).replace("classList.add('is-loop')", 'tagName')); }); return; }
  if (process.env.RZ_SP_PLANT === 'no-sequence' && rel === 'js/conv/sequence-view.js') { r.writeHead(404); r.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const O = `http://127.0.0.1:${srv.address().port}/`;
/* S7 on the open equipment modal of class cls (the page's modal is open) */
async function seqCheck(pg, cls) {
  if (SEQ[cls]) {
    const S = SEQ[cls], store0 = await pg.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]));
    const v = await pg.evaluate(() => {
      const b = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-seq]'); if (!b) return null;
      return { modes: [...b.querySelectorAll('details[data-seq-mode]')].map((d) => ({ id: d.getAttribute('data-seq-mode'), dt: [...d.querySelectorAll('dt')].map((x) => x.textContent),
        values: [...d.querySelectorAll('[data-seq-value]')].map((x) => +x.getAttribute('data-seq-value')) })), scns: [...b.querySelectorAll('[data-seq-scn] option')].map((o) => o.value) };
    });
    ok(!!v, 'S7', `${cls}: no Sequence of operations block in the modal`);
    if (v) {
      ok(v.modes.map((x) => x.id).join() === S.modes.map((x) => x.id).join(), 'S7', `${cls}: modes ${v.modes.map((x) => x.id)} ≠ twin`);
      v.modes.forEach((m, i) => {
        ok(['Entry', 'Actions, in order', 'Exit'].every((t) => m.dt.includes(t)), 'S7', `${cls}.${m.id}: missing Entry / Actions / Exit (${m.dt})`);
        const want = S.modes[i] ? S.modes[i].entry.concat(S.modes[i].exit).filter((c) => typeof c.value === 'number').map((c) => c.value) : [];
        ok(m.values.join() === want.join(), 'S7', `${cls}.${m.id}: shown thresholds ${m.values} ≠ twin ${want}`);
      });
      ok(v.scns.join() === S.scenarios.map((x) => x.id).join(), 'S7', `${cls}: scenarios ${v.scns}`);
      for (const sc of S.scenarios) {
        await pg.evaluate((id) => { const s = document.querySelector('.rz-cvm:not([hidden]) [data-seq-scn]'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); }, sc.id);
        const at0 = await pg.evaluate(() => [...document.querySelectorAll('.rz-cvm:not([hidden]) tr[data-seq-i]:not([hidden])')].length);
        ok(at0 === 0, 'S7', `${cls}/${sc.id}: ${at0} steps shown before Simulate`);
        await pg.evaluate(() => document.querySelector('.rz-cvm:not([hidden]) [data-seq-sim]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
        const first = await pg.evaluate(() => [...document.querySelectorAll('.rz-cvm:not([hidden]) tr[data-seq-i]:not([hidden])')].length);
        await sleep(900 * sc.steps.length + 400);
        const g = await pg.evaluate(() => {
          const b = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-seq]');
          return { rows: [...b.querySelectorAll('tr[data-seq-i]:not([hidden])')].map((r) => ({ mode: r.getAttribute('data-seq-step-mode'), running: +r.getAttribute('data-seq-running'), short: +r.getAttribute('data-seq-short') })),
            on: [...b.querySelectorAll('[data-seq-fig] rect[data-rzd-state="on"]')].map((r) => r.getAttribute('data-rzd-node')), warn: +b.querySelector('[data-seq-fig]').getAttribute('data-seq-warnings'),
            sim: b.textContent.indexOf('SIMULATED') >= 0 };
        });
        ok(first === 1, 'S7', `${cls}/${sc.id}: a pointer Simulate showed ${first} steps at once, want 1 then one per step`);
        ok(g.rows.map((r) => r.mode).join() === sc.steps.map((s) => s.mode).join(), 'S7', `${cls}/${sc.id}: walked ${g.rows.map((r) => r.mode)}, JSON order ${sc.steps.map((s) => s.mode)}`);
        ok(g.rows.every((r, i) => sc.steps[i] && r.running === sc.steps[i].running && Math.abs(r.short - sc.steps[i].short) < 0.051), 'S7', `${cls}/${sc.id}: step numbers ≠ twin`);
        ok(g.on.length === 1 && g.on[0] === 'seq-' + sc.steps[sc.steps.length - 1].mode, 'S7', `${cls}/${sc.id}: lit ${g.on}, want the last step's mode`);
        ok(g.warn === 0, 'S7', `${cls}/${sc.id}: RZDiagram warned ${g.warn} times on the path`);
        ok(g.sim, 'S7', `${cls}/${sc.id}: steps not labelled SIMULATED`);
        const kb = await pg.evaluate(() => { const b = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-seq]'); b.querySelector('[data-seq-reset]').click();
          const hid = b.querySelectorAll('tr[data-seq-i]:not([hidden])').length; b.querySelector('[data-seq-sim]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
          const all = b.querySelectorAll('tr[data-seq-i]:not([hidden])').length; b.querySelector('[data-seq-reset]').click(); return { hid, all }; });
        ok(kb.hid === 0 && kb.all === sc.steps.length, 'S7', `${cls}/${sc.id}: Reset left ${kb.hid} rows, keyboard Simulate showed ${kb.all} of ${sc.steps.length}`);
      }
      const store1 = await pg.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]));
      ok(store0 === store1, 'S7', `${cls}: Simulate wrote to browser storage`);
    }
  }
}
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

try {
  for (const page of PAGES) {
    const pg = await browser.newPage(), errs = [];
    pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
    await pg.setViewport({ width: 1440, height: 900 });
    await pg.goto(O + page, { waitUntil: 'load', timeout: 90000 });
    /* the values are written after boot: wait until the held points have a tooltip */
    const ids = Object.keys(WANT);
    let seen = [];
    for (let i = 0; i < 60; i++) {
      seen = await pg.evaluate((ids) => ids.flatMap((id) => [...document.querySelectorAll(`[data-point="${id}"][data-pt-tip]`)].map((el) => id)), ids);
      if (seen.length) break;
      await sleep(500);
    }
    ok(seen.length > 0, 'S2', `${page}: no live value of a held point carries a tooltip (points ${ids.join(', ')})`);
    for (const id of [...new Set(seen)]) {
      const r = WANT[id];
      const got = await pg.evaluate((id) => {
        const el = document.querySelector(`[data-point="${id}"][data-pt-tip]`), C = window.RZControlPoints;
        return { tip: el.getAttribute('data-pt-tip'), want: C && C.tipFor ? C.tipFor(id) : null, sp: C && C.spOf ? C.spOf(id) : null };
      }, id);
      ok(!!got.sp && got.sp.value === r.sp.value, 'S2', `${page} ${id}: page SP ${JSON.stringify(got.sp)} ≠ registry ${r.sp.value}`);
      ok(!!got.want && got.tip.indexOf(got.want) >= 0, 'S2', `${page} ${id}: tooltip "${got.tip}" lacks "${got.want}"`);
      ok(got.tip.indexOf(r.sp.evidenceClass) >= 0, 'S2', `${page} ${id}: tooltip does not name the evidence class ${r.sp.evidenceClass}`);

      /* S3: open the trend of that point */
      await pg.evaluate((id) => { document.querySelector(`[data-point="${id}"][data-pt-tip]`).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }, id);
      let t = null;
      for (let i = 0; i < 20; i++) {
        t = await pg.evaluate((id) => {
          const plot = document.querySelector('.rz-trend-plot'); if (!plot) return null;
          return { refs: plot.querySelectorAll(`line.ref[data-ref="${id}"]`).length,
            labels: [...plot.querySelectorAll(`[data-ref-label="${id}"]`)].map((x) => x.textContent.trim()),
            limits: plot.querySelectorAll('[data-limit]').length };
        }, id);
        if (t && t.refs) break;
        await sleep(250);
      }
      ok(!!t && t.refs === 1, 'S3', `${page} ${id}: trend draws ${t ? t.refs : 'no plot,'} SP lines, want 1`);
      ok(!!t && got.sp && t.labels.length === 1 && t.labels[0] === got.sp.label, 'S3', `${page} ${id}: SP line label ${JSON.stringify(t && t.labels)}, want "${got.sp && got.sp.label}"`);
      await pg.keyboard.press('Escape'); await sleep(200);
    }
    /* S4: the equipment modal of a class that holds a setpoint shows a "Setpoints & limits" table: one row per registry
       setpoint of that class, the SP cell = the registry value, the Live cell = the value the page shows */
    if (page === 'chiller-plant.html') {
      const BYCLS = {};
      REG.filter((r) => r.cockpit === 'conv' && r.sp && r.sp.classKey).forEach((r) => { (BYCLS[r.sp.classKey] = BYCLS[r.sp.classKey] || []).push(r); });
      for (const [cls, sel, view] of [['chiller', '#chw-sheet-host .hmi-node[data-node="ch1"]'], ['crah', '#chw-sheet-host .hmi-node[data-node^="crah"]'], ['chw_secondary_pump', '#chw-sheet-host .hmi-node[data-node="ps1"]'], ['tower_cell', '#chw-sheet-host .hmi-node[data-node="ct1"]', '[data-chw-sheet-btn="ch-m-102"]']]) {
        if (view) { await pg.evaluate((v) => { const x = document.querySelector(v); if (x) x.click(); }, view); await sleep(1500); }   /* towers are on the CH-M-102 sheet */
        await pg.waitForFunction((s) => document.querySelector(s), { timeout: 20000 }, sel).catch(() => {});
        const pt = await pg.evaluate((s) => { const g = document.querySelector(s); if (!g) return null; g.scrollIntoView({ block: 'center', inline: 'center' }); const b = g.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
        ok(!!pt, 'S4', `${page}: no ${cls} symbol ${sel}`);
        if (!pt) continue;
        await pg.mouse.click(pt.x, pt.y); await sleep(500);
        if (!(await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])')))) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(500); }
        const m = await pg.evaluate(() => {
          const t = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-sp]'); if (!t) return null;
          return [...t.querySelectorAll('tr[data-sp-row]')].map((r) => ({ id: r.getAttribute('data-sp-row'), sp: r.querySelector('[data-k="sp"]').textContent, pv: r.querySelector('[data-k="pv"]').textContent, src: r.querySelector('[data-k="pv"]').getAttribute('data-src') }));
        });
        const want = (BYCLS[cls] || []).map((r) => r.id).sort();
        /* S4w at 1440 the whole Setpoints table fits its frame: no sideways scroll hiding "Held by" (v3.109.0: a long
           'fixed: …' note in the Adjustable cell made the table 1415 px in a 1212 px frame) */
        const fit = await pg.evaluate(() => { const t = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-sp]'); const w = t && t.closest('.rz-cvm-sp-wrap'); return w ? { tw: t.scrollWidth, ww: w.clientWidth } : null; });
        ok(!!fit && fit.tw <= fit.ww + 1, 'S4w', `${page} ${cls}: Setpoints table ${fit && fit.tw} px in a ${fit && fit.ww} px frame at 1440 (columns scroll out of view)`);
        ok(!!m && m.map((x) => x.id).sort().join() === want.join(), 'S4', `${page} ${cls} modal setpoint rows ${JSON.stringify(m && m.map((x) => x.id))}, want ${JSON.stringify(want)}`);
        for (const row of m || []) {
          const r = REG.find((x) => x.id === row.id);
          ok(parseFloat(row.sp) === r.sp.value, 'S4', `${cls} ${row.id}: SP cell "${row.sp}" ≠ registry ${r.sp.value}`);
          /* a live point moves every tick and the modal repaints its Live cell on its own period (RZConvModal
             opts.period, 4 s by default), so a cell read at an arbitrary moment may be one period old, and a stale
             cell can match a page value that drifted by the same amount as a wrong one. Compare at the repaint
             itself: a MutationObserver callback runs in the microtask right after the modal writes the cell, before
             the page can tick again, so cell and page are read from the same tick. Every repaint seen in 6 s must
             agree; a page that does not show the point falls back to the cell as painted. */
          const o = await pg.evaluate((pv, id) => new Promise((done) => {
            const box = document.querySelector('.rz-cvm:not([hidden])'), pairs = [];
            const read = () => { const e = document.querySelector(`[data-point="${pv}"][data-pt-value]`), c = document.querySelector(`.rz-cvm:not([hidden]) tr[data-sp-row="${id}"] [data-k="pv"]`);
              return { v: e ? +e.getAttribute('data-pt-value') : null, cell: c ? c.textContent : null, src: c ? c.getAttribute('data-src') : null }; };
            const first = read();
            if (!box || first.v === null) { done({ first, pairs }); return; }
            const mo = new MutationObserver(() => { const x = read(); if (x.cell !== null) pairs.push(x); if (pairs.length >= 2) { mo.disconnect(); done({ first, pairs }); } });
            mo.observe(box, { subtree: true, childList: true, characterData: true });
            setTimeout(() => { mo.disconnect(); done({ first, pairs }); }, 6000);
          }), r.sp.pv[0], row.id);
          let shown = o.first.v;
          if (o.first.cell !== null) { row.pv = o.first.cell; row.src = o.first.src; }
          if (shown !== null) {
            ok(o.pairs.length >= 1, 'S4', `${cls} ${row.id}: the Live cell was not repainted in 6 s`);
            const bad = o.pairs.find((x) => !(x.src === 'page' && Math.abs(parseFloat(x.cell) - x.v) < 0.051));
            if (bad) { row.pv = bad.cell; row.src = bad.src; shown = bad.v; }
            else if (o.pairs.length) { row.pv = o.pairs[0].cell; row.src = o.pairs[0].src; shown = o.pairs[0].v; }
          }
          const eng = engineOf(r.sp.pv[0]);
          if (shown !== null) ok(row.src === 'page' && Math.abs(parseFloat(row.pv) - shown) < 0.051, 'S4', `${cls} ${row.id}: Live cell "${row.pv}" (${row.src}) ≠ page value ${shown}`);
          else if (typeof eng === 'number') ok(row.src === 'engine' && Math.abs(parseFloat(row.pv) - eng) < 0.051, 'S4', `${cls} ${row.id}: Live cell "${row.pv}" (${row.src}) ≠ engine ${eng}`);
          else ok(row.pv === '—', 'S4', `${cls} ${row.id}: Live cell "${row.pv}" for a point neither shown nor computed`);
        }
        /* S5 what-if: every adjustable setpoint of this class has a slider; one step up recomputes the engine in the page
           and the SIMULATED table equals a direct Node recompute of the same model (± 0.1 %); Reset restores the SP and
           clears the table; nothing is written to localStorage or sessionStorage */
        for (const r of (BYCLS[cls] || []).filter((x) => x.sp.adjustable)) {
          const a = r.sp.adjustable, to = Math.min(a.max, r.sp.value + a.step);
          const store0 = await pg.evaluate(() => JSON.stringify([Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]), Object.keys(sessionStorage).sort().map((k) => [k, sessionStorage.getItem(k)])]));
          const sim = await pg.evaluate((id, to) => {
            const box = document.querySelector(`.rz-cvm:not([hidden]) [data-rz-cvm-whatif="${id}"]`); if (!box) return null;
            const s = box.querySelector('input[type="range"]'); if (!s) return { noSlider: true };
            const lim = { min: +s.min, max: +s.max, step: +s.step, value: +s.value };
            s.value = String(to); s.dispatchEvent(new Event('input', { bubbles: true }));
            const rows = [...box.querySelectorAll('tr[data-wi-path]')].map((t) => ({ path: t.getAttribute('data-wi-path'), now: t.getAttribute('data-wi-now'), sim: t.getAttribute('data-wi-sim') }));
            const tag = box.textContent.indexOf('SIMULATED') >= 0;
            box.querySelector('[data-wi-reset]').click();
            const after = { value: +s.value, cleared: [...box.querySelectorAll('tr[data-wi-path]')].every((t) => !t.getAttribute('data-wi-sim')) };
            return { lim, rows, tag, after };
          }, r.id, to);
          ok(!!sim && !sim.noSlider, 'S5', `${cls} ${r.id}: no what-if slider ([data-rz-cvm-whatif] with input[type=range])`);
          if (!sim || sim.noSlider) continue;
          ok(sim.lim.min === a.min && sim.lim.max === a.max && sim.lim.step === a.step && sim.lim.value === r.sp.value, 'S5', `${cls} ${r.id}: slider ${JSON.stringify(sim.lim)} ≠ registry ${JSON.stringify(a)} at ${r.sp.value}`);
          const want = (r.sp.whatIf || []).map((w) => w.path);
          ok(want.length > 0 && sim.rows.map((x) => x.path).join() === want.join(), 'S5', `${cls} ${r.id}: what-if rows ${JSON.stringify(sim.rows.map((x) => x.path))}, registry ${JSON.stringify(want)}`);
          ok(sim.tag, 'S5', `${cls} ${r.id}: what-if result is not labelled SIMULATED`);
          const m0 = JSON.parse(JSON.stringify(ENGM)), m1 = JSON.parse(JSON.stringify(ENGM)); setPath(m1, r.sp.param, to);
          const s0 = ENGC.recompute(m0), s1 = ENGC.recompute(m1);
          for (const x of sim.rows) {
            const v0 = getPath(s0, x.path), v1 = getPath(s1, x.path);
            ok(Math.abs(+x.now - v0) <= Math.max(1e-9, Math.abs(v0) * 1e-3), 'S5', `${r.id} ${x.path}: "now" ${x.now} ≠ Node recompute ${v0}`);
            ok(Math.abs(+x.sim - v1) <= Math.max(1e-9, Math.abs(v1) * 1e-3), 'S5', `${r.id} ${x.path}: simulated ${x.sim} ≠ Node recompute ${v1} at ${r.sp.param} = ${to}`);
          }
          ok(sim.rows.some((x) => +x.sim !== +x.now), 'S5', `${r.id}: one step moved no listed output`);
          ok(sim.after.value === r.sp.value && sim.after.cleared, 'S5', `${r.id}: Reset left slider ${sim.after.value} (SP ${r.sp.value}) or a simulated value`);
          const store1 = await pg.evaluate(() => JSON.stringify([Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]), Object.keys(sessionStorage).sort().map((k) => [k, sessionStorage.getItem(k)])]));
          ok(store0 === store1, 'S5', `${r.id}: the what-if wrote to browser storage`);
        }
        /* S7 sequence of operations: a class with data/sequences/<class>.json shows every mode with entry, actions and
           exit, every threshold equal to the twin; Simulate of each scenario walks the steps in the JSON's order with
           the twin's numbers (running, capacity short), lights the step's mode on the path drawn by RZDiagram with 0
           engine warnings; the keyboard shows every step at once; Reset hides them; nothing is stored */
        await seqCheck(pg, cls);
        await pg.keyboard.press('Escape'); await sleep(400);
      }
      /* S8 control loops on the P&ID (PRD-SETPOINT-SIM P4): every registry loop with a sheet has exactly one controller
         bubble tagged as the registry says, one signal from its PV instrument, one signal to every unit of the class it
         drives (getFleet); the bubble's SP = registry, its OUT = the engine's mean drive speed of the running units, a
         remote PV the loop holds reads the setpoint (engine steady state); a double-click opens the modal whose
         Setpoints block names the loop. A registry loop without a sheet says why (notDrawn). 0 orphan bubbles. */
      const LOOPS = REG.filter((r) => r.cockpit === 'conv' && r.sp && r.sp.loop);
      /* S11 control authority (PRD-SETPOINT-SIM P10): a loop's output read from the engine key its registry row names;
         authority = 100 − OUT; saturated when OUT ≥ 100 − 2 or ≤ its minimum + 2 (2 % band ASSUMED). The modal's loop
         line carries data-auth-out / -left / -sat and says SATURATED exactly when saturated. */
      const AUTH = (L) => { if (!L.out) return null; const out = getPath(ENGC.snapshot, L.out.key), mn = L.out.minKey ? getPath(ENGC.snapshot, L.out.minKey) : (typeof L.out.min === 'number' ? L.out.min : null);
        return { out, left: Math.round((100 - out) * 10) / 10, sat: out >= 98 || (mn !== null && out <= mn + 2) }; };
      const authCheck = async (L, law) => {
        const want = AUTH(L); ok(!!want, law, `${L.tag}: registry loop has no out key (P10 authority)`); if (!want) return;
        const a = await pg.evaluate((tag) => { const x = document.querySelector(`.rz-cvm:not([hidden]) [data-rz-cvm-loop="${tag}"]`); return x ? { out: x.getAttribute('data-auth-out'), left: x.getAttribute('data-auth-left'), sat: x.getAttribute('data-auth-sat'), txt: x.textContent } : null; }, L.tag);
        ok(!!a && a.out !== null && Math.abs(+a.out - want.out) < 0.051 && Math.abs(+a.left - want.left) < 0.11, 'S11a', `${L.tag}: modal authority ${JSON.stringify(a && { out: a.out, left: a.left })} ≠ engine OUT ${want.out}, left ${want.left}`);
        ok(!!a && (a.sat === 'true') === want.sat && /SATURATED/.test(a.txt) === want.sat, 'S11b', `${L.tag}: saturated mark ${a && a.sat} / text ${a && /SATURATED/.test(a.txt)} ≠ engine ${want.sat} (OUT ${want.out})`);
      };
      ok(LOOPS.length >= 2, 'S8', `registry has ${LOOPS.length} conv control loops, want ≥ 2`);
      const MVSEL = { chw_secondary_pump: '.hmi-node[data-node^="ps"]', tower_cell: '.hmi-node[data-node^="ct"]' };
      const MVSPD = { chw_secondary_pump: 'speedPct', tower_cell: 'fanSpeedPct' };
      for (const r of LOOPS) {
        const L = r.sp.loop;
        if (!L.sheet) { ok(!!L.notDrawn, 'S8', `${r.id}: loop ${L.tag} has no sheet and no notDrawn reason`); continue; }
        if (/^int-/.test(L.sheet)) continue;   /* a loop inside one unit is drawn on its inside view: S8b */
        if (!/^ch-m-10[12]$/.test(L.sheet)) continue;   /* a loop on another page's sheet: that page's gate (fire FS-M-101: S8e of test-typed-control-numbers) */
        await pg.evaluate((v) => { const x = document.querySelector(`[data-chw-sheet-btn="${v}"]`); if (x) x.click(); }, L.sheet); await sleep(1500);
        const g = await pg.evaluate((tag, pvTag, mvSel) => {
          const svg = document.querySelector('#chw-sheet-host svg'); if (!svg) return null;
          const nodes = [...svg.querySelectorAll('.hmi-node')], by = (t) => nodes.filter((n) => (n.getAttribute('aria-label') || '').startsWith(t + ' — '));
          const near = (pt, n, pad) => { const b = n.getBBox(); return pt[0] >= b.x - pad && pt[0] <= b.x + b.width + pad && pt[1] >= b.y - pad && pt[1] <= b.y + b.height + pad; };
          const ends = [...svg.querySelectorAll('path.hmi-edge.w-signal')].map((p) => { const a = p.getPointAtLength(0), b = p.getPointAtLength(p.getTotalLength()); return [[a.x, a.y], [b.x, b.y]]; });
          const link = (x, y) => ends.filter((e) => (near(e[0], x, 6) && near(e[1], y, 6)) || (near(e[1], x, 6) && near(e[0], y, 6))).length;
          const c = by(tag), pv = by(pvTag), c0 = c[0], mv = [...svg.querySelectorAll(mvSel)];
          const val = (k) => { const t = c0 && svg.querySelector(`[data-val="${c0.getAttribute('data-node')}:${k}"]`); return t ? t.textContent.trim() : null; };
          const pvVal = pv[0] ? [...svg.querySelectorAll(`[data-val^="${pv[0].getAttribute('data-node')}:"]`)].map((t) => t.textContent.trim())[0] : null;
          const bubbles = nodes.filter((n) => /^inst(Panel|Plc)$/.test(n.getAttribute('data-sym'))).map((n) => (n.getAttribute('aria-label') || '').split(' — ')[0]);
          return { ctl: c.length, sym: c0 ? c0.getAttribute('data-sym') : null, id: c0 ? c0.getAttribute('data-node') : null, pv: pv.length, pvLink: c0 && pv[0] ? link(pv[0], c0) : 0,
            mv: mv.length, mvLinked: c0 ? mv.filter((n) => link(c0, n) >= 1).length : 0, sp: val('sp'), out: val('out'), pvVal, bubbles };
        }, L.tag, L.pv.tag, MVSEL[L.mv.classKey] || '.none');
        ok(!!g && g.ctl === 1 && /^inst(Panel|Plc)$/.test(g.sym || ''), 'S8', `${L.sheet}: ${g ? g.ctl : 'no sheet,'} controller bubbles tagged ${L.tag} (want 1, ISA-5.1 instPanel/instPlc)`);
        if (!g || g.ctl !== 1) continue;
        ok(g.pv === 1 && g.pvLink >= 1, 'S8', `${L.tag}: PV ${L.pv.tag} drawn ${g.pv}×, signals PV→controller ${g.pvLink}`);
        const fleet = ENGC.getFleet(L.mv.classKey), run = fleet.filter((u) => u.state === 'running');
        ok(g.mv === fleet.length && g.mvLinked === fleet.length, 'S8', `${L.tag}: ${g.mvLinked} of ${g.mv} drawn ${L.mv.classKey} units joined by a signal (engine fleet ${fleet.length})`);
        ok(g.sp !== null && Math.abs(parseFloat(String(g.sp).replace(/^SP\s*/, '')) - r.sp.value) < 0.051, 'S8', `${L.tag}: bubble SP "${g.sp}" ≠ registry ${r.sp.value}`);
        const mean = run.length ? Math.round(run.reduce((a, u) => a + u[MVSPD[L.mv.classKey]], 0) / run.length * 10) / 10 : null;
        ok(g.out !== null && mean !== null && Math.abs(parseFloat(String(g.out).replace(/^OUT\s*/, '')) - mean) < 0.051, 'S8', `${L.tag}: bubble OUT "${g.out}" ≠ engine mean ${MVSPD[L.mv.classKey]} ${mean} of ${run.length} running`);
        if (L.pv.draw) ok(g.pvVal !== null && Math.abs(parseFloat(g.pvVal) - r.sp.value) < 0.051, 'S8', `${L.pv.tag}: remote PV "${g.pvVal}" ≠ the setpoint it is held at (${r.sp.value}, engine steady state)`);
        const regTags = LOOPS.filter((x) => x.sp.loop.sheet === L.sheet).map((x) => x.sp.loop.tag).sort();
        ok(JSON.stringify([...g.bubbles].sort()) === JSON.stringify(regTags), 'S8', `${L.sheet}: controller bubbles ${JSON.stringify(g.bubbles)} ≠ registry loops ${JSON.stringify(regTags)} (orphan or missing)`);
        const pt = await pg.evaluate((id) => { const n = document.querySelector(`#chw-sheet-host .hmi-node[data-node="${id}"]`); n.scrollIntoView({ block: 'center', inline: 'center' }); const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, g.id);
        /* hover marks the whole loop: the controller, its PV instrument, every driven unit and the signal lines */
        await pg.mouse.move(pt.x, pt.y); await sleep(350);
        const hv = await pg.evaluate((pvTag, mvSel) => { const svg = document.querySelector('#chw-sheet-host svg'), on = [...svg.querySelectorAll('.is-loop')];
          return { nodes: on.filter((e) => e.matches('.hmi-node')).map((e) => (e.getAttribute('aria-label') || '').split(' — ')[0]), mv: on.filter((e) => e.matches(mvSel)).length, sig: on.filter((e) => e.matches('path.hmi-edge.w-signal')).length,
            pv: on.some((e) => (e.getAttribute('aria-label') || '').startsWith(pvTag + ' — ')) }; }, L.pv.tag, MVSEL[L.mv.classKey] || '.none');
        ok(hv.nodes.includes(L.tag) && hv.pv && hv.mv === fleet.length && hv.sig >= fleet.length + 1, 'S8', `${L.tag}: hover marks ${JSON.stringify(hv)} (want controller, ${L.pv.tag}, ${fleet.length} driven units, ≥ ${fleet.length + 1} signal lines)`);
        await pg.mouse.move(2, 2); await sleep(150);
        ok(await pg.evaluate(() => !document.querySelector('#chw-sheet-host .is-loop')), 'S8', `${L.tag}: the loop stays marked after the pointer leaves`);
        await pg.mouse.click(pt.x, pt.y); await sleep(500);
        if (!(await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])')))) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(700); }
        const ml = await pg.evaluate((tag) => { const x = document.querySelector(`.rz-cvm:not([hidden]) [data-rz-cvm-loop="${tag}"]`); return x ? x.textContent : null; }, L.tag);
        ok(!!ml && ml.indexOf(L.pv.tag) >= 0 && ml.indexOf(L.action + ' acting') >= 0, 'S8', `${L.tag}: double-click opens no modal naming the loop ([data-rz-cvm-loop]) — got ${JSON.stringify(ml && ml.slice(0, 120))}`);
        await authCheck(L, 'S11');
        await pg.keyboard.press('Escape'); await sleep(400);
      }
      await pg.evaluate(() => { const x = document.querySelector('[data-chw-sheet-btn="ch-m-101"]'); if (x) x.click(); }); await sleep(800);
      /* S8b unit loops on the inside view (PRD-SETPOINT-SIM P4b): a registry loop whose sheet is int-<class> is drawn
         inside every unit of that class. Open one running unit: exactly one controller bubble tagged as the registry
         says, its PV instrument and the MV it drives joined to it by signal lines, SP = registry, OUT = the engine
         (chiller drive speed, CRAH coil-flow opening), no other controller bubble (orphan), hover marks the loop. */
      const INT = LOOPS.filter((r) => /^int-/.test(r.sp.loop.sheet || ''));
      ok(INT.length >= 2, 'S8b', `registry has ${INT.length} loops drawn inside a unit (int-*), want ≥ 2 (TIC-CHWS, TIC-SAT)`);
      const OPENER = { chiller: '.hmi-node[data-node="ch1"]', crah: '.hmi-node[data-node^="crah"]' };
      const OUTKEY = { chiller: 'cooling.chiller_speed_pct', crah: 'cooling.crah_valve_open_pct' };
      for (const r of INT) {
        const L = r.sp.loop;
        const pt = await pg.evaluate((sel) => { const n = document.querySelector('#chw-sheet-host ' + sel); if (!n) return null; n.scrollIntoView({ block: 'center', inline: 'center' }); const b = (n.querySelector('.b') || n).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, OPENER[L.mv.classKey] || '.none');
        ok(!!pt, 'S8b', `${L.tag}: no ${L.mv.classKey} unit on CH-M-101 to open`); if (!pt) continue;
        await pg.mouse.click(pt.x, pt.y); await sleep(600);
        if (!(await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden]) #rz-cvm-int-svg')))) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(800); }
        const g = await pg.evaluate((tag, pvNode, mvNode) => {
          const svg = document.querySelector('.rz-cvm:not([hidden]) #rz-cvm-int-svg'); if (!svg) return null;
          const nodes = [...svg.querySelectorAll('.hmi-node')], c = nodes.filter((n) => (n.getAttribute('aria-label') || '').startsWith(tag + ' — '));
          const node = (id) => svg.querySelector(`.hmi-node[data-node="${id}"]`), c0 = c[0], pv = node(pvNode), mv = node(mvNode);
          const near = (p, n, pad) => { const b = n.getBBox(); return p[0] >= b.x - pad && p[0] <= b.x + b.width + pad && p[1] >= b.y - pad && p[1] <= b.y + b.height + pad; };
          const ends = [...svg.querySelectorAll('path.hmi-edge.w-signal')].map((p) => { const a = p.getPointAtLength(0), b = p.getPointAtLength(p.getTotalLength()); return [[a.x, a.y], [b.x, b.y]]; });
          const link = (x, y) => x && y ? ends.filter((e) => (near(e[0], x, 6) && near(e[1], y, 6)) || (near(e[1], x, 6) && near(e[0], y, 6))).length : 0;
          const val = (k) => { const t = c0 && svg.querySelector(`[data-val="${c0.getAttribute('data-node')}:${k}"]`); return t ? t.textContent.trim() : null; };
          const bubbles = nodes.filter((n) => n.getAttribute('data-sym') === 'instPanel').map((n) => (n.getAttribute('aria-label') || '').split(' — ')[0]);
          return { ctl: c.length, sym: c0 ? c0.getAttribute('data-sym') : null, id: c0 ? c0.getAttribute('data-node') : null, pv: !!pv, mv: !!mv,
            pvLink: link(pv, c0), mvLink: link(c0, mv), sp: val('sp'), out: val('out'), bubbles };
        }, L.tag, L.pv.node, L.mv.node);
        ok(!!g && g.ctl === 1 && g.sym === 'instPanel', 'S8b', `${L.sheet}: ${g ? g.ctl : 'no inside view,'} controller bubbles tagged ${L.tag} (want 1, ISA-5.1 instPanel)`);
        if (!g || g.ctl !== 1) { await pg.keyboard.press('Escape'); await sleep(400); continue; }
        ok(g.pv && g.pvLink >= 1, 'S8b', `${L.tag}: PV node ${L.pv.node} drawn ${g.pv}, signals PV→controller ${g.pvLink}`);
        ok(g.mv && g.mvLink >= 1, 'S8b', `${L.tag}: MV node ${L.mv.node} drawn ${g.mv}, signals controller→MV ${g.mvLink}`);
        ok(g.sp !== null && Math.abs(parseFloat(String(g.sp).replace(/^SP\s*/, '')) - r.sp.value) < 0.051, 'S8b', `${L.tag}: bubble SP "${g.sp}" ≠ registry ${r.sp.value}`);
        const want = getPath(ENGC.snapshot, OUTKEY[L.mv.classKey]);
        ok(g.out !== null && want !== null && Math.abs(parseFloat(String(g.out).replace(/^OUT\s*/, '')) - want) < 0.051, 'S8b', `${L.tag}: bubble OUT "${g.out}" ≠ engine ${OUTKEY[L.mv.classKey]} ${want}`);
        const regTags = INT.filter((x) => x.sp.loop.sheet === L.sheet).map((x) => x.sp.loop.tag).sort();
        ok(JSON.stringify([...g.bubbles].sort()) === JSON.stringify(regTags), 'S8b', `${L.sheet}: controller bubbles ${JSON.stringify(g.bubbles)} ≠ registry loops ${JSON.stringify(regTags)} (orphan or missing)`);
        const cp = await pg.evaluate((id) => { const n = document.querySelector(`#rz-cvm-int-svg .hmi-node[data-node="${id}"]`); n.scrollIntoView({ block: 'center', inline: 'center' }); const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, g.id);
        await pg.mouse.move(cp.x, cp.y); await sleep(350);
        const hv = await pg.evaluate((pvNode, mvNode, id) => { const svg = document.querySelector('#rz-cvm-int-svg'), on = (sel) => !!svg.querySelector(sel + '.is-loop');
          return { ctl: on(`.hmi-node[data-node="${id}"]`), pv: on(`.hmi-node[data-node="${pvNode}"]`), mv: on(`.hmi-node[data-node="${mvNode}"]`), sig: svg.querySelectorAll('path.hmi-edge.w-signal.is-loop').length }; }, L.pv.node, L.mv.node, g.id);
        ok(hv.ctl && hv.pv && hv.mv && hv.sig >= 2, 'S8b', `${L.tag}: hover marks ${JSON.stringify(hv)} (want controller, PV, MV and ≥ 2 signal lines)`);
        await pg.mouse.move(2, 2); await sleep(150);
        ok(await pg.evaluate(() => !document.querySelector('#rz-cvm-int-svg .is-loop')), 'S8b', `${L.tag}: the loop stays marked after the pointer leaves`);
        await authCheck(L, 'S11');
        const w = AUTH(L); if (w) ok(/SAT/.test(String(g.out)) === w.sat, 'S11b', `${L.tag}: bubble OUT "${g.out}" carries SAT ${/SAT/.test(String(g.out))}, engine saturated ${w.sat}`);
        await pg.keyboard.press('Escape'); await sleep(500);
      }
      /* S8c a reset loop (rack inlet → supply air) names a slave that is a registry loop, and the slave's setpoint is the
         master's (contained aisle, no mixing modelled: the engine sets one equal to the other) */
      for (const r of LOOPS.filter((x) => x.sp.loop.kind === 'reset')) {
        const sl = LOOPS.find((x) => x.sp.loop.tag === r.sp.loop.slave);
        ok(!!sl && Math.abs(sl.sp.value - r.sp.value) < 0.051, 'S8c', `${r.sp.loop.tag} resets ${r.sp.loop.slave}: slave ${sl ? sl.sp.value : 'missing'} ≠ master ${r.sp.value}`);
      }
      ok(LOOPS.some((x) => x.sp.loop.kind === 'reset'), 'S8c', 'no reset loop in the registry (rack inlet → supply air)');
      /* S11c the Loops table (PRD-SETPOINT-SIM P10): the chiller-plant side card lists every registry loop drawn on this
         page's sheets (CH-M-101, CH-M-102) or inside its machines (the chiller internals) — one row per loop, no more —
         with SP = registry, Live = the page's value of the loop's PV (else the engine's), OUT / left = the engine's, and
         the word saturated exactly when the engine output is within 2 % of a limit */
      const PAGE_SHEETS = ['ch-m-101', 'ch-m-102', 'int-chiller'];
      const wantLoops = LOOPS.filter((r) => PAGE_SHEETS.includes(r.sp.loop.sheet));
      await pg.waitForFunction(() => document.querySelectorAll('[data-rz-loops] tr[data-loop-row] td[data-k="pv"]').length > 0 &&
        ![...document.querySelectorAll('[data-rz-loops] tr[data-loop-row] td[data-k="pv"]')].some((c) => c.textContent === '—'), { timeout: 15000 }).catch(() => {});
      const lt = await pg.evaluate(() => [...document.querySelectorAll('[data-rz-loops] tr[data-loop-row]')].map((tr) => ({ tag: tr.getAttribute('data-loop-row'),
        sp: tr.querySelector('[data-k="sp"]').textContent, pv: tr.querySelector('[data-k="pv"]').textContent, err: tr.querySelector('[data-k="err"]').textContent,
        out: tr.getAttribute('data-auth-out'), left: tr.getAttribute('data-auth-left'), sat: tr.getAttribute('data-auth-sat'), state: tr.querySelector('[data-k="state"]').textContent })));
      ok(lt.length === wantLoops.length && wantLoops.every((r) => lt.some((x) => x.tag === r.sp.loop.tag)), 'S11c',
        `Loops table rows [${lt.map((x) => x.tag)}] ≠ registry loops on this page [${wantLoops.map((r) => r.sp.loop.tag)}]`);
      for (const r of wantLoops) {
        const x = lt.find((y) => y.tag === r.sp.loop.tag), w = AUTH(r.sp.loop); if (!x || !w) continue;
        ok(x.sp.startsWith(String(r.sp.value)) || parseFloat(x.sp) === r.sp.value, 'S11c', `${x.tag}: Loops SP "${x.sp}" ≠ registry ${r.sp.value}`);
        ok(/\d/.test(x.pv) && /\d/.test(x.err), 'S11c', `${x.tag}: Loops Live "${x.pv}" / Error "${x.err}" not filled`);
        ok(Math.abs(+x.out - w.out) < 0.051 && Math.abs(+x.left - w.left) < 0.11, 'S11a', `${x.tag}: Loops OUT ${x.out} / left ${x.left} ≠ engine ${w.out} / ${w.left}`);
        ok((x.sat === 'true') === w.sat && /saturated/i.test(x.state) === w.sat, 'S11b', `${x.tag}: Loops state "${x.state}" (sat ${x.sat}) ≠ engine saturated ${w.sat} (OUT ${w.out})`);
      }
      /* S6 page setpoint sliders (PRD-SETPOINT-SIM P2, the chiller-plant MAINT panel): in maintenance the running
         loops sit at the steady state of the setpoints, exactly, with no lag and no noise on the next ticks (no source
         states a time constant, so dynamics are not modelled and the panel says so); the DP slider shows the engine's
         secondary pump response labelled SIMULATED, equal to a Node recompute at that DP (± 0.1 %) */
      const DPR = REG.find((x) => x.id === 'conv.chiller-plant.chw_dp_sp');
      const pick = await pg.evaluate(() => {
        const g = (id) => document.getElementById(id);
        if (!g('maintTgl') || !g('spDp')) return null;
        if (!g('maintTgl').classList.contains('on')) g('maintTgl').click();
        const set = (id, v) => { const s = g(id); s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true })); return +s.value; };
        const c = g('spChws'), f = g('spFlow'), range = { chws: [c.min, c.max], flow: [f.min, f.max] };
        return { range, dp: set('spDp', 120), chws: set('spChws', Math.round((+c.min + 1) * 10) / 10), flow: set('spFlow', Math.round((+f.min + (+f.max - +f.min) * 0.4) * 10) / 10) };
      });
      ok(!!pick, 'S6', `${page}: no MAINT toggle or DP setpoint slider`);
      /* the secondary loop SP cannot go below the primary CHWS (a decoupled secondary loop has no cooling of its own):
         the slider range is bound to the engine from the first paint, not only after a scenario is picked */
      const CHWS = getPath(ENGC.snapshot, 'cooling.chws_c');
      if (pick) ok(Math.abs(+pick.range.chws[0] - CHWS) < 0.051 && Math.abs(+pick.range.chws[1] - (CHWS + 4)) < 0.051 && pick.range.flow[0] !== '' && pick.range.flow[1] !== '', 'S6', `${page}: at first paint the secondary SP slider is ${pick.range.chws} (want ${CHWS}…${CHWS + 4}) and the flow slider ${pick.range.flow}`);
      if (pick) {
        const loops = () => pg.evaluate(() => [...document.querySelectorAll('[data-point$=".loop_flow"]')].map((e) => {
          const p = e.getAttribute('data-point').replace(/loop_flow$/, ''), v = (k) => { const x = document.querySelector(`[data-point="${p}${k}"]`); return x ? parseFloat(x.textContent) : NaN; };
          return { id: p, flow: v('loop_flow'), chws: v('chws_c'), dp: v('loop_dp') };
        }).filter((l) => l.flow > 0));
        await sleep(2700); const a = await loops(); await sleep(2500); const b = await loops();
        ok(a.length > 0, 'S6', `${page}: no running loop in the MAINT table`);
        for (const l of a) ok(Math.abs(l.flow - pick.flow) < 0.051 && Math.abs(l.chws - pick.chws) < 0.051 && l.dp === pick.dp, 'S6', `${l.id}: MAINT loop ${JSON.stringify(l)} not at the setpoints ${JSON.stringify(pick)}`);
        ok(JSON.stringify(a) === JSON.stringify(b), 'S6', `${page}: MAINT loops moved between ticks at constant setpoints (lag or noise): ${JSON.stringify(a[0])} → ${JSON.stringify(b[0])}`);
        const d = await pg.evaluate(() => { const x = document.querySelector('[data-sp-sim="spDp"]'); return x ? { text: x.textContent, rows: [...x.querySelectorAll('[data-wi-path]')].map((t) => ({ path: t.getAttribute('data-wi-path'), sim: +t.getAttribute('data-wi-sim') })) } : null; });
        ok(!!d && /SIMULATED/.test(d.text) && /not modelled/i.test(d.text), 'S6', `${page}: the DP slider shows no SIMULATED engine response with "dynamics not modelled" ([data-sp-sim="spDp"])`);
        if (d && DPR) {
          const m1 = JSON.parse(JSON.stringify(ENGM)); setPath(m1, DPR.sp.param, pick.dp); const s1 = ENGC.recompute(m1);
          ok(d.rows.map((x) => x.path).join() === DPR.sp.whatIf.map((w) => w.path).join(), 'S6', `${page}: DP response rows ${d.rows.map((x) => x.path)} ≠ registry what-if`);
          for (const x of d.rows) { const v = getPath(s1, x.path); ok(Math.abs(x.sim - v) <= Math.max(1e-9, Math.abs(v) * 1e-3), 'S6', `${x.path}: page ${x.sim} ≠ Node recompute ${v} at DP ${pick.dp}`); }
        }
      }
    }
    ok(!errs.length, 'S9', `${page}: page errors ${errs.slice(0, 3).join(' | ')}`);
    await pg.close();
  }
  /* S8d phone (390 px): hovering or tapping a loop bubble on CH-M-101 / CH-M-102 shows its tooltip inside the viewport
     with every value cell inside the tooltip. Red on v3.107.0: a page rule for phone tables (display:block + nowrap)
     reached the tooltip table and pushed PDIC-01's values out to x 874 on a 390 px screen. */
  {
    const pg = await browser.newPage(), errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pg.goto(O + 'chiller-plant.html', { waitUntil: 'load', timeout: 90000 }); await sleep(4000);
    for (const [view, sp] of [['ch-m-101', 'conv.chiller-plant.chw_dp_sp'], ['ch-m-102', 'conv.chiller-plant.cdw_supply_sp']]) {
      await pg.evaluate((v) => { const x = document.querySelector(`[data-chw-sheet-btn="${v}"]`); if (x) x.click(); }, view); await sleep(1500);
      const pt = await pg.evaluate((id) => { const n = document.querySelector(`#chw-sheet-host .hmi-node[data-sym="instPanel"][data-loop="${id}"]`); if (!n) return null; n.scrollIntoView({ block: 'center', inline: 'center' }); const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sp);
      ok(!!pt, 'S8d', `${view}: no loop bubble for ${sp} at 390 px`); if (!pt) continue;
      await sleep(400); await pg.mouse.move(pt.x, pt.y); await sleep(800);
      const t = await pg.evaluate(() => { const t = document.querySelector('.hmi-tip.is-on'); if (!t) return null; const r = t.getBoundingClientRect();
        const cells = [...t.querySelectorAll('td')].map((d) => d.getBoundingClientRect()), rows = t.querySelectorAll('tr').length;
        return { l: r.left, r: r.right, vw: innerWidth, rows, out: cells.filter((c) => c.left < r.left - 1 || c.right > r.right + 1).length }; });
      ok(!!t && t.rows >= 4, 'S8d', `${view}: the bubble tooltip at 390 px has ${t ? t.rows : 'no'} rows`);
      ok(!!t && t.l >= 0 && t.r <= t.vw, 'S8d', `${view}: tooltip ${t && Math.round(t.l)}–${t && Math.round(t.r)} leaves the 390 px viewport`);
      ok(!!t && t.out === 0, 'S8d', `${view}: ${t && t.out} tooltip value cells lie outside the tooltip at 390 px`);
      await pg.mouse.move(2, 2); await sleep(300);
    }
    ok(!errs.length, 'S8d', `phone: page errors ${errs.slice(0, 3).join(' | ')}`);
    await pg.close();
  }
  /* S7 beyond the chiller plant: a generating set on the fuel cockpit (fuel-system.html F4) and a UPS on the EPMS LV
     view open the equipment modal on the inside of the unit; the class's sequence of operations walks like every other */
  const { primeCockpitAuditDocument, enterAuthorizedAuditState } = await import('./lib/cockpit-audit-state.mjs');
  for (const [page, sel, cls, ident, prep] of [
    ['fuel-system.html', '#fuel-sheet-host .hmi-node[data-node="gen1"]', 'genset', null, null],
    ['EPMS_Telemetry.html', '#epms-lv-host .hmi-node[data-node="ua-inv"]', 'ups', 'epms', '.epms-view-btn[data-epms-view="lv"]']]) {
    const pg = await browser.newPage(), errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: 1440, height: 900 });
    if (ident) await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(O + page, { waitUntil: 'load', timeout: 90000 });
    if (ident) await enterAuthorizedAuditState(pg, ident);
    if (prep) { await pg.waitForFunction((s) => document.querySelector(s), { timeout: 30000 }, prep).catch(() => {}); await pg.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); }, prep); await sleep(1800); }
    await pg.waitForFunction((s) => document.querySelector(s), { timeout: 30000 }, sel).catch(() => {});
    const pt = await pg.evaluate((s) => { const g = document.querySelector(s); if (!g) return null; g.scrollIntoView({ block: 'center', inline: 'center' }); const b = (g.querySelector('.b') || g).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
    ok(!!pt, 'S7', `${page}: no ${cls} symbol ${sel}`);
    if (pt) {
      await pg.mouse.click(pt.x, pt.y); await sleep(900);
      if (!(await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])')))) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(900); }
      ok(!!SEQ[cls], 'S7', `${cls}: no sequence in js/rz-sequences.js`);
      await seqCheck(pg, cls);
    }
    ok(!errs.length, 'S9', `${page}: page errors ${errs.slice(0, 3).join(' | ')}`);
    await pg.close();
  }
} finally {
  await browser.close(); srv.close();
}
if (fails.length) { console.log(`FAIL setpoint sim — ${fails.length} failed, ${passes} passed`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS setpoint sim — ${passes} checks (S2 tooltip = registry, S3 trend SP line, S4 modal Setpoints & limits, S5 what-if = Node recompute, S6 MAINT sliders at steady state, S7 sequence walk, S9 no page errors)`);
