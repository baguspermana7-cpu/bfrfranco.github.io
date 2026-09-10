#!/usr/bin/env node
/**
 * The shared PDF document shell, and who uses it.
 *
 * Owner comment (22): "export to PDF with a mature template, partial or whole", starting from
 * cdu-checklist.html but required across all the engines.
 *
 * Measured on 2026-09-10, before js/rz-pdf-export.js existed: 24 pages offered a PDF and 21 of
 * them were a bare `onclick="window.print()"` — no cover, no provenance, no section choice, and
 * whatever the screen stylesheet happened to do at print size. The three that built a real
 * document each built it again from scratch. js/rz-design-studio.js already shared the DIALOG
 * half; the document half was not shared by anything.
 *
 * This gate holds three things:
 *
 *   1. THE SHELL FOLLOWS THE STANDARD, NOT TASTE. Its palette is the table in
 *      standarization/PDF_EXPORT_STANDARD.md and its skeleton is that document's structure
 *      template. Body ink is fixed, because the standard says in capitals never to set body text
 *      to the muted greys and a shared shell is the place to make that impossible.
 *
 *   2. A PARTIAL EXPORT SAYS SO. "Partial or whole" is only safe if the whole and the part are
 *      distinguishable afterwards, so a document issued with sections removed must name what is
 *      missing rather than quietly ending early.
 *
 *   3. THE ESCAPE RULE HOLDS. The standard records the 2026-05-09 incident where an unescaped
 *      `</script>` inside a JS-built print template terminated the PARENT document's script block
 *      and broke five calculator pages.
 *
 * MONITOR, with the number recorded: 19 pages still call window.print() directly rather than
 * issuing through the shared shell. FLIP CONDITION: this becomes a gate when that count reaches
 * zero. It is not a gate today because converting a page is a per-page design decision — the
 * shell needs to know that page's sections and provenance — and a gate that fails on twenty
 * pages would be answered by weakening it.
 *
 * Usage: node tools/test-rz-pdf-export.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/* load the module the way a browser would */
const source = read('js/rz-pdf-export.js');
const sandbox = { window: {}, document: null };
sandbox.window.window = sandbox.window;
new Function('window', 'document', source)(sandbox.window, sandbox.document);
const API = sandbox.window.RZPdfExport;
assert.ok(API, 'js/rz-pdf-export.js must publish window.RZPdfExport');

/* ---- 1. the palette is the standard's palette --------------------------- */
const standard = read('standarization/PDF_EXPORT_STANDARD.md');
for (const [role, hex] of [
  ['Primary Text', '#1f2937'], ['Headings', '#1e3a5f'], ['Sub-headings', '#374151'],
  ['Secondary Text', '#6b7280'], ['Muted Text', '#94a3b8'],
  ['Table Header BG', '#f8fafc'], ['Table Border', '#e5e7eb'],
]) {
  assert.ok(standard.includes(hex), `PDF_EXPORT_STANDARD.md must still define ${role} as ${hex}`);
}
assert.equal(API.PALETTE.ink, '#1f2937', 'body ink is the standard primary text colour');
assert.equal(API.PALETTE.heading, '#1e3a5f');
assert.equal(API.PALETTE.muted, '#94a3b8');
assert.ok(Object.isFrozen(API.PALETTE), 'the palette is frozen — a caller may pick an accent, not a body colour');

/* ---- 2. the shell skeleton --------------------------------------------- */
const whole = API.buildDocument({
  title: 'Gate document', subtitle: 'shape check', accent: '#0ea5e9',
  generatedAt: '10 September 2026',
  meta: [['Basis', 'gate'], ['Scope', 'current']],
  sections: [{ id: 'a', label: 'A', html: '<p>alpha</p>' }, { id: 'b', label: 'B', html: '<p>beta</p>' }],
});
assert.ok(whole.startsWith('<!DOCTYPE html>'), 'a print document declares its doctype');
assert.match(whole, /<meta charset="UTF-8">/, 'charset before any content');
assert.match(whole, /@page\{margin:15mm\}/, 'the standard prescribes a 15 mm page margin');
assert.match(whole, /print-color-adjust:exact/, 'colour must survive the print pipeline');
assert.match(whole, /-webkit-print-color-adjust:exact/, 'and the webkit prefix the standard names');
assert.match(whole, /color:#1f2937/, 'body copy uses the primary ink');
assert.ok(!/body\{[^}]*color:#94a3b8/.test(whole) && !/body\{[^}]*color:#6b7280/.test(whole),
  'body copy may never be set to the muted greys — PDF_EXPORT_STANDARD.md marks that CRITICAL');
assert.match(whole, /resistancezero\.com &middot; Generated 10 September 2026 &middot; All calculations performed client-side/,
  'the footer is the line the standard prescribes');
assert.match(whole, /RESISTANCEZERO/, 'the header carries the brand block from the structure template');
assert.equal((whole.match(/class="rzp-section"/g) || []).length, 2, 'one wrapper per requested section');
assert.ok(!/Partial export/.test(whole), 'a whole export must not claim to be partial');

/* ---- 3. a partial export names what it dropped -------------------------- */
const part = API.buildDocument({
  title: 'Gate document', accent: '#0ea5e9', generatedAt: '10 September 2026',
  sections: [{ id: 'a', label: 'A', html: '<p>alpha</p>' }],
  omitted: [{ id: 'b', label: 'B — dropped' }, { id: 'c', label: 'C — dropped' }],
});
assert.equal((part.match(/class="rzp-section"/g) || []).length, 1, 'only the chosen section is rendered');
assert.match(part, /Partial export — 2 sections/, 'a partial export declares itself and counts what is missing');
assert.match(part, /B — dropped; C — dropped/, 'and names them, so the next reader is not misled');

/* ---- 4. the escape rule ------------------------------------------------- */
assert.equal(API.escapeScript('<script src="x"></script>'), '<script src="x"><\\/script>',
  'escapeScript closes the 2026-05-09 incident: </script> inside a JS string ends the PARENT block');
const hostile = API.buildDocument({
  title: 'x', accent: '#0ea5e9', generatedAt: 'd',
  sections: [{ id: 'a', label: 'A', html: '<p>a</p><script>alert(1)</script>' }],
});
assert.ok(!/<\/script/i.test(hostile), 'no document this module builds may contain an unescaped </script>');

/* ---- 5. adopters -------------------------------------------------------- */
const pages = readdirSync(ROOT).filter((n) => n.endsWith('.html'));
const adopters = [];
let barePrint = 0;
const bareList = [];
for (const page of pages) {
  const raw = read(page);
  /* v3.4.1 — SCAN CODE, NOT PROSE. This ran on the raw source and treated any page whose text
     contained "RZPdfExport" as an adopter, so `changelog.html` — which QUOTES the API in its
     release notes, inside <code> — was asserted against as if it shipped the feature. It slid past
     two assertions on quoted strings and failed the third, and it would have done so for every
     module this site ever documents. Documentation is stripped, and adoption is decided by an
     actual <script src> tag rather than by a mention anywhere in the file. */
  const text = raw.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ').replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, ' ');
  const usesStudio = text.includes('RZDesignStudio.register') || text.includes('RZPdfExport.adopt');
  const usesShell = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*rz-pdf-export\.js/i.test(text);
  if (usesShell) {
    adopters.push(page);
    assert.match(text, /js\/rz-pdf-export\.js/, `${page} uses RZPdfExport and must load the module`);
    assert.ok(usesStudio, `${page} builds documents with the shared shell and must issue them through the shared dialog`);
    assert.match(text, /css\/rz-design-studio\.css/, `${page} must load the dialog stylesheet it depends on`);
  }
  if (/onclick="window\.print\(\)"/.test(text) || /\bwindow\.print\(\)/.test(text)) {
    if (!usesShell) { barePrint += 1; bareList.push(page); }
  }
}
assert.ok(adopters.length >= 1, 'at least one page must issue through the shared shell');
/* adopt() is the sanctioned wiring, so it must itself go through the shared dialog */
assert.match(source, /RZDesignStudio\.register\(/, 'RZPdfExport.adopt() must register with the shared Design Studio dialog');
assert.match(source, /discoverSections\(/, 'adopt() must discover sections from the page rather than take a hand-kept list');

console.log('── SHARED PDF EXPORT ──');
console.log(`shell v${API.version}; adopters: ${adopters.join(', ')}`);
console.log(`MONITOR — ${barePrint} page(s) still print directly instead of issuing through the shell: `
  + bareList.slice(0, 6).join(', ') + (bareList.length > 6 ? ' …' : ''));
console.log('  flip condition: this becomes a gate when that count reaches 0.');
console.log('PASS — palette follows the standard, the skeleton is complete, a partial export names what it dropped, and no built document carries an unescaped closing script tag');
