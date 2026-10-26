#!/usr/bin/env node
// Share bar contract, static. Two defects shipped unseen (found 2026-10-26):
//   1. 15 articles carried a share bar with no script to add `.visible`, so it stayed at
//      opacity 0 forever (styles.css hides .share-buttons until then).
//   2. article-29 and article-30 hard-coded article-28's URL and title, so sharing them
//      shared a different article.
// Rules: a .share-buttons element must either be visible by markup (class "visible"), be
// deliberately removed (display:none on its id), or the page must toggle `visible` on it;
// on a page that loads styles.css; and any literal shareUrl must be the page's own canonical.
import { readdirSync, readFileSync } from 'fs';

const pages = readdirSync('.').filter(f => f.endsWith('.html')).sort();
const fails = [];
let bars = 0;
for (const f of pages) {
  const s = readFileSync(f, 'utf8');
  const tag = s.match(/<(?:aside|div|nav)\b[^>]*class="share-buttons[^"]*"[^>]*>/);
  // Only styles.css hides .share-buttons until `.visible`; a page that does not load it
  // (the generated incident dossiers) lays the bar out inline and is always visible.
  const hiddenByDefault = /href="styles(?:\.min)?\.css/.test(s);
  if (tag && hiddenByDefault) {
    bars++;
    const id = (tag[0].match(/\bid="([^"]+)"/) || [])[1];
    const staticVisible = /class="share-buttons[^"]*\bvisible\b/.test(tag[0]);
    const removed = id && new RegExp('#' + id + '[^{]*\\{[^}]*display:\\s*none').test(s);
    // the toggle must sit in a script that references THIS bar — article-24 passed a looser
    // check on an unrelated `el('dcjProInputs').classList.add('visible')`
    const ref = id ? new RegExp(`getElementById\\(\\s*['"]${id}['"]|#${id}\\b`) : /['"]\.share-buttons['"]/;
    const toggled = [...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].some(m =>
      ref.test(m[1]) && /classList\.(?:toggle|add)\(\s*['"]visible['"]/.test(m[1]));
    if (!staticVisible && !removed && !toggled) fails.push(`${f}: share bar never receives .visible (stays at opacity 0)`);
  }
  const lit = s.match(/shareUrl\s*=\s*['"](https?:\/\/[^'"]+)['"]/);
  if (lit) {
    const canon = (s.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (canon && lit[1] !== canon) fails.push(`${f}: shareUrl ${lit[1]} is not this page (${canon})`);
  }
}
if (fails.length) {
  console.log(`SHARE BAR — ${fails.length} defect(s) across ${bars} bars`);
  for (const l of fails) console.log('  ✗ ' + l);
  process.exit(1);
}
console.log(`SHARE BAR — PASS: ${bars} bars all become visible, no page shares another page's URL`);
