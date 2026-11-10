#!/usr/bin/env node
// P02 share links (#rzs=) — js/rz-scenario.js shareLink / readLink / restoreFiltered, on all 11 calculators.
//   U  unit (vm): round trip, oversize, bad base64, wrong version / calc, id pattern, value cap, key cap, origin,
//      and the reader's limits equal data/scenario-link.schema.json
//   E  rendered, per calculator: change up to 3 inputs, build the link, open it in a fresh browser context;
//      every captured input and every registry headline result must match; banner shown; hash cleared
//   S  security: a map naming login/password fields writes nothing into them
//   C  corrupted link: alert banner, inputs stay at their defaults
//   P  precedence: a link beats a pending "Open" from the account page and clears it
//   T  TIA: Tier, facility type (buttons, via hidden mirrors) and a checklist tick survive a link
//   B  Copy link button: present on every calculator but spares (own "Share URL"), copies a link that reads back
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = await readFile(join(ROOT, 'js/rz-scenario.js'), 'utf8');
const SCHEMA = JSON.parse(await readFile(join(ROOT, 'data/scenario-link.schema.json'), 'utf8'));
const REG = JSON.parse(await readFile(join(ROOT, 'data/calculators.json'), 'utf8')).calculators;
const fails = [];
let passes = 0;
const check = (name, cond, detail) => { if (cond) passes++; else fails.push(`${name}: ${detail}`); };

// ── U: unit ────────────────────────────────────────────────────────────────────────────────────────────────
{
  const win = { localStorage: { setItem() {}, getItem: () => null, removeItem() {} }, addEventListener() {},
    location: { origin: 'https://x.test', pathname: '/capex-calculator.html', search: '', hash: '' },
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary') };
  const doc = { readyState: 'complete', body: { getAttribute: (a) => ({ 'data-rz-calc': 'capex', 'data-rz-account-pill': 'off' })[a] ?? null },
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  vm.runInNewContext(SRC, { window: win, document: doc, Event: function () {}, escape, unescape });
  const S = win.rzScenario;
  const L = S.LINK;
  const inputs = { itLoad: { t: 'number', v: '2500' }, country: { t: 'select', v: 'ID' }, ok: { t: 'checkbox', v: true }, note: { t: 'text', v: 'ünï — 中文' } };
  const rt = S.readLink(S.encodeLink('capex', inputs, 'incident-12'), 'capex');
  check('U1 round trip', rt.ok && JSON.stringify(rt.map) === JSON.stringify(inputs) && rt.origin === 'incident-12', JSON.stringify(rt));
  const big = {}; for (let i = 0; i < 400; i++) big['f' + i] = { t: 'text', v: 'x'.repeat(30) };
  check('U2 oversize refused', S.shareLink(big).reason === 'too-large', JSON.stringify(S.shareLink(big)).slice(0, 80));
  check('U3 bad base64', S.readLink('#rzs=***', 'capex').reason === 'unreadable', '');
  const enc = (o) => '#rzs=' + Buffer.from(JSON.stringify(o)).toString('base64url');
  const cases = [
    ['U4 wrong version', { v: 2, calc: 'capex', inputs: {} }, 'unsupported version'],
    ['U5 wrong calc', { v: 1, calc: 'opex', inputs: {} }, 'link is for another calculator'],
    ['U6 id pattern', { v: 1, calc: 'capex', inputs: { 'a b': { t: 'text', v: '1' } } }, 'bad input id'],
    ['U7 value cap', { v: 1, calc: 'capex', inputs: { a: { t: 'text', v: 'x'.repeat(2001) } } }, 'value too long'],
    ['U8 type set', { v: 1, calc: 'capex', inputs: { a: { t: 'password', v: 'x' } } }, 'bad input type'],
    ['U9 origin', { v: 1, calc: 'capex', origin: 'javascript:alert(1) x', inputs: {} }, 'bad origin'],
    ['U10 value kind', { v: 1, calc: 'capex', inputs: { a: { t: 'text', v: { x: 1 } } } }, 'bad input value'],
  ];
  const many = {}; for (let i = 0; i < 501; i++) many['k' + i] = { t: 'text', v: '' };
  cases.push(['U11 key cap', { v: 1, calc: 'capex', inputs: many }, 'link too long']); // 501 keys cannot fit 8,000 chars; the length cap fires first
  for (const [n, o, want] of cases) { const r = S.readLink(enc(o), 'capex'); check(n, r.reason === want, `got ${JSON.stringify(r)}`); }
  // U13 linkFor (account.html rows): every registry calc gets a link to its own page that reads back
  for (const c of REG) {
    const r = S.linkFor(c.calc, { a: { t: 'number', v: '1' } });
    const ok = r.ok && r.url.startsWith('https://x.test/' + c.page + '#rzs=') && S.readLink(r.url.slice(r.url.indexOf('#')), c.calc).ok;
    check(`U13 linkFor ${c.calc}`, ok, JSON.stringify(r).slice(0, 120));
  }
  check('U13 linkFor unknown', S.linkFor('nope', {}).reason === 'no-calc' && S.linkFor('../x', {}).reason === 'no-calc', '');
  const sp = SCHEMA.properties, it = sp.inputs;
  check('U12 schema = reader', L.version === sp.v.const && L.maxKeys === it.maxProperties && L.maxLength === SCHEMA['x-rz-max-link-length'] &&
    L.keyPattern.source === it.propertyNames.pattern && L.originPattern.source.replace(/\\\//g, '/') === sp.origin.pattern &&
    L.maxValue === it.additionalProperties.properties.v.oneOf[0].maxLength &&
    JSON.stringify(L.types) === JSON.stringify(it.additionalProperties.properties.t.enum), 'limits in rz-scenario.js differ from data/scenario-link.schema.json');
}

// ── rendered ───────────────────────────────────────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const ALLOW = [base, 'https://cdn.jsdelivr.net/', 'https://cdnjs.cloudflare.com/'];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function open(url, ctx) {
  const tab = await (ctx || browser).newPage();
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (ALLOW.some((a) => r.url().startsWith(a)) ? r.continue() : r.abort()));
  await tab.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(1300);
  return tab;
}
const readResults = (tab, c) => tab.evaluate((sels) => sels.map((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }),
  c.results.map((r) => r.selector));
try {
  for (const c of REG) {
    const tab = await open(base + c.page);
    const made = await tab.evaluate(() => {
      const S = window.rzScenario;
      if (!S || !S.shareLink) return { err: 'rz-scenario not loaded' };
      const changed = [];
      const els = [...document.querySelectorAll('input[type=number][id], input[type=range][id], select[id]')]
        .filter((e) => e.offsetParent && !e.disabled && Object.prototype.hasOwnProperty.call(S.capture(), e.id));
      for (const el of els) {
        if (changed.length >= 3) break;
        let v;
        if (el.tagName === 'SELECT') { const o = [...el.options].find((x) => x.value && x.value !== el.value); if (!o) continue; v = o.value; }
        else {
          const cur = parseFloat(el.value); if (!Number.isFinite(cur)) continue;
          const min = el.min === '' ? -Infinity : +el.min, max = el.max === '' ? Infinity : +el.max, step = el.step && el.step !== 'any' ? +el.step : 1;
          let n = cur + step * Math.max(1, Math.round(Math.abs(cur) * 0.1 / step));
          if (n > max) n = cur - step; if (n < min) continue;
          v = String(+n.toFixed(6));
        }
        S.restore({ [el.id]: { t: el.tagName === 'SELECT' ? 'select' : el.type, v } });
        changed.push(el.id);
      }
      if (!changed.length) { // checklist pages (tia): tick the first visible checkbox instead
        const box = [...document.querySelectorAll('input[type=checkbox][id]')].find((e) => e.offsetParent && Object.prototype.hasOwnProperty.call(S.capture(), e.id));
        if (box) { box.click(); changed.push(box.id); }
      }
      return { changed, link: S.shareLink(), btn: !!document.getElementById('btnCopyLink') };
    });
    if (made.err) { check(`E ${c.calc}`, false, made.err); await tab.close(); continue; }
    await sleep(900);
    const want = await tab.evaluate(() => window.rzScenario.capture());
    const wantRes = await readResults(tab, c);
    await tab.close();
    check(`B ${c.calc} copy button`, made.btn === (c.calc !== 'spares'), `btnCopyLink present=${made.btn}`);
    // spares keeps its own "Share URL" (#s=): its ~300 inputs exceed the 8,000-char link cap, and the reader says so.
    if (c.calc === 'spares') { check('E spares refused as too large', made.link.reason === 'too-large', JSON.stringify(made.link)); continue; }
    if (!made.link.ok) { check(`E ${c.calc} link`, false, JSON.stringify(made.link)); continue; }
    const ctx = await browser.createBrowserContext();
    const t2 = await open(made.link.url.replace(/^https?:\/\/[^/]+\//, base), ctx);
    await sleep(700);
    const got = await t2.evaluate(() => ({ cap: window.rzScenario.capture(), banner: (document.getElementById('rzShareBanner') || {}).textContent || '',
      role: (document.getElementById('rzShareBanner') || { getAttribute: () => '' }).getAttribute('role'), hash: location.hash }));
    const gotRes = await readResults(t2, c);
    const diff = Object.keys(want).filter((k) => JSON.stringify(want[k]) !== JSON.stringify(got.cap[k]));
    check(`E ${c.calc} inputs (${made.changed.length} changed: ${made.changed.join(',')})`, made.changed.length > 0 && diff.length === 0,
      `changed=${made.changed.length} differing=${diff.slice(0, 5).map((k) => `${k}: ${JSON.stringify(want[k])} vs ${JSON.stringify(got.cap[k])}`).join('; ')}`);
    check(`E ${c.calc} results`, JSON.stringify(wantRes) === JSON.stringify(gotRes), `${JSON.stringify(wantRes)} vs ${JSON.stringify(gotRes)}`);
    check(`E ${c.calc} banner + hash`, got.role === 'status' && /Shared scenario/.test(got.banner) && got.hash.indexOf('#rzs=') < 0, JSON.stringify({ role: got.role, hash: got.hash }));
    await ctx.close();
  }

  // S: security filter
  {
    const tab = await open(base + 'capex-calculator.html');
    const r = await tab.evaluate(() => {
      const ov = document.createElement('div'); ov.id = 'rzModalOverlay';
      ov.innerHTML = '<input id="rzLoginEmail" type="email" value=""><input id="pw" type="password" value=""><input id="rzLoginNote" type="text" value="">';
      document.body.appendChild(ov);
      const res = window.rzScenario.restoreFiltered({ rzLoginEmail: { t: 'text', v: 'a@b.c' }, pw: { t: 'text', v: 'hunter2' },
        rzLoginNote: { t: 'text', v: 'x' }, itLoad: { t: 'number', v: '1234' } });
      return { res: [res.restored, res.skipped], email: document.getElementById('rzLoginEmail').value, pw: document.getElementById('pw').value,
        note: document.getElementById('rzLoginNote').value, it: document.getElementById('itLoad').value };
    });
    check('S login fields untouched', r.email === '' && r.pw === '' && r.note === '' && r.it === '1234' && r.res.join() === '1,3', JSON.stringify(r));
    await tab.close();
  }

  // C: corrupted link
  {
    const t0 = await open(base + 'opex-calculator.html');
    const def = await t0.evaluate(() => window.rzScenario.capture()); await t0.close();
    const tab = await open(base + 'opex-calculator.html#rzs=eyJ2IjoxLCJjYWxjIjoib3BleCIsImlucHV0cyI6e319XX');
    const r = await tab.evaluate(() => ({ cap: window.rzScenario.capture(), role: (document.getElementById('rzShareBanner') || { getAttribute: () => '' }).getAttribute('role'), hash: location.hash }));
    check('C corrupted link', r.role === 'alert' && r.hash === '' && JSON.stringify(r.cap) === JSON.stringify(def), JSON.stringify({ role: r.role, hash: r.hash }));
    await tab.close();
  }

  // P: link beats pending Open
  {
    const ctx = await browser.createBrowserContext();
    const t0 = await open(base + 'pue-calculator.html', ctx);
    const url = await t0.evaluate(() => {
      localStorage.setItem('rz_open_scenario', JSON.stringify({ calc: 'pue', inputs: { itLoad: { t: 'number', v: '777' } }, ts: Date.now() }));
      return location.pathname + window.rzScenario.encodeLink('pue', { itLoad: { t: 'number', v: '4321' } });
    });
    await t0.close();
    const tab = await open(base + url.replace(/^\//, ''), ctx);
    const r = await tab.evaluate(() => ({ it: document.getElementById('itLoad').value, pending: localStorage.getItem('rz_open_scenario'),
      banner: (document.getElementById('rzShareBanner') || {}).textContent || '' }));
    check('P link wins over pending Open', r.it === '4321' && r.pending === null && /set aside/.test(r.banner), JSON.stringify(r));
    await ctx.close();
  }

  // T: TIA buttons via mirrors
  {
    const tab = await open(base + 'tia-942-checklist.html');
    const url = await tab.evaluate(() => {
      setTier(2); setDcType('colo');
      const box = document.querySelector('input[type=checkbox][id^="chk-"]'); box.click();
      return { link: window.rzScenario.shareLink().url, box: box.id };
    });
    await tab.close();
    const ctx = await browser.createBrowserContext();
    const t2 = await open(url.link.replace(/^https?:\/\/[^/]+\//, base), ctx);
    await sleep(700);
    const r = await t2.evaluate((id) => ({ tier: currentTier, dc: currentDcType, box: document.getElementById(id).checked,
      pressed: document.querySelector('.tier-btn[aria-pressed=true]').textContent.trim().slice(0, 6) }), url.box);
    check('T TIA tier + type + tick', r.tier === 2 && r.dc === 'colo' && r.box === true && r.pressed === 'Tier 2', JSON.stringify(r));
    await ctx.close();
  }

  // B: the button copies a link that reads back
  {
    const ctx = await browser.createBrowserContext();
    await ctx.overridePermissions(base.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const tab = await open(base + 'cx-calculator.html', ctx);
    await tab.click('#btnCopyLink');
    await sleep(300);
    const r = await tab.evaluate(async () => {
      let clip = ''; try { clip = await navigator.clipboard.readText(); } catch (e) { clip = 'ERR ' + e.message; }
      const msg = document.getElementById('acctSaveMsg') || document.getElementById('rzScenarioMsg');
      const field = document.getElementById('rzShareLinkField');
      const url = /#rzs=/.test(clip) ? clip : (field ? field.value : '');
      return { msg: msg ? msg.textContent : '', ok: window.rzScenario.readLink(url.slice(url.indexOf('#')), 'cx').ok };
    });
    check('B copy link click', r.ok && /Link copied|Copy this link/.test(r.msg), JSON.stringify(r));
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }

if (fails.length) { console.log(`FAIL test-scenario-share-links — ${fails.length} of ${fails.length + passes}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`PASS test-scenario-share-links — ${passes} checks: unit + schema, 11 calculators round-trip inputs and results, security filter, corrupted link, precedence, TIA buttons, copy button`);
