/* Standards claims the hub tools once got wrong (v3.24.24). Each row was checked against a primary source before it
   became a rule; a page that prints the wrong form again fails here. Scans every tracked .html outside the journal
   (articles quote sources in their own date's context and are not tools).
   Run: node tools/test-standard-claims.mjs */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = [
    { id: 'ieee519-tdd-row', re: /TDD\)? at 5 % [^<]{0,80}100&ndash;1,000/, why: 'IEEE 519-2014 Table 2: 5 % TDD is the I_sc/I_L < 20 row; 100-1,000 is 15 %' },
    { id: 'nfpa2001-halocarbon-time', re: /30 s halocarbon/, why: 'NFPA 2001: halocarbon agents discharge within 10 s' },
    { id: 'ashrae-rh-40-60', re: /ASHRAE[^<'"]{0,30}recommended[^<'"]{0,12}40\s*(?:&ndash;|-|–)\s*60\s*%/, why: 'ASHRAE TC 9.9 recommended envelope is dew point -9 to 15 °C and <= 60 % RH since 2008/2015' },
    { id: 'tier-iv-plus', re: /Tier IV\+/, why: 'Uptime defines Tiers I-IV only' },
    { id: 'tier-iv-9999', re: /Tier IV[^<]{0,30}\(99\.99%\)|Tier IV[^<]{0,40}<td>99\.99%</, why: 'the legacy Tier IV estimate was 99.995 %, and no current Uptime standard assigns any' },
    { id: 'tier-standard-availability', re: /Uptime Institute Tier Standard<\/strong> classifies[^<]{0,80}99\.\d+% availability/, why: 'Uptime removed availability figures from the Tier Standard in 2009' },
    { id: 'hfc227-gwp-ar6', re: /3,220<\/td>[^\n]{0,60}AR6/, why: '3,220 is the IPCC AR4 GWP100 of HFC-227ea (the site basis); AR6 is a different value' },
];
const files = [];
(function walk(d) {
    for (const n of readdirSync(d)) {
        if (/^(node_modules|\.git|dcmoc|Article|Documents|standarization|tools)$/.test(n)) continue;
        const p = join(d, n), s = statSync(p);
        if (s.isDirectory()) walk(p);
        else if (n.endsWith('.html') && !/^(article-\d+|FF-\d+|geopolitics-\d+|changelog)\.html$/.test(n)) files.push(p);
    }
})(ROOT);
let fail = 0;
for (const f of files) {
    const h = readFileSync(f, 'utf8');
    for (const r of RULES) if (r.re.test(h)) { fail++; console.log(`  ✗ ${relative(ROOT, f)}: ${r.id} — ${r.why}`); }
}
console.log(fail ? `STANDARD CLAIMS — ${fail} finding(s) in ${files.length} pages` : `STANDARD CLAIMS — ${RULES.length} rules clean on ${files.length} pages`);
process.exit(fail ? 1 : 0);
