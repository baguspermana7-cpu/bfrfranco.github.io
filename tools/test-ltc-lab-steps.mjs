#!/usr/bin/env node
/**
 * test-ltc-lab-steps.mjs — the LTC lab step thread (js/ltc-lab-steps.js) works and tells the truth.
 *
 * S1 seven steps render, exactly one aria-current; #step=n selects that step
 * S2 every step result is non-empty, and changing IT load changes the Load and Capture results
 * S3 the arithmetic strip: every line that substitutes numbers RECOMPUTES within 1e-6 relative of the engine ("holds");
 *    a line that substitutes but does not hold is a failure (the strip would be showing a wrong equation)
 * S4 the step's equipment is outlined on the plant diagram (Loop → cdu + cool)
 * S5 0 page errors, scrollWidth <= viewport at 1440 and 390
 * S6 DESIGN STATUS states its basis: no radial donut or bar track; the total equals the weighted sum of the five
 *    standard scores; each design screen row recomputes (within 0.6 of the shown integer) from the numbers its basis line shows
 * S7 Run semantics: auto-run is on by default and the Recompute button is hidden; switching auto-run off reaches the
 *    engine toggle and shows Recompute; an edit then leaves the result unchanged and marks Recompute due; clicking it
 *    updates the result and clears the mark
 * S9 Sensitivity perturbs the model the page shows: every listed ΔPUE is reproduced by recomputing the plant
 *    (LTCLabPlant) with that input one step up, and no listed input is one the plant ignores
 * S10 Review compares against the last saved scenario: empty state before any save; right after a save every row
 *    reads "same" (the before, recomputed from the saved inputs, reproduces the shown design); after an edit each
 *    row's after equals the live model and its better/worse word follows the sign
 * S8 The right rail follows the step: at Load the Standards/Design/Validation cards are folded with a link to Check and
 *    Sensitivity is open; at Check they are open; the fold link selects its step
 * Env RZ_BASE (default http://127.0.0.1:8165). Run under the shared browser lock.
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.RZ_BASE || 'http://127.0.0.1:8165';
let puppeteer;
try { puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer'); }
catch { puppeteer = createRequire('/home/baguspermana7/wt-journal/package.json')('puppeteer'); }
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
try {
  for (const w of [1440, 390]) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
    await p.goto(`${BASE}/robots.txt`);
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator', expires: new Date(Date.now() + 864e5).toISOString() })); localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', 'dark'); });
    await p.goto(`${BASE}/ltc-system-modelling-lab.html#step=3`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 3000));
    const s1 = await p.evaluate(() => ({ n: document.querySelectorAll('.ltc-step').length, cur: [...document.querySelectorAll('.ltc-step[aria-current]')].map((e) => e.id),
      res: [...document.querySelectorAll('.ltc-step-res')].map((e) => e.textContent.trim()),
      lit: [...document.querySelectorAll('rect.ltc-step-node')].map((r) => r.getAttribute('data-rzd-node')).sort().join(',') }));
    ok(s1.n === 7, `${w} S1 ${s1.n} steps`);
    ok(s1.cur.length === 1 && s1.cur[0] === 'ltcStep-loop', `${w} S1 current ${s1.cur}`);
    ok(s1.res.every((t) => t && !/undefined|NaN|^–/.test(t)), `${w} S2 empty/NaN result: ${s1.res.join(' | ')}`);
    ok(s1.lit === 'cdu,cool', `${w} S4 outlined ${s1.lit}`);
    for (const k of ['capture', 'loop', 'rejection', 'cost']) {
      await p.click('#ltcStep-' + k); await new Promise((r) => setTimeout(r, 300));
      const rows = await p.evaluate(() => [...document.querySelectorAll('.ltc-arith-row')].map((r) => r.children[3].textContent + '|' + r.children[0].textContent));
      ok(rows.length > 0, `${w} S3 ${k}: no strip`);
      rows.filter((r) => r.startsWith('engine value')).forEach((r) => fails.push(`${w} S3 ${k}: substituted line does not recompute: ${r}`));
      ok(rows.some((r) => r.startsWith('holds')), `${w} S3 ${k}: no line holds`);
    }
    const ds = await p.evaluate(() => {
      const m = window.__ltcLastModel, C = window.RZEngine.data.ltcCalibration, sc = m.scores;
      const sum = sc.ashrae * C.totalScoreWeightAshrae + sc.ansi * C.totalScoreWeightAnsi + sc.iso * C.totalScoreWeightIso
        + sc.nfpa * C.totalScoreWeightNfpa + sc.uptime * C.totalScoreWeightUptime;
      return { donut: !!document.querySelector('#ltcRadialSvg, .ltc-sub-bar-track'), total: document.getElementById('ltcRadialPct').textContent,
        sum, rows: [...document.querySelectorAll('#ltcSubBars .ltc-sub-bar-row')].map((r) => [r.querySelector('.ltc-sub-bar-lbl').textContent,
          +r.querySelector('.ltc-sub-bar-val').textContent, r.querySelector('.ltc-sub-bar-basis')?.textContent || '']) };
    });
    ok(!ds.donut, `${w} S6 radial donut / bar track still rendered`);
    ok(String(Math.round(ds.sum)) === ds.total, `${w} S6 total ${ds.total} != weighted sum ${ds.sum}`);
    const num = (t) => (t.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const clamp = (v) => Math.min(100, Math.max(0, v));
    const re = { Efficiency: ([pue, best, , worst]) => clamp((worst - pue) / (worst - best) * 100),
      Resilience: ([ri, lo, , hi]) => clamp((hi - ri) / (hi - lo) * 100),
      Operability: ([conf, max]) => clamp(conf / max * 100) };
    ok(ds.rows.length === 4, `${w} S6 expected 4 design screens, got ${ds.rows.length}`);
    for (const [lbl, val, basis] of ds.rows) {
      if (!basis) { fails.push(`${w} S6 ${lbl}: no basis line`); continue; }
      if (re[lbl]) ok(Math.abs(re[lbl](num(basis)) - val) <= 0.6, `${w} S6 ${lbl} ${val} does not recompute from "${basis}"`);
    }
    const before = await p.evaluate(() => document.querySelector('#ltcStep-capture .ltc-step-res').textContent);
    await p.evaluate(() => { const e = document.getElementById('inItLoad'); e.value = '60'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await p.evaluate(() => document.querySelector('#ltcStep-capture .ltc-step-res').textContent);
    ok(after !== before, `${w} S2 Capture result did not change after IT load 60 (${before})`);
    const rail = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ltc-rail-card')].map((c) => {
      const t = c.querySelector('.ltc-rail-title'); const g = c.querySelector('.ltc-rail-go');
      return [t ? t.textContent.trim() : '?', (c.classList.contains('is-folded') ? 'folded' : 'open') + (g && !g.hidden ? ':' + g.textContent.trim() : '')]; })));
    await p.evaluate(() => document.getElementById('ltcStep-load').click());
    let rl = await rail();
    for (const k of ['STANDARDS SCREEN', 'DESIGN STATUS', 'MODEL VALIDATION'])
      ok(/^folded:Check/.test(rl[k] || ''), `${w} S8 at Load ${k} should be folded with a Check link: ${rl[k]}`);
    ok(rl['SENSITIVITY ANALYSIS'] === 'open', `${w} S8 at Load sensitivity should be open: ${rl['SENSITIVITY ANALYSIS']}`);
    const went = await p.evaluate(() => { const g = document.querySelector('.ltc-rail-card.is-folded .ltc-rail-go[data-step="check"]'); if (!g) return false; g.click(); return true; });
    ok(went, `${w} S8 no fold link to Check on a folded card`);
    rl = await rail();
    const cur = await p.evaluate(() => document.querySelector('.ltc-step[aria-current="step"]')?.id);
    ok(cur === 'ltcStep-check', `${w} S8 fold link did not select Check (${cur})`);
    for (const k of ['STANDARDS SCREEN', 'DESIGN STATUS', 'MODEL VALIDATION'])
      ok(rl[k] === 'open', `${w} S8 at Check ${k} should be open: ${rl[k]}`);
    ok(/^folded:Review/.test(rl['SCENARIO INFO'] || ''), `${w} S8 at Check scenario info should fold to Review: ${rl['SCENARIO INFO']}`);
    await p.evaluate(() => document.getElementById('ltcStep-load').click());
    const sens = await p.evaluate(() => {
      const m = window.__ltcLastModel, LP = window.LTCLabPlant, LM = RZEngine.models.ltc;
      const P = RZEngine.data.ltcCalibration.impactParams.concat([{ key: 'upsEff', label: 'UPS efficiency', step: 0.5, min: 90, max: 99.5 },
        { key: 'pumpHead', label: 'Pump head', step: 2, min: 5, max: 90 }, { key: 'distLoss', label: 'Distribution loss', step: 0.5, min: 0.5, max: 8 }]);
      return [...document.querySelectorAll('#ltcSensBars .ltc-sens-row')].map((r) => {
        const name = r.querySelector('.ltc-sens-name').firstChild.textContent.trim(); const shown = +r.querySelector('.ltc-sens-delta').textContent;
        const c = P.find((q) => q.label === name); if (!c) return [name, shown, null];
        const x = Object.assign({}, m.input); x[c.key] = Math.min(c.max, Math.max(c.min, +x[c.key] + c.step));
        if (c.key === 'supplyTemp') x.returnTemp = x.supplyTemp + Math.max(m.input.returnTemp - m.input.supplyTemp, 6);
        return [name, shown, LP.compute(x, LM.compute(x)).pue - m.pue];
      });
    });
    ok(sens.length >= 3, `${w} S9 sensitivity lists ${sens.length} rows`);
    for (const [n, shown, d] of sens) {
      ok(d !== null, `${w} S9 sensitivity row "${n}" is not a known input`);
      if (d !== null) ok(Math.abs(d) >= 5e-6 && Math.abs(shown - d) <= 5e-5, `${w} S9 "${n}" shows ${shown}, plant recompute ${d.toFixed(5)}`);
    }
    const setIt0 = (v) => p.evaluate((v) => { const e = document.getElementById('inItLoad'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    await p.evaluate(() => document.getElementById('ltcStep-review').click()); await new Promise((r) => setTimeout(r, 300));
    ok(await p.evaluate(() => !!document.querySelector('.ltc-arith .ltc-rev-empty')), `${w} S10 no empty state before any saved scenario`);
    await p.evaluate(() => { document.getElementById('scenarioName').value = 'gate-' + innerWidth; document.getElementById('saveScenarioBtn').click(); });
    await new Promise((r) => setTimeout(r, 900));
    const cmp = () => p.evaluate(() => { const m = window.__ltcLastModel; return [...document.querySelectorAll('.ltc-arith .ltc-rev-row')].map((r) => ({
      k: r.dataset.key, a: +r.dataset.before, b: +r.dataset.after, live: m[r.dataset.key], word: r.querySelector('.ltc-arith-s').textContent })); });
    let cr = await cmp();
    ok(cr.length >= 6, `${w} S10 compare rows after save: ${cr.length}`);
    ok(cr.every((r) => r.word === 'same'), `${w} S10 right after save not all same: ${cr.filter((r) => r.word !== 'same').map((r) => r.k + ' ' + r.a + '→' + r.b).join(', ')}`);
    await setIt0('52'); await new Promise((r) => setTimeout(r, 1500));
    cr = await cmp();
    ok(cr.some((r) => r.word !== 'same'), `${w} S10 nothing changed after IT load 52`);
    // [direction, display decimals, extensive]; IT load 52 differs from the save, so extensive totals must read "scale"
    const spec = { pue: [-1, 3, 0], systemCop: [1, 2, 0], wue: [-1, 2, 0], itKw: [0, 0, 1], totalFacilityKw: [0, 0, 1],
      annualGwh: [-1, 2, 1], netOpex: [-1, 0, 1], netCarbonTons: [-1, 0, 1] };
    const itRow = cr.find((r) => r.k === 'itKw'); const scaled = !!itRow && itRow.a !== itRow.b;
    ok(scaled, `${w} S10 IT load row missing or unchanged after the IT load edit`);
    for (const r of cr) {
      ok(Math.abs(r.b - r.live) <= Math.abs(r.live) * 1e-9 + 1e-9, `${w} S10 ${r.k} after ${r.b} != live ${r.live}`);
      const [dir, dp, ext] = spec[r.k] || [0, 0, 0]; const d = r.b - r.a;
      const want = Math.abs(d) < 0.5 * 10 ** -dp || Math.abs(d) <= Math.abs(r.a) * 1e-6 ? 'same' : dir === 0 ? 'changed' : ext && scaled ? 'scale' : d * dir > 0 ? 'better' : 'worse';
      ok(r.word === want, `${w} S10 ${r.k} ${r.a}→${r.b} reads "${r.word}", expected "${want}"`);
    }
    await p.evaluate(() => document.getElementById('ltcStep-load').click());
    const cap = () => p.evaluate(() => document.querySelector('#ltcStep-capture .ltc-step-res').textContent);
    const run = () => p.evaluate(() => { const b = document.getElementById('ltcRunBtn'), a = document.getElementById('ltcAutoRun'), e = document.getElementById('autoRunToggle');
      return { hidden: b.hidden, text: b.textContent.trim(), due: b.classList.contains('is-due'), auto: !!a && a.checked, eng: !!e && e.checked }; });
    const setIt = (v) => p.evaluate((v) => { const e = document.getElementById('inItLoad'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    let rs = await run();
    if (!(await p.$('#ltcAutoRun'))) { fails.push(`${w} S7 no auto-run switch (#ltcAutoRun) in the run section`); await p.close(); continue; }
    ok(rs.auto && rs.eng && rs.hidden, `${w} S7 default: auto ${rs.auto}, engine ${rs.eng}, button hidden ${rs.hidden}`);
    await p.evaluate(() => document.getElementById('ltcAutoRun').click());
    rs = await run();
    ok(!rs.auto && !rs.eng && !rs.hidden && rs.text === 'Recompute' && !rs.due, `${w} S7 auto off: ${JSON.stringify(rs)}`);
    const c0 = await cap();
    await setIt('40'); await new Promise((r) => setTimeout(r, 1200));
    rs = await run();
    ok((await cap()) === c0, `${w} S7 auto off but the result moved on edit`);
    ok(rs.due, `${w} S7 edit with auto off did not mark Recompute due`);
    await p.evaluate(() => document.getElementById('ltcRunBtn').click()); await new Promise((r) => setTimeout(r, 1200));
    rs = await run();
    ok((await cap()) !== c0, `${w} S7 Recompute did not update the result (${c0})`);
    ok(!rs.due, `${w} S7 Recompute left the due mark`);
    await p.evaluate(() => document.getElementById('ltcAutoRun').click());
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `${w} S5 scrollWidth ${sw}`);
    ok(!errs.length, `${w} S5 page error: ${errs[0]}`);
    await p.close();
  }
} finally { await b.close(); }
if (fails.length) { console.log(`FAIL — ${fails.length}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log('PASS — step thread: 7 steps × 2 widths, every substituted equation recomputes, results follow the inputs, design status recomputes from its basis, run semantics hold, the rail follows the step, sensitivity recomputes on the plant, review compares against the saved scenario, 0 errors');
