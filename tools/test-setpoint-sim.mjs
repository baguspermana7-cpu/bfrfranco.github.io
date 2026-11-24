/*
 * test-setpoint-sim.mjs — PRD-SETPOINT-SIM browser laws (documentation/prd/PRD_SETPOINT_SIM.md §B3). P1 laws:
 *
 *   S2 shown = registry: every live value on a Conventional cockpit whose point is held to a setpoint
 *      (js/rz-control-points.js spOf(id) != null) carries the setpoint in its tooltip, word for word tipFor(id),
 *      and the value equals data/control-points.json (read independently here, not through the page)
 *   S3 trend SP line: opening that point's trend draws exactly one reference line for it, labelled with the SP text
 *      ("SP 19.4"), and the limit lines are unchanged in number
 *   S9 (part) 0 page errors on the pages visited
 *
 * Red first: on v3.102.0 (no control registry in the browser) S2 and S3 fail on every page.
 *   node tools/test-setpoint-sim.mjs        run inside a browser lane (rz-lane)
 *   RZ_SP_PLANT=no-registry                 serve js/rz-control-points.js as 404 (the old state): S2 and S3 must fail
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
  if (process.env.RZ_SP_PLANT === 'no-sequence' && rel === 'js/conv/sequence-view.js') { r.writeHead(404); r.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const O = `http://127.0.0.1:${srv.address().port}/`;
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
        await pg.keyboard.press('Escape'); await sleep(400);
      }
    }
    ok(!errs.length, 'S9', `${page}: page errors ${errs.slice(0, 3).join(' | ')}`);
    await pg.close();
  }
} finally {
  await browser.close(); srv.close();
}
if (fails.length) { console.log(`FAIL setpoint sim — ${fails.length} failed, ${passes} passed`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS setpoint sim — ${passes} checks (S2 tooltip = registry, S3 trend SP line, S4 modal Setpoints & limits, S5 what-if = Node recompute, S7 sequence walk, S9 no page errors)`);
