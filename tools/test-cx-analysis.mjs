#!/usr/bin/env node
// test-cx-analysis.mjs — laws for the Cx Analysis tab on cx-calculator.html (PRD v1.1 §35 T1–T6, T10, T12, T15).
// Usage: node tools/test-cx-analysis.mjs [--base=http://127.0.0.1:8123] [--shots=dir]
// Serves the site root itself on 127.0.0.1:8123 when --base is omitted. Exits 1 on any failed law.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const SHOTS = arg('shots', ''); if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✘', n, d === undefined ? '' : JSON.stringify(d).slice(0, 300)); } };

/* ── Node laws (no browser) ── */
global.window = {}; require(resolve(ROOT, 'rz-engine.js'));
const P = require(resolve(ROOT, 'js', 'rz-cx-plan.js'));
{ // T10 every handbook link the tab emits points at an id that exists
  const anchors = new Set();
  P.LEVELS.forEach((l) => anchors.add(l.cite));
  Object.keys(P.CITES).forEach((k) => { const v = P.CITES[k]; if (typeof v === 'string') anchors.add(v); else Object.keys(v).forEach((j) => anchors.add(v[j])); });
  const bad = [];
  for (const a of anchors) {
    const [file, id] = a.split('#'); const p = resolve(ROOT, file);
    if (!existsSync(p)) { bad.push(a + ' (file)'); continue; }
    if (id && !new RegExp('id="' + id + '"').test(readFileSync(p, 'utf8'))) bad.push(a + ' (id)');
  }
  ok(`T10 ${anchors.size} handbook links resolve to a file and an id`, !bad.length, bad);
}

/* ── browser laws ── */
let server = null, base = arg('base', '');
if (!base) {
  const port = 8123; server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port; await new Promise((r) => setTimeout(r, 900));
}
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });
try {
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); const missing = []; page.on('response', (r) => { if (r.status() === 404) missing.push(r.url().replace(base, '')); }); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console ' + m.text()); });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} });   // the consent banner is position:fixed and would swallow clicks near the bottom edge
  await page.goto(base + '/cx-calculator.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => window.RZCxAnalysis && window.RZEngine && document.getElementById('cxTabBtnAnalysis'), { timeout: 30000 });
  await page.evaluate(() => { try { localStorage.removeItem('rz-cx-plan'); } catch (e) {} });
  // the register's own T13 rule (tools/test-tool-register.mjs): every visible control counts, aria-pressed chips OUTSIDE a .seg collapse to one group, .seg buttons count one by one
  const barControls = await page.evaluate(() => { const bar = document.querySelector('.tool-bar'); const vis = (e) => e.offsetParent !== null; const ctl = [...bar.querySelectorAll('button, a[role=button], select, a.btn, a[class*="btn"]')].filter(vis); const pressed = ctl.filter((c) => c.hasAttribute('aria-pressed') && !c.closest('.seg')); return { elements: ctl.length, total: ctl.length - pressed.length + (pressed.length ? 1 : 0), tabsOutsideBar: !bar.contains(document.getElementById('cxTabBtnAnalysis')) && document.querySelector('.tool-tabs.cx-tabs[role=tablist]') !== null }; });
  ok('T13 .tool-bar still <= 6 controls by the register rule; the page tabs sit on their own .tool-tabs row', barControls.total <= 6 && barControls.tabsOutsideBar, barControls);
  // T1 the calculator tab's DOM is byte-identical across a tab round trip
  const calcBefore = await page.evaluate(() => document.getElementById('cxTabCalc').innerHTML);
  await page.click('#cxTabBtnAnalysis'); await page.waitForFunction(() => !document.getElementById('cxTabAnalysis').hidden && document.querySelectorAll('#cxAnPlanTable tbody tr').length === 7, { timeout: 15000 });
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'cx-analysis-1440-dark.png'), fullPage: true });
  await page.click('#cxTabBtnCalc'); await page.waitForFunction(() => document.getElementById('cxTabAnalysis').hidden);
  const calcAfter = await page.evaluate(() => document.getElementById('cxTabCalc').innerHTML);
  ok('T1 calculator tab DOM identical after a tab round trip', calcBefore === calcAfter, { before: calcBefore.length, after: calcAfter.length });
  ok('T1 url carries ?tab=analysis only while the analysis tab is shown', await page.evaluate(() => !location.search.includes('tab=analysis')));
  await page.click('#cxTabBtnAnalysis'); await page.waitForFunction(() => !document.getElementById('cxTabAnalysis').hidden);
  ok('T1 deep link written on switch', await page.evaluate(() => location.search.includes('tab=analysis')));
  // T2 engine == calculator (grand total)
  const parity = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; const r = window.cxLastResults; return { plan: p && p.grand, calc: r && r.grandTotal, total: p && p.total }; });
  ok('T2 plan.grand vs calculator grandTotal within 1 %', parity.plan && parity.calc && Math.abs(parity.plan - parity.calc) / parity.calc < 0.01, parity);
  // KPI strip: no decimals > 2, no bare "0" for empty data
  const txt = await page.evaluate(() => document.getElementById('cxTabAnalysis').innerText);
  const longDec = txt.match(/\d+\.\d{3,}/g) || [];
  ok('T15 no numeral with more than two decimals in the rendered tab', !longDec.length, longDec.slice(0, 5));
  ok('KPI strip renders six facts', (await page.$$eval('#cxAnKpis .cx-kpi-card', (n) => n.length)) === 6);
  // T3 move L3 +1 month: finish +1, total unchanged (±$1), >= 6 monthly bars differ, successors move
  const before = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; return { finish: p.finishMonth, total: p.total, monthly: p.monthly.cost.slice(), l4: p.levels[4].start, l6end: p.levels[6].end }; });
  await page.evaluate(() => { const i = document.querySelector('.cx-an-in[data-level="L3"][data-field="start"]'); i.value = (parseFloat(i.value) + 1).toFixed(1); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction((f) => window.RZCxAnalysis.state.plan.finishMonth > f, {}, before.finish);
  const after = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; return { finish: p.finishMonth, total: p.total, monthly: p.monthly.cost.slice(), l4: p.levels[4].start, l6end: p.levels[6].end, edited: p.levels[3].edited, state: document.getElementById('cxAnState').textContent }; });
  const changedBars = after.monthly.filter((v, i) => Math.abs(v - (before.monthly[i] || 0)) > 1).length;
  ok('T3 L3 +1.0 mo → finish +1.0', Math.abs(after.finish - before.finish - 1) < 0.051, { before: before.finish, after: after.finish });
  ok('T3 total unchanged by a pure date shift (±$1)', Math.abs(after.total - before.total) <= 1, { before: before.total, after: after.total });
  ok('T3 >= 6 monthly cost buckets moved', changedBars >= 6, { changedBars });
  ok('T3 successors carried (L4 start +1, L6 end +1)', Math.abs(after.l4 - before.l4 - 1) < 0.051 && Math.abs(after.l6end - before.l6end - 1) < 0.051, { before, after });
  ok('T3 state reads Unsaved scenario and the L3 row is marked edited', after.edited && /Unsaved/.test(after.state), after.state);
  ok('T3 KPI finish shows the delta vs baseline', /\+1\.0 mo/.test(await page.$eval('#cxAnKpis', (n) => n.innerText)));
  // T4 save → reload keeps it; reset → baseline
  await page.click('#cxAnSave');
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RZCxAnalysis && window.RZCxAnalysis.state.plan && !document.getElementById('cxTabAnalysis').hidden, { timeout: 30000 });
  const kept = await page.evaluate(() => ({ finish: window.RZCxAnalysis.state.plan.finishMonth, state: document.getElementById('cxAnState').textContent }));
  ok('T4 reload keeps the saved scenario (finish still +1)', Math.abs(kept.finish - after.finish) < 0.051 && /Saved/.test(kept.state), kept);
  await page.click('#cxAnReset'); await page.waitForFunction((f) => Math.abs(window.RZCxAnalysis.state.plan.finishMonth - f) < 0.051, {}, before.finish);
  ok('T4 reset returns to the baseline and clears storage', await page.evaluate(() => localStorage.getItem('rz-cx-plan') === null && /baseline/i.test(document.getElementById('cxAnState').textContent)));
  // T5 / T6 status by month
  const mid = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; const l3 = p.levels[3]; return Math.round((l3.start + l3.end) / 2); });
  await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = m; r.dispatchEvent(new Event('input', { bubbles: true })); }, mid);
  const st = await page.evaluate(() => { const rows = [...document.querySelectorAll('#cxAnStatusTable tbody tr')]; const tags = rows.map((r) => r.children[3].textContent.trim()); return { n: rows.length, green: tags.filter((t) => t.includes('green')).length, yellow: tags.filter((t) => t.includes('yellow')).length, none: tags.filter((t) => t === '—').length, out: document.getElementById('cxAnMonthOut').textContent }; });
  ok('T5 mid-L3: 17 systems listed, some green and some yellow', st.n === 17 && st.green > 0 && st.yellow > 0, st);
  await page.evaluate(() => { const r = document.getElementById('cxAnMonth'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const m0 = await page.$$eval('#cxAnStatusTable tbody tr', (rows) => rows.filter((r) => r.children[2].textContent.trim() === '—').length);
  ok('T6 M0: no system carries an accepted level', m0 === 17, { m0 });
  // schematic: three sheets, nodes coloured by the month, click → inspector, halo on the changed node
  const sch = await page.evaluate(() => { const figs = [...document.querySelectorAll('#cxAnSheets .cx-an-sheet')]; return { n: figs.length, shown: figs.filter((f) => !f.hidden).map((f) => f.getAttribute('data-block')), hits: document.querySelectorAll('#cxAnSheets [data-rzd-hit]').length, states: [...document.querySelectorAll('#cxAnSheets [data-rzd-node]')].map((r) => r.getAttribute('data-rzd-state')) }; });
  ok('schematic: three sheets, electrical shown, every system a hit target', sch.n === 3 && sch.shown.join() === 'electrical' && sch.hits >= 17, sch);
  ok('schematic at M0: no node coloured', sch.states.length >= 17 && sch.states.every((s) => s === 'none'), sch.states);
  await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = m; r.dispatchEvent(new Event('input', { bubbles: true })); }, mid);
  const schMid = await page.$$eval('#cxAnSheets [data-rzd-node]', (rs) => rs.map((r) => r.getAttribute('data-rzd-state')));
  ok('schematic mid-L3: green and yellow nodes present (T5)', schMid.includes('green') && schMid.includes('yellow'), schMid);
  const gateMonth = await page.evaluate(() => Math.ceil(window.RZCxAnalysis.state.plan.levels[3].end));
  await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = m; r.dispatchEvent(new Event('input', { bubbles: true })); }, gateMonth);
  ok('schematic at the L3 gate month: at least one node carries the changed halo', (await page.$$eval('#cxAnSheets [data-cx-changed]', (n) => n.length)) >= 1);
  await page.evaluate(() => document.querySelector('.cx-an-sheet-tabs [data-sheet="mechanical"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await new Promise((r) => setTimeout(r, 120));
  const tabInfo = await page.evaluate(() => { const t = document.querySelector('.cx-an-sheet-tabs [data-sheet="mechanical"]'); const r = t.getBoundingClientRect(); return { connected: t.isConnected, x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 80) }; });
  try { await page.click('.cx-an-sheet-tabs [data-sheet="mechanical"]'); } catch (e) { console.log('  sheet-tab click failed:', e.message, JSON.stringify(tabInfo)); throw e; }
  ok('sheet tab switches to B', await page.evaluate(() => [...document.querySelectorAll('#cxAnSheets .cx-an-sheet')].filter((f) => !f.hidden).map((f) => f.getAttribute('data-block')).join() === 'mechanical'));
  await page.click('#cxAnSheets [data-rzd-hit="cdu"]'); await page.waitForFunction(() => /^CDUs/.test(document.getElementById('cxAnInsTitle').textContent));
  // K29: the same click also opens the inside of the block; Escape returns to the page (tools/test-cx-detail.mjs owns the modal's laws)
  const dt = await page.waitForFunction(() => { const d = document.getElementById('cxDetail'); return d && d.open && d.getAttribute('data-system') === 'cdu'; }, { timeout: 4000 }).then(() => true, () => false);
  ok('K29 a block click selects AND opens its detail modal', dt);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('cxDetail').open, { timeout: 4000 });
  ok('click on the CDU node opens its inspector and marks the node selected', await page.evaluate(() => !!document.querySelector('#cxAnSheets [data-rzd-node="cdu"][data-cx-selected]')));
  await page.evaluate(() => { const r = document.getElementById('cxAnMonth'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
  // 3D plant: mounts (or says why not), tints by month, roof-off focus, breadcrumb, budget
  await page.evaluate(() => document.getElementById('cxAnCampus').scrollIntoView({ block: 'center', behavior: 'instant' }));
  const c3 = await page.waitForFunction(() => ['ready', 'nogl', 'failed'].includes(document.getElementById('cxAnCampus').getAttribute('data-cx-3d')), { timeout: 30000 }).then(() => page.evaluate(() => document.getElementById('cxAnCampus').getAttribute('data-cx-3d'))).catch(() => 'timeout');
  ok('3D plant reaches ready or an explicit no-WebGL sentence', c3 === 'ready' || c3 === 'nogl', c3);
  if (c3 === 'ready') {
    await new Promise((r) => setTimeout(r, 1500));
    const st3 = await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.stats());
    ok('3D: equipment families and flows drawn within the draw-call budget (<= 300)', st3.equipment >= 12 && st3.flows >= 8 && st3.drawCalls > 0 && st3.drawCalls <= 300, st3);
    ok('3D: every equipment family is a shaped asset (RZCxAssets), not a box', st3.shaped === st3.equipment && st3.equipment === 15, { shaped: st3.shaped, equipment: st3.equipment });
    // P6 (3.28.0, §41 K15): the Blender library replaces the primitives, every unit has an outline hull, the site is a slab
    const glb = await page.waitForFunction(() => document.getElementById('cxAnCampus').getAttribute('data-cx-assets') === 'glb', { timeout: 20000 }).then(() => true).catch(() => false);
    const st6 = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); const s = h.__rzCampus.stats(); return { glb: s.glb, count: +h.getAttribute('data-cx-assets-count'), equipment: s.equipment, drawCalls: s.drawCalls }; });
    ok('P6 the Blender glb library loads and replaces all 15 families (data-cx-assets=glb)', glb && st6.glb === 15 && st6.count === 15, st6);
    ok('P6 draw calls stay <= 300 with the outline hulls', st6.drawCalls > 0 && st6.drawCalls <= 300, st6.drawCalls);
    await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus('hall'));
    await new Promise((r) => setTimeout(r, 700));
    const f3 = await page.evaluate(() => ({ focus: document.getElementById('cxAnCampus').getAttribute('data-cx-focus'), crumb: document.querySelector('#cxAnCampus .cx-3d-crumb').textContent }));
    ok('3D: focusing the hall lifts the roof and grows the breadcrumb', f3.focus === 'hall' && /Campus.*Data hall/.test(f3.crumb), f3);
    const co = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); const els = [...h.querySelectorAll('.cx-3d-co')].filter((e) => !e.hidden); const lines = [...h.querySelectorAll('.cx-3d-callouts line')].filter((l) => l.getAttribute('visibility') !== 'hidden'); const w = h.querySelector('.cx-3d-stage').clientWidth; const inside = els.every((e) => { const r = e.getBoundingClientRect(), s = h.querySelector('.cx-3d-stage').getBoundingClientRect(); return r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1; }); return { labels: els.length, lines: lines.length, texts: els.map((e) => e.textContent), inside, stats: h.__rzCampus.stats().callouts }; });
    ok('P6 the focused hall shows >= 6 family callouts, one leader line each, all inside the stage', co.labels >= 6 && co.lines === co.labels && co.inside && co.stats === co.labels, co);
    ok('P6 callouts name the family and its count (e.g. "rack rows · 220")', co.texts.some((s) => /^rack rows · \d+/.test(s)) && co.texts.some((s) => /CDU|cdu/.test(s)), co.texts);
    if (SHOTS) { const stage = await page.$('#cxAnCampus'); await page.evaluate(() => document.getElementById('cxAnCampus').scrollIntoView({ block: 'center', behavior: 'instant' })); await new Promise((r) => setTimeout(r, 500)); await stage.screenshot({ path: join(SHOTS, 'cx-campus-hall-1440-dark.png') }); }   /* the stage itself, not the viewport top */
    await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus(null)); await new Promise((r) => setTimeout(r, 400));
    const coNone = await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.stats().callouts);
    ok('P6 back on the campus the callouts are gone', coNone === 0, coNone);
    const hulls = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); const a = h.__rzCampus.stats().hulls; h.__rzCampus.focus('hall'); return new Promise((r) => setTimeout(() => r({ campus: a, hall: h.__rzCampus.stats().hulls }), 300)); });
    ok('P6 outline hulls are drawn only for the focused building (0 on the campus, >= 1 in the hall)', hulls.campus === 0 && hulls.hall >= 1, hulls);
    await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus('hall')); await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus(null));
    const fpsSample = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(n / 3); }; requestAnimationFrame(tick); }));
    ok('3D: page keeps >= 24 fps over 3 s while the flows run (headless software GL)', fpsSample >= 24, { fps: Math.round(fpsSample) });
    ok('3D: the note says design simulation and names the FWS flow basis', await page.evaluate(() => /design simulation/i.test(document.querySelector('#cxAnCampus .cx-3d-note').textContent) && /ΔT 10 K/.test(document.querySelector('#cxAnCampus .cx-3d-note').textContent)));
    const paused = await page.evaluate(() => { document.querySelector('#cxAnCampus [data-pause]').click(); return document.getElementById('cxAnCampus').__rzCampus.stats().paused; });
    ok('3D: pause flows control works', paused === true);
    // P7 (3.29.0, §41 K16–K18): the canvas is light in BOTH page themes (read from the GL buffer, not the source),
    // the plant is laid out from the basis and re-laid when the IT load changes, the focused building draws the hi twins
    const probeDark = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); h.__rzCampus.focus(null); return h.__rzCampus.probe(); });
    ok('K16 dark page theme: the 3D canvas renders light (min luminance ≥ 0.6, mean ≥ 0.75 over 5 probe pixels)', probeDark.min >= 0.6 && probeDark.avg >= 0.75, probeDark);
    const probeLight = await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); const h = document.getElementById('cxAnCampus'); const p = h.__rzCampus.probe(); document.documentElement.setAttribute('data-theme', 'dark'); return p; });
    ok('K16 light page theme: the same light canvas (min ≥ 0.6, mean ≥ 0.75)', probeLight.min >= 0.6 && probeLight.avg >= 0.75, probeLight);
    const stageBg = await page.evaluate(() => getComputedStyle(document.querySelector('#cxAnCampus .cx-3d-stage')).backgroundColor);
    ok('K16 the stage box behind the canvas is light too (computed background)', /rgb\((2[2-5]\d), (2[2-5]\d), (2[2-5]\d)\)/.test(stageBg), stageBg);
    const lay = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'), L = h.__rzCampus.layout(), s = h.__rzCampus.stats(); const C = window.RZEngine.models.commissioning, inp = C.mapInput(window.RZCxAnalysis.state.plan.input), es = C.equipScale(inp); return { kw: L.kw, rackKw: L.rackKw, racks: L.families.racks.count, esRacks: es.racks, drawn: Object.fromEntries(s.drawn), crah: L.families.crah.all, esCrah: es.cooling_units, cdu: L.families.cdu.count, cool: L.coolingType }; });
    ok('K18 the drawn rack count equals the engine rule (kW ÷ rack kW) and the InstancedMesh draws exactly that many', lay.racks === lay.esRacks && lay.drawn.racks === lay.racks && lay.crah === lay.esCrah, lay);
    ok('K18 an air-cooled basis draws no CDU; a liquid one would draw two per row', (lay.cool === 'air') === (lay.cdu === 0), lay);
    await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); h.__rzCampus.focus('hall'); });
    await new Promise((r) => setTimeout(r, 400));
    const coDyn = await page.evaluate(() => [...document.querySelectorAll('#cxAnCampus .cx-3d-co')].filter((e) => !e.hidden).map((e) => e.textContent));
    ok('K18 callouts carry the engine count, the basis and the month state (e.g. "rack rows · 334 · 6 kW per rack · not started")', coDyn.some((s) => new RegExp('^rack rows · ' + lay.racks + ' · ' + lay.rackKw + ' kW per rack').test(s)) && coDyn.every((s) => /not started|L[1-5]|in test/.test(s)), coDyn);
    const hiStats = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); return { hiAvail: +h.getAttribute('data-cx-assets-hi'), hiDrawn: h.__rzCampus.stats().hi }; });
    ok('K17 with the hall focused, every hall family with a _hi twin draws it (LOD)', hiStats.hiAvail === 0 || hiStats.hiDrawn >= 6, hiStats);
    await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus(null)); await new Promise((r) => setTimeout(r, 300));
    ok('K17 back on the campus no family draws its hi twin', (await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.stats().hi)) === 0);
    // K22 item 6: explode + Fit site / Fit selection
    const X0 = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'), b = h.querySelector('[data-explode]'), fs = h.querySelector('[data-fit="site"]'), fl = h.querySelector('[data-fit="sel"]'); return { has: !!(b && fs && fl), pressed: b && b.getAttribute('aria-pressed'), selDisabled: fl && fl.disabled }; });
    ok('X0 the campus bar has Explode (aria-pressed false), Fit site and Fit selection (disabled with nothing focused)', X0.has && X0.pressed === 'false' && X0.selDisabled === true, X0);
    if (X0.has) {
      const dots0 = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); h.__rzCampus.focus('hall'); return null; });
      await new Promise((r) => setTimeout(r, 500));
      const cy0 = await page.evaluate(() => [...document.querySelectorAll('#cxAnCampus svg circle')].filter((c) => c.getAttribute('visibility') !== 'hidden').map((c) => +c.getAttribute('cy')));
      await page.evaluate(() => document.querySelector('#cxAnCampus [data-explode]').click());
      await new Promise((r) => setTimeout(r, 900));
      const X1 = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); return { pressed: h.querySelector('[data-explode]').getAttribute('aria-pressed'), ex: h.__rzCampus.exploded(), cy: [...h.querySelectorAll('svg circle')].filter((c) => c.getAttribute('visibility') !== 'hidden').map((c) => +c.getAttribute('cy')) }; });
      const ys = X1.ex.layers.map((l) => l.y), distinct = new Set(ys.map((y) => y.toFixed(2))).size;
      ok('X1 Explode on the hall: pressed, factor 1, every hall family lifted to its own layer (all > 0, all distinct, >= 2)', X1.pressed === 'true' && X1.ex.factor === 1 && ys.length >= 2 && ys.every((y) => y > 0) && distinct === ys.length, X1.ex);
      ok('X1 the callout anchors follow the lifted layers (same count, and the anchor dots moved up on screen)', cy0.length > 0 && X1.cy.length === cy0.length && X1.cy.reduce((a, b) => a + b, 0) < cy0.reduce((a, b) => a + b, 0), { before: cy0, after: X1.cy });
      const X2 = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'), a = h.__rzCampus, wait = () => new Promise((r) => setTimeout(r, 1500)); /* K27: the camera eases 450 ms of clock; a software-GL frame can be 300 ms, so the landing frame may come ~750 ms after the click */ h.querySelector('[data-fit="site"]').click(); return wait().then(() => { const site = a.view(); const selDisabled = h.querySelector('[data-fit="sel"]').disabled; h.querySelector('[data-fit="sel"]').click(); return wait().then(() => ({ site, sel: a.view(), selDisabled, focus: h.getAttribute('data-cx-focus') })); }); });
      ok('X2 Fit site frames the whole site (zoom <= 1.3, target = site centre) and keeps the hall selected', X2.site.zoom <= 1.3 && X2.site.atSite && X2.focus === 'hall', X2);
      ok('X2 Fit selection is enabled with the hall focused and frames it (target = hall centre, zoom > site zoom)', !X2.selDisabled && X2.sel.atFocus && X2.sel.zoom > X2.site.zoom, X2);
      await page.evaluate(() => document.querySelector('#cxAnCampus [data-explode]').click());
      await new Promise((r) => setTimeout(r, 900));
      const X3 = await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.exploded());
      ok('X3 Explode off returns every layer to 0', X3.factor === 0 && X3.layers.every((l) => Math.abs(l.y) < 1e-6), X3);
      await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus(null)); await new Promise((r) => setTimeout(r, 300));
    }
    // the IT load changes → the plant re-lays itself (setBasis), the note and the counts follow
    const before = await page.evaluate(() => document.querySelector('#cxAnCampus .cx-3d-note').textContent);
    const relaid = await page.evaluate(() => { const el = document.getElementById('cxItLoadNum') || document.getElementById('cxItLoad'); const v0 = +el.value; el.value = String(Math.round(v0 * 2)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); if (typeof window.cxCalculate === 'function') window.cxCalculate(); return new Promise((res) => setTimeout(() => { const h = document.getElementById('cxAnCampus'), L = h.__rzCampus.layout(); res({ v0, kw: L.kw, racks: L.families.racks.count, drawn: Object.fromEntries(h.__rzCampus.stats().drawn).racks, note: document.querySelector('#cxAnCampus .cx-3d-note').textContent }); el.value = String(v0); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); if (typeof window.cxCalculate === 'function') window.cxCalculate(); }, 600)); });
    ok('K18 doubling the IT load re-lays the plant: kW, racks and the note change without a reload', relaid.kw === Math.round(lay.kw * 2) && relaid.racks > lay.racks && relaid.drawn === relaid.racks && relaid.note !== before && new RegExp(relaid.kw.toLocaleString('en-US') + ' kW IT').test(relaid.note), { was: lay.kw, now: relaid.kw, racks: [lay.racks, relaid.racks] });
    await new Promise((r) => setTimeout(r, 400));
  }
  // inspector: a system row → gate table + handbook ladder link; a level row → systems by gate month
  await page.click('#cxAnStatusTable [data-sel="sys:ups"]'); await page.waitForFunction(() => /UPS and batteries/.test(document.getElementById('cxAnInsTitle').textContent));
  const ins = await page.evaluate(() => ({ rows: document.querySelectorAll('#cxAnInsBody table tbody tr').length, ladder: !!document.querySelector('#cxAnInsBody a[href$="#s02-7-1"]'), op: /not connected/.test(document.getElementById('cxAnInsBody').innerText) }));
  ok('inspector: UPS shows 5 gate rows, the UPS ladder link and "Operating state: not connected"', ins.rows === 5 && ins.ladder && ins.op, ins);
  await page.click('#cxAnPlanTable [data-sel="level:L3"]'); await page.waitForFunction(() => /^L3/.test(document.getElementById('cxAnInsTitle').textContent));
  ok('inspector: L3 lists 17 systems by gate month', (await page.$$eval('#cxAnInsBody table tbody tr', (n) => n.length)) === 17);
  // Tier 1.5 (3.26.1): calendar panel, extension lines, CSV, PDF sheet
  await page.click('#cxAnReset'); await new Promise((r) => setTimeout(r, 200));
  const ex0 = await page.evaluate(() => { const p = document.getElementById('cxExPanel'); return { there: !!p, after: !!p && p.previousElementSibling && p.previousElementSibling.id === 'cxAnPlanPanel', rel: document.getElementById('cxExRelease').textContent, rows: document.querySelectorAll('#cxExTable tbody tr').length, slotOff: document.getElementById('cxExSlot').disabled }; });
  ok('P5 calendar panel renders after the plan editor; without a start date it says months are relative', ex0.there && ex0.after && /No start date/.test(ex0.rel) && ex0.rows === 0 && ex0.slotOff, ex0);
  await page.evaluate(() => { const i = document.getElementById('cxExAnchor'); i.value = '2027-01-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelectorAll('#cxExTable tbody tr').length === 7);
  const ex1 = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); const rows = [...document.querySelectorAll('#cxExTable tbody tr')].map((r) => r.children[1].textContent); return { release: cp.release, rel: document.getElementById('cxExRelease').textContent, slot: document.getElementById('cxExSlot').checked, firstStart: rows[0], l4: cp.levels[4], dates: rows.every((d) => /^\d{1,2} [A-Z][a-z]{2} 20\d\d$/.test(d)), base: cp.release === cp.baselineRelease }; });
  ok('P5 start date set: seven dated windows, release printed, witness slot defaults on, release equals its baseline', ex1.dates && /Release/.test(ex1.rel) && ex1.slot && ex1.base && /^\d{4}-\d{2}-\d{2}$/.test(ex1.release), ex1);
  ok('P5 L4 (witness) starts on a Monday of a full week', ex1.l4 && ex1.l4.witness && new Date(ex1.l4.start + 'T00:00:00Z').getUTCDay() === 1, ex1.l4);
  // a slipped L3 moves L4 to a later Monday and the row explains the constraint
  const rel0 = ex1.release;
  await page.evaluate(() => { const i = document.querySelector('.cx-an-in[data-level="L3"][data-field="start"]'); i.value = (parseFloat(i.value) + 0.5).toFixed(1); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelectorAll('#cxExTable tbody tr.is-edited').length >= 1);
  const ex2a = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); return { delta: cp.releaseDeltaDays, rel: document.getElementById('cxExRelease').textContent, l3: cp.levels[3].moved, l4: cp.levels[4].explain }; });
  ok('P5 L3 +0.5 mo (11 work days): L3 row moves, the L4 witness slot absorbs it, release holds on the baseline date', ex2a.l3 && ex2a.delta === 0 && /on the baseline date/.test(ex2a.rel) && /Witness slot/.test(ex2a.l4), ex2a);
  await page.evaluate(() => { const i = document.querySelector('.cx-an-in[data-level="L3"][data-field="start"]'); i.value = (parseFloat(i.value) + 1).toFixed(1); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction((r) => window.RZCxExt.compute(window.RZCxAnalysis.state.plan).release !== r, {}, rel0);
  const ex2 = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); return { delta: cp.releaseDeltaDays, rel: document.getElementById('cxExRelease').textContent, moved: cp.levels.filter((l) => l.moved).length, explain: [...document.querySelectorAll('#cxExTable tbody tr.is-edited .cx-ex-explain')].map((e) => e.textContent).filter(Boolean).length }; });
  ok('P5 L3 +1.5 mo crosses a month: release slips by whole weeks (delta printed), moved rows carry the constraint sentence', ex2.delta >= 28 && ex2.delta % 7 === 0 && /\+\d+ days/.test(ex2.rel) && ex2.moved >= 3 && ex2.explain >= 2, ex2);
  ok('P5 the edited L3 row says how many work days it moved vs its baseline start', await page.$eval('#cxExTable tbody tr:nth-child(4) .cx-ex-explain', (e) => /^\+33 work days vs baseline start/.test(e.textContent)), await page.$eval('#cxExTable tbody tr:nth-child(4) .cx-ex-explain', (e) => e.textContent));
  // extension lines: standby between the two releases prices the slip, lump on release adds once
  await page.click('#cxExAddStandby'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 1);
  await page.evaluate(() => { const i = document.querySelector('#cxExLines .cx-ex-in[data-field="perWorkDay"]'); i.value = '100'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('#cxExAddLump'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 2);
  await page.evaluate(() => { const i = document.querySelector('#cxExLines tr[data-line="lump1"] .cx-ex-in[data-field="amount"]'); i.value = '5000'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await new Promise((r) => setTimeout(r, 150));
  const ex3 = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); const sb = cp.lines[0], lp = cp.lines[1]; return { days: sb.days, sbAmt: sb.amount, lpAmt: lp.amount, ext: cp.extensionTotal, total: document.getElementById('cxExTotal').textContent, monthSum: cp.monthly.extension.reduce((a, b) => a + (b || 0), 0) }; });
  ok('P5 standby 100/work day over the slip + lump 5,000 on release = extension total, bucketed by month to the cent', ex3.days > 0 && ex3.sbAmt === ex3.days * 100 && ex3.lpAmt === 5000 && Math.abs(ex3.ext - (ex3.sbAmt + 5000)) < 0.01 && Math.abs(ex3.monthSum - ex3.ext) < 0.01 && /Extension total/.test(ex3.total), ex3);
  if (SHOTS) await (await page.$('#cxExPanel')).screenshot({ path: join(SHOTS, 'cx-p5-panel-1440-dark.png') });
  const ex3b = await page.evaluate(() => { const i = document.querySelector('#cxExLines tr[data-line="lump1"] .cx-ex-in[data-field="on"]'); i.value = 'tomorrow'; i.dispatchEvent(new Event('change', { bubbles: true })); return { err: document.getElementById('cxExErrors').textContent, kept: window.RZCxAnalysis.state.extra.lines[1].on }; });
  ok('P5 an invalid date on a line is refused with a sentence and the previous value kept', /not valid/.test(ex3b.err) && ex3b.kept === 'release', ex3b);
  // CSV import: one good row applies, bad rows are listed by row number; exports carry the header
  const imp = await page.evaluate(() => { const r = window.RZCxExt.importPlanText('level,start,months,crew,shift\nL2,3.0,1.5,8,2x12\nL9,1,1,1,1x8\nL1,abc,1,1,1x8\n'); return { accepted: r.accepted, errors: r.errors.map((e) => e.row), list: document.getElementById('cxExErrors').innerText, l2: window.RZCxAnalysis.state.plan.levels[2].start }; });
  ok('P5 plan CSV import: L2 row applied (start 3.0), rows 3 and 4 rejected with reasons', imp.accepted === 1 && imp.errors.join() === '3,4' && /Row 3/.test(imp.list) && /Row 4/.test(imp.list) && Math.abs(imp.l2 - 3) < 0.051, imp);
  const csv = await page.evaluate(() => { const got = {}; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { got.type = b.type; return 'blob:x'; }; const a = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { got.name = this.download; }; const out = {}; for (const k of ['plan', 'monthly', 'status', 'calendar', 'lines']) out[k] = window.RZCxExt.exportKind(k).split('\n')[0]; URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = a; return { out, got }; });
  ok('P5 five CSV exports download text/csv with their headers', csv.got.type.startsWith('text/csv') && /^level,/.test(csv.out.plan) && /^month,/i.test(csv.out.monthly) && /^system|^id/i.test(csv.out.status) && /^level,label,start,end,work_days/.test(csv.out.calendar) && /^id,label,kind/.test(csv.out.lines) && /\.csv$/.test(csv.got.name), csv);
  // PDF sheet: the page's export appends it, with the KPI, plan, monthly, status tables and the dated release
  const sheet = await page.evaluate(() => { const h = window.RZCxAnalysisSheet(); return { len: h.length, tables: (h.match(/<table/g) || []).length, title: /Cx Analysis — program plan/.test(h), release: /Release|Finish/.test(h) && /20\d\d/.test(h), svg: /<svg/.test(h), noScript: !/<script/.test(h), hooked: /RZCxAnalysisSheet\(\)/.test(document.documentElement.outerHTML) || typeof window.cxExportPDF === 'function' }; });
  ok('P5 PDF sheet: title, >= 4 tables, dated finish, schematic SVG snapshot, no script tags', sheet.title && sheet.tables >= 4 && sheet.release && sheet.svg && sheet.noScript, sheet);
  // save → reload keeps anchor, slot and lines (store v2)
  await page.click('#cxAnSave'); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RZCxExt && window.RZCxAnalysis.state.plan && document.querySelectorAll('#cxExLines tbody tr').length === 2, { timeout: 30000 });
  const kept2 = await page.evaluate(() => ({ anchor: document.getElementById('cxExAnchor').value, slot: document.getElementById('cxExSlot').checked, lines: window.RZCxAnalysis.state.extra.lines.map((l) => l.id).join(), per: window.RZCxAnalysis.state.extra.lines[0].perWorkDay }));
  ok('P5 reload keeps the start date, the slot rule and both lines', kept2.anchor === '2027-01-01' && kept2.slot && kept2.lines === 'standby1,lump1' && kept2.per === 100, kept2);
  // a cleared witness-slot box stays cleared when the date changes (slots default on only from a null date; reviewer MED 2026-11-07)
  await page.click('#cxExSlot'); await page.evaluate(() => { const i = document.getElementById('cxExAnchor'); i.value = '2027-02-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.getElementById('cxExAnchor').value === '2027-02-01' && window.RZCxAnalysis.state.extra.calendar.anchor === '2027-02-01');
  const slotKept = await page.evaluate(() => ({ slot: document.getElementById('cxExSlot').checked, st: window.RZCxAnalysis.state.extra.calendar.slot }));
  ok('P5 unchecking witness slots survives a later start-date change', slotKept.slot === false && slotKept.st === false, slotKept);
  await page.click('#cxExSlot'); await page.evaluate(() => { const i = document.getElementById('cxExAnchor'); i.value = '2027-01-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => window.RZCxAnalysis.state.extra.calendar.anchor === '2027-01-01' && window.RZCxAnalysis.state.extra.calendar.slot === true);
  await page.click('#cxExPanel [data-remove="standby1"]'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 1);
  ok('P5 remove line works', true);
  await page.click('#cxAnReset'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 0 && document.getElementById('cxExAnchor').value === '');
  ok('P5 reset clears calendar and lines', true);
  // charts: amber / grey only
  const series = await page.evaluate(() => { const out = []; for (const id of ['cxAnChartMonthly', 'cxAnChartCum', 'cxAnChartCrew']) { const c = window.Chart && window.Chart.getChart(document.getElementById(id)); if (!c) { out.push(id + ' missing'); continue; } c.data.datasets.forEach((d) => out.push(String(d.backgroundColor || d.borderColor))); } return out; });
  ok('T19 three charts drawn, series amber or neutral grey only', series.length === 6 && series.every((s) => /#D49A2A|#7D8794|#A0AEC0/i.test(s)), series);
  // light theme shot
  if (SHOTS) { await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await new Promise((r) => setTimeout(r, 400)); await page.screenshot({ path: join(SHOTS, 'cx-analysis-1440-light.png'), fullPage: true }); await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); }
  // T13 no WebGL → the sentence, and every other workflow still runs
  { const p2 = await browser.newPage(); await p2.setViewport({ width: 1440, height: 1000 });
    await p2.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k) { if (/webgl/.test(String(k))) return null; return orig.apply(this, arguments); }; });
    await p2.goto(base + '/cx-calculator.html?tab=analysis', { waitUntil: 'networkidle2', timeout: 60000 });
    await p2.evaluate(() => document.getElementById('cxAnCampus').scrollIntoView({ block: 'center', behavior: 'instant' }));
    const nogl = await p2.waitForFunction(() => document.getElementById('cxAnCampus').getAttribute('data-cx-3d') === 'nogl', { timeout: 30000 }).then(() => true).catch(() => false);
    const txt2 = await p2.evaluate(() => (document.querySelector('#cxAnCampus .cx-3d-nogl') || {}).textContent || '');
    ok('T13 no WebGL: the 3D panel states it in one sentence and the schematic remains', nogl && /no WebGL/.test(txt2) && await p2.evaluate(() => document.querySelectorAll('#cxAnSheets [data-rzd-hit]').length >= 17), txt2.slice(0, 80));
    await p2.close(); }
  /* K21 workbench (js/rz-cx-workbench.js): drag / keyboard / undo / impact / named scenarios — real pointer input */
  await page.evaluate(() => { try { localStorage.removeItem('rz-cx-scenarios'); } catch (e) {} document.getElementById('cxAnReset').click(); });
  const wbReady = await page.waitForFunction(() => window.RZCxWorkbench && document.querySelectorAll('#cxAnTimeline [data-cx-bar]').length === 7 && document.getElementById('cxWbImpactBody'), { timeout: 15000 }).then(() => true).catch(() => false);
  ok('W0 workbench loaded: 7 draggable bars, impact and scenario panels', wbReady);
  if (wbReady) {
    const geo = async (id, edge) => page.evaluate((id, edge) => {
      const r = document.querySelector('#cxAnTimeline [data-cx-' + (edge ? 'edge' : 'bar') + '="' + id + '"]'); r.scrollIntoView({ block: 'center', behavior: 'instant' });
      const b = r.getBoundingClientRect(), svg = r.ownerSVGElement, w = +svg.dataset.cxW, pad = +svg.dataset.cxPad, maxM = +svg.dataset.cxMaxm;
      return { x: b.left + (edge ? b.width / 2 : Math.min(20, b.width / 2)), y: b.top + b.height / 2, pxm: (svg.getBoundingClientRect().width * (w - pad - 10) / w) / maxM };
    }, id, edge);
    const st = () => page.evaluate(() => { const S = window.RZCxAnalysis.state, L = (id) => S.plan.levels.find((x) => x.id === id); return { ov: JSON.stringify(S.overrides), l2: L('L2'), l3: L('L3'), l5: L('L5'), total: S.plan.total, finish: S.plan.finishMonth, why: document.getElementById('cxWbImpactBody').textContent }; });
    const drag = async (id, months, edge, esc) => { const g = await geo(id, edge); await page.mouse.move(g.x, g.y); await page.mouse.down(); for (let k = 1; k <= 8; k++) await page.mouse.move(g.x + g.pxm * months * k / 8, g.y); if (esc) await page.keyboard.press('Escape'); await page.mouse.up(); await new Promise((r) => setTimeout(r, 150)); };
    const b0 = await st();
    await drag('L3', 1.0);
    const d1 = await st();
    ok('W1 drag L3 bar +1 month: start +1.0 (±0.1), finish +1.0, total unchanged', Math.abs(d1.l3.start - b0.l3.start - 1) <= 0.11 && Math.abs(d1.finish - b0.finish - 1) <= 0.11 && d1.total === b0.total, { s0: b0.l3.start, s1: d1.l3.start, f: [b0.finish, d1.finish], t: [b0.total, d1.total] });
    ok('W1 impact panel says why: L4 carried from L3', /L4 moves \+1\.0 mo — carried from L3/.test(d1.why) && /L3 edited: start/.test(d1.why), d1.why.slice(0, 300));
    await page.evaluate(() => document.getElementById('cxWbUndo').click()); const u1 = await st();
    ok('W2 Undo restores the baseline (overrides {})', u1.ov === '{}' && u1.finish === b0.finish, u1.ov);
    await page.evaluate(() => document.getElementById('cxWbRedo').click()); const r1 = await st();
    ok('W2 Redo re-applies the drag', r1.ov === d1.ov, [r1.ov, d1.ov]);
    await page.evaluate(() => document.body.focus()); await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); const k1 = await st();
    ok('W3 Ctrl+Z undoes outside a text field', k1.ov === '{}', k1.ov);
    await drag('L3', 2.0, false, true); const e1 = await st();
    ok('W4 Esc mid-drag cancels: plan unchanged', e1.ov === '{}' && e1.finish === b0.finish, e1.ov);
    await drag('L5', 0.5, true); const s1 = await st();
    ok('W5 drag L5 right end +0.5 mo: duration +0.5 (±0.1), start kept, cost moves (witness days)', Math.abs(s1.l5.months - b0.l5.months - 0.5) <= 0.11 && Math.abs(s1.l5.start - b0.l5.start) < 0.01 && s1.total > b0.total, { m: [b0.l5.months, s1.l5.months], t: [b0.total, s1.total] });
    await page.evaluate(() => document.getElementById('cxWbUndo').click());
    await page.evaluate(() => document.querySelector('#cxAnTimeline [data-cx-bar="L2"]').focus()); for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
    await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift'); const kb = await st();
    const focusKept = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-cx-bar'));
    ok('W6 keyboard: 3× ArrowRight = start +0.3, Shift+ArrowRight = duration +0.1, focus stays on the bar', Math.abs(kb.l2.start - b0.l2.start - 0.3) < 0.01 && Math.abs(kb.l2.months - b0.l2.months - 0.1) < 0.01 && focusKept === 'L2', { s: [b0.l2.start, kb.l2.start], m: [b0.l2.months, kb.l2.months], focusKept });
    await page.evaluate(() => { const c = document.getElementById('cxAnCap'); c.value = '1'; c.dispatchEvent(new Event('change', { bubbles: true })); });
    ok('W7 cap 1 → impact lists the months over the cap', await page.evaluate(() => /above the site crew cap of 1 /.test(document.getElementById('cxWbImpactBody').textContent)));
    await page.evaluate(() => { document.getElementById('cxWbName').value = 'Slip L2'; document.getElementById('cxWbSaveAs').click(); });
    const saved = await page.evaluate(() => [...document.querySelectorAll('#cxWbScenBody tbody th')].map((x) => x.textContent).concat(['msg=' + document.getElementById('cxWbMsg').textContent, 'val=' + document.getElementById('cxWbName').value, 'active=' + (document.activeElement && document.activeElement.id)])).then((a) => a.filter((x) => !/^(msg|val|active)=/.test(x)).length === 3 ? a.filter((x) => !/^(msg|val|active)=/.test(x)) : a);
    ok('W8 Save as adds a named row between baseline and current', saved.length === 3 && /^Slip L2/.test(saved[1]), saved);
    await page.evaluate(() => document.getElementById('cxAnReset').click()); const rs = await st();
    await page.evaluate(() => document.querySelector('#cxWbScenBody [data-wb-load="Slip L2"]').click()); const ld = await st();
    ok('W8 Reset then Load restores the saved overrides', rs.ov === '{}' && ld.ov === kb.ov, [rs.ov, ld.ov, kb.ov]);
    for (const n of ['B', 'C', 'D', 'E', 'F']) { await page.evaluate((n) => { document.getElementById('cxWbName').value = n; document.getElementById('cxWbSaveAs').click(); }, n); }
    const full = await page.evaluate(() => ({ rows: document.querySelectorAll('#cxWbScenBody [data-wb-load]').length, msg: document.getElementById('cxWbMsg').textContent }));
    ok('W8 five kept; the sixth name is refused with a reason', full.rows === 5 && /5 scenarios saved already/.test(full.msg), full);
    await page.evaluate(() => document.querySelector('#cxWbScenBody [data-wb-del="Slip L2"]').click());
    ok('W8 Delete removes the row', await page.evaluate(() => !document.querySelector('#cxWbScenBody [data-wb-load="Slip L2"]')));
    ok('W9 no change → the Δ chart says so instead of printing a ±$1 scale', await page.evaluate(() => { document.getElementById('cxAnReset').click(); const t = document.getElementById('cxWbImpactBody').textContent; return /no change in any month/.test(t) && !/\+\$1\b/.test(t); }));
    await page.click('#cxWbScenBody [data-wb-load="B"]').catch(() => {}); await drag('L3', 1.0);
    if (SHOTS) { await page.evaluate(() => document.getElementById('cxWbImpact').scrollIntoView({ block: 'start', behavior: 'instant' })); await page.screenshot({ path: join(SHOTS, 'cx-workbench-1440.png') }); }
    await page.evaluate(() => { localStorage.removeItem('rz-cx-scenarios'); const c = document.getElementById('cxAnCap'); c.value = ''; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('cxAnReset').click(); });
  }
  /* K22 journey 2 / T9: an issue A on the UPS blocks its next gate on the schematic, the status table and readiness */
  await page.evaluate(() => { try { localStorage.removeItem('rz-cx-issues'); } catch (e) {} document.getElementById('cxAnReset').click(); });
  const j2ready = await page.waitForFunction(() => window.RZCxIssuesUI && document.getElementById('cxIsForm'), { timeout: 15000 }).then(() => true).catch(() => false);
  ok('J2 issue register panel present', j2ready);
  if (j2ready) {
    const m = await page.evaluate(() => { const S = window.RZCxAnalysis.state; for (let mo = 0; mo <= Math.ceil(S.plan.finishMonth); mo++) { const r = window.RZCxPlan.statusAt(S.plan, mo).systems.find((x) => x.id === 'ups'); if (r.next === 'L4') return mo; } return -1; });
    await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = String(m); r.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#cxAnStatusTable [data-sel="sys:ups"]').click(); }, m);
    const pre = await page.evaluate(() => ({ verdict: (document.querySelector('.cx-is-verdict') || {}).textContent || '', items: document.querySelectorAll('.cx-is-items input').length }));
    ok('J2 inspector: readiness for the L4 gate, 5 handbook items, not ready', m >= 0 && /Not ready for the L4 gate/.test(pre.verdict) && pre.items === 5, { m, pre });
    await page.type('#cxIsTitle', 'UPS-A1 bypass breaker fails to close');
    await page.select('#cxIsSev', 'A'); await page.select('#cxIsSys', 'ups'); await page.select('#cxIsGate', 'L4');
    await page.evaluate(() => document.getElementById('cxIsAdd').click());
    const blk = await page.evaluate(() => ({ node: document.querySelectorAll('#cxAnSheets [data-rzd-node="ups"][data-cx-blocked]').length, mark: document.querySelectorAll('#cxAnSheets [data-cx-blocked-mark="ups"]').length, row: (document.querySelector('#cxAnStatusTable tr[data-cx-asset="ups"]') || {}).textContent || '', count: (document.querySelector('[data-cx-blocked-count] b') || {}).textContent, verdict: (document.querySelector('.cx-is-verdict') || {}).textContent || '' }));
    ok('J2 add A on UPS/L4: node blocked + static marker, row "blocked ISS-01", count 1, readiness names ISS-01 (A)', blk.node >= 1 && blk.mark >= 1 && /blocked ISS-01/.test(blk.row) && blk.count === '1' && /ISS-01 \(A\) open/.test(blk.verdict), blk);
    await page.evaluate(() => { const r = document.getElementById('cxAnMonth'); r.dispatchEvent(new Event('input', { bubbles: true })); });
    ok('J2 marker survives a month redraw', await page.evaluate(() => document.querySelectorAll('#cxAnSheets [data-cx-blocked-mark="ups"]').length >= 1));
    await page.type('#cxIsTitle', '<img src=x onerror=window.__xss=1>'); await page.select('#cxIsSev', 'C'); await page.evaluate(() => document.getElementById('cxIsAdd').click());
    ok('J2 issue title is text, never markup', await page.evaluate(() => !window.__xss && !document.querySelector('#cxIsList img') && /<img src=x/.test(document.getElementById('cxIsList').textContent)));
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RZCxIssuesUI && document.querySelectorAll('#cxIsList tr[data-is]').length === 2, { timeout: 30000 }).catch(() => {});
    ok('J2 register survives a reload', await page.evaluate(() => document.querySelectorAll('#cxIsList tr[data-is]').length === 2));
    await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = String(m); r.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#cxAnStatusTable [data-sel="sys:ups"]').click(); }, m);
    await page.evaluate(() => document.querySelector('#cxIsList [data-is-toggle="ISS-01"]').click());
    const cl = await page.evaluate(() => ({ node: document.querySelectorAll('#cxAnSheets [data-cx-blocked]').length, count: (document.querySelector('[data-cx-blocked-count] b') || {}).textContent }));
    ok('J2 close ISS-01 → marker gone, blocked 0', cl.node === 0 && cl.count === '0', cl);
    for (let k = 0; k < 5; k++) { await page.evaluate((k) => document.querySelectorAll('.cx-is-items input')[k].click(), k); }
    const rd = await page.evaluate(() => (document.querySelector('.cx-is-verdict') || {}).textContent || '');
    ok('J2 all five items ticked, no blocker → "Ready for the L4 gate" with the C condition', /^Ready for the L4 gate with 1 condition \(ISS-02\)/.test(rd), rd);
    if (SHOTS) { await page.evaluate(() => document.getElementById('cxIsPanel').scrollIntoView({ block: 'start', behavior: 'instant' })); await page.screenshot({ path: join(SHOTS, 'cx-issues-1440.png') }); }
    await page.evaluate(() => { localStorage.removeItem('rz-cx-issues'); });
  }
  /* K22 §12: Changed this month, play speed, scenario mode */
  {
    await page.evaluate(() => document.getElementById('cxAnReset').click());
    const mode0 = await page.evaluate(() => ({ mode: document.getElementById('cxTabAnalysis').getAttribute('data-cx-mode'), after: getComputedStyle(document.getElementById('cxAnSchematic'), '::after').content }));
    ok('M1 baseline: data-cx-mode=baseline, no scenario mark', mode0.mode === 'baseline' && (mode0.after === 'none' || mode0.after === 'normal'), mode0);
    await page.evaluate(() => { const i = document.querySelector('.cx-an-in[data-level="L3"][data-field="start"]'); i.value = String(+i.value + 1); i.dispatchEvent(new Event('change', { bubbles: true })); });
    const mode1 = await page.evaluate(() => ({ mode: document.getElementById('cxTabAnalysis').getAttribute('data-cx-mode'), after: getComputedStyle(document.getElementById('cxAnSchematic'), '::after').content, outline: getComputedStyle(document.getElementById('cxAnSchematic')).outlineStyle }));
    ok('M1 an override → scenario mode: dashed outline + "Scenario · not the approved baseline"', mode1.mode === 'scenario' && /Scenario · not the approved baseline/.test(mode1.after) && mode1.outline === 'dashed', mode1);
    await page.evaluate(() => document.getElementById('cxAnReset').click());
    const m = await page.evaluate(() => { const S = window.RZCxAnalysis.state; for (let mo = 1; mo <= Math.ceil(S.plan.finishMonth); mo++) { const c = window.RZCxPlan.statusAt(S.plan, mo).systems.filter((x) => x.changed).length; if (c > 0 && c < 17) return mo; } return -1; });
    await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = String(m); r.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('cxAnChangedOnly').click(); }, m);
    const ch = await page.evaluate(() => { const rows = [...document.querySelectorAll('#cxAnStatusTable tbody tr[data-cx-asset]')]; const vis = rows.filter((r) => r.offsetParent !== null); const n = window.RZCxPlan.statusAt(window.RZCxAnalysis.state.plan, window.RZCxAnalysis.state.month).systems.filter((x) => x.changed).length; const un = document.querySelectorAll('#cxAnSheets [data-rzd-node]:not([data-cx-changed])').length, veils = document.querySelectorAll('#cxAnSheets [data-cx-veil]').length; return { vis: vis.length, n, allChanged: vis.every((r) => r.classList.contains('is-changed')), un, veils, pressed: document.getElementById('cxAnChangedOnly').getAttribute('aria-pressed') }; });
    ok('C1 Changed this month: only the changed systems listed, the others dimmed on the sheet', ch.pressed === 'true' && ch.vis === ch.n && ch.n > 0 && ch.n < 17 && ch.allChanged && ch.veils === ch.un && ch.un > 0, ch);
    const e0 = await page.evaluate(() => { const S = window.RZCxAnalysis.state; let mo = -1; for (let k = 0; k <= Math.ceil(S.plan.finishMonth); k++) if (!window.RZCxPlan.statusAt(S.plan, k).systems.some((x) => x.changed)) { mo = k; break; } const r = document.getElementById('cxAnMonth'); r.value = String(mo); r.dispatchEvent(new Event('input', { bubbles: true })); const t = (document.querySelector('#cxAnStatusTable .cx-an-empty') || {}).textContent || ''; return { mo, t }; });
    ok('C2 a month with no gate says so, with Clear', e0.mo >= 0 && /No gate passes in M/.test(e0.t), e0);
    await page.evaluate(() => document.querySelector('#cxAnStatusTable [data-cx-clear-changed]').click());
    ok('C2 Clear switches the filter off: all 17 rows back', await page.evaluate(() => document.getElementById('cxAnChangedOnly').getAttribute('aria-pressed') === 'false' && [...document.querySelectorAll('#cxAnStatusTable tbody tr[data-cx-asset]')].filter((r) => r.offsetParent !== null).length === 17));
    await page.select('#cxAnSpeed', '600');
    ok('P1 play speed 2× = 600 ms per month', await page.evaluate(() => window.RZCxAnalysis.state.playMs === 600));
    await page.select('#cxAnSpeed', '1200');
  }
  /* K22 §23: gate heatmap and the chart data table */
  {
    await page.evaluate(() => { document.getElementById('cxAnReset').click(); const r = document.getElementById('cxAnMonth'); r.value = '4'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    const hm = await page.evaluate(() => { const S = window.RZCxAnalysis.state, st = window.RZCxPlan.statusAt(S.plan, S.month); const cells = [...document.querySelectorAll('#cxTbHeatBody [data-cx-heat]')]; const passed = cells.filter((c) => c.dataset.state === 'passed').length; let expect = 0; st.systems.forEach((x) => ['L1', 'L2', 'L3', 'L4', 'L5'].forEach((L) => { if (x.gates[L] != null && x.gates[L] <= S.month) expect++; })); return { cells: cells.length, passed, expect, month: document.getElementById('cxTbHeatSub').dataset.month }; });
    ok('H1 heatmap: 17 × 5 cells, passed cells = gates on or before the month (statusAt), follows the month', hm.cells === 85 && hm.passed === hm.expect && hm.month === 'M4', hm);
    await page.evaluate(() => document.getElementById('cxTbToggle').click());
    const tb = await page.evaluate(() => { const S = window.RZCxAnalysis.state, rows = document.querySelectorAll('#cxTbBody tbody tr'); return { rows: rows.length, months: S.plan.monthly.cost.length, hidden: document.getElementById('cxTbBody').hidden, first: rows[0] && rows[0].textContent, eng: window.RZCxTables.rows()[0] }; });
    ok('H2 chart table: one row per engine month, opened by the toggle', !tb.hidden && tb.rows === tb.months, tb);
    ok('H2 table Σ scenario = engine total (±$25 rounding)', await page.evaluate(() => { const S = window.RZCxAnalysis.state; return Math.abs(window.RZCxTables.rows().reduce((a, r) => a + r.scen, 0) - S.plan.total) <= 25; }));
  }
  // T12 phone
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: 'load' }); /* never networkidle on a page with a WebGL loop (feedback_webgl_headless_gate_traps) */ await page.waitForFunction(() => window.RZCxAnalysis && !document.getElementById('cxTabAnalysis').hidden, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sx: window.scrollX, wide: [...document.querySelectorAll('#cxTabAnalysis *')].filter((e) => e.getBoundingClientRect().right > 391 && !e.closest('.cx-an-tablewrap') && !e.closest('.cx-an-sheet')).map((e) => e.tagName + '.' + e.className).slice(0, 5), small: [...document.querySelectorAll('#cxTabAnalysis input, #cxTabAnalysis select')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length }));
  ok('T12 390 px: scrollWidth <= 390 and nothing outside the viewport (table wraps excepted)', phone.sw <= 390 && !phone.wide.length, phone);
  ok('T12 390 px: every field >= 16 px (no iOS zoom)', phone.small === 0, phone);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'cx-analysis-390-dark.png'), fullPage: true });
  /* Tier 3 slice (3.29.0): the Records panel overlays ACTUAL accepted levels from the demo record set on the plan */
  const rec = await page.waitForFunction(() => { const t = document.querySelector('#cxRecTable tbody'); return t && t.querySelectorAll('tr').length === 17 && /3 of 10 L3/.test(t.textContent); }, { timeout: 15000 }).then(() => page.evaluate(() => { const row = document.querySelector('#cxRecTable tr[data-cx-rec="crah"]'); const cells = [...row.querySelectorAll('td')].map((c) => c.textContent); return { cells, counts: document.getElementById('cxRecCounts').textContent, findSub: document.getElementById('cxRecFindSub').textContent, findings: document.querySelectorAll('#cxRecFindings li').length, ups: document.querySelector('#cxRecTable tr[data-cx-rec="ups"] td:nth-child(4)').textContent }; })).catch(() => null);
  ok('T20 Records panel: 17 rows, crah = actual L3 · "3 of 10 L3" · 1 blocked · "Model not verified (2 of 10)"', !!rec && rec.cells.length === 5 && rec.cells[1] === 'L3' && rec.cells[2] === '3 of 10 L3' && rec.cells[3] === '1' && rec.cells[4] === 'Model not verified (2 of 10)', rec);
  ok('T20 Records panel: a system without a register says "no register" and the demo set has 0 findings', !!rec && rec.ups === 'no register' && /^0 findings/.test(rec.findSub) && rec.findings === 0, rec && { ups: rec.ups, findSub: rec.findSub });
  const recImp = await page.evaluate(() => { document.getElementById('cxRecCsv').value = ['tag,class,system_id,location_id,rating', 'CRAH-11,crah,crah,HALL-1,200 kW', 'CRAH-11,crah,crah,HALL-1,200 kW', 'PUMP-9,pump,nope,PLANT-1,30 kW', 'UPS-5,ups,ups,,500 kW'].join('\n'); document.getElementById('cxRecImport').click(); return { sub: document.getElementById('cxRecImportSub').textContent, rejected: [...document.querySelectorAll('#cxRecRejected li')].map((l) => l.textContent), applyEnabled: !document.getElementById('cxRecApply').disabled }; });
  ok('T20 import: 1 accepted, 3 rejected with reasons (duplicate tag, unknown system_id, missing parent), apply enabled', /^1 row\(s\) accepted · 3 rejected/.test(recImp.sub) && recImp.rejected.length === 3 && /duplicate tag CRAH-11/.test(recImp.rejected[0]) && /unknown system_id nope/.test(recImp.rejected[1]) && /missing location_id/.test(recImp.rejected[2]) && recImp.applyEnabled, recImp);
  const recApplied = await page.evaluate(() => { document.getElementById('cxRecApply').click(); return { sub: document.getElementById('cxRecImportSub').textContent, crah: document.querySelector('#cxRecTable tr[data-cx-rec="crah"] td:nth-child(4)').textContent, assets: document.getElementById('cxRecCounts').textContent }; });
  ok('T20 apply: the accepted row joins the set in-page — crah becomes "3 of 11 L3", 12 assets', /1 added/.test(recApplied.sub) && recApplied.crah === '3 of 11 L3' && /assets 12/.test(recApplied.assets), recApplied);
  ok('no page or console errors', !errs.length, errs.slice(0, 4));
  if (missing.length) console.log('  · 404 resources (fatal in the repo ship gate, informational here):', [...new Set(missing)].slice(0, 8).join(' '));
  ok('calculator-only sections hidden on the analysis tab', await page.evaluate(() => { const ex = window.RZCxAnalysis.state.extras || []; return ex.length >= 1 && ex.every((e) => e.hidden) && document.querySelector('.cx-below').closest('#cxTabCalc') !== null; }));
} finally { await browser.close(); if (server) server.kill(); }
console.log(`CX ANALYSIS — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
