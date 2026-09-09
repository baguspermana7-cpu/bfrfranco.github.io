#!/usr/bin/env node
/**
 * No rendered number may spill its raw float.
 *
 * The owner found `1497.2441888329738 L/m` and `992.6728971962617 kW` overflowing their boxes on
 * the CDU HMI, and `25.78698 °C` on a 2.8 px glyph in the hall drawing. One root cause behind the
 * panels: `js/datahall-ai/hmi-payloads.js` publishes two accessors per point — `P.v()` returns the
 * payload's own text at its declared precision, `P.n()` returns the RAW engine number for
 * arithmetic. Only simulated (`b.S`) points round their `value`; engine (`b.E`), authored (`b.D`)
 * and plane (`b.P`) points do not. Every spill was a renderer calling `P.n()` and concatenating a
 * unit onto it. The hall temperature was separate: `RZ_SIM('page3', …, 5)` passed five digits where
 * its three siblings pass one.
 *
 * THE TEST IS SIGNIFICANT DIGITS, NOT DECIMAL PLACES, AND THAT DISTINCTION IS LOAD-BEARING. A first
 * cut flagged anything past three decimals and immediately caught four VESDA obscuration readings
 * on the fire mimic — `0.0024 %/m`. Those are CORRECT: an aspirating detector is specified in the
 * 0.0015-0.02 %/m band, so four decimal places there carry two significant digits and are the real
 * instrument precision. Meanwhile 1497.2441888329738 carries seventeen. Decimal places measure the
 * wrong thing; significant digits separate a small quantity from a raw float. The ceiling is six —
 * no readout on an operator surface is known to more than six significant digits.
 *
 * RED baseline, measured before the v2.18.0 fix: 12 values across #cduHmi, #ctHmiModal and
 * #crahHmi at 11-14 decimal places, plus the hall cold-aisle sensors at 5.
 *
 * Usage: node tools/test-dcai-rendered-precision.mjs [--measure]
 */
import puppeteer from 'puppeteer';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'datahallAI.html';
const MEASURE = process.argv.includes('--measure');
const MAX_SIGNIFICANT = 6;

/* Any decimal quantity. A second dot (a version like 1.42.0) or an adjacent digit means it is not
   one, so both sides are guarded. */
const DECIMAL = /(?<![.\d])(\d+)\.(\d+)(?![.\d])/g;

/* Leading zeros carry no information: 0.0024 is two significant digits, not five. */
function significantDigits(intPart, fracPart) {
  const digits = (intPart + fracPart).replace(/^0+/, '');
  return digits.length;
}

function scanText(text) {
  const hits = [];
  let m;
  DECIMAL.lastIndex = 0;
  while ((m = DECIMAL.exec(text))) {
    if (significantDigits(m[1], m[2]) > MAX_SIGNIFICANT) hits.push(m[0]);
  }
  return hits;
}

/* Reported alongside, not policed: how many rendered values sit at the top of the allowed band. */
function countAtCeiling(text) {
  let n = 0, m;
  DECIMAL.lastIndex = 0;
  while ((m = DECIMAL.exec(text))) {
    if (significantDigits(m[1], m[2]) === MAX_SIGNIFICANT) n += 1;
  }
  return n;
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });
await primeCockpitAuditDocument(page, 'dark');
await page.goto(pathToFileURL(resolve(ROOT, PAGE)).href, { waitUntil: 'networkidle0' });
await enterAuthorizedAuditState(page, 'dc-ai');

const set = TAB_SETS[PAGE];
const findings = [];
let threeDp = 0;

async function harvest(where) {
  const rows = await page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el) continue;
      if (el.closest('script,style,template,[hidden]')) continue;
      const box = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (box && box.width < 1 && box.height < 1) continue;
      const t = (node.nodeValue || '').trim();
      if (t) out.push({ text: t.slice(0, 120), tag: el.tagName.toLowerCase(), id: el.id || (el.closest('[id]') || {}).id || '' });
    }
    return out;
  });
  for (const r of rows) {
    threeDp += countAtCeiling(r.text);
    for (const hit of scanText(r.text)) {
      findings.push({ where, hit, id: r.id, tag: r.tag, text: r.text });
    }
  }
}

/* every tab and sub-tab */
for (const entry of set.diagrams) {
  await activateTab(page, set, entry);
  await new Promise((r) => setTimeout(r, 120));
  await harvest(`tab:${entry.tab}${entry.sub ? '/' + entry.sub : ''}`);
}

/* every tier-2 modal, through its real opener */
const openers = await page.evaluate(() => Object.keys(window.RZDatahallAIHmiOpeners || {}));
for (const name of openers) {
  const opened = await page.evaluate(async (n) => {
    const fn = (window.RZDatahallAIHmiOpeners || {})[n];
    if (typeof fn !== 'function') return false;
    try { fn(1); } catch (e) { return false; }
    return true;
  }, name);
  if (!opened) continue;
  await new Promise((r) => setTimeout(r, 300));
  await harvest(`modal:${name}`);
  await page.evaluate(() => {
    const el = document.querySelector('.dh-modal-host.show');
    if (el) el.classList.remove('show');
  });
  await new Promise((r) => setTimeout(r, 80));
}

await browser.close();

const distinct = new Map();
for (const f of findings) {
  const key = f.where + '|' + f.hit;
  if (!distinct.has(key)) distinct.set(key, f);
}

console.log(`── RENDERED PRECISION — ${PAGE} ──`);
console.log(`values at the ${MAX_SIGNIFICANT}-significant-digit ceiling (allowed, informational): ${threeDp}`);
if (!distinct.size) {
  console.log(`PASS — no rendered numeral carries more than ${MAX_SIGNIFICANT} significant digits`);
  process.exit(0);
}
for (const f of distinct.values()) {
  console.log(`  ✗ ${f.where.padEnd(20)} ${f.hit.padEnd(24)} ${f.id ? '#' + f.id + ' ' : ''}${f.text}`);
}
console.log(`── ${distinct.size} distinct over-precise value(s) across ${new Set([...distinct.values()].map((f) => f.where)).size} view(s)`);
console.log('A display site must use the payload text accessor P.v()/P.u(), not the raw P.n().');
process.exit(MEASURE ? 0 : 1);
