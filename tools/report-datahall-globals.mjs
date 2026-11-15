#!/usr/bin/env node
// PRD-P09 FR-P09-1 — the cross-block global map of datahallAI.html, required before any block moves to a tab module.
// For every inline <script> block: the top-level names it DEFINES (function/var/let/const/class declarations at program
// level, `var` hoisted out of top-level blocks, assignments to undeclared names, `window.X = …`) and the free names it
// READS (identifiers not declared in any enclosing scope of the block, plus `window.X` reads). A read is a cross-block
// dependency when another inline block defines the name; everything else is a builtin or comes from an external script.
// Analysis only: the two optional-chaining operators (`?.`, `??`) are rewritten to `.`/`||` in a copy so esprima parses
// it; identifiers are unchanged.
// Run: node tools/report-datahall-globals.mjs [--json=<path>] [--md=<path>] [--check]
//   --check  exits 1 when the committed report does not match the current page (stale report = no move allowed).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const esprima = require('esprima');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'datahallAI.html';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OUT_JSON = arg('json', 'documentation/product-transformation/05-test-evidence/P09-global-map.json');
const OUT_MD = arg('md', 'documentation/product-transformation/05-test-evidence/P09-global-map.md');

export function inlineBlocks(html) {
  const out = [], re = /<script(\b[^>]*)>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) {
    if (/\bsrc=|type="application\/(ld\+)?json"/.test(m[1])) continue;
    out.push({ line: html.slice(0, m.index).split('\n').length, code: m[2] });
  }
  return out;
}

// ---- scope analysis ----
function Scope(parent, fn) { return { parent, fn, names: new Set() }; }
function fnScope(s) { while (!s.fn) s = s.parent; return s; }
function declares(s, n) { for (; s; s = s.parent) if (s.names.has(n)) return true; return false; }
function patternNames(p, out) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach((q) => patternNames(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach((q) => patternNames(q, out));
  else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
  else if (p.type === 'RestElement') patternNames(p.argument, out);
  return out;
}
const CHILD_SKIP = new Set(['type', 'range', 'loc', 'leadingComments', 'trailingComments']);
function children(n) { const out = []; for (const k in n) { if (CHILD_SKIP.has(k)) continue; const v = n[k]; if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && out.push(x)); else if (v && typeof v.type === 'string') out.push(v); } return out; }

// pass 1: hoist declarations into their scopes (keyed by node)
function hoist(node, scope, map) {
  const visit = (n, s) => {
    if (!n) return;
    switch (n.type) {
      case 'FunctionDeclaration': {
        s.names.add(n.id.name);
        const fs = Scope(s, true); map.set(n, fs);
        n.params.forEach((p) => patternNames(p, []).forEach((x) => fs.names.add(x)));
        visit(n.body, fs); return;
      }
      case 'FunctionExpression': case 'ArrowFunctionExpression': {
        const fs = Scope(s, true); map.set(n, fs);
        if (n.id) fs.names.add(n.id.name);
        n.params.forEach((p) => patternNames(p, []).forEach((x) => fs.names.add(x)));
        visit(n.body, fs); n.params.forEach((p) => visit(p, fs)); return;
      }
      case 'VariableDeclaration': {
        const tgt = n.kind === 'var' ? fnScope(s) : s;
        n.declarations.forEach((d) => { patternNames(d.id, []).forEach((x) => tgt.names.add(x)); visit(d.init, s); });
        return;
      }
      case 'ClassDeclaration': s.names.add(n.id.name); children(n).forEach((c) => visit(c, s)); return;
      case 'CatchClause': { const cs = Scope(s, false); map.set(n, cs); patternNames(n.param, []).forEach((x) => cs.names.add(x)); visit(n.body, cs); return; }
      case 'BlockStatement': case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': case 'SwitchStatement': {
        if (map.has(n)) return; const bs = Scope(s, false); map.set(n, bs); children(n).forEach((c) => visit(c, bs)); return;
      }
      default: children(n).forEach((c) => visit(c, s));
    }
  };
  children(node).forEach((c) => visit(c, scope));
}

// pass 2: free references + implicit/explicit global writes
function resolveRefs(node, scope, map, acc) {
  const ref = (name, s, write, at) => { if (!declares(s, name)) { (write ? acc.writes : acc.reads).add(name); if (write && at && !acc.writeAt[name]) acc.writeAt[name] = at.line; } };
  const visit = (n, s, parent, key) => {
    if (!n) return;
    const sc = map.get(n) || s;
    switch (n.type) {
      case 'Identifier':
        if (parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
            (parent.type === 'Property' && key === 'key' && !parent.computed) || (parent.type === 'MethodDefinition' && key === 'key') ||
            ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label'))) return;
        ref(n.name, s, false); return;
      case 'AssignmentExpression':
        if (n.left.type === 'Identifier') ref(n.left.name, s, true, n.loc && n.loc.start);
        else if (n.left.type === 'MemberExpression' && !n.left.computed && n.left.object.type === 'Identifier' && /^(window|self|globalThis)$/.test(n.left.object.name)) acc.winWrites.add(n.left.property.name);
        else visit(n.left, sc, n, 'left');
        visit(n.right, sc, n, 'right'); return;
      case 'MemberExpression':
        if (!n.computed && n.object.type === 'Identifier' && /^(window|self|globalThis)$/.test(n.object.name)) acc.winReads.add(n.property.name);
        break;
      case 'VariableDeclarator': visit(n.init, sc, n, 'init'); return;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': visit(n.body, sc, n, 'body'); n.params.forEach((p) => p.type === 'AssignmentPattern' && visit(p.right, sc, p, 'right')); return;
      case 'ClassDeclaration': case 'ClassExpression': visit(n.superClass, sc, n, 'superClass'); visit(n.body, sc, n, 'body'); return;
      case 'CatchClause': visit(n.body, sc, n, 'body'); return;
    }
    for (const k in n) { if (CHILD_SKIP.has(k)) continue; const v = n[k];
      if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && visit(x, sc, n, k));
      else if (v && typeof v.type === 'string') visit(v, sc, n, k); }
  };
  children(node).forEach((c) => visit(c, scope, node, 'body'));
}

export function analyse(code) {
  const src = code.replace(/\?\.(?=[A-Za-z_$(\[])/g, '.').replace(/\?\?/g, '||');
  const ast = esprima.parseScript(src, { loc: true });
  const top = Scope(null, true), map = new Map();
  hoist(ast, top, map);
  const acc = { reads: new Set(), writes: new Set(), winReads: new Set(), winWrites: new Set(), writeAt: {} };
  resolveRefs(ast, top, map, acc);
  const defines = new Set([...top.names, ...acc.writes, ...acc.winWrites]);
  const reads = new Set([...acc.reads, ...acc.winReads].filter((n) => !defines.has(n)));
  return { defines: [...defines].sort(), reads: [...reads].sort(), implicit: Object.keys(acc.writeAt).sort().map((n) => ({ name: n, line: acc.writeAt[n] })) };
}

export function globalMap(html) {
  const blocks = inlineBlocks(html).map((b, i) => ({ id: 'B' + (i + 1), line: b.line, bytes: Buffer.byteLength(b.code), ...analyse(b.code) }));
  const owner = {};
  blocks.forEach((b) => b.defines.forEach((n) => { (owner[n] = owner[n] || []).push(b.id); }));
  blocks.forEach((b) => {
    b.uses = {}; b.external = [];
    b.reads.forEach((n) => { const o = (owner[n] || []).filter((x) => x !== b.id); if (o.length) o.forEach((x) => { (b.uses[x] = b.uses[x] || []).push(n); }); else if (!owner[n]) b.external.push(n); });
  });
  const multi = Object.keys(owner).filter((n) => owner[n].length > 1).sort().map((n) => ({ name: n, blocks: owner[n] }));
  const inline = inlineBlocks(html).map((b) => b.code).join('\u0000');
  return { page: PAGE, sha256: createHash('sha256').update(inline).digest('hex').slice(0, 16), blocks, definedInMoreThanOneBlock: multi };
}

function md(r) {
  const L = [`# P09 global map — ${r.page}`, '', `Generated by \`tools/report-datahall-globals.mjs\` (FR-P09-1). Inline code hash \`${r.sha256}\`; a stale map fails \`--check\`.`, '',
    '| Block | Line | Bytes | Defines | Reads (free) | Uses from other blocks |', '|---|---:|---:|---:|---:|---|'];
  r.blocks.forEach((b) => L.push(`| ${b.id} | ${b.line} | ${b.bytes.toLocaleString('en-US')} | ${b.defines.length} | ${b.reads.length} | ${Object.keys(b.uses).map((k) => `${k}: ${b.uses[k].length}`).join(', ') || '—'} |`));
  L.push('', '## Cross-block reads (the names a move must keep reachable)', '');
  r.blocks.forEach((b) => Object.keys(b.uses).forEach((k) => L.push(`- ${b.id} ← ${k}: ${b.uses[k].map((n) => '`' + n + '`').join(', ')}`)));
  L.push('', '## Implicit globals (assignment to an undeclared name)', '');
  const imp = r.blocks.flatMap((b) => (b.implicit || []).map((i) => `- \`${i.name}\` in ${b.id}, page line ${b.line + i.line}`));
  L.push(...(imp.length ? imp : ['none']));
  L.push('', '## Names defined by more than one block', '');
  if (!r.definedInMoreThanOneBlock.length) L.push('none');
  r.definedInMoreThanOneBlock.forEach((x) => L.push(`- \`${x.name}\`: ${x.blocks.join(', ')}`));
  return L.join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = globalMap(readFileSync(join(ROOT, PAGE), 'utf8'));
  const json = JSON.stringify(r, null, 1) + '\n';
  if (process.argv.includes('--check')) {
    const have = existsSync(join(ROOT, OUT_JSON)) ? readFileSync(join(ROOT, OUT_JSON), 'utf8') : '';
    if (have !== json) { console.error(`FAIL report-datahall-globals — ${OUT_JSON} is stale or missing (page inline hash ${r.sha256}); rerun without --check`); process.exit(1); }
    console.log(`PASS report-datahall-globals — map fresh (${r.blocks.length} blocks, hash ${r.sha256})`); process.exit(0);
  }
  writeFileSync(join(ROOT, OUT_JSON), json); writeFileSync(join(ROOT, OUT_MD), md(r));
  console.log(`wrote ${OUT_JSON} + ${OUT_MD}: ${r.blocks.length} blocks, ${r.definedInMoreThanOneBlock.length} names defined twice`);
  r.blocks.forEach((b) => console.log(`  ${b.id} L${b.line} ${b.bytes} B defines ${b.defines.length} reads ${b.reads.length} uses ${JSON.stringify(Object.fromEntries(Object.entries(b.uses).map(([k, v]) => [k, v.length])))}`));
}
