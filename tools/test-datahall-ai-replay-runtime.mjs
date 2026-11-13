#!/usr/bin/env node
/* test-datahall-ai-replay-runtime.mjs — PRD-P05 stage 1 in the browser (datahallAI.html).
 *   B1 the header Replay button loads the controls and opens the mapping dialog (a DHModal panel)
 *   B2 the fixture parses in the Worker; 2 columns auto-match CDU-01 points, 1 is listed unmatched; axe clean
 *   B3 Start: body data-rz-data-mode="replay", the header label reads REPLAY · <file>, the bar shows
 *   B4 value equality at 3 scrub positions: the CDU-01 payload AND the open inspector print the file value
 *      (sample-and-hold where the file has a gap); engine planes stay engine values
 *   B5 unmapped points print "—" (payload row and a drawing reading): nothing simulated silently
 *   B6 no network request from Start to Exit (scrub + play at 60x)
 *   B7 the mapping is stored under the file signature (rz_replay_maps)
 *   B8 Exit restores the seeded simulation: payload deep-equal to the pre-replay one at the pinned tick
 *   B9 390 px: the bar wraps inside the viewport, no horizontal scroll; 0 page errors
 *   B10 an unreadable file names its line and leaves the page simulated
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'tools/fixtures/replay/cdu-trend.csv');
const SHOTS = process.env.RZ_SHOTS || '';
let fails = 0, passes = 0;
const ok = (c, name, detail = '') => { if (c) { passes++; console.log('  PASS  ' + name + (detail ? ' — ' + detail : '')); } else { fails++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

const { default: puppeteer } = await import('puppeteer');
const { serve } = await import('./build-calc-parameter-registry.mjs');
const { primeCockpitAuditDocument, enterAuthorizedAuditState } = await import('./lib/cockpit-audit-state.mjs');
const { server, base } = await serve();
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const AXE = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');

async function open(width) {
  const ctx = await browser.createBrowserContext();
  const tab = await ctx.newPage();
  await tab.setCacheEnabled(false);
  await tab.setBypassServiceWorker(true);
  await tab.setViewport({ width, height: 900 });
  await tab.evaluateOnNewDocument(() => { window.__rzSimTick = 4242; });
  await primeCockpitAuditDocument(tab, 'dark');
  const errors = [], requests = [];
  tab.on('pageerror', e => errors.push(String(e.message || e)));
  await tab.setRequestInterception(true);
  tab.on('request', r => { requests.push(r.url()); if (!r.url().startsWith(base)) return r.abort(); r.continue(); });
  await tab.goto(base + 'datahallAI.html', { waitUntil: 'load', timeout: 60000 });
  await tab.bringToFront();
  await wait(1800);
  await enterAuthorizedAuditState(tab, 'dc-ai');
  return { tab, ctx, errors, requests };
}
const cdu = tab => tab.evaluate(() => {
  const P = RZ_HMI_P('cdu', '1', 1);
  const rows = {}; Object.keys(P.tabs).forEach(t => Array.isArray(P.tabs[t]) && P.tabs[t].forEach(r => { rows[r.point] = { text: r.text, quality: r.quality }; }));
  return rows;
});
async function loadFile(tab, file) {
  await tab.click('#rzReplayTrig');
  await tab.waitForFunction(() => { const d = document.getElementById('replayDialog'); return d && d.classList.contains('show') && window.RZDatahallAIReplayUI; }, { timeout: 15000 });
  const input = await tab.$('#replayFile');
  await input.uploadFile(file);
}

try {
  const { tab, ctx, errors, requests } = await open(1366);
  const before = await cdu(tab);
  const page7 = await tab.evaluate(() => RZ_SIM('page7', 0, 6, 0));

  await loadFile(tab, FIX);
  ok(true, 'B1 Replay button opened the dialog');
  await tab.waitForSelector('#replayMapTable', { timeout: 15000 });
  const map = await tab.evaluate(() => ({
    rows: [...document.querySelectorAll('#replayMapTable tbody tr')].map(tr => [tr.getAttribute('data-col'), tr.querySelector('.replay-point').value]),
    status: document.getElementById('replayStatus').textContent, start: document.getElementById('replayStart').disabled
  }));
  const mapped = map.rows.filter(r => r[1]).map(r => r[0]);
  ok(mapped.length === 2 && mapped.includes('CDU-01 Differential pressure') && mapped.includes('CDU-01 control valve') && /1 unmatched/.test(map.status) && !map.start,
    'B2 auto-match: 2 mapped, 1 unmatched, Start enabled', JSON.stringify(map.rows) + ' · ' + map.status);
  await tab.addScriptTag({ content: AXE });
  const ax = await tab.evaluate(async () => (await window.axe.run(document.getElementById('replayDialog'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.filter(v => /serious|critical/.test(v.impact)).map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ') + ' ' + (n.any[0] && n.any[0].message || '').slice(0, 90)).join(' ; ')));
  ok(!ax.length, 'B2 axe on the mapping dialog: 0 serious/critical', ax.join(', '));
  if (SHOTS) await tab.screenshot({ path: path.join(SHOTS, 'replay-dialog-1366.png') });

  const nBefore = requests.length;
  await tab.click('#replayStart');
  await wait(300);
  const s3 = await tab.evaluate(() => ({ labels: [...document.querySelectorAll('[data-rz-mode-label]')].map(n => n.textContent), mode: document.body.getAttribute('data-rz-data-mode'), banner: (document.querySelector('.rz-tq-banner-label') || {}).textContent || '', bar: !document.getElementById('rzReplayBar').hidden, dlg: document.getElementById('replayDialog').classList.contains('show') }));
  ok(s3.mode === 'replay' && /^REPLAY · cdu-trend\.csv/.test(s3.banner) && s3.bar && !s3.dlg && s3.labels.length >= 1 && s3.labels.every(t => /replay/i.test(t)), 'B3 mode replay, header label + every in-page mode label read REPLAY, bar shown, dialog closed', JSON.stringify(s3));

  await tab.evaluate(() => RZDatahallAIEquipmentInspector.open('cdu:1'));
  await wait(400);
  const want = [['1.62', '64'], ['1.71', '64'], ['1.88', '81']];
  for (let i = 0; i < 3; i++) {
    await tab.evaluate(i => RZDatahallAIReplayUI.seek(i), i);
    await wait(150);
    const rows = await cdu(tab);
    const insp = await tab.evaluate(() => (document.querySelector('aside.rz-inspector') || {}).innerText || '');
    const good = rows.dp_bar.text === want[i][0] && rows.valve_pct.text === want[i][1] && rows.dp_bar.quality === 'replay' && insp.includes(want[i][0]) && insp.includes(want[i][1] + ' %');
    ok(good, `B4 scrub ${i}: payload + inspector print the file (dp ${want[i][0]} bar, valve ${want[i][1]} %)`, `dp ${rows.dp_bar.text} valve ${rows.valve_pct.text} inspector ${insp.includes(want[i][0])}`);
  }
  const rows = await cdu(tab);
  ok(rows.tcs_supply_c.quality === 'derived' && rows.tcs_supply_c.text === before.tcs_supply_c.text, 'B4 engine plane TCS supply stays the engine value', rows.tcs_supply_c.text);
  const dash = await tab.evaluate(() => RZ_SIM('page7', 0, 6, 0));
  ok(rows.strainer_dp.text === '—' && rows.strainer_dp.quality === 'replay' && dash === '—', 'B5 unmapped payload row and drawing reading print —', `strainer ${rows.strainer_dp.text} page7 ${dash}`);

  await tab.evaluate(() => { RZDatahallAIReplayUI.seek(0); const s = document.getElementById('replaySpeed'); s.value = '60'; s.dispatchEvent(new Event('change')); });
  await tab.click('#replayPlay');
  await wait(2400);
  const played = await tab.evaluate(() => RZDatahallAIReplayUI.state().idx);
  ok(played >= 1, 'B6 play at 60x advances the cursor', 'idx ' + played);
  await tab.keyboard.press('Escape');
  const during = requests.slice(nBefore);
  ok(during.length === 0, 'B6 no network request during replay', during.slice(0, 3).join(', '));

  const store = await tab.evaluate(() => { const o = JSON.parse(localStorage.getItem('rz_replay_maps') || '{}'); const k = Object.keys(o); return { n: k.length, sig: k[0], map: k[0] && o[k[0]].map }; });
  ok(store.n === 1 && /^[0-9a-f]{64}$/.test(store.sig) && store.map['CDU-01 Differential pressure'].point === 'cdu:1:1|dp_bar', 'B7 mapping stored under the sha256 file signature', JSON.stringify(store).slice(0, 140));

  if (SHOTS) await tab.screenshot({ path: path.join(SHOTS, 'replay-bar-1366.png') });
  await tab.click('#replayExit');
  await wait(200);
  const after = await cdu(tab);
  const page7b = await tab.evaluate(() => RZ_SIM('page7', 0, 6, 0));
  const mode = await tab.evaluate(() => document.body.getAttribute('data-rz-data-mode') + ([...document.querySelectorAll('[data-rz-mode-label]')].every(n => /simulated/i.test(n.textContent)) ? '' : ' (label stuck)'));
  ok(JSON.stringify(after) === JSON.stringify(before) && page7b === page7 && mode === 'simulated', 'B8 Exit restores the seeded simulation (deep-equal at tick 4242)', `mode ${mode} page7 ${page7b}`);
  ok(!errors.length, 'B9 0 page errors at 1366', errors.slice(0, 2).join(' | '));

  // B10 bad file
  const bad = path.join(process.env.TMPDIR || '/tmp', 'rz-replay-bad.csv');
  fs.writeFileSync(bad, 'time,a\n2026-11-03T14:00:00,1\n2026-11-03T14:01:00,"open\n');
  await loadFile(tab, bad);
  await tab.waitForFunction(() => document.getElementById('replayStatus').getAttribute('data-tone') === 'error', { timeout: 15000 });
  const err = await tab.evaluate(() => ({ s: document.getElementById('replayStatus').textContent, mode: document.body.getAttribute('data-rz-data-mode') }));
  ok(/line 3/.test(err.s) && err.mode === 'simulated', 'B10 unreadable file names its line, page stays simulated', err.s);
  await ctx.close();

  { // B9 phone
    const { tab, ctx, errors } = await open(390);
    await loadFile(tab, FIX);
    await tab.waitForSelector('#replayMapTable', { timeout: 15000 });
    if (SHOTS) await tab.screenshot({ path: path.join(SHOTS, 'replay-dialog-390.png') });
    await tab.click('#replayStart'); await wait(300);
    const g = await tab.evaluate(() => { const b = document.getElementById('rzReplayBar').getBoundingClientRect(); const kids = [...document.querySelectorAll('#rzReplayBar > *')].map(e => e.getBoundingClientRect()); return { sw: document.documentElement.scrollWidth, vw: innerWidth, right: Math.max(b.right, ...kids.map(k => k.right)), left: Math.min(b.left, ...kids.map(k => k.left)), h: b.height }; });
    ok(g.sw <= g.vw && g.right <= g.vw + 0.5 && g.left >= -0.5, 'B9 390 px: bar inside the viewport, no horizontal scroll', JSON.stringify(g));
    if (SHOTS) await tab.screenshot({ path: path.join(SHOTS, 'replay-bar-390.png') });
    ok(!errors.length, 'B9 0 page errors at 390', errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`\nreplay runtime: ${passes} pass, ${fails} fail`);
process.exit(fails ? 1 : 0);
