#!/usr/bin/env node
/**
 * A description that truncates mid-clause is a snippet nobody finished writing.
 *
 * WHY THIS GATE EXISTS
 *
 * Row 2 of the SEO ledger recorded 96 published descriptions running past the ~160-character
 * display cut, and recorded it as NOT fixable: trimming at a boundary discards the text after it,
 * and leaving it truncates mid-clause. Both of those are true, and both are the wrong move —
 * because there is a third option the row did not consider: rewrite the description so it FINISHES
 * inside the cut. Nothing authored is lost, because the sentence is composed to fit.
 *
 * Measured before this gate landed: 98 of the sitemap's pages ran over 160 characters, 45 of them
 * with no clause boundary anywhere in the first 160 — so a mechanical trim would have cut those
 * mid-phrase. Most of the overflow was a redundant lead-in ("Calculate X for your data center",
 * "... on ResistanceZero") rather than substance.
 *
 * WHAT IT ASSERTS, per page the sitemap publishes
 *
 *   M1  a description exists and is at least 50 characters — a stub is not a snippet
 *   M2  it is at most 160 characters, so a search engine shows the whole thing
 *   M3  it does not end on a dangling connector (a comma, semicolon, colon, dash) or a trailing
 *       function word — those are the signature of a sentence that was cut rather than written
 *
 * `sitemap.xml` is the population for the same reason test-page-metadata.mjs uses it: it is the
 * site's own definition of public, not a hand-kept list that can silently shrink.
 *
 * Usage: node tools/test-meta-description-fit.mjs [--json] [--list]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
const LIST = process.argv.includes('--list');

/* PENDING exists for pages a PARALLEL session has open in the working tree: editing a file another
   session is mid-change on means one of us silently reverts the other (see
   feedback_staging_by_name_swallows_parallel_work). Three pages were deferred that way when this
   gate landed in v3.11.10; that session pushed its sweep, so in v3.11.11 they were rewritten and
   the list is empty again — which is the only end state this mechanism accepts.

   The deferral EXPIRES BY ITSELF: a pending page that is already compliant is reported as a
   failure (M4) telling you to delete it from this list. So the list can only shrink, and it cannot
   quietly become the place descriptions go to avoid the rule. */
const PENDING = new Map([
    /* empty — add [page, reason] only for a file another session is actively changing */
]);

const MAX = 160;          /* the display cut this gate exists to fit inside */
const MIN = 50;
/* a description that ends in one of these was cut, not finished */
const DANGLING_PUNCT = /[,;:—-]$/;
const DANGLING_WORD = /\b(and|or|with|for|of|to|the|a|an|in|on|at|by|from|that|which|plus|including)$/i;

const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+\//, ''))
    .filter((p) => p && !p.endsWith('/'))
    .filter((p) => existsSync(join(ROOT, p)));

const findings = [];
const pending = [];
for (const page of pages) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    const head = html.includes('</head>') ? html.slice(0, html.indexOf('</head>')) : html;
    const m = head.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (!m) { findings.push({ page, rule: 'M1', detail: 'no meta description' }); continue; }
    /* compare what a crawler sees: entities resolved, whitespace collapsed */
    const text = m[1]
        .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ').trim();
    if (text.length < MIN) findings.push({ page, rule: 'M1', detail: `${text.length} chars — too thin to be a snippet` });
    if (text.length > MAX) {
        if (PENDING.has(page)) pending.push({ page, len: text.length, why: PENDING.get(page) });
        else findings.push({ page, rule: 'M2', detail: `${text.length} chars — ${text.length - MAX} past the ${MAX}-char cut; rewrite it to finish, do not trim it` });
    } else if (PENDING.has(page)) {
        findings.push({ page, rule: 'M4', detail: `now fits in ${text.length} chars — delete it from PENDING in this gate, the deferral has expired` });
    }
    const tail = text.replace(/[.!?]$/, '').trimEnd();
    if (DANGLING_PUNCT.test(tail) || DANGLING_WORD.test(tail)) {
        findings.push({ page, rule: 'M3', detail: `ends on a dangling connector: "...${text.slice(-42)}"` });
    }
}

if (JSON_OUT) { console.log(JSON.stringify({ gate: 'meta-description-fit', pages: pages.length, findings, pending }, null, 2)); }
else {
    console.log(`META DESCRIPTION FIT — ${pages.length} published page(s), max ${MAX} chars`);
    for (const p of pending) console.log(`  PENDING ${p.page} — ${p.len} chars (${p.why})`);
    if (findings.length === 0) {
        console.log(`\nPASS — every published description finishes inside the display cut`
            + (pending.length ? `, except ${pending.length} deferred by name above.` : '.'));
    }
    else {
        const byRule = findings.reduce((a, f) => { (a[f.rule] = a[f.rule] || []).push(f); return a; }, {});
        for (const rule of Object.keys(byRule).sort()) console.log(`  ${rule}: ${byRule[rule].length}`);
        if (LIST) for (const f of findings) console.log(`    ${f.rule} ${f.page} — ${f.detail}`);
        console.log(`\nFAIL — ${findings.length} finding(s) across ${new Set(findings.map((f) => f.page)).size} page(s).`);
        console.log('Rewrite the description so it FINISHES inside the cut; trimming at a boundary deletes authored text.');
    }
}
process.exit(findings.length ? 1 : 0);
