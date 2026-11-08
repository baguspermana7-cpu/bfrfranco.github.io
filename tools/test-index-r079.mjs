#!/usr/bin/env node
/**
 * test-index-r079.mjs — the laws of the R079 homepage refit (owner 2026-11-07), run on the rendered page.
 *  L1 every id of the pre-refit homepage (BASE commit) still exists, and every href="#x" resolves to an id.
 *  L2 employer cards: 5 cards, exactly 1 .is-current; Details flips (aria-expanded, back face not inert, rotateY 180),
 *     Esc flips home, opening card B closes card A, card height does not change on flip; reduced motion: no rotation.
 *  L3 phone 390: no horizontal scroll, cards one column, each card as tall as its shown face, every employer logo >= 56 px tall and a vector.
 *  L4 nav: no backdrop-filter, no box-shadow, 64 +/- 2 px at 1440; the Contact pill once in the nav, the
 *     pill CTA once in the hero and once in the contact section, each reaching #contact or mailto.
 *     The meta row reads [hh:mm WIB] · Bekasi, Indonesia · Independent personal project, above the cards, no email.
 *  L5 footer: the wordmark spans the footer content box +/- 2 px at 390/1024/1440; every footer link resolves;
 *     no phone number, no street address, no availability/hire copy; the old mono slogan is gone.
 * Env RZ_BASE (default http://127.0.0.1:8177).   node tools/test-index-r079.mjs
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = 'a7c34f420';
const URL = (process.env.RZ_BASE || 'http://127.0.0.1:8177') + '/index.html';
let puppeteer;
try { puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer'); }
catch { puppeteer = createRequire('/home/baguspermana7/wt-journal/package.json')('puppeteer'); }

let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };
const oldHtml = execFileSync('git', ['show', `${BASE_COMMIT}:index.html`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
const oldIds = [...oldHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
const open = async (w, theme = 'light', reduced = false) => {
  const p = await browser.newPage();
  p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e).slice(0, 120)));
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900 });
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(URL.replace('/index.html', '/robots.txt'));
  await p.evaluate((t) => { localStorage.clear(); localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', t); }, theme);
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  return p;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  // L1
  let p = await open(1440);
  const ids = await p.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  const missing = oldIds.filter((i) => !ids.includes(i));
  check(missing.length === 0, `L1 all ${oldIds.length} pre-refit ids present${missing.length ? ' — missing ' + missing.slice(0, 6).join(',') : ''}`);
  const dead = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
  check(dead.length === 0, `L1 every in-page anchor resolves${dead.length ? ' — dead ' + [...new Set(dead)].join(',') : ''}`);

  // L2
  const cards = await p.evaluate(() => ({ n: document.querySelectorAll('.emp-card').length, cur: document.querySelectorAll('.emp-card.is-current').length }));
  check(cards.n === 5 && cards.cur === 1, `L2 5 employer cards, 1 current — read ${cards.n}/${cards.cur}`);
  const st = (i) => p.evaluate((i) => { const c = document.querySelectorAll('.emp-card')[i], b = c.querySelector('.emp-back');
    return { exp: c.querySelector('.emp-open').getAttribute('aria-expanded'), inert: b.hasAttribute('inert'), tf: getComputedStyle(b).transform, h: Math.round(c.getBoundingClientRect().height),
      focus: document.activeElement && document.activeElement.className }; }, i);
  const h0 = (await st(1)).h;
  await p.click('.emp-card:nth-child(2) .emp-open'); await sleep(800);
  let s = await st(1);
  check(s.exp === 'true' && !s.inert && (s.tf === 'none' || s.tf === 'matrix(1, 0, 0, 1, 0, 0)') && /emp-back-name/.test(s.focus), `L2 Details opens card 2 (expanded, back live, back face square to the reader, focus on its heading) — ${JSON.stringify(s)}`);
  check(s.h === h0, `L2 card height unchanged by the flip — ${h0} -> ${s.h}`);
  const frontTf = await p.evaluate(() => getComputedStyle(document.querySelectorAll('.emp-card')[1].querySelector('.emp-front')).transform);
  check(/matrix3d\(-1/.test(frontTf), `L2 front face turned 180deg — ${frontTf.slice(0, 40)}`);
  await p.click('.emp-card:nth-child(4) .emp-open'); await sleep(800);
  const a = await st(1), b = await st(3);
  check(a.exp === 'false' && a.inert && b.exp === 'true', `L2 opening card 4 flips card 2 home (one open at a time)`);
  await p.keyboard.press('Escape'); await sleep(800);
  const c = await st(3);
  check(c.exp === 'false' && c.inert && /emp-open/.test(c.focus), `L2 Esc flips card 4 home and returns focus to Details`);
  check(p.errors.length === 0, `L2 no page errors — ${p.errors.join(' | ')}`);

  // L4 (1440)
  const nav = await p.evaluate(() => { const n = document.querySelector('.navbar'), cs = getComputedStyle(n);
    const href = (sel) => [...document.querySelectorAll(sel)].map((a) => a.getAttribute('href'));
    return { h: Math.round(n.getBoundingClientRect().height), blur: cs.backdropFilter, sh: cs.boxShadow,
      navPill: href('.navbar .rz-pill-cta'), navPillShown: [...document.querySelectorAll('.navbar .rz-pill-cta')].filter((e) => e.offsetParent).length,
      hero: href('#home .rz-pill-cta'), contact: href('#contact .rz-pill-cta') }; });
  check(nav.blur === 'none' && nav.sh === 'none' && Math.abs(nav.h - 64) <= 2, `L4 nav flat, ${nav.h}px (blur ${nav.blur}, shadow ${nav.sh})`);
  const okHref = (l) => l.length === 1 && /^(#contact|mailto:)/.test(l[0]);
  check(okHref(nav.navPill) && nav.navPillShown === 1 && okHref(nav.hero) && okHref(nav.contact), `L4 pill CTA: nav ${nav.navPill}, hero ${nav.hero}, contact ${nav.contact}`);
  const meta = await p.evaluate(() => { const m = document.querySelector('.rz-meta-row'); const r = m.getBoundingClientRect(), c = document.querySelector('#career').getBoundingClientRect();
    return { t: m.textContent.trim(), above: r.bottom <= c.top + 1, w: Math.round(r.width) }; });
  check(/^\[\d\d:\d\d WIB\]Time zone WIB, UTC\+7\. · Bekasi, Indonesia · Independent personal project$/.test(meta.t) && meta.above && !/@/.test(meta.t), `L4 meta row under the hero, clock live, no email — "${meta.t}"`);
  await p.close();

  // L2 reduced motion: no rotation
  p = await open(1440, 'light', true);
  await p.click('.emp-card:nth-child(2) .emp-open'); await sleep(400);
  const rm = await p.evaluate(() => { const c = document.querySelectorAll('.emp-card')[1];
    return [getComputedStyle(c.querySelector('.emp-front')).transform, getComputedStyle(c.querySelector('.emp-back')).transform, getComputedStyle(c.querySelector('.emp-back')).opacity]; });
  check(rm[0] === 'none' && rm[1] === 'none' && rm[2] === '1', `L2 reduced motion: crossfade, no rotation — ${rm.join(' / ')}`);
  await p.close();

  // L3 + L5 at three widths, both themes for 390
  for (const [w, theme] of [[390, 'light'], [390, 'dark'], [1024, 'light'], [1440, 'dark']]) {
    p = await open(w, theme);
    const r = await p.evaluate(() => {
      const f = document.querySelector('.rz-foot-in'), fs = getComputedStyle(f), m = document.querySelector('.rz-foot-mark img');
      const cols = new Set([...document.querySelectorAll('.emp-card')].map((c) => Math.round(c.getBoundingClientRect().left))).size;
      const logos = [...document.querySelectorAll('.emp-logo')].filter((i) => i.offsetParent).map((i) => ({ h: Math.round(i.getBoundingClientRect().height), src: i.getAttribute('src') }));
      const text = document.querySelector('.rz-foot').innerText;
      const gap = Math.max(...[...document.querySelectorAll('.emp-card')].map((c) => { const b = c.querySelector('.emp-front .emp-btn').getBoundingClientRect(), l = c.querySelector('.emp-front .emp-skills').getBoundingClientRect(); return Math.round(b.top - l.bottom); }));
      return { sw: document.documentElement.scrollWidth, cols, gap, logos, mark: m.getBoundingClientRect().width, box: f.clientWidth - parseFloat(fs.paddingLeft) - parseFloat(fs.paddingRight),
        links: [...document.querySelectorAll('.rz-foot a')].map((a) => a.getAttribute('href')), text, html: document.documentElement.outerHTML.includes('ALL OPERATIONAL DATASETS') || document.documentElement.outerHTML.includes('BUILT FOR MISSION CRITICAL') };
    }, w);
    if (w === 390) {
      check(r.sw <= 390, `L3 ${theme} 390: no horizontal scroll (scrollWidth ${r.sw})`);
      check(r.cols === 1, `L3 ${theme} 390: cards in one column (${r.cols} column x-positions)`);
      check(r.gap <= 40, `L3 ${theme} 390: a card is as tall as its shown face (largest empty band above the Details button ${r.gap} px)`);
    }
    check(r.logos.length === 5 && r.logos.every((l) => l.h >= 56 && /\.svg(\?|$)/.test(l.src)), `L3 ${theme} ${w}: 5 logos shown, each >= 56 px and a vector — ${r.logos.map((l) => l.h).join(',')}`);
    check(Math.abs(r.mark - r.box) <= 2, `L5 ${w}: wordmark ${r.mark.toFixed(0)} px = footer box ${r.box.toFixed(0)} px`);
    if (w === 1440) {
      const bad = r.links.filter((h) => !(/^(mailto:|https:\/\/|#)/.test(h) || existsSync(resolve(ROOT, decodeURI(h.split('#')[0])))));
      check(bad.length === 0, `L5 all ${r.links.length} footer links resolve${bad.length ? ' — ' + bad.join(',') : ''}`);
      const banned = /\+?\d[\d\s-]{8,}\d|Jl\.|Jalan|street|open to|available for|hire|let's talk|contact us/i;
      check(!banned.test(r.text), `L5 footer carries no phone, address or availability copy`);
      check(!r.html, 'L5 the old mono slogan is gone');
    }
    await p.close();
  }
} finally { await browser.close(); }
console.log(fail ? `FAIL — ${fail} R079 law(s) broken` : 'PASS — the R079 homepage laws hold on the rendered page');
process.exit(fail ? 1 : 0);
