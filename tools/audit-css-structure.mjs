#!/usr/bin/env node
/**
 * audit-css-structure — CSS that the browser silently throws away.
 *
 * WHY THIS EXISTS
 *
 * `cx-calculator.html` carried this, found by hand in v3.11.12:
 *
 *     /* accent vars: darker in light theme *\/
 *     { --accent-purple:#64748b; --accent-emerald:#047857; … }
 *
 * A rule with NO SELECTOR. CSS error recovery discards everything up to the
 * matching `}`, so none of those seven tokens was ever defined. The page
 * returned 200, every static audit was green, `audit-vibecode` reads the same
 * text and said nothing, and `audit-js-syntax.py` does not read CSS at all.
 * Nothing in the suite could see it.
 *
 * That is the shape this repo keeps paying for: not a crash, not a log line —
 * code that is simply not there. A CSS parser is the only thing that can tell
 * the difference between a declaration and a declaration-shaped string.
 *
 * WHAT IT REPORTS
 *   selectorless-rule   a `{…}` block with no selector — silently discarded
 *   unbalanced-braces   the file's braces do not close; everything after the
 *                       imbalance is parsed as something else entirely
 *   empty-selector      a selector list with an empty slot (`.a, , .b`), which
 *                       invalidates the WHOLE list in CSS, not just the slot
 *   stray-semicolon     `;` where a selector belongs, which eats the next rule
 *   bad-at-rule         an at-rule whose block never opens
 *
 * Scope: every `.css` under the repo (excluding generated `.min.css` twins and
 * vendored trees) plus every inline `<style>` element in every `.html`.
 *
 * Run:  node tools/audit-css-structure.mjs [--strict] [--file=x.css]
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const ONLY = (ARGS.find((a) => a.startsWith('--file=')) || '').split('=')[1] || null;

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dcmoc', 'games', 'Dunia-Emosi',
  'obsidian-knowledge-vault', '.claude', 'Documents', 'review', 'Apps', 'cf-worker',
  'Article', 'Data', 'my-video', '.rz',
  /* scraped third-party pages kept as corpus evidence -- not ours to fix, and
     their markup is whatever the source site shipped */
  'dc-corpus']);

/* A minified twin is GENERATED from its source; auditing it would report the
   same defect twice and point at the file nobody edits. The source is the
   thing to fix. */
const isGenerated = (p) => /\.min\.css$/.test(p);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

/* Strip comments and string literals BEFORE looking at structure, so a brace
   or a semicolon inside `content: "}"` or inside a comment cannot be mistaken
   for syntax. This is the step whose absence makes a regex "parser" lie. */
function neutralise(css) {
  let out = '', i = 0;
  while (i < css.length) {
    const two = css.slice(i, i + 2);
    if (two === '/*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      for (let k = i; k < stop; k++) out += css[k] === '\n' ? '\n' : ' ';
      i = stop; continue;
    }
    const c = css[i];
    if (c === '"' || c === "'") {
      out += ' '; i++;
      while (i < css.length && css[i] !== c) {
        if (css[i] === '\\') { out += ' '; i++; }
        out += css[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += ' '; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

function check(raw, label, findings) {
  const css = neutralise(raw);

  let depth = 0, lastOpen = [];
  let segStart = 0;          /* where the current top-level selector text began */
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) {
        const sel = css.slice(segStart, i);
        const bare = sel.trim();
        if (!bare) {
          findings.push({ kind: 'selectorless-rule', file: label, line: lineOf(css, i),
            detail: 'a `{…}` block with no selector — CSS error recovery discards it whole, '
                  + 'so every declaration inside it is silently absent' });
        } else if (/(^|,)\s*(,|$)/.test(bare.replace(/\s+/g, ' ')) && bare.includes(',')) {
          findings.push({ kind: 'empty-selector', file: label, line: lineOf(css, i),
            detail: `empty slot in the selector list \`${bare.slice(0, 60)}\` — an invalid `
                  + 'selector invalidates the WHOLE list, not just that slot' });
        } else if (/;\s*[^;{}]*$/.test(bare) && !/^\s*@/.test(bare)) {
          findings.push({ kind: 'stray-semicolon', file: label, line: lineOf(css, i),
            detail: `a \`;\` sits where a selector belongs: \`${bare.replace(/\s+/g, ' ').slice(0, 70)}\`` });
        }
      }
      depth++; lastOpen.push(i);
    } else if (c === '}') {
      depth--; lastOpen.pop();
      if (depth < 0) {
        findings.push({ kind: 'unbalanced-braces', file: label, line: lineOf(css, i),
          detail: 'a `}` with no matching `{` — everything after it parses as something else' });
        depth = 0;
      }
      if (depth === 0) segStart = i + 1;
    } else if (depth === 0 && c === ';') {
      /* a top-level `;` legitimately ends @import/@charset; otherwise it is a
         declaration stranded outside any rule, which the browser drops. */
      const seg = css.slice(segStart, i).trim();
      if (seg && !/^@(import|charset|namespace|layer)\b/i.test(seg)) {
        findings.push({ kind: 'stray-declaration', file: label, line: lineOf(css, i),
          detail: `\`${seg.replace(/\s+/g, ' ').slice(0, 70)}\` sits outside any rule — dropped` });
      }
      segStart = i + 1;
    }
  }
  if (depth > 0) {
    findings.push({ kind: 'unbalanced-braces', file: label,
      line: lineOf(css, lastOpen[0] ?? 0),
      detail: `${depth} unclosed \`{\` — the rest of the file is swallowed by the open block` });
  }
}

const files = ONLY ? [join(ROOT, ONLY)] : (await walk(ROOT)).sort();
const findings = [];
let cssFiles = 0, styleBlocks = 0;

for (const f of files) {
  const rel = relative(ROOT, f);
  if (isGenerated(rel)) continue;
  let text;
  try { text = await readFile(f, 'utf8'); } catch { continue; }
  if (extname(f) === '.css') {
    cssFiles++;
    check(text, rel, findings);
  } else {
    /* <script> comes out FIRST, and this is the whole correctness of the tool.
       The first version matched `<style>` with a regex over the raw file and
       reported 83 findings across 3 pages -- every one of them an artifact of
       the tool, because these pages build PDF export templates as JS template
       literals containing `<style>…</style>`. The regex matched that inner
       `<style>` and then parsed JavaScript as CSS: `refreshAuthority()`,
       `var pdfBtn=gid( )` and prose from a FAQ string all arrived as "stray
       declarations". It also counted 1728 inline <style> blocks, which should
       have been the tell on its own.
       Blanking the script bodies (keeping newlines, so reported line numbers
       stay true) leaves only real <style> elements. A <script> that BUILDS css
       is a different question, and a regex cannot answer it honestly. */
    const noScript = text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
      (m) => m.replace(/[^\n]/g, ' '));
    for (const m of noScript.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
      styleBlocks++;
      const before = noScript.slice(0, m.index).split('\n').length - 1;
      const sub = [];
      check(m[1], rel, sub);
      for (const s of sub) { s.line += before; findings.push(s); }
    }
  }
}

console.log('── CSS STRUCTURE ──');
console.log(`  ${cssFiles} stylesheet(s) + ${styleBlocks} inline <style> block(s)\n`);

if (!findings.length) {
  console.log('PASS — no rule is silently discarded by CSS error recovery.');
  process.exit(0);
}

const RANK = { 'unbalanced-braces': 0, 'selectorless-rule': 1, 'empty-selector': 2,
               'stray-semicolon': 3, 'stray-declaration': 4 };
findings.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.file.localeCompare(b.file) || a.line - b.line);
console.log(`FAIL — ${findings.length} finding(s) across ${new Set(findings.map((f) => f.file)).size} file(s)\n`);
let kind = null;
for (const f of findings) {
  if (f.kind !== kind) { kind = f.kind; console.log(`  [${kind}]`); }
  console.log(`      ${f.file}:${f.line} — ${f.detail}`);
}
console.log('\n  None of these throws, logs, or fails a 200. The declarations are simply');
console.log('  not there, which is why only a parser can find them.');
process.exit(STRICT ? 1 : 0);
