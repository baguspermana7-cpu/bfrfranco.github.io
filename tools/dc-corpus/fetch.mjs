#!/usr/bin/env node
/* dc-corpus fetch — reads sources.yaml, fetches each PUBLIC url (rate-limited,
 * cached), converts to markdown via markitdown, writes raw/<slug>.md.
 * Raw stays gitignored (local cache); facts are extracted by extract.mjs.
 * Run: node tools/dc-corpus/fetch.mjs [--only slug] */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const RAW = join(DIR, 'raw');
mkdirSync(RAW, { recursive: true });
const MARKITDOWN = `${process.env.HOME}/.venvs/corpus/bin/markitdown`;

/* minimal YAML list-of-flow-maps parser (sources.yaml uses one shape only) */
function parseSources(txt) {
    return txt.split('\n').filter((l) => l.trim().startsWith('- {')).map((l) => {
        const get = (key) => {
            const m = l.match(new RegExp(key + ':\\s*(?:"([^"]*)"|([^,}]+))'));
            return m ? (m[1] ?? m[2]).trim() : '';
        };
        return { company: get('company'), segment: get('segment'), url: get('url'), kind: get('kind') };
    });
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const sources = parseSources(readFileSync(join(DIR, 'sources.yaml'), 'utf8'));
let ok = 0, fail = 0, cached = 0;

for (const src of sources) {
    const name = slug(src.company);
    if (only && name !== only) continue;
    const ext = src.ext ?? (src.url.split('?')[0].toLowerCase().endsWith('.pdf') ? 'pdf' : 'html');
    const htmlPath = join(RAW, `${name}.${ext}`);
    const mdPath = join(RAW, `${name}.md`);
    if (existsSync(mdPath)) { cached++; continue; }
    try {
        /* EA-2 (owner): markitdown-only storage — download size-capped 60MB, binary
         * DELETED after conversion; only the small .md survives on disk. */
        const curlArgs = ['-sL', '--max-time', '120', '--max-filesize', '62914560', '-A',
            'Mozilla/5.0 (compatible; rz-dc-corpus/1.0; research; +https://resistancezero.com; contact: resistancezero.com)'];
        if (src.insecure) curlArgs.push('-k');           // per-source: broken TLS chain (mis. BKPM)
        if (src.referer) curlArgs.push('-e', src.referer); // per-source: WAF butuh Referer (mis. YTL)
        execFileSync('curl', [...curlArgs, '-o', htmlPath, src.url], { timeout: 150000 });
        execFileSync(MARKITDOWN, [htmlPath, '-o', mdPath], { timeout: 180000 });
        try { unlinkSync(htmlPath); } catch { /* already gone */ }
        const size = readFileSync(mdPath, 'utf8').length;
        if (size < 500) throw new Error(`too small (${size}b — likely blocked/empty)`);
        /* provenance header for the extractor */
        const md = readFileSync(mdPath, 'utf8');
        writeFileSync(mdPath, `<!-- source_url: ${src.url} | company: ${src.company} | segment: ${src.segment} | kind: ${src.kind} | fetched: 2026-07-19 -->\n` + md);
        console.log(`  ok  ${name} (${(size / 1024).toFixed(0)}KB)`);
        ok++;
    } catch (e) {
        console.log(`  FAIL ${name}: ${String(e.message).slice(0, 80)}`);
        fail++;
    }
    /* rate limit: 2s between hosts */
    execFileSync('sleep', ['2']);
}
console.log(`\nFETCH: ${ok} fetched · ${cached} cached · ${fail} failed (of ${sources.length})`);
