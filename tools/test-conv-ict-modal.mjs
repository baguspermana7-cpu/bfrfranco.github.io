#!/usr/bin/env node
/* test-conv-ict-modal.mjs — STRICT. ict.html: every block of the network architecture opens a deep modal
   (PRD-CONV-LIVING-PLANT §8.3, owner comment C4). Real browser, 1440 (every block of every segment) and 390.
   I1 every block of all six segments opens the modal on double-click: title = the block's label, state = its state
      text, >= 3 tabs, no "undefined" / "NaN", and the modal holds no copy of the architecture drawing
   I2 connection rows = the block's drawn connections (uplink + peer + downlink) in the page's own model
   I3 a metered link's capacity and traffic in the modal equal the page's link register
   I4 the three zone firewalls show Zones and a Policy table whose last rule is any -> any deny
   I5 a facility gateway names its protocol and links to its cockpit page
   I6 keyboard: Enter on a block opens the inspector, its "Open device detail" button opens the modal, arrow keys
      move between tabs, Escape closes and focus returns to the button
   I7 a simulated scenario reaches the modal: Core A fail -> SW-CORE-A reads FAULT
   I8 390 px: the dialog fits the viewport width, the page does not scroll sideways; no page error
   Usage: node tools/test-conv-ict-modal.mjs [--shots=<dir>] */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEGS = ['it', 'bms', 'sec', 'mgmt', 'wan', 'mon'];

async function open(W) {
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'ict.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(3000);
  try { await enterAuthorizedAuditState(pg, 'ict'); } catch (e) { /* ict may not be a gated identity */ }
  await sleep(1200);
  return { pg, errs };
}
const goSeg = (pg, key) => pg.evaluate((k) => { const b = document.getElementById('nav-' + k); if (b) b.click(); return !!b; }, key);

{
  const { pg, errs } = await open(1440);
  let blocks = 0;
  for (const key of SEGS) {
    ok(await goSeg(pg, key), `I1 segment ${key}: no navigation control found`);
    await sleep(350);
    const res = await pg.evaluate((key) => {
      const out = [];
      const nodes = [...document.querySelectorAll('#canvas svg.ict-arch .node')];
      nodes.forEach((g) => {
        const id = g.getAttribute('data-node'), inp = window.__ictNodeModalInput(key, id);
        g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        const m = document.querySelector('.rz-nm'); if (!m) { out.push({ id, none: true }); return; }
        const tabs = [...m.querySelectorAll('.rz-nm-tab')].map((t) => t.getAttribute('data-tab'));
        const paneRows = (t) => m.querySelectorAll('[data-pane="' + t + '"] .rz-nm-tbl tbody tr').length;
        const connTab = ['interfaces', 'ports', 'circuits', 'links'].find((t) => tabs.includes(t));
        const metered = []; if (connTab) m.querySelectorAll('[data-pane="' + connTab + '"] .rz-nm-tbl tbody tr').forEach((tr) => { const c = [...tr.cells].map((x) => x.textContent); if (c[2] !== '—') metered.push(c); });
        const wantMetered = inp.up.concat(inp.peer, inp.down).filter((a) => a.link).map((a) => [a.link.tag, a.link.capGbps + ' Gbps', a.link.state === 'up' ? a.link.trafficGbps.toFixed(2) + ' Gbps' : 'standby']);
        const policy = tabs.includes('policy') ? [...m.querySelectorAll('[data-pane="policy"] tbody tr')].map((tr) => [...tr.cells].map((x) => x.textContent)) : null;
        const link = m.querySelector('[data-pane="protocol"] a.rz-nm-link');
        out.push({ id, kind: m.querySelector('.rz-nm-panel').getAttribute('data-kind'), title: m.querySelector('.rz-nm-title').textContent, want: inp.node.label, st: m.querySelector('.rz-nm-st').textContent, wantSt: inp.node.stateText,
          tabs, bad: /undefined|NaN/.test(m.textContent), repeat: !!m.querySelector('svg.ict-arch, svg'), conn: connTab ? paneRows(connTab) : 0, degree: inp.up.length + inp.peer.length + inp.down.length,
          metered: metered.map((c) => [c[2], c[3], c[4]]), wantMetered, policy, zones: m.querySelectorAll('[data-pane="zones"] .rz-nm-zone').length,
          proto: (m.querySelector('[data-pane="protocol"] dd') || {}).textContent || null, href: link ? link.getAttribute('href') : null });
        window.RZNetModal.close();
      });
      return out;
    }, key);
    blocks += res.length;
    ok(res.length >= 5, `I1 ${key}: only ${res.length} blocks`);
    for (const r of res) {
      const T = `${key}/${r.id}`;
      if (r.none) { ok(false, `I1 ${T}: double-click opened no modal`); continue; }
      ok(r.title === r.want && r.st === r.wantSt, `I1 ${T}: title/state "${r.title}" "${r.st}" want "${r.want}" "${r.wantSt}"`);
      ok(r.tabs.length >= 3 && r.tabs[0] === 'overview' && !r.bad && !r.repeat, `I1 ${T}: tabs ${r.tabs} bad=${r.bad} repeat=${r.repeat}`);
      ok(r.degree === 0 || r.conn === r.degree, `I2 ${T}: ${r.conn} connection rows, the drawing has ${r.degree}`);
      ok(JSON.stringify(r.metered) === JSON.stringify(r.wantMetered), `I3 ${T}: metered ${JSON.stringify(r.metered)} ≠ register ${JSON.stringify(r.wantMetered)}`);
      if (r.kind === 'firewall') { const last = r.policy && r.policy[r.policy.length - 1]; ok(r.zones >= 2 && last && last[0] === 'any' && last[1] === 'any' && last[4] === 'deny', `I4 ${T}: zones ${r.zones}, last rule ${JSON.stringify(last)}`); }
      if (/-GW$/.test(r.id) && r.id !== 'BMS-GW-01') ok(!!r.proto && r.href && fs.existsSync(path.join(ROOT, r.href)), `I5 ${T}: protocol "${r.proto}", link ${r.href}`);
    }
  }
  ok(blocks >= 60, `I1 blocks exercised: ${blocks}`);
  /* I6 keyboard */
  await goSeg(pg, 'bms'); await sleep(350);
  await pg.evaluate(() => document.querySelector('#canvas svg.ict-arch .node[data-node="OTFW"]').focus()); await pg.keyboard.press('Enter'); await sleep(200);
  const btn = await pg.$('#node-detail-btn'); ok(!!btn, 'I6 the inspector shows no "Open device detail" button');
  if (btn) {
    await pg.focus('#node-detail-btn'); await pg.keyboard.press('Enter'); await sleep(250);
    const k1 = await pg.evaluate(() => ({ open: !!document.querySelector('.rz-nm'), focus: document.activeElement && document.activeElement.getAttribute('data-tab') }));
    ok(k1.open && k1.focus === 'overview', 'I6 button did not open the modal with focus on the first tab: ' + JSON.stringify(k1));
    await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await sleep(100);
    const k2 = await pg.evaluate(() => ({ sel: (document.querySelector('.rz-nm-tab[aria-selected="true"]') || {}).textContent, shown: [...document.querySelectorAll('.rz-nm-pane')].filter((p) => !p.hidden).map((p) => p.getAttribute('data-pane')).join() }));
    ok(k2.sel === 'Policy' && k2.shown === 'policy', 'I6 arrow keys: ' + JSON.stringify(k2));
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'ict-modal-1440.png') });
    await pg.keyboard.press('Escape'); await sleep(150);
    const k3 = await pg.evaluate(() => ({ open: !!document.querySelector('.rz-nm'), focus: document.activeElement && document.activeElement.id }));
    ok(!k3.open && k3.focus === 'node-detail-btn', 'I6 Escape: ' + JSON.stringify(k3));
  }
  /* I7 scenario */
  await goSeg(pg, 'it'); await sleep(350);
  const sc = await pg.evaluate(() => { const s = document.getElementById('arch-scenario'); s.value = 'core-a-fail'; s.dispatchEvent(new Event('change', { bubbles: true }));
    const g = document.querySelector('#canvas svg.ict-arch .node[data-node="SW-CORE-A"]'); g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const m = document.querySelector('.rz-nm'); const r = m ? { st: m.querySelector('.rz-nm-st').textContent, text: m.textContent.includes('Core A fail') } : null; if (m) window.RZNetModal.close(); return r; });
  ok(sc && sc.st === 'FAULT' && sc.text, 'I7 scenario not reflected: ' + JSON.stringify(sc));
  ok(errs.length === 0, 'I8 page errors @1440: ' + errs.slice(0, 2).join(' | '));
  await pg.close();
}
{
  const { pg, errs } = await open(390);
  await goSeg(pg, 'bms'); await sleep(400);
  const r = await pg.evaluate(() => { const g = document.querySelector('#canvas svg.ict-arch .node[data-node="OTFW"]'); if (!g) return null; g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const t = document.querySelector('.rz-nm-tab[data-tab="policy"]'); if (t) t.click();
    const p = document.querySelector('.rz-nm-panel'); if (!p) return null; const b = p.getBoundingClientRect();
    return { left: b.left, right: b.right, vw: innerWidth, over: document.documentElement.scrollWidth > innerWidth + 1, close: p.querySelector('.rz-nm-x').getBoundingClientRect().height }; });
  ok(r && r.left >= -0.5 && r.right <= r.vw + 0.5 && !r.over && r.close >= 44, 'I8 390 px dialog: ' + JSON.stringify(r));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'ict-modal-390.png') });
  ok(errs.length === 0, 'I8 page errors @390: ' + errs.slice(0, 2).join(' | '));
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.error(`FAIL — ${fails.length} of ${checks} checks`); fails.slice(0, 30).forEach((f) => console.error('  ✗ ' + f)); process.exit(1); }
console.log(`PASS — ${checks} checks: every network block opens its modal, connections = the drawing, metered links = the register, firewall policy, gateway links, keyboard, scenario, 390 px`);
