#!/usr/bin/env node
/* test-explain-ask.mjs — PRD-P21 stage 1 gate: "Ask about this page" (js/rz-ask.js + data/explain/*.json).
 *   N1 fresh      every data/explain/<page>.json equals what tools/build-explain-index.mjs builds now
 *   N2 grounded   every record id resolves in the registry the page's drawer reads; every manual anchor exists as an
 *                 id in the manual file; the manual is the one the page links (FR-P21-4: no citation that does not resolve)
 *   N3 wired      15 pages: one slot, one rz-ask.js tag after the basis drawer, its index file exists
 *   N4 useful     20 fixture questions return the expected record or section in the top 3 (>= 18, PRD §4); the PRD
 *                 acceptance: "why is PUE 1.165" on datahallAI has pue.design_day FIRST
 *   N5 honest     10 off-topic questions return the honest miss (10/10)
 *   N6 held-out   12 questions written after tuning and never tuned against: >= 9 (recorded 11/12 at v3.53.0)
 *   N7 fast       every question answers in < 50 ms in Node (PRD §15)
 *   N8 template   every answer sentence is a template over record fields (nothing generated, PRD §12)
 *   B1..B9        in a real browser: answer card cites and opens the drawer, honest miss, loading and failed-load
 *                 states with Retry, a gated value stays hidden signed-out, text-only rendering of a hostile question,
 *                 Escape/focus order, 390 px stacking, axe on the open panel, the trigger present on all 15 pages
 *   node tools/test-explain-ask.mjs [--node-only] */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PAGES, buildPage, outPath, manualSections } from './build-explain-index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ASK_PATH = process.env.RZ_ASK_JS ? path.resolve(process.env.RZ_ASK_JS) : path.join(ROOT, 'js/rz-ask.js');
const RZAsk = require(ASK_PATH);
const NODE_ONLY = process.argv.includes('--node-only');
let fails = 0, passes = 0;
const ok = (c, name, detail = '') => { if (c) { passes++; console.log('  PASS  ' + name + (detail ? ' — ' + detail : '')); } else { fails++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); } };
const idx = {};
const loadIdx = p => idx[p] || (idx[p] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/explain', p + '.json'), 'utf8')));

const HITS = [
  ['datahallAI', 'why is PUE 1.165', 'pue.design_day'], ['datahallAI', 'kenapa PUE 1,165', 'pue.design_day'],
  ['datahallAI', 'how many GPUs', 'compute.gpu_facility'], ['datahallAI', 'what is the free cooling cliff', 'pue.free_cooling_cliff_ambient_c'],
  ['datahallAI', 'CDU count per hall', 'equipment.cdu_installed_per_hall'],
  ['dc-conventional', 'design PUE', 'site.pue'], ['dc-conventional', 'how many halls', 'campus.hall_count'],
  ['dc-conventional', 'UPS efficiency', 'electrical.ups_efficiency'], ['chiller-plant', 'chilled water supply temperature', 'cooling.chws_c'],
  ['datahall', 'rack power', 'hall.rack_actual_avg_kw'], ['fuel-system', 'fuel autonomy hours', 'fuel.autonomy_hr'],
  ['pue-calculator', 'what is DCiE', 'calc.pue.dcie'], ['pue-calculator', 'annual energy', 'calc.pue.annual_energy'],
  ['pue-calculator', 'where does the data come from', '#constants-and-data-sources'],
  ['capex-calculator', 'cost per kW', 'calc.capex.per_kw'], ['capex-calculator', 'biaya generator', 'calc.capex.cost.generator'],
  ['opex-calculator', 'staffing cost', 'calc.opex.staffing'], ['tco-calculator', 'which option is lowest TCO', 'calc.tco.lowest'],
  ['roi-calculator', 'what is the IRR', 'calc.roi.irr'], ['carbon-footprint', 'scope 3 emissions', 'calc.carbon.scope3']
];
const MISSES = [
  ['datahallAI', 'what is the weather'], ['pue-calculator', 'who won the football match'], ['capex-calculator', 'how do I bake bread'],
  ['roi-calculator', 'best restaurant in Jakarta'], ['dc-conventional', 'what time is it'], ['chiller-plant', 'tell me a joke'],
  ['opex-calculator', 'stock price of nvidia'], ['datahall', 'siapa presiden indonesia'], ['carbon-footprint', 'translate hello to french'],
  ['ict', 'play music']
];
const HELD_OUT = [
  ['datahallAI', 'total IT power in MW', 'power.total_it_mw'], ['datahallAI', 'how many racks per hall', 'compute.racks_per_hall'],
  ['datahallAI', 'chiller count', 'equipment.chillers_installed|design.counts.chillers_running'], ['dc-conventional', 'generator size', 'MISS'],   /* the conventional registry carries no generator rating: a miss is right */
  ['chiller-plant', 'condenser water temperature', 'cooling.cdw_supply_c|cooling.cdw_return_c'], ['opex-calculator', 'maintenance cost per year', 'calc.opex.maintenance'],
  ['roi-calculator', 'net present value', 'calc.roi.npv'], ['tco-calculator', 'colocation cost', 'calc.tco.colo'],
  ['carbon-footprint', 'scope 2 grid electricity', 'calc.carbon.scope2'], ['pue-calculator', 'total facility power', 'calc.pue.total_power'],
  ['capex-calculator', 'berapa biaya pendingin', 'calc.capex.cost.cooling'], ['water-system', 'water usage effectiveness', 'water.wue_l_per_kwh']
];
const cite = h => h.doc.kind === 'record' ? h.doc.id : '#' + h.doc.anchor;

console.log('── N: index, grounding, matcher ──');
{ // N1
  const stale = PAGES.filter(cfg => !fs.existsSync(outPath(cfg)) || fs.readFileSync(outPath(cfg), 'utf8') !== JSON.stringify(buildPage(cfg)) + '\n');
  ok(!stale.length, 'N1 every explain index is fresh', stale.length ? 'stale: ' + stale.map(c => c.page).join(', ') : PAGES.length + ' pages');
}
{ // N2
  const bad = [];
  for (const cfg of PAGES) {
    const j = loadIdx(cfg.page), src = fs.readFileSync(path.join(ROOT, cfg.page + '.html'), 'utf8');
    const regAttr = (src.match(/<script[^>]*rz-basis-drawer\.js[^>]*data-rz-registry="([^"]+)"/) || src.match(/<script[^>]*data-rz-registry="([^"]+)"[^>]*rz-basis-drawer\.js/) || [])[1] || 'RZ_CONV_PARAMETERS';
    if (regAttr !== j.registry.global) bad.push(`${cfg.page}: index cites ${j.registry.global}, the page's drawer reads ${regAttr}`);
    const reg = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, j.registry.file), 'utf8')).parameters.map(r => r.id));
    if (!src.includes(`href="${j.manual}"`)) bad.push(`${cfg.page}: the page does not link ${j.manual}`);
    const manual = fs.readFileSync(path.join(ROOT, j.manual), 'utf8');
    const ids = new Set([...manual.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
    for (const d of j.docs) {
      if (d.kind === 'record' && !reg.has(d.id)) bad.push(`${cfg.page}: record ${d.id} not in ${j.registry.file}`);
      if (d.anchor && !ids.has(d.anchor)) bad.push(`${cfg.page}: anchor #${d.anchor} not in ${j.manual}`);
      if (d.kind === 'record' && !d.id) bad.push(`${cfg.page}: a record without an id`);
    }
  }
  ok(!bad.length, 'N2 every citation resolves (registry id, manual anchor, page→manual link, drawer registry)', bad.slice(0, 5).join(' | ') || `${PAGES.reduce((a, c) => a + loadIdx(c.page).docs.length, 0)} documents`);
}
{ // N3
  const bad = [];
  for (const cfg of PAGES) {
    const src = fs.readFileSync(path.join(ROOT, cfg.page + '.html'), 'utf8');
    const slots = (src.match(/data-rz-ask-slot/g) || []).length;
    const tags = [...src.matchAll(/<script[^>]*src="js\/rz-ask\.js[^"]*"[^>]*>/g)];
    if (slots !== 1) bad.push(`${cfg.page}: ${slots} slots`);
    if (tags.length !== 1) { bad.push(`${cfg.page}: ${tags.length} rz-ask tags`); continue; }
    const want = `data/explain/${cfg.page}.json`;
    if (!tags[0][0].includes(`data-rz-ask-index="${want}"`)) bad.push(`${cfg.page}: index attribute is not ${want}`);
    if (!/\bdefer\b/.test(tags[0][0])) bad.push(`${cfg.page}: rz-ask.js not deferred`);
    if (src.indexOf('js/rz-basis-drawer.js') > tags[0].index) bad.push(`${cfg.page}: rz-ask.js before the drawer`);
  }
  ok(!bad.length, 'N3 15 pages wired (one slot, one deferred tag after the drawer, own index)', bad.join(' | '));
}
let maxMs = 0;
function run(p, q) { const r = RZAsk.search(loadIdx(p), q); maxMs = Math.max(maxMs, r.ms); return r; }
{ // N4
  let n = 0; const missed = [];
  for (const [p, q, want] of HITS) {
    const r = run(p, q), got = r.hits.map(cite);
    if (got.some(g => want.split('|').includes(g))) n++; else missed.push(`${p} "${q}" → ${got.join(',') || 'miss'}`);
  }
  ok(n >= 18, `N4 fixture hits in the top 3: ${n}/20 (target >= 18)`, missed.join(' | '));
  const a = run('datahallAI', 'why is PUE 1.165');
  ok(a.hits.length && cite(a.hits[0]) === 'pue.design_day', 'N4 acceptance: "why is PUE 1.165" on datahallAI → pue.design_day first', a.hits.map(cite).join(', '));
}
{ // N5
  const wrong = MISSES.map(([p, q]) => [p, q, run(p, q)]).filter(([, , r]) => !r.miss).map(([p, q, r]) => `${p} "${q}" → ${r.hits.map(cite).join(',')}`);
  ok(!wrong.length, `N5 honest miss on off-topic questions: ${MISSES.length - wrong.length}/${MISSES.length}`, wrong.join(' | '));
}
{ // N6
  let n = 0; const missed = [];
  for (const [p, q, want] of HELD_OUT) {
    const r = run(p, q), got = r.hits.map(cite);
    if (want === 'MISS' ? r.miss : got.some(g => want.split('|').includes(g))) n++; else missed.push(`${p} "${q}" → ${got.join(',') || 'miss'}`);
  }
  ok(n >= 10, `N6 held-out questions (never tuned against): ${n}/12 (floor 10)`, missed.join(' | '));
}
{ // N7
  for (let i = 0; i < 5; i++) for (const [p, q] of [...HITS, ...MISSES]) run(p, q);
  ok(maxMs < 50, `N7 slowest answer ${maxMs.toFixed(2)} ms (< 50 ms)`);
}
{ // N8
  const bad = [];
  for (const [p, q] of [...HITS, ...HELD_OUT]) for (const h of run(p, q).hits) {
    if (h.doc.kind !== 'record') continue;
    const rec = h.doc.rec, note = 'NOTE', c = RZAsk.compose(rec, { evidenceNote: note, format: (v, u) => String(v) + (u ? ' ' + u : '') });
    const allowed = [];
    if (rec.calc) allowed.push(`${rec.label} = ${rec.display != null ? rec.display : String(rec.value) + (rec.unit ? ' ' + rec.unit : '')} at the default inputs.`);
    else if (rec.value != null) allowed.push(`${rec.label} = ${String(rec.value)}${rec.unit ? ' ' + rec.unit : ''}.`);
    if (rec.evidenceClass) allowed.push(`It is ${rec.evidenceClass}: ${note}.`);
    if (rec.formula) allowed.push(`Formula: ${rec.formula}${/[.)]$/.test(rec.formula) ? '' : '.'}`);
    if (rec.source && rec.source.ref) allowed.push(`Source: ${rec.source.ref}${rec.source.section ? ', ' + rec.source.section : ''}.`);
    for (const s of c.sentences) if (!allowed.includes(s)) bad.push(`${h.doc.id}: "${s.slice(0, 80)}"`);
    if (c.title !== (rec.label || rec.id)) bad.push(`${h.doc.id}: title`);
  }
  const hidden = RZAsk.compose({ id: 'x', label: 'CAPEX per kW', value: 12345, unit: '$/kW', evidenceClass: 'DERIVED' }, { hidden: 'signin' });
  if (hidden.sentences.join(' ').includes('12345') || hidden.sentences.join(' ').includes('12,345')) bad.push('a hidden value leaked into the sentence');
  ok(!bad.length, 'N8 every sentence is a template over record fields; a hidden value never prints', bad.slice(0, 4).join(' | '));
}

if (!NODE_ONLY && !fails) {
  console.log('── B: in the browser ──');
  const { default: puppeteer } = await import('puppeteer');
  const { serve } = await import('./build-calc-parameter-registry.mjs');
  const { primeCockpitAuditDocument, enterAuthorizedAuditState } = await import('./lib/cockpit-audit-state.mjs');
  const { server, base } = await serve();
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const AXE = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function open(page, { width = 1366, height = 900, theme = 'dark', route, cockpit } = {}) {
    const ctx = await browser.createBrowserContext();
    const tab = await ctx.newPage();
    await tab.setCacheEnabled(false);
    await tab.setBypassServiceWorker(true);   /* sw.js would fetch the index outside the page's request routing */
    await tab.setViewport({ width, height });
    await primeCockpitAuditDocument(tab, theme);
    const errors = [];
    tab.on('pageerror', e => errors.push(String(e.message || e)));
    await tab.setRequestInterception(true);
    tab.on('request', async r => {
      const u = r.url();
      if (!u.startsWith(base)) return r.abort();
      if (route) { const done = await route(r); if (done) return; }
      r.continue();
    });
    await tab.goto(base + page + '.html', { waitUntil: 'load', timeout: 60000 });
    await tab.bringToFront();
    await wait(1800);
    if (cockpit) await enterAuthorizedAuditState(tab, cockpit);
    return { tab, ctx, errors };
  }
  async function ask(tab, q) {
    await tab.evaluate(() => { const t = document.querySelector('.rz-ask-trigger'); if (document.getElementById('rz-ask-panel').hidden) t.click(); });
    await tab.waitForFunction(() => { const b = document.querySelector('#rz-ask-panel button[type=submit]'); return b && !b.disabled; }, { timeout: 15000 });
    await tab.evaluate(q => { const i = document.getElementById('rz-ask-q'); i.value = q; i.form.requestSubmit(); }, q);
    await wait(150);
    return tab.evaluate(() => ({
      cites: [...document.querySelectorAll('#rz-ask-panel .rz-ask-card')].map(c => c.getAttribute('data-rz-ask-cite')),
      text: document.getElementById('rz-ask-panel').innerText, status: document.querySelector('#rz-ask-panel .rz-ask-status').textContent
    }));
  }
  try {
    { // B1 + B7 + B8 on datahallAI
      const { tab, ctx, errors } = await open('datahallAI', { cockpit: 'dc-ai' });
      const r = await ask(tab, 'why is PUE 1.165');
      ok(r.cites[0] === 'pue.design_day' && /1\.165/.test(r.text), 'B1 datahallAI: first card cites pue.design_day and prints its value', r.cites.join(', '));
      await tab.click('.rz-ask-card [data-rz-ask-open="pue.design_day"]');
      await wait(250);
      const dr = await tab.evaluate(() => { const h = document.getElementById('rz-basis-drawer'); return { open: h && h.getAttribute('aria-hidden') === 'false', text: h ? h.innerText.slice(0, 400) : '' }; });
      ok(dr.open && /pue\.design_day|design day/i.test(dr.text), 'B1 Open basis opens the drawer on that record', dr.text.slice(0, 60).replace(/\n/g, ' '));
      await tab.keyboard.press('Escape'); await wait(150);
      const s1 = await tab.evaluate(() => ({ drawer: document.getElementById('rz-basis-drawer').getAttribute('aria-hidden'), panel: !document.getElementById('rz-ask-panel').hidden }));
      await tab.keyboard.press('Escape'); await wait(150);
      const s2 = await tab.evaluate(() => ({ panel: !document.getElementById('rz-ask-panel').hidden, focus: document.activeElement && document.activeElement.className }));
      ok(s1.drawer === 'true' && s1.panel && !s2.panel && /rz-ask-trigger/.test(s2.focus), 'B1 Escape closes the drawer first, then the panel, focus back on Ask', JSON.stringify({ s1, s2 }));
      const m = await ask(tab, 'what is the weather');
      ok(!m.cites.length && /Not covered by this tool's records/.test(m.status), 'B2 honest miss: no card, the miss text and a manual link', m.status);
      /* the page renders record fields, so poison one in the live registry and ask for it */
      await tab.evaluate(() => { const r = window.RZBasisDrawer.get('pue.design_day'); r.label = '<img src=x onerror="window.__rzAskX=1">design day'; });
      const x = await ask(tab, 'why is PUE 1.165');
      await wait(200);
      const xs = await tab.evaluate(() => ({ img: !!document.querySelector('#rz-ask-panel img'), fired: window.__rzAskX === 1, shown: (document.querySelector('.rz-ask-card h3') || {}).textContent || '' }));
      ok(x.cites[0] === 'pue.design_day' && !xs.img && !xs.fired && xs.shown.startsWith('<img'), 'B8 markup in a record field renders as text (no element, no script)', JSON.stringify(xs));
      await ask(tab, 'how many GPUs');
      await tab.addScriptTag({ content: AXE });
      const ax = await tab.evaluate(async () => { const r = await window.axe.run(document.getElementById('rz-ask-panel'), { runOnly: ['wcag2a', 'wcag2aa'] }); return r.violations.filter(v => /serious|critical/.test(v.impact)).map(v => v.id + ':' + v.nodes.length); });
      ok(!ax.length, 'B7 axe on the open panel with answers: 0 serious/critical', ax.join(', '));
      ok(!errors.length, 'B datahallAI: no page errors', errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
    { // B3 + B4: loading state and failed load with Retry
      let mode = 'fail';
      const route = async r => {
        if (!r.url().includes('/data/explain/')) return false;
        if (mode === 'fail') { r.abort(); return true; }
        if (mode === 'slow') { await wait(1200); return false; }
        return false;
      };
      const { tab, ctx } = await open('pue-calculator', { route });
      await tab.click('.rz-ask-trigger');
      await wait(400);
      const f = await tab.evaluate(() => ({ status: document.querySelector('#rz-ask-panel .rz-ask-status').textContent, retry: !!document.querySelector('[data-rz-ask-retry]'), disabled: document.querySelector('#rz-ask-panel button[type=submit]').disabled }));
      ok(/unavailable/.test(f.status) && f.retry && f.disabled, 'B3 failed load: unavailable message, Retry, Ask disabled', f.status);
      mode = 'slow';
      await tab.click('[data-rz-ask-retry]');
      await wait(300);
      const l = await tab.evaluate(() => { const b = document.querySelector('#rz-ask-panel button[type=submit]'); return { text: b.textContent, disabled: b.disabled, title: b.title }; });
      ok(l.disabled && l.text === 'Loading…' && /Loading/.test(l.title), 'B4 while loading: Ask reads "Loading…", disabled, with the reason', JSON.stringify(l));
      await wait(1400);
      const r = await ask(tab, 'what is DCiE');
      ok(r.cites[0] === 'calc.pue.dcie', 'B3 Retry recovers: answers work after the index loads', r.cites.join(', '));
      await ctx.close();
    }
    { // B5: a value hidden for signed-out visitors stays hidden in the answer
      const { tab, ctx } = await open('capex-calculator');
      const gated = await tab.evaluate(() => [...document.querySelectorAll('[data-rz-basis-gated]')].map(e => e.getAttribute('data-rz-basis-gated')));
      const r = await ask(tab, 'cost per kW');
      const card = await tab.evaluate(() => { const c = document.querySelector('.rz-ask-card[data-rz-ask-cite="calc.capex.per_kw"]'); return c ? c.innerText : ''; });
      const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/calc-parameters.json'), 'utf8')).parameters.find(p => p.id === 'calc.capex.per_kw');
      ok(gated.includes('calc.capex.per_kw') && /shown after you sign in/.test(card) && !card.includes(String(rec.display)),
        'B5 capex signed-out: per-kW is gated on the page and the answer withholds its value', `gated ${gated.length}; "${card.split('\n')[2] || ''}"`);
      await ctx.close();
    }
    { // B6: 390 px — panel inside the viewport, cards stacked, no page scroll
      const { tab, ctx } = await open('roi-calculator', { width: 390, height: 844, theme: 'light' });
      await ask(tab, 'payback period');
      await ask(tab, 'irr npv payback');
      const g = await tab.evaluate(() => {
        const p = document.getElementById('rz-ask-panel').getBoundingClientRect();
        const cards = [...document.querySelectorAll('.rz-ask-card')].map(c => c.getBoundingClientRect());
        return { left: p.left, right: p.right, n: cards.length, stacked: cards.every((c, i) => !i || c.top >= cards[i - 1].bottom - 1), sx: document.documentElement.scrollWidth };
      });
      ok(g.left >= 15 && g.right <= 375 && g.n >= 2 && g.stacked && g.sx <= 390, 'B6 390 px: panel within 16 px gutters, cards stacked, no horizontal scroll', JSON.stringify(g));
      await tab.screenshot({ path: path.join(process.env.RZ_ASK_SHOTS || '/tmp', 'ask-roi-390.png') });
      await ctx.close();
    }
    { // B9: trigger on every page, visible at 1366 and 390
      const bad = [];
      for (const cfg of PAGES) for (const width of [1366, 390]) {
        const cockpit = cfg.page === 'datahallAI' ? 'dc-ai' : null;
        const { tab, ctx, errors } = await open(cfg.page, { width, height: width > 500 ? 900 : 844, cockpit });
        /* a header that is a horizontal scroller on a phone holds the trigger like its other controls: in reach after a scroll */
        const t = await tab.evaluate(() => { const b = document.querySelector('[data-rz-ask-slot] .rz-ask-trigger'); if (!b) return null; b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, right: r.right }; });
        if (!t || !t.w || !t.h) bad.push(`${cfg.page}@${width}: no visible trigger`);
        else if (t.right > width + 1) bad.push(`${cfg.page}@${width}: trigger past the edge (${Math.round(t.right)})`);
        const ownErr = errors.filter(e => /rz-ask|RZAsk/.test(e));
        if (ownErr.length) bad.push(`${cfg.page}@${width}: ${ownErr[0]}`);
        await ctx.close();
      }
      ok(!bad.length, 'B9 the Ask trigger is visible on all 15 pages at 1366 and 390 px', bad.join(' | '));
    }
  } finally { await browser.close(); server.close(); }
}
console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
