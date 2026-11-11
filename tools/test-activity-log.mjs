#!/usr/bin/env node
/**
 * test-activity-log.mjs — P15 part A ship gate: the account's own actions are recorded and shown back.
 *
 *  A1  source: rz-scenario.js tracks only through rzSupa.logEvent, with an action allowlist and a meta allowlist;
 *      account.html asks listAuditLog for OWN rows; rz-supabase.js filters on actor_id when asked
 *  A2  browser, account.html with a stubbed rzSupa (served in place of js/rz-supabase.js):
 *      - events render as a table (label, item name, "deleted scenario" for a missing id, calc)
 *      - listAuditLog was called with {own:true}
 *      - Open / Copy link / Delete each log exactly one event with the right action
 *      - an empty log shows the empty sentence; a failing log shows the error + Retry, and Retry reloads
 *  A3  browser, two calculators: the real PDF builders are wrapped (__rzTracked); a wrapped builder that returns
 *      logs pdf_exported with {calc, format:'pdf'}; a throwing builder logs nothing; signed out logs nothing;
 *      an unknown action and an unknown meta key never reach logEvent
 *
 * Run: node tools/test-activity-log.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };

/* A1 */
const scn = readFileSync(join(ROOT, 'js/rz-scenario.js'), 'utf8');
const acc = readFileSync(join(ROOT, 'account.html'), 'utf8');
const sup = readFileSync(join(ROOT, 'js/rz-supabase.js'), 'utf8');
ok(/TRACK_ACTIONS\.indexOf\(action\) < 0\) return/.test(scn), 'A1 track() lost its action allowlist');
ok(/TRACK_META\.indexOf\(k\) >= 0/.test(scn), 'A1 track() lost its meta allowlist');
ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(scn.slice(scn.indexOf('function track'), scn.indexOf('function hookPdfExports'))), 'A1 track() must go through rzSupa.logEvent only');
ok(/listAuditLog\(50, \{ own: true \}\)/.test(acc), 'A1 account.html must ask for its OWN audit rows');
ok(/opts && opts\.own\) q = q\.eq\('actor_id', user\.id\)/.test(sup), 'A1 rz-supabase listAuditLog lost the own-rows filter');

const STUB = `
const U = { id: 'u-1', email: 'test@example.test', created_at: '2026-11-01T00:00:00Z' };
const mode = (new URLSearchParams(location.search)).get('stub') || 'rows';
window.__rzEvents = []; window.__rzAuditCalls = [];
const ROWS = [{ id: 's-1', name: 'Plant A capex', calc: 'capex', created_at: '2026-11-10T08:00:00Z', payload: { inputs: { x: 1 }, summary: {} } }];
const EV = [
  { id: 3, actor_id: 'u-1', action: 'pdf_exported', target_type: 'calc', target_id: null, meta: { calc: 'pue', format: 'pdf' }, created_at: '2026-11-11T09:00:00Z' },
  { id: 2, actor_id: 'u-1', action: 'scenario_saved', target_type: 'scenario', target_id: 's-1', meta: { calc: 'capex' }, created_at: '2026-11-10T08:00:00Z' },
  { id: 1, actor_id: 'u-1', action: 'scenario_deleted', target_type: 'scenario', target_id: 's-gone', meta: { calc: 'tco' }, created_at: '2026-11-09T08:00:00Z' },
];
let auditFails = mode === 'error' ? 1 : 0;
const api = {
  configured: true, error: null,
  async getUser() { return mode === 'signedout' ? null : U; },
  async getProfile() { return { data: { tier: 'pro', created_at: U.created_at } }; },
  async listScenarios() { return { data: ROWS.slice(), error: null }; },
  async deleteScenario() { return { error: null }; },
  async listAuditLog(limit, opts) {
    window.__rzAuditCalls.push({ limit, opts: opts || null });
    if (auditFails > 0) { auditFails--; return { data: [], error: 'boom' }; }
    return { data: mode === 'empty' ? [] : EV.slice(), error: null };
  },
  async logEvent(action, tt, tid, meta) { window.__rzEvents.push({ action, tt, tid, meta }); return { error: null }; },
  onChange() {}, async signIn() { return {}; }, async signUp() { return {}; }, async signOut() {}, async changePassword() { return {}; },
};
window.rzSupa = api; window.rzSupa.ready = Promise.resolve(api);
`;

const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/js/rz-supabase.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end(STUB); return; }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const open = async (url) => {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1280, height: 900 });
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) ? r.continue() : r.abort()));
  const errs = []; tab.on('pageerror', (e) => errs.push(String(e.message || e)));
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  return { tab, errs };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  /* A2 rows */
  {
    const { tab, errs } = await open('account.html?stub=rows');
    await tab.waitForSelector('#actList table', { timeout: 15000 });
    const t = await tab.evaluate(() => ({
      rows: [...document.querySelectorAll('#actList tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent.trim())),
      calls: window.__rzAuditCalls,
    }));
    ok(t.rows.length === 3, `A2 expected 3 activity rows, got ${t.rows.length}`);
    ok(t.rows[0] && t.rows[0][1] === 'Exported PDF' && t.rows[0][3] === 'pue', `A2 row 1 wrong: ${JSON.stringify(t.rows[0])}`);
    ok(t.rows[1] && t.rows[1][2] === 'Plant A capex', `A2 saved row must name the scenario: ${JSON.stringify(t.rows[1])}`);
    ok(t.rows[2] && t.rows[2][2] === 'deleted scenario', `A2 a missing scenario must read "deleted scenario": ${JSON.stringify(t.rows[2])}`);
    ok(t.calls.length >= 1 && t.calls[0].opts && t.calls[0].opts.own === true, `A2 listAuditLog not asked for own rows: ${JSON.stringify(t.calls)}`);
    /* Copy link, Open, Delete each log one event */
    await tab.evaluate(() => { window.__rzEvents.length = 0; try { navigator.clipboard.writeText = async () => {}; } catch (e) {} });
    await tab.click('button[data-share="s-1"]'); await sleep(400);
    let ev = await tab.evaluate(() => window.__rzEvents.slice());
    ok(ev.length === 1 && ev[0].action === 'scenario_link_copied', `A2 Copy link logged ${JSON.stringify(ev)}`);
    await tab.evaluate(() => { window.__rzEvents.length = 0; });
    await tab.click('button[data-id="s-1"]'); await sleep(400);
    ev = await tab.evaluate(() => window.__rzEvents.slice());
    ok(ev.length === 1 && ev[0].action === 'scenario_deleted' && ev[0].tid === 's-1' && ev[0].meta.calc === 'capex', `A2 Delete logged ${JSON.stringify(ev)}`);
    await tab.evaluate(() => { window.__rzEvents.length = 0; });
    await Promise.all([tab.waitForNavigation({ timeout: 8000 }).catch(() => null), tab.click('button[data-open="s-1"]')]);
    ok(/capex-calculator\.html/.test(tab.url()), `A2 Open did not reach the calculator: ${tab.url()}`);
    ok(errs.length === 0, `A2 page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
  /* Open logs before leaving: re-run with navigation blocked, read the event */
  {
    const { tab } = await open('account.html?stub=rows');
    await tab.waitForSelector('button[data-open="s-1"]', { timeout: 15000 });
    await tab.evaluate(() => { window.__rzEvents.length = 0; window.addEventListener('beforeunload', () => { localStorage.setItem('__rzEv', JSON.stringify(window.__rzEvents)); }); });
    await Promise.all([tab.waitForNavigation({ timeout: 8000 }).catch(() => null), tab.click('button[data-open="s-1"]')]);
    await tab.goto(base + 'account.html?stub=rows', { waitUntil: 'load' });
    const ev = JSON.parse(await tab.evaluate(() => localStorage.getItem('__rzEv') || '[]'));
    ok(ev.length === 1 && ev[0].action === 'scenario_opened' && ev[0].tid === 's-1', `A2 Open logged ${JSON.stringify(ev)}`);
    await tab.close();
  }
  /* A2 empty + error/retry */
  {
    const { tab } = await open('account.html?stub=empty');
    await tab.waitForFunction(() => /No activity recorded yet/.test(document.getElementById('actList').textContent), { timeout: 15000 }).catch(() => null);
    ok(await tab.evaluate(() => /No activity recorded yet\. Saving or opening a scenario adds an entry\./.test(document.getElementById('actList').textContent)), 'A2 empty log shows no empty sentence');
    await tab.close();
  }
  {
    const { tab } = await open('account.html?stub=error');
    await tab.waitForSelector('#actRetry', { timeout: 15000 }).catch(() => null);
    ok(await tab.evaluate(() => /Activity could not be loaded\./.test(document.getElementById('actList').textContent)), 'A2 failing log shows no error sentence');
    await tab.click('#actRetry').catch(() => null);
    await tab.waitForSelector('#actList table', { timeout: 8000 }).catch(() => null);
    ok(await tab.evaluate(() => document.querySelectorAll('#actList tbody tr').length === 3), 'A2 Retry did not reload the log');
    await tab.close();
  }
  /* A3 calculators */
  for (const [page, calc] of [['capex-calculator.html', 'capex'], ['pue-calculator.html', 'pue']]) {
    const { tab, errs } = await open(page + '?stub=rows');
    await tab.waitForFunction(() => window.rzScenario && window.rzScenario.track, { timeout: 15000 });
    await sleep(600);
    const r = await tab.evaluate(async () => {
      const S = window.rzScenario;
      const real = S.PDF_BUILDERS.filter((p) => { const f = p.split('.').reduce((o, k) => o && o[k], window); return typeof f === 'function'; });
      const wrapped = real.filter((p) => p.split('.').reduce((o, k) => o && o[k], window).__rzTracked);
      window.exportCriticalityPDF = function () { return 1; };
      window.exportReadinessPDF = function () { throw new Error('no jsPDF'); };
      S.hookPdfExports();
      window.__rzEvents.length = 0;
      window.exportCriticalityPDF();
      try { window.exportReadinessPDF(); } catch (e) {}
      await new Promise((r) => setTimeout(r, 300));
      const pdf = window.__rzEvents.slice();
      window.__rzEvents.length = 0;
      await S.track('made_up_action', 'calc', null, { calc: 'x' });
      await S.track('scenario_saved', 'scenario', 'z', { calc: 'capex', email: 'leak@example.test', note: 'x'.repeat(60) });
      const filt = window.__rzEvents.slice();
      return { real, wrapped, pdf, filt };
    });
    ok(r.real.length >= 1 && r.wrapped.length === r.real.length, `A3 ${page}: builders ${JSON.stringify(r.real)} not all wrapped (${JSON.stringify(r.wrapped)})`);
    ok(r.pdf.length === 1 && r.pdf[0].action === 'pdf_exported' && r.pdf[0].meta.calc === calc && r.pdf[0].meta.format === 'pdf', `A3 ${page}: pdf events ${JSON.stringify(r.pdf)}`);
    ok(r.filt.length === 1 && r.filt[0].action === 'scenario_saved' && JSON.stringify(r.filt[0].meta) === JSON.stringify({ calc: 'capex' }), `A3 ${page}: allowlists leaked ${JSON.stringify(r.filt)}`);
    ok(errs.length === 0, `A3 ${page} page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
  {
    const { tab } = await open('pue-calculator.html?stub=signedout');
    await tab.waitForFunction(() => window.rzScenario && window.rzScenario.track, { timeout: 15000 });
    const n = await tab.evaluate(async () => { await window.rzScenario.track('scenario_saved', 'scenario', 'z', { calc: 'pue' }); return window.__rzEvents.length; });
    ok(n === 0, `A3 signed out must log nothing, logged ${n}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (fails.length) { console.log(`FAIL test-activity-log — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`PASS test-activity-log — ${checks} checks: own-rows query, table/empty/error+retry states, open/copy/delete/pdf events, allowlists, signed-out silence`);
