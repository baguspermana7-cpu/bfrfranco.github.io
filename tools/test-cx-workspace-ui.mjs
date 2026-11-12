#!/usr/bin/env node
// test-cx-workspace-ui.mjs — PRD-P06 stage 1 in a real browser, on cx-calculator.html?tab=analysis (Records panel).
// W1 Demo is the default and read-only: chip "read-only", write tools hidden, "Start your own set" offered (FR-P06-7).
// W2 a register CSV validated in Demo starts a NEW set (dialog: required name refused empty, focus inside, Escape-safe);
//    the set is local, rev 1, its crah row reads "0 of 1 untagged".
// W3 Gate decision L2 before L1 is refused inside the dialog with the R4 text; L1 then accepts (rev bumps) (PRD §21).
// W4 a blocking issue on CRAH-01 L3: issue row present, crah Blocked = 1; accepting L3 is refused with the R8 text.
// W5 Undo removes the last write (single level); Close issue from the row; Edit keeps markup as text.
// W6 reload keeps the set and the selection; export → import in a fresh browser gives a deep-equal set.
// W7 a corrupt store is quarantined with a notice; a write in tab A reloads tab B with "Updated in another tab".
// W8 390 px both themes: the panel and the dialog fit, controls >= 44 px, fields >= 16 px; no page errors.
// Run: node tools/test-cx-workspace-ui.mjs [--base=http://127.0.0.1:PORT]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d !== undefined ? ' ' + JSON.stringify(d).slice(0, 400) : '')); } };
const puppeteer = require('puppeteer');
let base = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7), server = null;
if (!base) {
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port; await new Promise((res) => setTimeout(res, 900));
}
{ const served = await fetch(base + '/js/rz-version.js').then((x) => x.text()).catch(() => '');
  if (served !== readFileSync(join(ROOT, 'js/rz-version.js'), 'utf8')) { console.error('FAIL — ' + base + ' does not serve this tree'); if (server) server.kill(); process.exit(1); } }
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 120000 });
const errors = [];
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const URL = base + '/cx-calculator.html?tab=analysis';
async function open(ctx, opts = {}) {
  const p = await ctx.newPage();
  await p.setViewport({ width: opts.width || 1440, height: 900 });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => d.dismiss());
  if (opts.theme) await p.evaluateOnNewDocument((th) => { try { localStorage.setItem('theme', th); } catch (e) {} }, opts.theme);
  if (opts.seed) await p.evaluateOnNewDocument((s) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('rz_cx_records_v1', s); sessionStorage.setItem('__seeded', '1'); } }, opts.seed);
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForFunction(() => { const t = document.querySelector('#cxRecTable tbody'); return t && t.querySelectorAll('tr').length >= 17; }, { timeout: 30000 }).catch(() => null);
  return p;
}
const state = (p) => p.evaluate(() => {
  const q = (s) => document.querySelector(s), row = (id, n) => { const r = q('#cxRecTable tr[data-cx-rec="' + id + '"]'); return r ? r.querySelectorAll('td')[n].textContent : null; };
  return { chip: q('#cxRecChip').textContent, tools: !q('#cxRecTools').hidden, start: !q('#cxRecStart').hidden, issuesVisible: !q('#cxRecIssueWrap').hidden,
    status: q('#cxRecStatus').textContent, crahDen: row('crah', 2), crahBlocked: row('crah', 3), issues: [...document.querySelectorAll('#cxRecIssues tbody tr[id]')].map((r) => ({ id: r.id, text: r.textContent, state: r.dataset.state })),
    dlgOpen: !!(q('#cxRecDlg') && q('#cxRecDlg').open), dlgErr: (q('#cxRecDlgErr') || {}).textContent || '', mode: window.RZCxRecordsUi && window.RZCxRecordsUi.mode(), applyLabel: q('#cxRecApply').textContent };
});
const click = (p, sel) => p.$eval(sel, (b) => b.click());
/* fill the open dialog: {label: value} by label text */
const fill = (p, vals) => p.evaluate((v) => {
  const form = document.querySelector('#cxRecDlg form');
  for (const lab of form.querySelectorAll('label')) { const key = lab.textContent.replace(' *', '').trim(); if (!(key in v)) continue; const inp = document.getElementById(lab.htmlFor); if (inp.type === 'checkbox') inp.checked = !!v[key]; else { inp.value = v[key]; inp.dispatchEvent(new Event('change')); } }
}, vals);
const submit = async (p) => { await p.$eval('#cxRecDlgOk', (b) => b.click()); await wait(150); };

try {
  const ctx = await browser.createBrowserContext();
  let p = await open(ctx);
  let s = await state(p);
  ok('W1 Demo default: read-only chip, write tools + issue table hidden, Start offered', s.mode === 'demo' && s.chip === 'read-only' && !s.tools && !s.issuesVisible && s.start, s);
  ok('W1 Demo overlay unchanged: crah "3 of 10 L3", 1 blocked', s.crahDen === '3 of 10 L3' && s.crahBlocked === '1', s);

  await p.evaluate(() => { document.getElementById('cxRecCsv').value = 'tag,class,system_id,location_id,rating\nCRAH-01,crah,crah,HALL-1,200 kW\nPUMP-9,pump,nope,PLANT-1,30 kW'; });
  await click(p, '#cxRecImport'); await wait(100);
  s = await state(p);
  ok('W2 in Demo the apply button starts a set', s.applyLabel === 'Start a set with these rows', s.applyLabel);
  await click(p, '#cxRecApply'); await wait(200);
  const focusIn = await p.evaluate(() => document.getElementById('cxRecDlg').contains(document.activeElement));
  s = await state(p);
  ok('W2 new-set dialog open with focus inside', s.dlgOpen && focusIn, { s, focusIn });
  await submit(p); s = await state(p);
  ok('W2 empty name refused inline, dialog stays open', s.dlgOpen && /Name is required/.test(s.dlgErr), s.dlgErr);
  await fill(p, { Name: 'Hall 1 handover' }); await submit(p); s = await state(p);
  ok('W2 set created: local · rev 1, tools shown, crah "1 of 1 untagged"', !s.dlgOpen && s.chip === 'local · rev 1' && s.tools && s.issuesVisible && s.crahDen === '1 of 1 untagged' && s.mode !== 'demo', s);

  await click(p, '#cxRecGate'); await wait(150);
  await fill(p, { Level: 'L2', Signer: 'cxa.rahman' }); await submit(p); s = await state(p);
  ok('W3 L2 before L1 refused in the dialog with the R4 law text (PRD §21)', s.dlgOpen && /^R4: L2 accepted on A-CRAH-01 without L1 — L\(n\) accepted implies L\(n−1\) accepted/.test(s.dlgErr), s.dlgErr);
  await fill(p, { Level: 'L1' }); await submit(p); s = await state(p);
  ok('W3 L1 accept commits: rev 2, crah "1 of 1 L1"', !s.dlgOpen && s.chip === 'local · rev 2' && s.crahDen === '1 of 1 L1', s);

  await click(p, '#cxRecNewIssue'); await wait(150);
  await fill(p, { Title: 'Condensate pan <b>tilted</b>', 'Blocks gate': true, Owner: 'vendor' }); await p.evaluate(() => { document.getElementById('cxRecFLevel').value = 'L3'; });
  await submit(p); s = await state(p);
  ok('W4 blocking issue saved: one row, text kept literal, crah Blocked = 1 (PRD §21)', !s.dlgOpen && s.issues.length === 1 && s.issues[0].text.includes('Condensate pan <b>tilted</b>') && s.crahBlocked === '1', s);
  await click(p, '#cxRecGate'); await wait(150);
  await fill(p, { Level: 'L2', Signer: 'cxa' }); await submit(p);
  await p.focus('#cxRecGate'); await click(p, '#cxRecGate'); await wait(150);
  await fill(p, { Level: 'L3', Signer: 'cxa' }); await submit(p); s = await state(p);
  ok('W4 accepting the blocked L3 is refused with the R8 text', s.dlgOpen && /^R8: open blocking issue/.test(s.dlgErr), s.dlgErr);
  await p.keyboard.press('Escape'); await wait(150);
  const back = await p.evaluate(() => document.activeElement && document.activeElement.id);
  ok('W4 Escape closes the dialog and returns focus to its opener', !(await state(p)).dlgOpen && back === 'cxRecGate', back);

  const revBefore = (await state(p)).chip;
  await click(p, '#cxRecIssues button[data-act="close"]'); await wait(150); s = await state(p);
  ok('W5 Close issue from the row clears the block', s.issues[0].state === 'closed' && s.crahBlocked === '0', s);
  await click(p, '#cxRecUndo'); await wait(150); s = await state(p);
  ok('W5 Undo restores the previous revision (issue open, blocked again)', s.chip === revBefore && s.issues[0].state === 'open' && s.crahBlocked === '1', { s, revBefore });
  ok('W5 Undo is single-level (disabled after use)', await p.$eval('#cxRecUndo', (b) => b.disabled));

  await p.reload({ waitUntil: 'networkidle2' });
  await p.waitForFunction(() => { const t = document.querySelector('#cxRecTable tbody'); return t && t.querySelectorAll('tr').length >= 17; }, { timeout: 30000 });
  s = await state(p);
  ok('W6 reload keeps the set and selection', s.mode !== 'demo' && s.chip === revBefore && s.issues.length === 1, s);
  const exported = await p.evaluate(() => window.RZCxWorkspace.exportSet(window.RZCxRecordsUi.workspace().sets[window.RZCxRecordsUi.mode()]));
  const dbA = await p.evaluate(() => JSON.stringify(window.RZCxRecordsUi.db()));
  await click(p, '#cxRecExport');
  const ctx2 = await browser.createBrowserContext();
  const p2 = await open(ctx2);
  await p2.evaluate((t) => window.RZCxRecordsUi.importText(t), exported); await wait(200);
  const dbB = await p2.evaluate(() => JSON.stringify(window.RZCxRecordsUi.db()));
  ok('W6 export → import in another browser: deep-equal record set', dbA === dbB && (await state(p2)).mode !== 'demo', { a: dbA.length, b: dbB.length });
  await ctx2.close();

  await click(p, '#cxRecDemo'); await wait(150); s = await state(p);
  ok('W6 Demo stays selectable and read-only beside My records', s.mode === 'demo' && s.chip === 'read-only' && s.crahDen === '3 of 10 L3', s);

  /* an untrusted file: markup in text, numbers where ids belong, a string where a list belongs */
  const hostile = JSON.stringify({ format: 'rz-cx-records', v: 1, name: '<img src=x onerror="window.__pwn=1">', project_id: { x: 1 }, rev: -5,
    db: { assets: [{ id: 'A-1', tag: '<b>T</b>', system_id: 'crah', revision: 1 }], issues: [{ id: 'I-1', title: '<img src=x onerror="window.__pwn=1">', state: 'open', blocking_gate_ids: [7], assets: 'A-1', revision: 1 }] } });
  await p.evaluate((t) => window.RZCxRecordsUi.importText(t), hostile); await wait(300);
  const hz = await p.evaluate(() => ({ pwn: window.__pwn || 0, imgs: document.querySelectorAll('#cxRecPanel img, #cxRecSet img').length, row: (document.querySelector('#cxRecIssues tbody tr[id]') || {}).textContent || '', chip: document.getElementById('cxRecChip').textContent }));
  ok('W6 an untrusted import renders its text as text (no element, no script) and odd types do not break the table', hz.pwn === 0 && hz.imgs === 0 && hz.row.includes('<img src=x') && /rev 1|invalid/.test(hz.chip), hz);
  await click(p, '#cxRecDemo'); await wait(100);

  /* two tabs */
  const pa = await ctx.newPage(); pa.on('pageerror', (e) => errors.push(e.message));
  await pa.goto(URL, { waitUntil: 'networkidle2' }); await pa.waitForFunction(() => window.RZCxRecordsUi, { timeout: 30000 });
  await pa.evaluate(() => { const sel = document.getElementById('cxRecSet'); sel.value = sel.options[1].value; sel.dispatchEvent(new Event('change')); });
  await wait(100); await click(pa, '#cxRecNewIssue'); await wait(150); await fill(pa, { Title: 'From tab A' }); await submit(pa);
  await wait(400);
  s = await state(p);
  ok('W7 a write in another tab reloads this one with a notice', s.status === 'Updated in another tab', s.status);
  await pa.close();
  await ctx.close();

  const ctx3 = await browser.createBrowserContext();
  const pc = await open(ctx3, { seed: '{broken' });
  s = await state(pc);
  const q = await pc.evaluate(() => localStorage.getItem('rz_cx_records_v1_quarantine'));
  ok('W7 a corrupt store is quarantined with a notice, Demo shown', /set aside/.test(s.status) && q === '{broken' && s.mode === 'demo', { s, q });
  await ctx3.close();

  for (const theme of ['dark', 'light']) {
    const c = await browser.createBrowserContext();
    const pp = await open(c, { width: 390, theme });
    await pp.evaluate(() => { document.getElementById('cxRecCsv').value = 'tag,class,system_id,location_id,rating\nCRAH-01,crah,crah,HALL-1,200 kW'; });
    await click(pp, '#cxRecImport'); await click(pp, '#cxRecApply'); await wait(150);
    await fill(pp, { Name: 'Phone' }); await submit(pp);
    await click(pp, '#cxRecGate'); await wait(200);
    ok(`W8 ${theme} 390: the gate dialog is open for the measurement`, await pp.$eval('#cxRecDlg', (d) => d.open));
    const m = await pp.evaluate(() => {
      const d = document.getElementById('cxRecDlg').getBoundingClientRect(), panel = document.getElementById('cxRecPanel');
      const small = [...document.querySelectorAll('#cxRecDlg input[type=text], #cxRecDlg select, #cxRecWs select')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length;
      const short = [...document.querySelectorAll('#cxRecWs .tool-btn, #cxRecWs select, #cxRecTools .tool-btn, #cxRecDlg .tool-btn, #cxRecDlg input[type=text], #cxRecDlg select')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent);
      const wide = [...panel.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > 391 && !e.closest('.cx-an-tablewrap')).map((e) => e.id || e.className).slice(0, 4);
      return { l: d.left, r: d.right, h: d.height, sw: document.documentElement.scrollWidth, small, short, wide, bg: getComputedStyle(document.getElementById('cxRecDlg')).backgroundColor };
    });
    ok(`W8 ${theme} 390: dialog centred inside the viewport (not a side sheet), no horizontal scroll, panel fits`, m.l >= 8 && m.r <= 382 && Math.abs(m.l - (390 - m.r)) <= 2 && m.h < 700 && m.sw <= 390 && !m.wide.length, m);
    ok(`W8 ${theme} 390: controls >= 44 px, fields >= 16 px`, !m.short.length && m.small === 0, m);
    await c.close();
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 5));
} finally {
  await browser.close();
  if (server) server.kill();
}
if (fail) { console.error(`FAIL test-cx-workspace-ui — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`PASS test-cx-workspace-ui — ${pass} checks: Demo read-only, new set from a register, R4/R8 refused in the dialog, issue CRUD, undo, reload, export→import deep-equal, quarantine, two tabs, 390 px both themes`);
