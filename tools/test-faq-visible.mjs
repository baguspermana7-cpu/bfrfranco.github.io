#!/usr/bin/env node
/* FAQ visibility gate (PRD-X-DEFECTS FR-X7B.1, law L-X7.2).
 *
 *   node tools/test-faq-visible.mjs [--json] [--file <page.html> ...] | --self-test
 *
 * Every Question.name inside an FAQPage (top level, in an array, or inside @graph) on every page listed in
 * sitemap.xml must appear in that page's visible text. Visible text = the HTML minus <script>, <style>, <template>,
 * <noscript> and comments, tags stripped, entities decoded, whitespace collapsed, curly quotes folded to straight.
 * A JSON-LD block that does not parse is a failure. Exit: 0 clean, 1 hidden questions or unparseable blocks, 2 usage.
 * --fix (FR-X7B.2) is deliberately absent until the owner decides D-XDEF-1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://resistancezero.com/';

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"',
  ldquo: '"', ndash: '–', mdash: '—', hellip: '…', middot: '·', deg: '°', times: '×', copy: '©', reg: '®' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function norm(s) {
  return decodeEntities(String(s))
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

export function visibleText(html) {
  return norm(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function faqQuestions(node, out) {
  if (Array.isArray(node)) { node.forEach((n) => faqQuestions(n, out)); return out; }
  if (!node || typeof node !== 'object') return out;
  const t = node['@type'];
  if (t === 'FAQPage' || (Array.isArray(t) && t.includes('FAQPage'))) {
    const me = node.mainEntity;
    for (const q of Array.isArray(me) ? me : me ? [me] : []) if (q && typeof q.name === 'string') out.push(q.name);
  }
  if (node['@graph']) faqQuestions(node['@graph'], out);
  return out;
}

export function scanHtml(html) {
  const questions = [];
  const errors = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { faqQuestions(JSON.parse(m[1]), questions); } catch (e) { errors.push('unparseable JSON-LD'); }
  }
  const text = visibleText(html);
  const hidden = questions.filter((q) => !text.includes(norm(q)));
  return { questions, hidden, errors };
}

function sitemapFiles() {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const files = [];
  for (const [, loc] of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    if (!loc.startsWith(SITE)) continue;
    let rel = decodeURIComponent(loc.slice(SITE.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (!rel.endsWith('.html') && fs.existsSync(path.join(ROOT, rel + '.html'))) rel += '.html';
    if (fs.existsSync(path.join(ROOT, rel))) files.push(rel);
  }
  return [...new Set(files)];
}

/* Fixtures (PRD T-6a): entities, curly quotes, @graph, an array of blocks, an unparseable block. */
function selfTest() {
  const ld = (o) => `<script type="application/ld+json">${typeof o === 'string' ? o : JSON.stringify(o)}</script>`;
  const faq = (...names) => ({ '@type': 'FAQPage', mainEntity: names.map((name) => ({ '@type': 'Question', name })) });
  const cases = [
    ['entity in page, plain in JSON', ld(faq('What is R&D cost?')) + '<p>What is R&amp;D cost?</p>', 0, 0],
    ['curly quote in page', ld(faq("What's PUE?")) + '<h3>What\u2019s PUE?</h3>', 0, 0],
    ['question only in JSON-LD', ld(faq('Hidden one?')) + '<p>nothing</p>', 1, 0],
    ['inside @graph', ld({ '@graph': [{ '@type': 'WebPage' }, faq('Graph Q?')] }), 1, 0],
    ['top-level array', ld([faq('Arr Q?')]) + '<p>Arr  Q?</p>', 0, 0],
    ['question inside a script only', ld(faq('Script Q?')) + '<script>var s="Script Q?"</script>', 1, 0],
    ['unparseable block', '<script type="application/ld+json">{bad</script>', 0, 1],
  ];
  let fail = 0;
  for (const [name, html, wantHidden, wantErr] of cases) {
    const r = scanHtml(html);
    const ok = r.hidden.length === wantHidden && r.errors.length === wantErr;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: hidden ${r.hidden.length}/${wantHidden}, errors ${r.errors.length}/${wantErr}`);
  }
  console.log(`self-test: ${cases.length - fail}/${cases.length}`);
  return fail ? 1 : 0;
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const json = argv.includes('--json');
  const fi = argv.indexOf('--file');
  for (const a of argv) if (a.startsWith('--') && !['--json', '--file', '--self-test'].includes(a)) {
    console.error('usage: unknown argument ' + a); return 2;
  }
  const files = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : sitemapFiles();
  const rows = [];
  for (const f of files) {
    const r = scanHtml(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    if (r.hidden.length || r.errors.length) rows.push({ file: f, ...r });
  }
  const hiddenQ = rows.reduce((n, r) => n + r.hidden.length, 0);
  const bad = rows.filter((r) => r.hidden.length).length;
  const unparseable = rows.reduce((n, r) => n + r.errors.length, 0);
  if (json) console.log(JSON.stringify(rows.map((r) => ({ file: r.file, hidden: r.hidden, total: r.questions.length,
    errors: r.errors })), null, 2));
  else for (const r of rows) {
    if (r.hidden.length) console.log(`HIDDEN ${r.file} ${r.hidden.length}/${r.questions.length} first="${r.hidden[0].slice(0, 80)}"`);
    for (const e of r.errors) console.log(`ERROR ${r.file} ${e}`);
  }
  (json ? console.error : console.log)(`test-faq-visible: ${files.length} pages scanned, ${bad} pages with ${hiddenQ} hidden questions, ${unparseable} unparseable blocks`);
  return hiddenQ || unparseable ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
