#!/usr/bin/env node
/**
 * extract-calc-ids — list every id / selector a calculator page's OWN JavaScript targets.
 * Sources: the page's inline <script> blocks plus its own external local scripts (js/fire-engine.js,
 * js/fire-model.js, js/script.min.js for tco ...). Shared site scripts (rz-*.js, auth.js, rz-engine.min.js,
 * rz-tracker.js) are excluded: they target their own ids defensively and are not part of the page contract.
 *
 *   ids        ids targeted by getElementById('x') / querySelector('#x') / $('#x') / $$('#x') / jQuery('#x')
 *   dynamic    the subset the JS itself creates (id="x" in a template string, el.id = 'x'): not in the static HTML by design
 *   selectors  every other selector string handed to querySelector(All) / $ / closest / matches (classes, attributes, combinators)
 *
 * Usage: node tools/extract-calc-ids.mjs <page.html> [--root=<dir>]   -> JSON on stdout
 * Library: import { extractCalcIds } from './extract-calc-ids.mjs'
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = /^(?:js\/rz-[\w.-]+|auth(?:\.min)?\.js|rz-[\w.-]+\.js|sw[\w.-]*\.js|js\/rz-engine\.min\.js)$/;

export function extractCalcIds(page, root = resolve(HERE, '..')) {
  const html = readFileSync(join(root, page), 'utf8');
  const sources = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
    const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!src) { sources.push({ name: 'inline', text: m[2] }); continue; }
    if (/^https?:/.test(src)) continue;
    const clean = src.split('?')[0];
    if (SHARED.test(clean)) continue;
    const f = join(root, clean);
    if (existsSync(f)) sources.push({ name: clean, text: readFileSync(f, 'utf8') });
  }
  const ids = new Set(), dyn = new Set(), sels = new Set();
  const ID = '[A-Za-z_][\\w:.-]*';
  const q = (s) => s.replace(/\\(['"`])/g, '$1');
  for (const { text } of sources) {
    for (const m of text.matchAll(new RegExp(`getElementById\\(\\s*(['"\`])(${ID})\\1\\s*\\)`, 'g'))) ids.add(m[2]);
    for (const m of text.matchAll(/\b(?:querySelector(?:All)?|\$\$?|jQuery|closest|matches)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      const sel = q(m[2]).trim();
      if (!sel || sel.includes('${')) continue;
      const only = sel.match(new RegExp(`^#(${ID})$`));
      if (only) ids.add(only[1]);
      else {
        sels.add(sel);
        for (const x of sel.matchAll(new RegExp(`#(${ID})`, 'g'))) ids.add(x[1]);
      }
    }
    for (const m of text.matchAll(new RegExp(`\\bid\\s*=\\s*\\\\?["']\\\\?(${ID})\\\\?["']`, 'g'))) dyn.add(m[1]);
    for (const m of text.matchAll(new RegExp(`\\.id\\s*=\\s*(['"\`])(${ID})\\1`, 'g'))) dyn.add(m[2]);
    for (const m of text.matchAll(new RegExp(`setAttribute\\(\\s*['"]id['"]\\s*,\\s*(['"\`])(${ID})\\1`, 'g'))) dyn.add(m[2]);
  }
  // helpers like `function $(id){return document.getElementById(id)}` hide the literal: any quoted token or object key in the
  // JS that equals an id present in the page's own HTML is a binding too (fire: ['inVol','inArea'].forEach, {inVol:500})
  const htmlIds = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
  for (const { text } of sources) {
    for (const m of text.matchAll(/(['"`])([A-Za-z_][\w:.-]*)\1|\b([A-Za-z_]\w*)\s*:/g)) {
      const t = m[2] || m[3];
      if (htmlIds.has(t)) ids.add(t);
    }
  }
  const idList = [...ids].sort();
  return { page, sources: sources.map((s) => s.name), ids: idList, dynamic: idList.filter((i) => dyn.has(i)), selectors: [...sels].sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const page = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const rootArg = (process.argv.find((a) => a.startsWith('--root=')) || '').slice(7);
  if (!page) { console.error('usage: extract-calc-ids.mjs <page.html> [--root=dir]'); process.exit(2); }
  console.log(JSON.stringify(extractCalcIds(page, rootArg ? resolve(rootArg) : undefined), null, 1));
}
