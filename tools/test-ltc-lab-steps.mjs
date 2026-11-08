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
 * S11 The six primary sliders show the values the model runs on: equal to their inputs after load (the plant pull sets
 *    them silently) and after a programmatic set; their ranges hold the plant default (IT 100 MW) and the plant clamp
 *    (capture 99 %)
 * S12 Pump power names one plant quantity per label: Results has a TCS pump row equal to rho g H Q / eta from the shown
 *    head, flow and efficiency; the KPI says it sums TCS + FWS and equals that sum; the energy-balance pump row is the
 *    TCS pumps; the energy-balance rows add up to the Total Facility row
 * S13 In plant mode the Results card shows the plant: Liquid COP is the plant's, the free-cooling row is the plant's
 *    hours without trim, inputs the plant ignores (pipe loss, hydraulic margin) are not listed, the coolant properties are
 *    water's with a note when another coolant is selected, and a capture above the architecture cap is noted
 * S14 Every fx trace on the Results card in plant mode names the plant as its source, carries no Indonesian UI
 *    text, and its listed inputs reproduce the traced value by independent arithmetic
 * S15 Every Equation Inspector line has the form 'name = formula = numeric expression = result' and the expression
 *    evaluates to the stated result (the same lines go into the PDF)
 * S16 The Charts-tab tornado and the Logic Impact Matrix perturb the shown model (the plant) one step from the shown
 *    base: every tornado row and the IT-load matrix row equal a plant recompute (the old range clamp turned +0.2 MW
 *    at 100 MW into 80 MW)
 * S17 The operating-scenario readout's deltas are the same model recomputed in normal mode, and in plant mode its
 *    label says a fault mode moves the screening risk index, not the heat balance
 * S18 (1440) In plant mode a setting carries the 'screening only' mark exactly when changing it moves none of the
 *    plant's outputs (each setting perturbed and restored in the page)
 * S19 The dashboard tab follows the step (1-5 Results, 6 Charts, 7 Report); the tab buttons are ARIA tabs with
 *    aria-selected in sync, and the step-scoped tabs name their steps
 * S20 No second hue or tile in the lab's chrome: section labels neutral or amber with no bullet glyph, tier chips are
 *    unfilled words, scenario metrics are rows of one panel
 * S21 (1440) Optimize To Target writes back only changes that matter (each changed input, reverted alone, moves an
 *    objective metric) and its impact line does not call a worse PUE better
 * S22 No cell of a result table (Target Guidance scenario table) breaks across lines or overflows its cell at 1440 or 390
 * S23 Calibration Fit: shown figures are reproduced from the form (apply on or off); with apply on every written input
 *    moves a fitted metric, with apply off the form is untouched
 * S24 Pareto apply best: the baseline row is the design before the apply, the figures shown reproduce from the form,
 *    the form carries no float noise
 * S25 (plant) The energy Sankey adds up to the plant's facility power; aux, pump and fan nodes are plant figures
 * S26 Charts tab chrome: no text with a hue cast except the amber accent and a fault-red state pill; no dashed borders
 * S27 Accordion titles are the block heading only (no tooltip text glued on)
 * S28 Charts-tab series are amber and greys (red only for a high-risk state)
 * S29 The Pareto scatter's axis ticks are distinct, also for a one-point frontier
 * S30 Report compare card: verdict words on every row; totals read "scale" across IT loads; pump efficiency up = better
 * S31 The page's own nav links carry no second hue
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
    // the plant overview draws asynchronously; under a loaded machine the step outline can lag the 3 s settle
    for (let i = 0; i < 20 && !(await p.evaluate(() => document.querySelectorAll('rect.ltc-step-node').length)); i++) await new Promise((r) => setTimeout(r, 250));
    // S1/S4 are read on the page as loaded, before the later laws edit inputs
    const s1 = await p.evaluate(() => ({ n: document.querySelectorAll('.ltc-step').length, cur: [...document.querySelectorAll('.ltc-step[aria-current]')].map((e) => e.id),
      res: [...document.querySelectorAll('.ltc-step-res')].map((e) => e.textContent.trim()),
      lit: [...document.querySelectorAll('rect.ltc-step-node')].map((r) => r.getAttribute('data-rzd-node')).sort().join(',') }));
    // S11 the primary sliders show the values the model runs on, also after a programmatic set (plant pull, scenario)
    const sl = () => p.evaluate(() => ['inItLoad', 'inLiquidCapture', 'inSupplyTemp', 'inReturnTemp', 'inPumpHead', 'inPumpEff'].map((id) => {
      const o = document.getElementById(id), n = document.getElementById('ltcNum_' + id), r = document.getElementById('ltcRange_' + id);
      return { id, model: o && +o.value, num: n && +n.value, range: r && +r.value, max: r && +r.max }; }));
    for (const s of await sl()) ok(s.num === s.model && s.range === s.model, `${w} S11 ${s.id} slider ${s.num}/${s.range}, model input ${s.model}`);
    const lim = Object.fromEntries((await sl()).map((s) => [s.id, s.max]));
    ok(lim.inItLoad >= 100, `${w} S11 IT load slider max ${lim.inItLoad} < plant default 100 MW`);
    ok(lim.inLiquidCapture <= 99, `${w} S11 capture slider max ${lim.inLiquidCapture} > plant clamp 99 %`);
    await p.evaluate(() => { const a = document.getElementById('inPumpHead'), b = document.getElementById('inSupplyTemp');
      a.value = '33'; b.value = '31.5'; b.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 1200));
    for (const s of (await sl()).filter((s) => /PumpHead|SupplyTemp/.test(s.id))) ok(s.num === s.model && s.range === s.model, `${w} S11 after a silent set ${s.id} slider ${s.num}, model ${s.model}`);
    await p.evaluate(() => { const a = document.getElementById('inCoolingArchitecture'); a.dataset.was = a.value;
      a.value = [...a.options].map((o) => o.value).find((v) => v !== a.value); document.getElementById('inPumpEff').dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 1200));
    const ac = await p.evaluate(() => { const a = document.getElementById('inCoolingArchitecture'), on = document.querySelector('.ltc-arch-card.ltc-arch-active');
      const r = { want: a.value, shown: on && on.dataset.arch, known: !!document.querySelector(`.ltc-arch-card[data-arch="${a.value}"]`) };
      a.value = a.dataset.was; a.dispatchEvent(new Event('change', { bubbles: true })); return r; });
    if (ac.known) ok(ac.shown === ac.want, `${w} S11 architecture card shows ${ac.shown}, model ${ac.want}`);
    await new Promise((r) => setTimeout(r, 1200));
    // S12 pump power: each label names one plant quantity and the TCS row reproduces rho g H Q / eta from what is shown
    const pw = await p.evaluate(() => {
      const m = window.__ltcLastModel || {}, r = m.plant, num = (t) => parseFloat(String(t).replace(/,/g, ''));
      const rows = Object.fromEntries([...document.querySelectorAll('#ltcTabResults .ltc-res-row')].map((x) =>
        [x.querySelector('.ltc-res-lbl').textContent.trim(), num(x.querySelector('.ltc-res-val').textContent)]));
      const kpi = document.getElementById('kpiPump'), kl = kpi && kpi.parentElement.querySelector('.ltc-kpi-label').textContent.trim();
      const eb = [...document.querySelectorAll('.ltc-etable tbody tr')].map((t) => [t.cells[0].textContent.trim(), num(t.cells[1].textContent)]);
      const foot = num(document.querySelector('.ltc-etable tfoot td:nth-child(2)')?.textContent);
      const fp = document.getElementById('flowPump');
      return { rows, kl, kv: kpi && num(kpi.textContent), eb, foot, tcs: r && r.liquid.tcsPumpKw, fws: r && r.liquid.fwsPumpKw,
        flow: fp && [fp.parentElement.firstElementChild.textContent.trim(), num(fp.textContent)] };
    });
    const tcsRow = pw.rows['TCS pumps'];
    ok(tcsRow != null, `${w} S12 no "TCS pumps" row in Results (rows: ${Object.keys(pw.rows).filter((k) => /pump/i.test(k)).join(', ')})`);
    if (tcsRow != null) {
      const calc = 997 * 9.81 * pw.rows['Pump Head'] * (pw.rows['Volumetric Flow'] / 60000) / (pw.rows['Pump Efficiency'] / 100) / 1000;
      ok(Math.abs(calc - tcsRow) <= tcsRow * 0.002 + 0.05, `${w} S12 TCS pump ${tcsRow} kW, rho g H Q / eta from the shown row = ${calc.toFixed(1)}`);
      ok(Math.abs(tcsRow - pw.tcs) <= 0.051, `${w} S12 TCS row ${tcsRow} != plant ${pw.tcs}`);
    }
    ok(/TCS\s*\+\s*FWS|both loops|loop pumps/i.test(pw.kl || ''), `${w} S12 KPI "${pw.kl}" does not say it sums two loops`);
    ok(Math.abs(pw.kv - (pw.tcs + pw.fws)) <= 0.06, `${w} S12 KPI ${pw.kv} != TCS + FWS ${pw.tcs + pw.fws}`);
    const ebp = pw.eb.find((e) => /pump/i.test(e[0]));
    ok(ebp && /TCS/.test(ebp[0]) && Math.abs(ebp[1] - pw.tcs) <= 0.06, `${w} S12 energy-balance pump row ${JSON.stringify(ebp)} vs TCS ${pw.tcs}`);
    ok(pw.flow && /TCS/.test(pw.flow[0]) && Math.abs(pw.flow[1] - pw.tcs) <= 0.6, `${w} S12 Flow-tab loss bar ${JSON.stringify(pw.flow)} vs TCS pumps ${pw.tcs}`);
    const ebSum = pw.eb.reduce((a, e) => a + e[1], 0);
    ok(Math.abs(ebSum - pw.foot) <= pw.foot * 0.001, `${w} S12 energy-balance rows sum ${ebSum.toFixed(1)} != Total Facility ${pw.foot}`);
    // S13 in plant mode the Results card shows what the plant computed, not the screening model's internals
    const rr = () => p.evaluate(() => {
      const m = window.__ltcLastModel || {}, r = m.plant, num = (t) => parseFloat(String(t).replace(/,/g, ''));
      const rows = Object.fromEntries([...document.querySelectorAll('#ltcTabResults .ltc-res-row')].map((x) =>
        [x.querySelector('.ltc-res-lbl').textContent.trim(), x.querySelector('.ltc-res-val').textContent.trim()]));
      const L = r && r.liquid, T = r && r.totals;
      return { rows, num: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, num(v)])),
        cop: L && (L.coolerKw + L.trimKw) / Math.max(1, L.coolerFanKw + L.trimKwe + L.fwsPumpKw),
        free: T && (T.hours - T.trimHours) / T.hours * 100, plant: !!r };
    });
    let q = await rr();
    if (q.plant) {
      ok(Math.abs(q.num['Liquid COP'] - q.cop) <= 0.006, `${w} S13 Liquid COP ${q.num['Liquid COP']} != plant ${q.cop && q.cop.toFixed(3)}`);
      ok(!('Economizer %' in q.rows), `${w} S13 "Economizer %" (screening-model internal) shown in plant mode: ${q.rows['Economizer %']}`);
      const fk = Object.keys(q.rows).find((k) => /no trim/i.test(k));
      ok(fk && Math.abs(q.num[fk] - q.free) <= 0.06, `${w} S13 free-cooling row ${fk}=${fk && q.num[fk]} vs plant ${q.free && q.free.toFixed(2)}`);
      for (const k of ['Pipe Loss Factor', 'Hydraulic Margin']) ok(!(k in q.rows), `${w} S13 "${k}" shown but the plant does not use it`);
      await p.evaluate(() => { const c = document.getElementById('inCoolant'); c.dataset.was = c.value; c.value = 'pg30'; c.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise((r) => setTimeout(r, 1500));
      q = await rr();
      ok(q.num['Cp'] === 4.186 && q.num['Density'] === 997, `${w} S13 PG30 selected: card Cp ${q.rows['Cp']}, density ${q.rows['Density']}; the plant computes water (4.186, 997)`);
      ok(Object.entries(q.rows).some(([k, v]) => /coolant/i.test(k) && /screening/i.test(v)), `${w} S13 PG30 selected but no row says the selection drives the screening model only`);
      await p.evaluate(() => { const c = document.getElementById('inCoolant'); c.value = c.dataset.was; c.dispatchEvent(new Event('change', { bubbles: true }));
        const a = document.getElementById('inCoolingArchitecture'); a.value = 'hybrid'; a.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise((r) => setTimeout(r, 800));
      await p.evaluate(() => { const e = document.getElementById('inLiquidCapture'); e.value = '85'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise((r) => setTimeout(r, 1500));
      const capNote = await p.evaluate(() => { const n = document.getElementById('ltcCapNote'); return n && !n.hidden ? n.textContent : ''; });
      const eff = (await rr()).num['Effective Capture'];
      ok(/75/.test(capNote) && eff === 75, `${w} S13 hybrid at 85 %: model runs ${eff} %, slider note "${capNote}"`);
      await p.evaluate(() => { const a = document.getElementById('inCoolingArchitecture'); a.value = 'direct_liquid'; a.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise((r) => setTimeout(r, 800));
      await p.evaluate(() => { const e = document.getElementById('inLiquidCapture'); e.value = '85'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise((r) => setTimeout(r, 1500));
      ok(await p.evaluate(() => { const n = document.getElementById('ltcCapNote'); return !n || n.hidden; }), `${w} S13 capture note still shown under the cap`);
    }
    // S14 every fx trace in plant mode is the plant's: its source, and the listed inputs reproduce the value
    const RE = { liquidKw: (a, b) => a * b / 100, flowLpm: (q, cp, dt, rho) => q / (cp * dt) / rho * 1000 * 60, pumpPowerKw: (a, b) => a + b,
      cduCount: (a, b) => a * b, totalFacilityKw: (...v) => v.reduce((x, y) => x + y, 0), pue: (a, b) => a / b, wue: (a, b) => a / b,
      annualGwh: (a) => a / 1000, deltaT: (a, b) => b - a, effectiveCapture: (a, b) => Math.min(a, b), systemCop: (a, b) => a / b };
    const keys = await p.evaluate(() => [...new Set([...document.querySelectorAll('#ltcTabResults [data-ltc-trace]')].map((e) => e.dataset.ltcTrace))]);
    let traced = 0;
    for (const k of keys) {
      const t = await p.evaluate((k) => { document.querySelector(`#ltcTabResults [data-ltc-trace="${k}"]`).click();
        const pop = document.getElementById('ltcTracePop'), num = (x) => parseFloat(String(x).replace(/,/g, ''));
        const r = { prov: pop.querySelector('.ltc-trace-prov')?.textContent || '', text: pop.textContent, head: num(pop.querySelector('.ltc-trace-val').textContent),
          deps: [...pop.querySelectorAll('.ltc-trace-pill b')].map((b) => num(b.textContent)) };
        pop.classList.remove('open'); return r; }, k);
      ok(!/models\.ltc\.compute/.test(t.prov) && /plant/i.test(t.prov + (/INPUT/.test(t.prov) ? ' plant' : '')), `${w} S14 ${k} trace source "${t.prov}"`);
      ok(!/DIHITUNG|klik|telusuri/i.test(t.text), `${w} S14 ${k} trace has Indonesian UI text`);
      if (RE[k]) { traced++;
        const v = RE[k](...t.deps);
        ok(t.deps.length && Math.abs(v - t.head) <= Math.abs(t.head) * 0.003 + 0.051, `${w} S14 ${k} = ${t.head}, but its inputs [${t.deps.join(', ')}] give ${v}`); }
    }
    ok(traced >= 8, `${w} S14 only ${traced} traces checked (keys: ${keys.join(',')})`);
    // S15 the Equation Inspector (and the PDF equation list) does its own arithmetic: every line "... = expr = result"
    const eq = await p.evaluate(() => [...document.querySelectorAll('#equationList .equation-line')].map((e) => e.textContent.replace(/^Eq \d+:\s*/, '').trim()));
    ok(eq.length >= 8, `${w} S15 ${eq.length} equation lines`);
    for (const line of eq) {
      const seg = line.split(' = ');
      const expr = (seg[seg.length - 2] || '').replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      const res = parseFloat((seg[seg.length - 1] || '').replace(/[$,]/g, ''));
      let v = NaN;
      if (seg.length >= 3 && /^[\d.\s+\-*/()]*$/.test(expr)) { try { v = Function(`return (${expr})`)(); } catch {} }
      ok(isFinite(v) && Math.abs(v - res) <= Math.abs(res) * 0.002 + 0.06, `${w} S15 "${line.slice(0, 90)}" evaluates to ${v}, states ${res}`);
    }
    // S16 the tornado and the Logic Impact Matrix perturb the model the page shows (the plant), one step from the shown base
    const s16 = await p.evaluate(() => {
      const m = window.__ltcLastModel, eng = window.RZEngine.models.ltc, IP = window.RZEngine.data.ltcCalibration.impactParams;
      const plant = (inp) => window.LTCLabPlant.compute(inp, eng.compute(inp));
      const at = (cfg, dir) => { const i = Object.assign({}, m.input); i[cfg.key] = (i[cfg.key] || 0) + dir * cfg.step; return plant(i); };
      const tor = [...document.querySelectorAll('#ltcTornado .ltc-tor-row')].map((r) => {
        const lbl = r.querySelector('.ltc-tor-lbl').textContent.trim(), cfg = IP.find((c) => c.label === lbl);
        const v = r.querySelector('.ltc-tor-val').textContent.replace(/−/g, '-'), g = (re) => parseFloat((v.match(re) || [])[1]);
        if (!cfg) return { lbl, miss: true };
        return { lbl, shown: [g(/-step\s*([+-]?[\d.]+)/), g(/\+step\s*([+-]?[\d.]+)/)], want: [at(cfg, -1).pue - m.pue, at(cfg, 1).pue - m.pue] };
      });
      const imp = [...document.querySelectorAll('#impactRows tr')].map((tr) => [...tr.cells].map((c) => c.textContent.trim()));
      const it = imp.find((r) => /^IT Load/.test(r[0]));
      const cfgIt = IP.find((c) => c.key === 'itLoadMw'), altIt = at(cfgIt, 1);
      return { tor, it, wantOpex: altIt.netOpex - m.netOpex, wantPue: altIt.pue - m.pue };
    });
    ok(s16.tor.length >= 3, `${w} S16 tornado rows ${s16.tor.length}`);
    for (const t of s16.tor) {
      if (t.miss) { fails.push(`${w} S16 tornado row "${t.lbl}" is not an engine impact parameter`); continue; }
      ok(Math.abs(t.shown[0] - t.want[0]) <= 0.00006 && Math.abs(t.shown[1] - t.want[1]) <= 0.00006, `${w} S16 tornado ${t.lbl} shows ${t.shown.join(' / ')}, plant -step / +step ${t.want.map((v) => v.toFixed(4)).join(' / ')}`);
    }
    const n16 = (x) => parseFloat(String(x).replace(/[,+]/g, ''));
    ok(s16.it && Math.abs(n16(s16.it[4]) - s16.wantOpex) <= Math.abs(s16.wantOpex) * 0.01 + 1, `${w} S16 impact matrix IT +step net OPEX ${s16.it && s16.it[4]}, plant ${Math.round(s16.wantOpex)}`);
    ok(s16.it && Math.abs(n16(s16.it[2]) - s16.wantPue) <= 0.0006, `${w} S16 impact matrix IT +step PUE ${s16.it && s16.it[2]}, plant ${s16.wantPue.toFixed(4)}`);
    // S17 the operating-scenario readout compares like with like and says what a fault mode moves in plant mode
    await p.evaluate(() => document.querySelector('#ltcScenarioBtns .ltc-scenario-btn[data-scen="pump_degraded"]').click());
    await new Promise((r) => setTimeout(r, 1500));
    const s17 = await p.evaluate(() => {
      const m = window.__ltcLastModel, ni = Object.assign({}, m.input, { failureMode: 'normal' });
      const norm = window.LTCLabPlant.compute(ni, window.RZEngine.models.ltc.compute(ni));
      const rows = [...document.querySelectorAll('#ltcScenarioReadout .ltc-scenario-metric')].map((e) => [e.querySelector('span').textContent,
        parseFloat((e.querySelector('.ltc-scenario-delta')?.textContent || 'NaN').replace(/,/g, ''))]);
      const lbl = document.querySelector('.ltc-scenario-card .ltc-overview-label').textContent;
      return { rows, lbl, want: { PUE: m.pue - norm.pue, 'System COP': m.systemCop - norm.systemCop, 'Risk Index': m.riskIndex - norm.riskIndex, 'Loop pumps': m.pumpPowerKw - norm.pumpPowerKw } };
    });
    for (const [k, d] of s17.rows) ok(Math.abs(d - s17.want[k]) <= 0.051, `${w} S17 scenario delta ${k} ${d}, same-model recompute ${s17.want[k]}`);
    ok(/risk index/i.test(s17.lbl) && !/recomputes the whole model/i.test(s17.lbl), `${w} S17 scenario label "${s17.lbl.slice(0, 90)}" does not say a fault mode moves only the risk index`);
    await p.evaluate(() => document.querySelector('#ltcScenarioBtns .ltc-scenario-btn[data-scen="normal"]').click());
    await new Promise((r) => setTimeout(r, 1200));
    // S18 (1440) in plant mode a setting is marked "screening only" exactly when changing it moves none of the plant's outputs
    if (w === 1440) {
      const s18 = await p.evaluate(async () => {
        const sleep = (t) => new Promise((r) => setTimeout(r, t));
        const snap = () => { const m = window.__ltcLastModel; return [m.pue, m.systemCop, m.wue, m.totalFacilityKw, m.netOpex, m.netCarbonTons, m.flowLpm,
          m.pumpPowerKw, m.cduCount, m.pueDesign, m.plant.it.racks]; };
        const skip = /^(inCoolingArchitecture|inCountryProfile|inTargetPue|inTargetCop|inFailureMode)$/;
        const fields = [...document.querySelectorAll('#ltcOtherParamsBody .ltc-tier-sec input, #ltcOtherParamsBody .ltc-tier-sec select')]
          .filter((f) => f.id && !skip.test(f.id) && !/checkbox|file|button/.test(f.type));
        const out = [];
        for (const f of fields) {
          const marked = !!(f.closest('.input-group') && f.closest('.input-group').querySelector('.ltc-scr:not([hidden])'));
          const v0 = f.value, base = snap();
          if (f.tagName === 'SELECT') { const o = [...f.options].find((o) => o.value !== f.value); if (!o) continue; f.value = o.value; }
          else { const v = +f.value || 0, mx = f.max !== '' ? +f.max : Infinity; let nv = v ? v * 1.1 : 1; if (nv > mx) nv = v * 0.9; f.value = String(+nv.toFixed(4)); }
          f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(450);
          const moved = snap().some((v, i) => Math.abs(v - base[i]) > Math.abs(base[i]) * 1e-9 + 1e-12);
          f.value = v0; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(450);
          out.push({ id: f.id, marked, moved });
        }
        return out;
      });
      ok(s18.length >= 25, `S18 only ${s18.length} settings probed`);
      for (const r of s18) ok(r.marked !== r.moved, `${w} S18 ${r.id}: ${r.moved ? 'moves the plant' : 'moves nothing in the plant'} but is ${r.marked ? '' : 'not '}marked screening only`);
    }
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
    // the strip refreshes on a short timer after each render; under CPU load allow up to 6 s before calling it stale
    let after = before;
    for (let i = 0; i < 24 && after === before; i++) { await new Promise((r) => setTimeout(r, 250));
      after = await p.evaluate(() => document.querySelector('#ltcStep-capture .ltc-step-res').textContent); }
    if (after === before) {
      const dx = await p.evaluate(() => ({ it: document.getElementById('inItLoad').value, model: window.__ltcLastModel && window.__ltcLastModel.itKw,
        auto: document.getElementById('autoRunToggle') && document.getElementById('autoRunToggle').checked, ltcAuto: document.getElementById('ltcAutoRun') && document.getElementById('ltcAutoRun').checked,
        last: document.getElementById('ltcLastRun') && document.getElementById('ltcLastRun').textContent, legacy: !!window.__ltcLegacy, outLiquid: document.getElementById('outLiquidLoad') && document.getElementById('outLiquidLoad').textContent, fm: document.getElementById('inFailureMode') && document.getElementById('inFailureMode').value }));
      await new Promise((r) => setTimeout(r, 3000));
      dx.later = await p.evaluate(() => document.querySelector('#ltcStep-capture .ltc-step-res').textContent);
      dx.active = await p.evaluate(() => (document.querySelector('.ltc-step[aria-current]') || {}).id);
      fails.push(`${w} S2 Capture result did not change after IT load 60 (${before}) · state ${JSON.stringify(dx)}`);
    }
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
    await setIt0('52');
    for (let i = 0; i < 24; i++) { await new Promise((r) => setTimeout(r, 250)); cr = await cmp();
      const it = cr.find((r) => r.k === 'itKw'); if (it && Math.abs(it.b - 52000) < 1 && Math.abs(it.live - 52000) < 1) break; }
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
    // S19 the dashboard tab follows the step: 1-5 Results, 6 Charts, 7 Report; tabs are ARIA tabs and name their steps
    const tabState = () => p.evaluate(() => [...document.querySelectorAll('.ltc-tabs-bar .ltc-tab-btn')].map((b) => ({ k: b.dataset.tab,
      on: b.classList.contains('ltc-tab-active'), role: b.getAttribute('role'), sel: b.getAttribute('aria-selected'), txt: b.textContent.replace(/\s+/g, ' ').trim() })));
    for (const [step, want] of [['capture', 'results'], ['check', 'charts'], ['loop', 'results'], ['review', 'report'], ['load', 'results']]) {
      await p.evaluate(() => document.querySelector('.ltc-tab-btn[data-tab="flow"]').click());
      await p.evaluate((s) => document.getElementById('ltcStep-' + s).click(), step);
      await new Promise((r) => setTimeout(r, 400));
      const ts = await tabState(), on = ts.filter((t) => t.on).map((t) => t.k);
      ok(on.length === 1 && on[0] === want, `${w} S19 step ${step} leaves tab ${on.join(',')} open, expected ${want}`);
      ok(ts.every((t) => t.role === 'tab' && t.sel === String(t.on)), `${w} S19 tabs not ARIA tabs in sync: ${JSON.stringify(ts.map((t) => [t.k, t.role, t.sel, t.on]))}`);
    }
    const tl = Object.fromEntries((await tabState()).map((t) => [t.k, t.txt]));
    ok(/1\s*[–-]\s*5/.test(tl.results) && /\b6\b/.test(tl.charts) && /\b7\b/.test(tl.report), `${w} S19 tab labels do not name their steps: ${JSON.stringify(tl)}`);
    // S20 no second hue or tile in the lab's chrome: section labels neutral or amber with no bullet glyph, tier chips
    // unfilled words, scenario metrics rows of one panel (not boxed tiles)
    await p.evaluate(() => { const b = document.getElementById('ltcOtherParamsBtn'); if (b && !b.classList.contains('open')) b.click();
      document.querySelector('.ltc-tab-btn[data-tab="flow"]').click(); });
    await new Promise((r) => setTimeout(r, 400));
    const s20 = await p.evaluate(() => {
      const hsl = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map((v) => v / 255), a = m[3] == null ? 1 : +m[3];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
        if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, a }; };
      const out = [];
      for (const e of document.querySelectorAll('.ltc-overview-label, .ltc-section-label, .ltc-res-card-title, .ltc-rail-title, .ltc-tier-title')) {
        if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
        const c = hsl(getComputedStyle(e).color);
        if (c && c.s > 0.2 && !(c.h >= 25 && c.h <= 50)) out.push(`label "${e.textContent.trim().slice(0, 30)}" hue ${Math.round(c.h)} sat ${c.s.toFixed(2)}`);
        if (/^\s*●/.test(e.textContent)) out.push(`label "${e.textContent.trim().slice(0, 30)}" starts with a bullet glyph`);
      }
      for (const e of document.querySelectorAll('.ltc-tier-chip')) {
        const c = hsl(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0.02) { out.push(`tier chip "${e.textContent.trim()}" filled ${getComputedStyle(e).backgroundColor}`); break; }
      }
      for (const e of document.querySelectorAll('.ltc-scenario-metric')) {
        const cs = getComputedStyle(e), bg = hsl(cs.backgroundColor);
        const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((k) => parseFloat(cs['border' + k + 'Width']) > 0).length;
        if ((bg && bg.a > 0.02) || sides >= 3) { out.push(`scenario metric is a boxed tile (bg ${cs.backgroundColor}, ${sides} bordered sides)`); break; }
      }
      return out;
    });
    for (const f of s20) fails.push(`${w} S20 ${f}`);
    await p.evaluate(() => document.querySelector('.ltc-tab-btn[data-tab="results"]').click());
    // S21 (1440) Optimize To Target writes back only changes that matter: every input it changed, reverted alone,
    // moves at least one objective metric; the action list names only changed inputs; impact words follow the signs
    if (await p.$('#optimizeTarget')) {
      const before = await p.evaluate(() => Object.assign({}, window.__ltcLastModel.input));
      await p.evaluate(() => document.getElementById('optimizeTarget').click());
      await new Promise((r) => setTimeout(r, 2500));
      for (let i = 0; i < 40 && await p.evaluate(() => !document.querySelector('#targetActions li') || /Run model|Edit any/.test(document.querySelector('#targetActions').textContent)); i++) await new Promise((r) => setTimeout(r, 500));
      const s21 = await p.evaluate((before) => {
        const m = window.__ltcLastModel, after = m.input, LP = window.LTCLabPlant;
        const K = ['pue', 'systemCop', 'riskIndex', 'netOpex', 'netCarbonTons', 'designDensity', 'pumpPowerKw'];
        const T = ['liquidCapture', 'rackDensityTarget', 'highDensityShare', 'supplyTemp', 'airCop', 'pumpEff', 'economizerHours', 'heatReuse',
          'hydraulicMargin', 'controlQuality', 'predictiveGain', 'coefHeatTransfer', 'coefCduLoss', 'coefPipeLoss', 'coefFutureTech'];
        const changed = T.filter((k) => Math.abs((+after[k]) - (+before[k])) > 1e-9);
        const idle = changed.filter((k) => { const i = Object.assign({}, after, { [k]: before[k] });
          if (k === 'supplyTemp') i.returnTemp = after.returnTemp - (after.supplyTemp - before.supplyTemp);
          const alt = LP.computeLike(m, i); return K.every((q) => Math.abs(alt[q] - m[q]) <= Math.abs(m[q]) * 1e-9 + 1e-9); });
        const acts = document.getElementById('targetActions').textContent;
        const lie = /PUE -[\d.]+ better|PUE \+?0\.000 better/.test(acts.replace(/−/g, '-'));
        return { changed, idle, acts, lie };
      }, before);
      const LBL = { liquidCapture: /liquid capture/i, rackDensityTarget: /rack density/i, highDensityShare: /high-density/i, supplyTemp: /supply/i,
        airCop: /air.*cop/i, pumpEff: /pump efficiency/i, economizerHours: /economi[sz]er/i, heatReuse: /heat reuse/i, hydraulicMargin: /hydraulic margin/i,
        controlQuality: /control quality/i, predictiveGain: /predictive/i, coefHeatTransfer: /heat.transfer/i, coefCduLoss: /cdu loss/i,
        coefPipeLoss: /pipe loss/i, coefFutureTech: /future/i };
      const unnamed = s21.changed.filter((k) => !LBL[k].test(s21.acts));
      ok(unnamed.length === 0, `${w} S21 optimizer changed ${unnamed.join(', ')} but the action list does not say so`);
      ok(s21.idle.length === 0, `${w} S21 optimizer changed inputs with no effect on any objective metric: ${s21.idle.join(', ')}`);
      ok(!s21.lie, `${w} S21 impact line calls a worse or unchanged PUE "better": ${s21.acts}`);
      // S22 a figure in a result table never breaks across lines (390: "$89,2 / 79,14 / 3")
      const broken = await p.evaluate(() => { document.querySelector('.ltc-tab-btn[data-tab="charts"]').click();
        const acc = document.getElementById('targetActions').closest('.ltc-acc'); if (acc && !acc.classList.contains('open')) acc.querySelector('.ltc-acc-head').click();
        return [...document.querySelectorAll('.target-block td, .target-block th')].filter((c) => {
          const t = c.textContent.trim(); if (!t || c.offsetHeight === 0) return false;
          const r = document.createRange(); r.selectNodeContents(c); const lines = new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
          return lines > 1 || c.scrollWidth > c.clientWidth + 1; }).map((c) => c.textContent.trim()).slice(0, 6); });
      ok(broken.length === 0, `${w} S22 result-table cells broken across lines or overflowing their cell: ${broken.join(' | ')}`);
      const optK = await p.evaluate(() => { const m = window.__ltcLastModel; return [m.pue, m.systemCop, m.netOpex]; });
      await p.evaluate(() => { const e = document.getElementById('inPumpHead'); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise((r) => setTimeout(r, 1500));
      const formK = await p.evaluate(() => { const m = window.__ltcLastModel; return [m.pue, m.systemCop, m.netOpex]; });
      ok(formK.every((v, i) => Math.abs(v - optK[i]) <= Math.abs(optK[i]) * 1e-9 + 1e-9), `${w} S21 optimised [${optK}] not reproduced from the form [${formK}]`);
      await p.goto(p.url(), { waitUntil: 'networkidle2' }); await new Promise((r) => setTimeout(r, 2500));
      // S23 Calibration Fit: with "apply" on, the figures shown are reproduced from the form and every input it changed
      // moves a fitted metric; with "apply" off, the form is untouched and the figures shown still follow the form
      const runCal = async (apply) => {
        const before = await p.evaluate((apply) => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; };
          set('calTargetPue', '1.24'); set('calTargetCop', '4.2'); document.getElementById('calLockApply').checked = apply;
          const m = window.__ltcLastModel; window.__s23prev = m; return Object.assign({}, m.input); }, apply);
        await p.evaluate(() => document.getElementById('runCalibration').click());
        for (let i = 0; i < 60 && await p.evaluate(() => window.__ltcLastModel === window.__s23prev); i++) await new Promise((r) => setTimeout(r, 500));
        await new Promise((r) => setTimeout(r, 800));
        const rowLbl = await p.evaluate(() => (document.getElementById('optRowLabel') || {}).textContent);
        ok(rowLbl === 'Calibrated', `${w} S23 scenario row after calibration reads "${rowLbl}", expected "Calibrated"`);
        const shown = await p.evaluate((before) => { const m = window.__ltcLastModel, LP = window.LTCLabPlant, after = m.input;
          const K = ['pue', 'systemCop', 'netOpex', 'netCarbonTons', 'pumpPowerKw'];
          const T = ['liquidCapture', 'controlQuality', 'predictiveGain', 'coefHeatTransfer', 'coefCduLoss', 'coefPipeLoss', 'coefFutureTech',
            'airCop', 'pumpEff', 'hydraulicMargin', 'economizerHours', 'fanPower'];
          const changed = T.filter((k) => Math.abs((+after[k]) - (+before[k])) > 1e-9);
          const idle = changed.filter((k) => { const alt = LP.computeLike(m, Object.assign({}, after, { [k]: before[k] }));
            return K.every((q) => Math.abs(alt[q] - m[q]) <= Math.abs(m[q]) * 1e-9 + 1e-9); });
          return { k: [m.pue, m.systemCop, m.netOpex], changed, idle }; }, before);
        await p.evaluate(() => { const e = document.getElementById('inPumpHead'); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
        await new Promise((r) => setTimeout(r, 1500));
        const form = await p.evaluate(() => { const m = window.__ltcLastModel; return [m.pue, m.systemCop, m.netOpex]; });
        const same = form.every((v, i) => Math.abs(v - shown.k[i]) <= Math.abs(shown.k[i]) * 1e-9 + 1e-9);
        ok(same, `${w} S23 calibration (apply ${apply ? 'on' : 'off'}) shows [${shown.k}] but the form computes [${form}]`);
        if (apply) ok(shown.idle.length === 0, `${w} S23 calibration wrote inputs with no effect on any fitted metric: ${shown.idle.join(', ')}`);
        else ok(shown.changed.length === 0, `${w} S23 calibration with apply off shows results on inputs not in the form: ${shown.changed.join(', ')}`);
      };
      await runCal(true);
      await p.goto(p.url(), { waitUntil: 'networkidle2' }); await new Promise((r) => setTimeout(r, 2500));
      await runCal(false);
      await p.goto(p.url(), { waitUntil: 'networkidle2' }); await new Promise((r) => setTimeout(r, 2500));
      // S25 (plant) the energy Sankey adds up to the plant's facility power and each node is a plant figure
      const s25 = await p.evaluate(() => { const m = window.__ltcLastModel, sum = document.getElementById('sankeySummary');
        if (!m.plant || !sum) return null;
        const kw = (lbl) => { const t = [...document.querySelectorAll('#energySankeySvg text')].map((x) => x.textContent); const i = t.indexOf(lbl);
          return i >= 0 && t[i + 1] ? +t[i + 1].split('kW')[0].replace(/[^\d.]/g, '') : NaN; };
        const tot = +(sum.textContent.match(/Total facility power: ([\d,]+)/) || [0, 'NaN'])[1].replace(/,/g, '');
        const P = m.plant, fans = (P.air.fanKw || 0) + (P.elec.roomFanKw || 0) + (P.liquid.coolerFanKw || 0);
        return { tot, fac: m.totalFacilityKw, aux: kw('Facility Aux'), plantAux: m.breakdown.aux, pump: kw('Pump Drive'), plantPump: m.breakdown.pump,
          fan: kw('Fan Power'), plantFan: fans }; });
      if (s25) {
        ok(Math.abs(s25.tot - s25.fac) <= 1, `${w} S25 Sankey total ${s25.tot} kW != plant facility ${Math.round(s25.fac)} kW`);
        ok(Math.abs(s25.aux - s25.plantAux) <= 1, `${w} S25 Sankey Facility Aux ${s25.aux} kW != plant aux ${Math.round(s25.plantAux)} kW`);
        ok(Math.abs(s25.pump - s25.plantPump) <= 1, `${w} S25 Sankey Pump Drive ${s25.pump} kW != plant TCS pumps ${Math.round(s25.plantPump)} kW`);
        ok(Math.abs(s25.fan - s25.plantFan) <= 1, `${w} S25 Sankey Fan Power ${s25.fan} kW != plant fans ${Math.round(s25.plantFan)} kW`);
      }
      // S26 Charts tab chrome: no text with a hue cast (slate, blue, green) except the amber accent and a fault-red state
      // pill, and no dashed or dotted borders
      const s26 = await p.evaluate(() => { document.querySelector('.ltc-tab-btn[data-tab="charts"]').click();
        document.querySelectorAll('.ltc-acc').forEach((a) => { if (!a.classList.contains('open') && a.offsetParent) a.querySelector('.ltc-acc-head').click(); });
        const panel = document.getElementById('ltcTabCharts'); if (!panel) return { cast: ['no #ltcTabCharts'], dashed: [] };
        const hue = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, bb, a] = m.map(Number); if (a === 0) return null;
          const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb); if (mx - mn <= 25) return null; let h;
          if (mx === r) h = 60 * (((g - bb) / (mx - mn)) % 6); else if (mx === g) h = 60 * ((bb - r) / (mx - mn) + 2); else h = 60 * ((r - g) / (mx - mn) + 4); return (h + 360) % 360; };
        const vis = [...panel.querySelectorAll('*')].filter((e) => e.offsetParent && !e.closest('svg'));
        const cast = vis.filter((e) => { if (!e.textContent.trim() || [...e.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) return false;
          const h = hue(getComputedStyle(e).color); if (h === null || (h >= 25 && h <= 50)) return false;
          return !(e.matches('.status-pill.err') && (h < 15 || h > 345)); }).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' ' + getComputedStyle(e).color);
        const dashed = vis.filter((e) => { const cs = getComputedStyle(e); return ['Top', 'Right', 'Bottom', 'Left'].some((k) => /dashed|dotted/.test(cs['border' + k + 'Style']) && parseFloat(cs['border' + k + 'Width']) > 0); })
          .map((e) => e.id || e.className);
        const navy = vis.filter((e) => { const h = hue(getComputedStyle(e).backgroundColor); return h !== null && h > 180 && h < 260; })
          .map((e) => (e.id || e.className) + ' ' + getComputedStyle(e).backgroundColor);
        return { cast: [...new Set(cast)].slice(0, 6), dashed: [...new Set(dashed)].slice(0, 6), navy: [...new Set(navy)].slice(0, 6) }; });
      ok(s26.navy.length === 0, `${w} S26 Charts-tab panels with a navy/blue fill: ${s26.navy.join(' | ')}`);
      ok(s26.cast.length === 0, `${w} S26 Charts-tab text with a hue cast: ${s26.cast.join(' | ')}`);
      ok(s26.dashed.length === 0, `${w} S26 Charts-tab dashed/dotted borders: ${s26.dashed.join(', ')}`);
      // S27 accordion titles are the block's heading, not the heading plus its tooltip text ("Chart?Facility … notes.Ref:")
      const s27 = await p.evaluate(() => [...document.querySelectorAll('.ltc-acc-title')].map((e) => e.textContent.trim())
        .filter((t) => t.length > 70 || /\?|[a-z)]\.[A-Z]|Ref:|Impact:|[a-z)]Guide$/.test(t)).map((t) => t.slice(0, 60)));
      ok(s27.length === 0, `${w} S27 accordion titles carry tooltip text: ${s27.slice(0, 4).join(' | ')}`);
      // S28 chart series on the register: no SVG fill/stroke or histogram bar on the Charts tab in a hue other than amber
      // or grey, except red for a high-risk state
      const s28 = await p.evaluate(() => { const panel = document.getElementById('ltcTabCharts'); const out = new Set();
        const hue = (c) => { const m = (c || '').match(/[\d.]+/g); if (!m || m.length < 3) return null; const [r, g, bb, a] = m.map(Number); if (a === 0) return null;
          const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb); if (mx - mn <= 25) return null; let h;
          if (mx === r) h = 60 * (((g - bb) / (mx - mn)) % 6); else if (mx === g) h = 60 * ((bb - r) / (mx - mn) + 2); else h = 60 * ((r - g) / (mx - mn) + 4); return (h + 360) % 360; };
        panel.querySelectorAll('svg *, .hist-bar').forEach((e) => { if (!e.getBoundingClientRect().width) return; const cs = getComputedStyle(e);
          for (const v of [cs.fill, cs.stroke, e.classList.contains('hist-bar') ? cs.backgroundColor : '']) { const h = hue(v);
            if (h === null || (h >= 25 && h <= 50) || h < 12 || h > 350) continue; out.add(((e.closest('svg') || {}).id || 'hist') + ' ' + v); } });
        return [...out].slice(0, 6); });
      ok(s28.length === 0, `${w} S28 Charts-tab series in a second hue: ${s28.join(' | ')}`);
      // S29 the Pareto scatter's axis ticks are distinct, also for a frontier of one point
      const s29 = await p.evaluate(() => { if (!window.__ltcRenderParetoFor) return ['no test seam'];
        const m = Object.assign({}, window.__ltcLastModel, { _feasible: true }); window.__ltcRenderParetoFor([m]);
        const t = [...document.querySelectorAll('#paretoScatterSvg text')].map((x) => x.textContent.trim());
        const y = t.filter((x) => /^\$[\d.]+M$/.test(x)), xs = t.filter((x) => /^1\.\d+$/.test(x));
        const dup = (a) => a.length !== new Set(a).size; const out = [];
        if (y.length < 3 || dup(y)) out.push('y ticks ' + y.join(' '));
        if (xs.length < 3 || dup(xs)) out.push('x ticks ' + xs.join(' '));
        window.__ltcRenderParetoFor([]); return out; });
      ok(s29.length === 0, `${w} S29 Pareto scatter with one point repeats its axis ticks: ${s29.join(' | ')}`);
      // S30 Report compare card: every row states its verdict as a word; with a different IT load the totals read
      // "scale"; with the same IT load a better pump efficiency reads "better" on the pump row
      if (await p.$('#ltcPinA')) {
        const setIn = (id, v) => p.evaluate((id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, id, v);
        const rows = () => p.evaluate(() => [...document.querySelectorAll('#ltcCompareTable .ltc-cmp-row:not(.ltc-cmp-head)')].map((r) => ({ k: r.dataset.key, w: (r.querySelector('.ltc-cmp-s') || {}).textContent || '' })));
        const settle = async (key, want) => { let r = []; for (let i = 0; i < 24; i++) { await new Promise((x) => setTimeout(x, 250)); r = await rows(); const x = r.find((q) => q.k === key); if (x && want(x.w)) break; } return r; };
        await setIt0('100'); await setIn('inPumpEff', '70');
        for (let i = 0; i < 24 && await p.evaluate(() => Math.abs(window.__ltcLastModel.itKw - 100000) > 1); i++) await new Promise((x) => setTimeout(x, 250));
        await p.evaluate(() => document.getElementById('ltcPinA').click());
        await setIt0('60');
        let r = await settle('opex', (x) => x === 'scale');
        const noWord = r.filter((x) => !/^(same|better|worse|scale|changed)$/.test(x.w)).map((x) => x.k);
        ok(r.length >= 6 && noWord.length === 0, `${w} S30 compare rows without a verdict word: ${noWord.join(', ') || 'rows ' + r.length}`);
        const notScale = r.filter((x) => ['opex', 'carbon', 'pump', 'flow'].includes(x.k) && !/^(scale|same)$/.test(x.w)).map((x) => x.k + '=' + x.w);
        ok(notScale.length === 0, `${w} S30 totals called better/worse across different IT loads: ${notScale.join(', ')}`);
        await p.evaluate(() => document.getElementById('ltcPinA').click());
        await setIn('inPumpEff', '90');
        r = await settle('pump', (x) => x === 'better');
        const pump = r.find((x) => x.k === 'pump');
        ok(pump && pump.w === 'better', `${w} S30 higher pump efficiency at the same IT load reads "${pump && pump.w}" on the pump row`);
        await p.goto(p.url(), { waitUntil: 'networkidle2' }); await new Promise((x) => setTimeout(x, 2500));
      }
      // S31 the page's own nav links carry no second hue (the Glossary link was inline teal #14b8a6)
      const s31 = await p.evaluate(() => [...document.querySelectorAll('.nav-links > a.nav-back, .nav-links > .theme-toggle')].filter((e) => e.getBoundingClientRect().width).map((e) => {
        const m = getComputedStyle(e).color.match(/[\d.]+/g).map(Number), mx = Math.max(m[0], m[1], m[2]), mn = Math.min(m[0], m[1], m[2]);
        if (mx - mn <= 25) return null; let h; if (mx === m[0]) h = 60 * (((m[1] - m[2]) / (mx - mn)) % 6); else if (mx === m[1]) h = 60 * ((m[2] - m[0]) / (mx - mn) + 2); else h = 60 * ((m[0] - m[1]) / (mx - mn) + 4);
        h = (h + 360) % 360; return h >= 25 && h <= 50 ? null : e.textContent.trim() + ' ' + getComputedStyle(e).color; }).filter(Boolean));
      ok(s31.length === 0, `${w} S31 nav links in a second hue: ${s31.join(' | ')}`);
      // S24 Pareto "apply best": the baseline row is the design before the apply, the figures shown are reproduced from
      // the form, and the form shows plain numbers (no float noise such as 1.2300000000000002)
      if (await p.$('#runPareto')) {
        const pre = await p.evaluate(() => { const m = window.__ltcLastModel; window.__s24prev = m; return m.pue; });
        await p.evaluate(() => { const e = document.getElementById('paretoSamples'); if (e) e.value = '200'; document.getElementById('runPareto').click(); });
        for (let i = 0; i < 60 && await p.evaluate(() => !document.querySelector('#paretoRows tr[data-pareto-idx]')); i++) await new Promise((r) => setTimeout(r, 500));
        await p.evaluate(() => document.getElementById('applyParetoBest').click());
        await new Promise((r) => setTimeout(r, 1200));
        const s24 = await p.evaluate(() => { const m = window.__ltcLastModel;
          const noisy = [...document.querySelectorAll('.calc-input-panel input[type=number], .ltc-left-rail input[type=number]')]
            .filter((e) => /\.\d*0000\d|\.\d*9999\d|\d\.\d{5,}/.test(e.value)).map((e) => e.id + '=' + e.value);
          return { k: [m.pue, m.systemCop, m.netOpex], base: +document.getElementById('basePue').textContent, noisy: noisy.slice(0, 5) }; });
        ok(Math.abs(s24.base - pre) < 0.0006, `${w} S24 Pareto baseline row PUE ${s24.base} is not the design before the apply (${pre.toFixed(3)})`);
        ok(s24.noisy.length === 0, `${w} S24 Pareto wrote float noise into the form: ${s24.noisy.join(', ')}`);
        // S22 (all result tables) + S20 (selected row): no cell of any scenario table on the Charts tab breaks or overflows;
        // the selected Pareto row is marked without a second hue
        const s22b = await p.evaluate(() => { document.querySelector('.ltc-tab-btn[data-tab="charts"]').click();
          document.querySelectorAll('.ltc-acc').forEach((a) => { if (!a.classList.contains('open') && a.querySelector('.scenario-table')) a.querySelector('.ltc-acc-head').click(); });
          const broken = [...document.querySelectorAll('.scenario-table td, .scenario-table th')].filter((c) => {
            const t = c.textContent.trim(); if (!t || c.offsetHeight === 0 || t.length > 40) return false;
            const r = document.createRange(); r.selectNodeContents(c); const lines = new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
            return lines > 1 || c.scrollWidth > c.clientWidth + 1; }).map((c) => c.textContent.trim()).slice(0, 6);
          const sel = document.querySelector('#paretoRows tr.selected'); let green = null;
          if (sel) { const cs = getComputedStyle(sel); for (const v of [cs.backgroundColor, cs.outlineColor]) { const m = v.match(/[\d.]+/g); if (m && (+m[3] !== 0) && +m[1] > +m[0] + 30 && +m[1] > +m[2]) green = v; } }
          return { broken, green }; });
        ok(s22b.broken.length === 0, `${w} S22 Charts-tab table cells broken across lines or overflowing: ${s22b.broken.join(' | ')}`);
        ok(!s22b.green, `${w} S20 selected Pareto row marked in a second hue: ${s22b.green}`);
        await p.evaluate(() => { const e = document.getElementById('inPumpHead'); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
        await new Promise((r) => setTimeout(r, 1500));
        const form = await p.evaluate(() => { const m = window.__ltcLastModel; return [m.pue, m.systemCop, m.netOpex]; });
        ok(form.every((v, i) => Math.abs(v - s24.k[i]) <= Math.abs(s24.k[i]) * 1e-9 + 1e-9), `${w} S24 Pareto point shows [${s24.k}] but the form computes [${form}]`);
        await p.goto(p.url(), { waitUntil: 'networkidle2' }); await new Promise((r) => setTimeout(r, 2500));
      }
    }
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `${w} S5 scrollWidth ${sw}`);
    ok(!errs.length, `${w} S5 page error: ${errs[0]}`);
    await p.close();
  }
} finally { await b.close(); }
if (fails.length) { console.log(`FAIL — ${fails.length}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log('PASS — step thread: 7 steps × 2 widths, every substituted equation recomputes, results follow the inputs, design status recomputes from its basis, run semantics hold, the rail follows the step, sensitivity recomputes on the plant, review compares against the saved scenario, the sliders show the model inputs, each pump figure names its loop, the Results card shows the plant, every trace reproduces from its inputs, every equation line evaluates to its result, tornado and impact matrix perturb the plant, scenario deltas compare like with like, screening-only settings are marked, the tab follows the step, the chrome has one accent and no tiles, the optimizer writes back only effective changes, table figures stay on one line, calibration figures reproduce from the form, a Pareto point applies against the prior design, the Sankey adds up to the plant, the Charts chrome is neutral, accordion titles are plain, chart series are amber and grey, scatter ticks are distinct, the compare card states its verdicts, 0 errors');
