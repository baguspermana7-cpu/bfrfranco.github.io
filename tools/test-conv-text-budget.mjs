#!/usr/bin/env node
/**
 * test-conv-text-budget.mjs — PRD-CONV-REDRAW law T: the Conventional cockpits show the drawing, numbers and
 * states at rest; explanation lives in tooltips, the basis drawer and modals (owner 2026-11-14: "terlalu banyak
 * tulisan … ingat pakai tooltip, traceable dan modal, jangan semua tulisan ada disini").
 *
 * Measured on the RENDER at 1440 px, dark theme, authorized audit state, after the page settles:
 *   prose   — visible elements outside <svg>, dialogs, tooltips and drawers whose OWN text (direct text nodes) has
 *             >= 10 words: a sentence sitting on the page. Law T1: 0.
 *   words   — visible words outside <svg>, dialogs, tooltips and drawers. Law T2: <= the page's budget.
 *   svg     — a <text> in a visible drawing with >= 6 words is a sentence inside the drawing. Law T4: 0.
 *   clipped — the main drawing is wider than the box that shows it at rest (scrollable or not). Law T3: 0.
 *   node tools/test-conv-text-budget.mjs              verdict against BUDGET (exit 1 on any breach)
 *   node tools/test-conv-text-budget.mjs --measure    print counts and the prose blocks, no verdict
 *   node tools/test-conv-text-budget.mjs --page=x.html
 */
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/* words budget per page: set from the redraw, never raised to pass */
export const BUDGET = {
  'datahall.html': 400, 'chiller-plant.html': 400, 'fire-system.html': 400,
  'fuel-system.html': 400, 'water-system.html': 400, 'ict.html': 400,
};
/* T4 ratchet while a drawing waits for its redraw: the count may fall, never rise.
   Empty since the W2 redraw (CH-M-101, 2026-11-14) took chiller-plant from 28 to 0. */
export const T4_RATCHET = {};
const args = process.argv.slice(2);
const MEASURE = args.includes('--measure');
const only = args.filter((a) => a.startsWith('--page=')).map((a) => a.slice(7));
const pages = only.length ? only : Object.keys(BUDGET);

export function inPage() {
  const SKIP = '[data-rz-provenance], svg, [role="dialog"], dialog, [role="tooltip"], .rz-tip, .rz-basis-drawer, #rz-basis-drawer, .rz-inspector, aside.rz-inspector, script, style, noscript, template';
  const vis = (el) => { const d = el.closest('details:not([open])'); if (d && !el.closest('summary')) return false; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const words = (s) => (s.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  let total = 0; const prose = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (el.closest(SKIP)) continue;
    let own = '';
    el.childNodes.forEach((c) => { if (c.nodeType === 3) own += c.textContent + ' '; });
    const w = words(own); if (!w || !vis(el)) continue;
    total += w;
    if (w >= 10) prose.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' · ' + own.trim().replace(/\s+/g, ' ').slice(0, 90));
  }
  const clipped = [];
  document.querySelectorAll('svg').forEach((s) => {
    const r = s.getBoundingClientRect(); if (r.width < 300 || r.height < 150) return;
    for (let n = s.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n); if (!/hidden|clip|auto|scroll/.test(cs.overflowX)) continue;
      /* a drawing wider than the box that shows it is cut at rest, even when the box scrolls:
         the reader sees part of the plant until they find the scrollbar */
      const nr = n.getBoundingClientRect();
      if (r.right > nr.right + 2 || r.left < nr.left - 2) clipped.push((s.id || 'svg') + ' cut by ' + (n.id || n.className || n.tagName) + ' (' + Math.round(r.width) + ' > ' + Math.round(nr.width) + ' px)');
      break;
    }
  });
  /* drawing text: words inside visible SVGs (labels, tags, values) — a P&ID carries tags and values, not sentences */
  let svgWords = 0; const svgProse = [];
  document.querySelectorAll('svg text').forEach((t) => { if (!vis(t) || t.closest('[role="dialog"], dialog')) return; const w = words(t.textContent); svgWords += w; if (w >= 6) svgProse.push('svg · ' + t.textContent.trim().slice(0, 80)); });
  return { total, prose, clipped, svgWords, svgProse };
}

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  let fails = 0;
  try {
    for (const p of pages) {
      const t = await browser.newPage(); await t.setViewport({ width: 1440, height: 900 });
      await primeCockpitAuditDocument(t, 'dark');
      await t.goto(pathToFileURL(join(ROOT, p)).href, { waitUntil: 'load' });
      await enterAuthorizedAuditState(t, p.replace(/\.html$/, ''));
      await new Promise((r) => setTimeout(r, 2000));
      const m = await t.evaluate(inPage); await t.close();
      const bad = [];
      if (m.prose.length) bad.push('T1 ' + m.prose.length + ' prose block(s)');
      if (m.total > BUDGET[p]) bad.push('T2 ' + m.total + ' words > ' + BUDGET[p]);
      const t4Allow = T4_RATCHET[p] || 0;
      if (m.svgProse.length > t4Allow) bad.push('T4 ' + m.svgProse.length + ' sentence(s) inside the drawing' + (t4Allow ? ' (ratchet ' + t4Allow + ')' : ''));
      else if (m.svgProse.length && !MEASURE) console.log('  MONITOR ' + p + ' T4 ' + m.svgProse.length + ' / ratchet ' + t4Allow + ' — falls to 0 with the W2 redraw');
      if (m.clipped.length) bad.push('T3 ' + m.clipped.join('; '));
      console.log((MEASURE ? '  ' : bad.length ? '  FAIL  ' : '  PASS  ') + p.padEnd(20) + ' words ' + String(m.total).padStart(5) + '  prose ' + m.prose.length + '  svgWords ' + String(m.svgWords).padStart(4) + '  svgSentences ' + m.svgProse.length + '  clipped ' + m.clipped.length + (MEASURE ? '' : bad.length ? ' — ' + bad.join(' | ') : ''));
      if (MEASURE) m.prose.concat(m.svgProse).slice(0, 60).forEach((s) => console.log('        ' + s));
      if (bad.length) fails++;
    }
  } finally { await browser.close(); }
  if (MEASURE) process.exit(0);
  console.log(fails ? `FAIL test-conv-text-budget — ${fails} page(s) over budget` : 'PASS test-conv-text-budget — 6 cockpits: no prose at rest, words within budget, drawings reachable');
  process.exit(fails ? 1 : 0);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
