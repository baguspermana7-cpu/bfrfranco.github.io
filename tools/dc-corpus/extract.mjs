#!/usr/bin/env node
/* dc-corpus extract — scans raw/*.md for DC metrics, emits STRUCTURED FACTS.
 * RULE (gate-enforced): every fact carries source_url + the verbatim quote it
 * was read from — a fact without provenance is rejected here, not later.
 * Output: dc-facts.json (committed). Run after fetch.mjs. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const RAW = join(DIR, 'raw');

/* metric patterns — conservative: number must sit near the metric term */
const PATTERNS = [
    { metric: 'pue', unit: 'ratio', re: /(?:PUE|power usage effectiveness)[^.\n]{0,60}?(\d\.\d{1,3})/gi, min: 1.0, max: 2.5 },
    { metric: 'pue', unit: 'ratio', re: /(\d\.\d{1,3})[^.\n]{0,40}?(?:PUE|power usage effectiveness)/gi, min: 1.0, max: 2.5 },
    { metric: 'wue', unit: 'L/kWh', re: /(?:WUE|water usage effectiveness)[^.\n]{0,60}?(\d+\.?\d*)\s*(?:L\/kWh|liters? per kilowatt)/gi, min: 0, max: 10 },
    { metric: 'renewable_share', unit: '%', re: /(\d{1,3})\s?%[^.\n]{0,60}?renewable/gi, min: 1, max: 100 },
    { metric: 'renewable_share', unit: '%', re: /renewable[^.\n]{0,60}?(\d{1,3})\s?%/gi, min: 1, max: 100 },
    { metric: 'capacity_mw', unit: 'MW', re: /(\d{2,4}(?:,\d{3})?)\s?(?:MW|megawatts?)(?!h)/gi, min: 10, max: 5000 },
    { metric: 'capex_per_mw', unit: '$M/MW', re: /\$\s?(\d{1,2}(?:\.\d)?)\s?(?:M|million)[^.\n]{0,30}?per\s?(?:MW|megawatt)/gi, min: 3, max: 30 },
];

const yearRe = /\b(20[12]\d)\b/;
const facts = [];
const seen = new Set();

for (const f of readdirSync(RAW).filter((x) => x.endsWith('.md'))) {
    const txt = readFileSync(join(RAW, f), 'utf8');
    const head = txt.slice(0, 400);
    const meta = {
        source_url: head.match(/source_url: (\S+)/)?.[1] ?? null,
        company: head.match(/company: ([^|]+)\|/)?.[1]?.trim() ?? f.replace('.md', ''),
        segment: head.match(/segment: ([^|]+)\|/)?.[1]?.trim() ?? 'unknown',
    };
    if (!meta.source_url) continue;                 // provenance mandatory

    for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        let m;
        while ((m = p.re.exec(txt)) !== null) {
            const value = parseFloat(m[1].replace(',', ''));
            if (!Number.isFinite(value) || value < p.min || value > p.max) continue;
            /* verbatim quote: the sentence-ish window around the match */
            const start = Math.max(0, m.index - 80);
            const quote = txt.slice(start, m.index + m[0].length + 80).replace(/\s+/g, ' ').trim();
            const year = quote.match(yearRe)?.[1] ? parseInt(quote.match(yearRe)[1]) : null;
            const key = `${meta.company}|${p.metric}|${value}|${year}`;
            if (seen.has(key)) continue;
            seen.add(key);
            facts.push({ metric: p.metric, value, unit: p.unit, company: meta.company, segment: meta.segment, year, source_url: meta.source_url, quote: quote.slice(0, 300) });
        }
    }
}

facts.sort((a, b) => a.metric.localeCompare(b.metric) || a.company.localeCompare(b.company) || a.value - b.value);
writeFileSync(join(DIR, 'dc-facts.json'), JSON.stringify({ generated: '2026-07-19', note: 'AUTO-EXTRACTED public-source facts — every fact carries source_url + verbatim quote (gate-enforced). Heuristic extraction; curation append-only.', count: facts.length, facts }, null, 1) + '\n');
const byMetric = {};
for (const x of facts) byMetric[x.metric] = (byMetric[x.metric] ?? 0) + 1;
console.log(`EXTRACT: ${facts.length} facts`, byMetric);
