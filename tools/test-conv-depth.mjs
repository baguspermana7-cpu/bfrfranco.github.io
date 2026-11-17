#!/usr/bin/env node
/* test-conv-depth.mjs — RATCHET (pages listed in tools/conv-depth-thresholds.json are STRICT; the rest MONITOR). Per conv cockpit, in the authorised audit state at 1440,
   measure what the operator actually gets:
   T  traceability — visible numerals: hooked to a registry id (data-basis-param), declared only
      (data-rz-authored-basis), or bare; plus whether a visible evidence mark sits beside hooked ones
   H  help — visible numerals / labels with a tooltip (data-explain, title, aria-describedby, <title>)
   M  modal — every tagged SVG equipment item: click it, did a modal / inspector / drawer open?
   I  inspector depth — when the right-side inspector opens: rows on LIVE, and how many of its six tabs
      (Live/Capacity/Deps/Alarms/Trend/Maint) carry more than one row; traceable cells inside it.
   Baseline 2026-11-16 and the flip condition: standarization/Audit result/CONV_TOTAL_AUDIT_2026-11-16.md §7.
   Proven sound: CH-01..04 open the loop modal and are counted (4/29 on chiller); a click on the
   text layer instead of the symbol body counted 0 — the probe clicks the .hmi-node body. */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const only = (process.argv.find((a) => a.startsWith('--page=')) || '').split('=')[1];
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').split('=')[1];
const PAGES = ['dc-conventional.html', 'datahall.html', 'chiller-plant.html', 'water-system.html', 'fire-system.html',
  'fuel-system.html', 'ict.html', 'EPMS_Telemetry.html', 'cdu-mini-bms.html'].filter((p) => !only || p === only);
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const report = {};

const OPEN_SEL = '.show:not([class*="tip"]):not(.rz-toast), [role="dialog"]:not([hidden]):not([aria-hidden="true"]), dialog[open], .rz-inspector.open, aside.rz-inspector.open, .show[class*="modal"], .open[class*="modal"], .is-open, .rz-basis-drawer.open, [class*="drawer"].open, [class*="modal"].active, .modal.visible, [aria-modal="true"]';

for (const page of PAGES) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 1000 });
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + page, { waitUntil: 'networkidle0', timeout: 90000 });
  try { await enterAuthorizedAuditState(pg, page === 'EPMS_Telemetry.html' ? 'epms-telemetry' : page.replace('.html', '')); } catch (e) { errs.push('auditState: ' + e.message.slice(0, 120)); }
  await new Promise((r) => setTimeout(r, 2500));

  const T = await pg.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
    const out = { numerals: 0, hooked: 0, hookedMarked: 0, declared: 0, bare: 0, tipNum: 0, labels: 0, tipLabel: 0, bareSamples: [], untipSamples: [], explain: document.querySelectorAll('[data-explain]').length };
    const hasTip = (el) => { for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) { if (e.hasAttribute && (e.hasAttribute('data-explain') || e.hasAttribute('title') || e.hasAttribute('aria-describedby') || e.hasAttribute('data-tip') || e.hasAttribute('data-tooltip'))) return true; if (e.querySelector && e.querySelector(':scope > title')) return true; } return false; };
    const markNear = (host) => !!(host.querySelector('.rz-basis-mark, .rz-evidence-dot, [class*="basis-mark"], [class*="evidence"]') || getComputedStyle(host, '::after').content.length > 2 || getComputedStyle(host, '::before').content.length > 2 || (host.nextElementSibling && /basis|evidence/.test(host.nextElementSibling.className && host.nextElementSibling.className.baseVal !== undefined ? host.nextElementSibling.className.baseVal : host.nextElementSibling.className)));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue.trim(); if (!t) continue;
      const el = n.parentElement; if (!el || seen.has(el)) continue;
      if (el.closest('script,style,noscript,nav,footer,header .brand,[aria-hidden="true"],.rz-command-palette,#rz-cookie')) continue;
      if (!vis(el)) continue;
      seen.add(el);
      if (/\d/.test(t) && /\d[\d.,]*\s*(%|°|kW|MW|kVA|L|m|A|V|bar|kPa|Pa|h|s|K|C|Gb|ms|RT|ppm|µS|NTU|Hz|\b)/.test(t) && !/^\d{1,2}:\d{2}/.test(t) && t.length < 40) {
        out.numerals++;
        const hook = el.closest('[data-basis-param]');
        const decl = el.closest('[data-rz-authored-basis],[data-rz-distribution]');
        if (hook) { out.hooked++; if (markNear(hook)) out.hookedMarked++; }
        else if (decl) out.declared++;
        else { out.bare++; if (out.bareSamples.length < 12) out.bareSamples.push(t.slice(0, 30) + ' <' + (el.id || (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName) + '>'); }
        if (hasTip(el)) out.tipNum++;
      } else if (!/\d/.test(t) && t.length >= 3 && t.length <= 32 && (/^[A-Z0-9 ·\-\/&()%°.]+$/.test(t) || el.matches('[class*="lbl"],[class*="label"],dt,th'))) {
        out.labels++; if (hasTip(el)) out.tipLabel++; else if (out.untipSamples.length < 12) out.untipSamples.push(t);
      }
    }
    return out;
  });

  /* M: tagged SVG equipment */
  const cands = await pg.evaluate(() => {
    const tagRe = /^[A-Z]{1,6}[- ]?[A-Z]?\d{1,3}[A-Z]?$|^[A-Z]{2,6}-[A-Z0-9]{1,6}(-[A-Z0-9]{1,4})?$/;
    const res = []; let i = 0;
    for (const t of document.querySelectorAll('svg text')) {
      const s = (t.textContent || '').trim(); if (!tagRe.test(s)) continue;
      const r = t.getBoundingClientRect(); if (r.width < 1) continue;
      const of = t.getAttribute('data-tag-of');
      const g = (of && t.closest('svg').querySelector('.hmi-node[data-node="' + of + '"]')) || t.closest('[data-rz-equipment],.hmi-node,[data-node],[data-eq],[data-id],g[onclick],g[role="button"]') || t.parentElement;
      const cur = getComputedStyle(g).cursor;
      g.setAttribute('data-probe-eq', String(i));
      res.push({ i: i++, tag: s, pointer: cur === 'pointer', svg: (t.closest('svg').id || t.closest('svg').getAttribute('class') || '').toString().slice(0, 30) });
    }
    return res;
  });
  const M = { tagged: cands.length, pointer: cands.filter((c) => c.pointer).length, opened: 0, dead: [], perSvg: {} };
  const byTag = new Map(); for (const c of cands) if (!byTag.has(c.tag)) byTag.set(c.tag, c);
  const uniq = [...byTag.values()].slice(0, 80);
  M.unique = byTag.size; M.clicked = uniq.length;
  for (const c of uniq) {
    const before = await pg.evaluate((s) => document.querySelectorAll(s).length, OPEN_SEL);
    const pt = await pg.evaluate((i) => { const g = document.querySelector('[data-probe-eq="' + i + '"]'); if (!g) return null; g.scrollIntoView({ block: 'center' }); const b = g.querySelector('.b, rect, circle, path, polygon') || g; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, c.i);
    const ok = !!pt; if (pt) await pg.mouse.click(pt.x, pt.y);
    await new Promise((r) => setTimeout(r, 350));
    const after = await pg.evaluate((s) => document.querySelectorAll(s).length, OPEN_SEL);
    const opened = ok && after > before;
    const insp = await pg.evaluate(async () => { const a = document.querySelector('aside.rz-inspector.open, .rz-inspector.open'); if (!a) return null;
      const res = { tabs: 0, live: 0, basis: 0 };
      for (const t of a.querySelectorAll('[role=tab]')) { t.click(); await new Promise((r) => setTimeout(r, 50));
        const body = a.querySelector('[role=tabpanel]:not([hidden])') || a;
        /* content = value rows, dependency cards or alarm cards (a DEPS tab has no rows, only cards) */
        const n = body.querySelectorAll('tr, li, [class*="row"], .rz-inspector-dep, .rz-inspector-alarm').length;
        res.basis += body.querySelectorAll('[data-basis-param]').length;
        if (/live/i.test(t.textContent)) res.live = n; if (n >= 1) res.tabs++; }
      return res; });
    if (insp) { M.insp = M.insp || { n: 0, liveLe2: 0, tabsSum: 0, basis: 0 }; M.insp.n++; if (insp.live <= 2) M.insp.liveLe2++; M.insp.tabsSum += insp.tabs; M.insp.basis += insp.basis; }
    const ps = (M.perSvg[c.svg] = M.perSvg[c.svg] || { n: 0, open: 0 }); ps.n++;
    if (opened) { M.opened++; ps.open++; } else if (M.dead.length < 25) M.dead.push(c.tag);
    await pg.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 120));
    await pg.evaluate((s) => { document.querySelectorAll(s).forEach((d) => { const x = d.querySelector('[aria-label*="lose" i],.close,[class*="close"]'); if (x) x.click(); }); }, OPEN_SEL);
    await new Promise((r) => setTimeout(r, 120));
  }
  report[page] = { T, M, errors: errs.slice(0, 3) };
  const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
  console.log(`\n== ${page}${errs.length ? '  [errors ' + errs.length + ': ' + errs[0].slice(0, 80) + ']' : ''}`);
  console.log(`T numerals ${T.numerals}: hooked ${T.hooked} (${pct(T.hooked, T.numerals)}, with visible mark ${T.hookedMarked}) · declared-only ${T.declared} · bare ${T.bare}`);
  console.log(`H tooltip on numerals ${pct(T.tipNum, T.numerals)} · on labels ${T.tipLabel}/${T.labels} (${pct(T.tipLabel, T.labels)}) · data-explain ${T.explain}`);
  console.log(`M tagged SVG equipment ${M.tagged} (unique ${M.unique}, pointer ${M.pointer}); clicked ${M.clicked} → opened ${M.opened} (${pct(M.opened, M.clicked)}) ${JSON.stringify(M.perSvg)}`);
  if (M.insp) console.log(`I inspector opened ${M.insp.n}: LIVE <= 2 rows on ${M.insp.liveLe2}; avg tabs with content ${(M.insp.tabsSum / M.insp.n).toFixed(1)}/6; traceable cells ${M.insp.basis}`);
  console.log(`  bare e.g. ${T.bareSamples.slice(0, 6).join(' | ')}`);
  console.log(`  no-tooltip labels e.g. ${T.untipSamples.slice(0, 8).join(' | ')}`);
  console.log(`  dead clicks e.g. ${M.dead.slice(0, 12).join(' ')}`);
  await pg.close();
}
await browser.close(); srv.close();
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
/* GD ratchet: a page with an entry in tools/conv-depth-thresholds.json fails below it; a page without one stays MONITOR.
   Entries only ever rise (the D-2..D-5 work raises them as pages land). */
const TH = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/conv-depth-thresholds.json'), 'utf8')).pages || {};
const fails = [];
for (const [page, r] of Object.entries(report)) {
  const th = TH[page]; if (!th) continue;
  const M = r.M, T = r.T, I = M.insp || { n: 0, liveLe2: 0, tabsSum: 0, basis: 0 };
  const chk = (ok, what) => { if (!ok) fails.push(page + ': ' + what); };
  if (th.openedPct != null) chk(M.clicked && 100 * M.opened / M.clicked >= th.openedPct, `opened ${M.opened}/${M.clicked} < ${th.openedPct} %`);
  if (th.liveLe2Max != null) chk(I.liveLe2 <= th.liveLe2Max, `LIVE <= 2 rows on ${I.liveLe2} > ${th.liveLe2Max}`);
  if (th.avgTabsMin != null) chk(I.n && I.tabsSum / I.n >= th.avgTabsMin, `avg tabs ${(I.tabsSum / Math.max(1, I.n)).toFixed(1)} < ${th.avgTabsMin}`);
  if (th.bareMax != null) chk(T.bare <= th.bareMax, `bare numerals ${T.bare} > ${th.bareMax}`);
  if (th.labelTipPct != null) chk(T.labels && 100 * T.tipLabel / T.labels >= th.labelTipPct, `label tooltips ${T.tipLabel}/${T.labels} < ${th.labelTipPct} %`);
  if (th.inspectorBasisMin != null) chk(I.basis >= th.inspectorBasisMin, `inspector basis cells ${I.basis} < ${th.inspectorBasisMin}`);
}
const strict = Object.keys(report).filter((p) => TH[p]);
if (fails.length) { console.log('\n' + fails.join('\n')); console.log(`\nCONV DEPTH — FAIL (${fails.length} below threshold; strict pages: ${strict.join(', ')})`); process.exit(1); }
console.log(`\nCONV DEPTH — PASS (strict: ${strict.join(', ') || 'none'}; MONITOR: ${Object.keys(report).filter((p) => !TH[p]).join(', ') || 'none'})`);
