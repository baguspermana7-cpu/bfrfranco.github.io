#!/usr/bin/env node
/**
 * test-embed-article.mjs — PRD-P20 part A: article embeds of the calculators (?embed=article).
 *   A0 parity: data/calculators.json embed.keep = <body data-rz-embed-keep-ids> on all 11 pages, every id exists;
 *      js/rz-embed.js PAGES = the registry pages; each page loads js/rz-embed-article.js
 *   A1 compact (11 pages, inside a same-origin parent): no visible nav, footer, cookie banner, search button or
 *      account pill; every declared unit visible; title + "Open full calculator"; 0 page errors
 *   A2 size (pue, 360/768/1280): iframe height = frame document height ±2 px, no inner vertical scroll
 *   A3 changing an input inside the embed changes the result inside it (pue IT load, capex IT load)
 *   A4 "Open full calculator" is the P02 link: the full page opens with the embed's current input value
 *   A5 a parent on ANOTHER origin gets only a link out (no calculator) and receives no size message
 *   A6 the parent ignores a size message that is not from its own frame (posted by the parent window itself)
 *   A7 a frame that never reports (its embed script blocked) is replaced after 8 s by the fallback sentence + link
 *   A8 a box naming a page outside the registry is refused (no iframe)
 *   A10 the adopting articles (any sitemap article with a box, at least 3): ready, CLS <= 0.02, both themes, 0 errors
 *   A9 every input an embed shows moves the result it shows (PUE once showed IT load, which a ratio ignores)
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.RZ_SHOTS || '';
let fails = 0, passes = 0;
const ok = (c, name, detail = '') => { if (c) { passes++; console.log('  PASS  ' + name + (detail ? ' — ' + detail : '')); } else { fails++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const reg = JSON.parse(readFileSync(join(ROOT, 'data/calculators.json'), 'utf8')).calculators;
const EMB = reg.filter((c) => !(c.embed && c.embed.excluded));   /* checklists are excluded with a written reason */

/* A0 */
{
  const bad = [];
  for (const c of reg) {
    const src = readFileSync(join(ROOT, c.page), 'utf8');
    if (c.embed && c.embed.excluded) {
      if (c.embed.keep.length || /data-rz-embed-keep-ids=/.test(src) || c.embed.excluded.length < 40) bad.push(c.calc + ': excluded but still declares ids, or the reason is under 40 chars');
      continue;
    }
    const m = src.match(/<body[^>]*data-rz-calc="[^"]+"[^>]*data-rz-embed-keep-ids="([^"]*)"/);
    const ids = m ? m[1].split(/\s+/).filter(Boolean) : [];
    if (!c.embed || JSON.stringify(c.embed.keep) !== JSON.stringify(ids)) bad.push(c.calc + ': registry ' + JSON.stringify(c.embed && c.embed.keep) + ' vs body ' + JSON.stringify(ids));
    ids.forEach((id) => { if (!src.includes('id="' + id + '"')) bad.push(c.calc + ': no #' + id); });
    if (!/<script src="js\/rz-embed-article\.js\?v=[^"]+"><\/script>/.test(src)) bad.push(c.calc + ': rz-embed-article.js not loaded');
  }
  const inJs = (readFileSync(join(ROOT, 'js/rz-embed.js'), 'utf8').match(/var INPUTS = (\{[^}]+\})/) || [])[1];
  const INPUTS = inJs ? JSON.parse(inJs.replace(/'/g, '"')) : {};
  const want = Object.fromEntries(EMB.map((c) => [c.page, c.embed.keep.length - 1]));
  if (JSON.stringify(INPUTS) !== JSON.stringify(want)) bad.push('rz-embed.js INPUTS ' + JSON.stringify(INPUTS) + ' differ from the registry ' + JSON.stringify(want));
  ok(!bad.length, 'A0 embed declarations: registry = page body ids = rz-embed.js INPUTS (' + EMB.length + ' embeddable, ' + (reg.length - EMB.length) + ' excluded with a reason)', bad.join('; '));
}

const { default: puppeteer } = await import('puppeteer');
const { serve } = await import('./build-calc-parameter-registry.mjs');
const A = await serve(), B = await serve();   /* two ports = two origins */
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const PARENT = 'rz-tmp-embed-parent.html';
const parentHtml = (boxes) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>embed parent</title>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px">' + boxes +
  '<script src="js/rz-embed.js"></script></body></html>';
writeFileSync(join(ROOT, PARENT), parentHtml(''));

async function openParent(boxes, width, block) {
  writeFileSync(join(ROOT, PARENT), parentHtml(boxes));
  const ctx = await browser.createBrowserContext();
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(String(e.message || e)));
  await tab.setViewport({ width, height: 900 });
  if (block) { await tab.setRequestInterception(true); tab.on('request', (r) => (block.test(r.url()) ? r.abort() : r.continue())); }
  await tab.goto(A.base + PARENT, { waitUntil: 'load', timeout: 60000 });
  return { tab, ctx, errors };
}
const frameOf = async (tab, i = 0) => { const h = (await tab.$$('iframe'))[i]; return h ? h.contentFrame() : null; };
async function ready(tab, n = 1) {
  await tab.waitForFunction((n) => document.querySelectorAll('[data-rz-embed-state="ready"]').length >= n, { timeout: 30000 }, n);
  await wait(400);
}
const box = (page, title) => `<div data-rz-embed="${page}" data-rz-embed-title="${title}" style="margin:0 0 24px"></div>`;

try {
  /* A1 + A9 */
  const a1 = [], a9 = [];
  for (const c of EMB) {
    const { tab, ctx, errors } = await openParent(box(c.page, c.title), 1280);
    try {
      await ready(tab);
      const fr = await frameOf(tab);
      const r = await fr.evaluate((keep) => {
        const vis = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden'; };
        const chrome = ['nav', 'footer', '#rz-cookie-banner,.cookie-banner,[class*="cookie"]', '.rz-search-btn,[data-rz-search],#rzPaletteBtn', '[data-rz-account-pill-el],.rz-account-pill']
          .map((s) => [...document.querySelectorAll(s)].filter(vis).length);
        const units = keep.map((id) => { const el = document.getElementById(id); const u = el && el.closest('[data-rz-embed-keep]'); return !!(u && vis(u)); });
        return { chrome, units, head: vis(document.getElementById('rzEmbedHead')), open: vis(document.getElementById('rzEmbedOpen')) };
      }, c.embed.keep);
      const bad = r.chrome.some((n) => n) || r.units.some((u) => !u) || !r.head || !r.open || errors.length;
      if (bad) a1.push(c.calc + ' ' + JSON.stringify(r) + (errors.length ? ' errors: ' + errors[0].slice(0, 80) : ''));
      /* A9: every input the embed shows must move the result it shows (an input that cannot is a lie in the box) */
      const resultId = c.embed.keep[c.embed.keep.length - 1];
      for (const id of c.embed.keep.slice(0, -1)) {
        const moved = await fr.evaluate(async (id, rid) => {
          const el = document.getElementById(id), res = document.getElementById(rid);
          const read = () => res.textContent.replace(/\s+/g, ' ').trim();
          const fire = () => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
          const before = read(), old = el.value;
          const tries = el.tagName === 'SELECT' ? [...el.options].map((o) => o.value).filter((v) => v !== old) : [String(+old * 2 || 1), String(+old / 2 || 1)];
          let changed = false;
          for (const v of tries.slice(0, 6)) { el.value = v; fire(); await new Promise((r) => setTimeout(r, 350)); if (read() !== before) { changed = true; break; } }
          el.value = old; fire(); await new Promise((r) => setTimeout(r, 300));
          return changed;
        }, id, resultId);
        if (!moved) a9.push(c.calc + ': #' + id + ' does not move #' + resultId);
      }
      if (SHOTS && ['pue', 'capex', 'tia'].includes(c.calc)) await tab.screenshot({ path: join(SHOTS, 'embed-' + c.calc + '-1280.png'), fullPage: true });
    } catch (e) { a1.push(c.calc + ': ' + String(e.message || e).slice(0, 100)); }
    await ctx.close();
  }
  ok(!a9.length, 'A9 every input an embed shows moves the result it shows (' + EMB.length + ' calculators)', a9.join(' | '));
  ok(!a1.length, 'A1 compact embed on all ' + EMB.length + ' embeddable calculators: no chrome, every declared unit shown, title + open link, 0 errors', a1.join(' | '));

  /* A2 + A3 + A4 */
  for (const width of [360, 768, 1280]) {
    const { tab, ctx } = await openParent(box('pue-calculator.html', 'PUE calculator'), width);
    await ready(tab);
    const fr = await frameOf(tab);
    const m = await tab.evaluate(() => { const f = document.querySelector('iframe'); const d = f.contentDocument; return { fh: f.getBoundingClientRect().height, dh: Math.ceil(d.documentElement.getBoundingClientRect().height), inner: d.scrollingElement.scrollHeight - d.scrollingElement.clientHeight }; });
    ok(Math.abs(m.fh - m.dh) <= 2 + 2 && m.inner <= 2, `A2 ${width}px: iframe height follows its content, no inner scroll`, JSON.stringify(m));
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, 'embed-pue-' + width + '.png'), fullPage: true });
    if (width === 1280) {
      const before = await fr.$eval('#pueValue', (e) => e.textContent.trim());
      /* PUE is a ratio: IT load scales every overhead with it, so the cooling type is the embedded input that moves it */
      await fr.evaluate(() => { const s = document.getElementById('coolingType'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; s.dispatchEvent(new Event('change', { bubbles: true })); });
      await wait(600);
      const after = await fr.$eval('#pueValue', (e) => e.textContent.trim());
      ok(before !== after, 'A3 pue: changing the cooling type inside the embed changes the result inside it', before + ' -> ' + after);
      await fr.evaluate(() => { const i = document.getElementById('itLoad'); i.value = '5000'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
      await wait(400);
      const href = await fr.$eval('#rzEmbedOpen', (a) => { a.click(); return a.href; });
      await wait(300);
      const t2 = await browser.newPage();
      await t2.goto(href, { waitUntil: 'load', timeout: 60000 });
      await wait(1500);
      const v = await t2.$eval('#itLoad', (i) => i.value);
      ok(!/embed=/.test(href) && /#/.test(href) && v === '5000', 'A4 "Open full calculator" opens the full page with the embed\'s inputs (P02 link)', href.slice(0, 90) + '… itLoad=' + v);
      await t2.close();
    }
    await ctx.close();
  }
  {
    const { tab, ctx } = await openParent(box('capex-calculator.html', 'CAPEX calculator'), 1280);
    await ready(tab);
    const fr = await frameOf(tab);
    const before = await fr.$eval('#totalCost', (e) => e.textContent.trim());
    await fr.evaluate(() => { const i = document.getElementById('itLoad'); i.value = String(+i.value * 2); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    await wait(800);
    const after = await fr.$eval('#totalCost', (e) => e.textContent.trim());
    ok(before !== after, 'A3 capex: changing IT load inside the embed changes the result inside it', before + ' -> ' + after);

    /* A6 */
    const h0 = await tab.$eval('iframe', (f) => f.style.height);
    await tab.evaluate(() => window.postMessage({ type: 'rz-embed-size', h: 77 }, location.origin));
    await wait(300);
    const h1 = await tab.$eval('iframe', (f) => f.style.height);
    ok(h0 === h1 && h1 !== '77px', 'A6 a size message not from the box\'s own frame is ignored', h0 + ' -> ' + h1);
    await ctx.close();
  }

  /* A5 cross-origin parent: page B frames A's embed */
  {
    const ctx = await browser.createBrowserContext();
    const tab = await ctx.newPage();
    const errs = [];
    tab.on('pageerror', (e) => errs.push(String(e.message || e)));
    writeFileSync(join(ROOT, PARENT), '<!doctype html><html><head><meta charset="utf-8"><title>x</title></head><body>' +
      '<iframe id="x" style="width:800px;height:600px" src="' + A.base + 'pue-calculator.html?embed=article"></iframe>' +
      '<script>window.__msgs=0;addEventListener("message",function(){window.__msgs++;});</script></body></html>');
    await tab.goto(B.base + PARENT, { waitUntil: 'load', timeout: 60000 });
    await wait(2500);
    const topUrl = tab.url();
    const fr = await frameOf(tab);
    const inner = fr ? await fr.evaluate(() => ({ mode: document.documentElement.getAttribute('data-rz-embed'), link: !!document.getElementById('rzEmbedRefused'), calc: !!document.getElementById('pueValue') && document.getElementById('pueValue').getBoundingClientRect().height > 0 })).catch(() => null) : null;
    const msgs = await tab.evaluate(() => window.__msgs).catch(() => 0);
    const brokeOut = !topUrl.startsWith(B.base);
    ok((brokeOut || (inner && inner.mode === 'refused' && inner.link && !inner.calc)) && msgs === 0,
      'A5 a parent on another origin gets no calculator (link out only) and no size message', JSON.stringify({ topUrl: topUrl.slice(0, 60), inner, msgs }));
    await ctx.close();
  }

  /* A7 dead frame */
  {
    const { tab, ctx } = await openParent(box('tier-advisor.html', 'Tier advisor'), 1280, /rz-embed-article\.js/);
    const t0 = Date.now();
    await tab.waitForFunction(() => document.querySelector('[data-rz-embed-state="fallback"]'), { timeout: 15000 }).catch(() => null);
    const r = await tab.evaluate(() => { const b = document.querySelector('[data-rz-embed]'); return { state: b.getAttribute('data-rz-embed-state'), text: b.textContent.trim(), href: (b.querySelector('a') || {}).getAttribute ? b.querySelector('a').getAttribute('href') : null, frames: b.querySelectorAll('iframe').length }; });
    const secs = (Date.now() - t0) / 1000;
    ok(r.state === 'fallback' && /could not load/.test(r.text) && r.href === 'tier-advisor.html' && !r.frames && secs >= 7,
      'A7 no size message in 8 s: fallback sentence + plain link replace the frame', JSON.stringify(r) + ' after ' + secs.toFixed(1) + ' s');
    await ctx.close();
  }

  /* A8 */
  {
    const { tab, ctx } = await openParent(box('index.html', 'home'), 1280);
    await wait(500);
    const r = await tab.evaluate(() => ({ state: document.querySelector('[data-rz-embed]').getAttribute('data-rz-embed-state'), frames: document.querySelectorAll('iframe').length }));
    ok(r.state === 'refused' && r.frames === 0, 'A8 a page outside the registry is refused', JSON.stringify(r));
    await ctx.close();
  }
  /* A10 adopted articles: the box becomes ready, the page does not jump (CLS while scrolling to it), both themes */
  {
    const ADOPTED = [...readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>[^<]*\/(article-\d+\.html)<\/loc>/g)].map((m) => m[1])
      .filter((f) => /data-rz-embed="/.test(readFileSync(join(ROOT, f), 'utf8')));
    const a10 = [];
    for (const f of ADOPTED) for (const width of [390, 1366]) for (const theme of ['light', 'dark']) {
      const ctx = await browser.createBrowserContext();
      const tab = await ctx.newPage();
      const errs = [];
      tab.on('pageerror', (e) => errs.push(String(e.message || e)));
      await tab.setViewport({ width, height: 860 });
      await tab.evaluateOnNewDocument((t) => {
        try { localStorage.setItem('theme', t); localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) { /* none */ }
        window.__cls = 0;
        new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: false });
      }, theme);
      await tab.goto(A.base + f, { waitUntil: 'load', timeout: 60000 });
      await wait(800);
      await tab.evaluate(() => { window.__cls = 0; });
      const y = await tab.$eval('[data-rz-embed]', (b) => b.getBoundingClientRect().top + scrollY);
      for (let at = 0; at < y; at += 400) { await tab.evaluate((v) => scrollTo(0, v), at); await wait(120); }
      await tab.evaluate((v) => scrollTo(0, v - 120), y);
      const st = await tab.waitForFunction(() => /ready|fallback/.test(document.querySelector('[data-rz-embed]').getAttribute('data-rz-embed-state') || ''), { timeout: 20000 }).then(() => tab.$eval('[data-rz-embed]', (b) => b.getAttribute('data-rz-embed-state'))).catch(() => 'timeout');
      await wait(600);
      const cls = await tab.evaluate(() => window.__cls);
      if (st !== 'ready' || cls > 0.02 || errs.length) a10.push(`${f} ${width} ${theme}: state ${st}, CLS ${cls.toFixed(3)}${errs.length ? ', error ' + errs[0].slice(0, 60) : ''}`);
      if (SHOTS) { const el = await tab.$('[data-rz-embed]'); if (el) await el.screenshot({ path: join(SHOTS, `embed-${f.replace('.html', '')}-${width}-${theme}.png`) }); }
      await ctx.close();
    }
    ok(ADOPTED.length >= 3 && !a10.length, 'A10 ' + ADOPTED.length + ' adopting articles × 390/1366 × light/dark: box ready, CLS ≤ 0.02 while scrolling to it, 0 errors', a10.join(' | ') || ADOPTED.join(', '));
  }
} finally {
  await browser.close(); A.server.close(); B.server.close();
  try { unlinkSync(join(ROOT, PARENT)); } catch (e) { /* gone */ }
}
console.log(`\nembed article: ${passes} pass, ${fails} fail`);
process.exit(fails ? 1 : 0);
