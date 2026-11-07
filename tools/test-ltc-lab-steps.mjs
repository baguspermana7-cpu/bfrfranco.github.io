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
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `${w} S5 scrollWidth ${sw}`);
    ok(!errs.length, `${w} S5 page error: ${errs[0]}`);
    await p.close();
  }
} finally { await b.close(); }
if (fails.length) { console.log(`FAIL — ${fails.length}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log('PASS — step thread: 7 steps × 2 widths, every substituted equation recomputes, results follow the inputs, design status recomputes from its basis, run semantics hold, the rail follows the step, sensitivity recomputes on the plant, review compares against the saved scenario, the sliders show the model inputs, each pump figure names its loop, the Results card shows the plant, every trace reproduces from its inputs, every equation line evaluates to its result, tornado and impact matrix perturb the plant, scenario deltas compare like with like, screening-only settings are marked, the tab follows the step, 0 errors');
