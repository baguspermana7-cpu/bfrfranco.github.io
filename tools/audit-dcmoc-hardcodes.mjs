#!/usr/bin/env node
/**
 * audit-dcmoc-hardcodes.mjs — WARN-level "magic number" advisory scan (Workstream X).
 *
 * OWNER MANDATE: "jangan ada angka yang muncul tiba-tiba" — no economically-material
 * number should appear inside a formula without a documented basis (engine DATA field,
 * a sourced constant, a screening label, or a citing standard). This gate is a HEURISTIC
 * tripwire that flags numeric literals which LOOK like un-sourced magic numbers so a human
 * can confirm. It is ADVISORY: it prints WARN lines and ALWAYS exits 0 — it never blocks a
 * ship. The real provenance discipline lives in the DATA.sources gate + code review.
 *
 * ── What it flags ────────────────────────────────────────────────────────────
 * A numeric literal is flagged when ALL of these hold:
 *   • It has ≥ 3 significant digits (so 100, 1000, 12, 0.5, 8760-style round unit
 *     scalers are IGNORED — see UNIT_SCALERS / significant-digit test below).
 *   • It participates in ARITHMETIC on its line (adjacent to + - * / % or wrapped in
 *     Math.*(...)) — i.e. it is computed with, not merely a config/enum/id value.
 *   • The file is dcmoc render/model code (.ts/.tsx under src/), NOT a test/probe.
 *   • There is NO provenance keyword within ±3 lines: a comment (or same line) matching
 *     /screening|source|DATA\.|engine|SFG20|IEEE|ASHRAE|NFPA|benchmark/i.
 *
 * ── Honest about false positives (READ THIS) ─────────────────────────────────
 * This is a regex heuristic, NOT a type-aware analyzer. It WILL over-report:
 *   • Legitimate math/statistics constants (z-scores 1.2816, π-ish factors, 365.25
 *     days, 525960 min/yr, 8760 h/yr, 4046.86 m²/acre) — these are universal
 *     conversions, not "made-up" economics, but they trip the digit test.
 *   • Documented values whose comment sits > 3 lines away, or uses a synonym the
 *     keyword list doesn't cover (e.g. "EPA", "CBRE", "BNEF", "JLL", "Uptime",
 *     "IEA" appear in this codebase as sources but are intentionally NOT in the
 *     keyword set to keep the gate simple + auditable — such lines will WARN).
 *   • Band edges / thresholds (0.70, 0.85) written as decimals with 2 sig-figs are
 *     ignored, but 3-figure ones (0.999) will warn.
 * It also UNDER-reports: a magic number split across variables, or one on a line
 * whose arithmetic operator is on the next line, can slip through.
 * Treat every WARN as "look here", not "this is wrong". Zero WARN is NOT required.
 *
 * Run: node tools/audit-dcmoc-hardcodes.mjs     (always exit 0)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const SRC = join(REPO, 'dcmoc', 'src');

const PROV_RE = /screening|source|DATA\.|engine|SFG20|IEEE|ASHRAE|NFPA|benchmark/i;
/** Round unit scalers that are never "magic" — ignore even if 3+ digits. */
const UNIT_SCALERS = new Set([
    '100', '1000', '10000', '100000', '1000000', '1e3', '1e6', '1e9',
    '1024', '360', '3600', '8760', '525600', '1440',
]);

/** True when a numeric token carries ≥ 3 significant digits. */
function threeSigDigits(tok) {
    // strip sign, underscores (1_000), exponent, decimal point → count significant digits
    const cleaned = tok.replace(/_/g, '').replace(/^[-+]/, '');
    if (/[eE]/.test(cleaned)) return false;           // 1e6 etc. handled as scalers
    const digits = cleaned.replace(/\./g, '').replace(/^0+/, '').replace(/0+$/, m => (cleaned.includes('.') ? '' : m));
    // significant = leading zeros stripped; trailing zeros in an integer are NOT significant
    const sig = cleaned.includes('.')
        ? cleaned.replace('.', '').replace(/^0+/, '').length
        : cleaned.replace(/^0+/, '').replace(/0+$/, '').length;
    return sig >= 3;
}

/** Is this literal adjacent to an arithmetic operator on its line, or inside Math.*()? */
function inArithmetic(line, idx, tok) {
    const before = line.slice(0, idx);
    const after = line.slice(idx + tok.length);
    if (/[-+*/%]\s*$/.test(before) || /^\s*[-+*/%]/.test(after)) return true;
    // Math.pow/exp/max/min/round(... , NNN ...) — literal used as a math arg
    if (/Math\.\w+\([^)]*$/.test(before)) return true;
    return false;
}

function walk(dir, out) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
            if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
            walk(p, out);
        } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec|d)\.tsx?$/.test(name)) {
            out.push(p);
        }
    }
    return out;
}

const files = walk(SRC, []);
const NUM_RE = /(?<![\w.$])[-+]?\d[\d_]*(?:\.\d+)?/g;
const warnings = [];

for (const file of files) {
    const rel = relative(REPO, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip pure comment / import / type-only lines quickly.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) continue;

        // Provenance window: this line ± 3 lines.
        let hasProv = false;
        for (let k = Math.max(0, i - 3); k <= Math.min(lines.length - 1, i + 3); k++) {
            if (PROV_RE.test(lines[k])) { hasProv = true; break; }
        }
        if (hasProv) continue;

        let m;
        NUM_RE.lastIndex = 0;
        while ((m = NUM_RE.exec(line)) !== null) {
            const tok = m[0];
            const bare = tok.replace(/^[-+]/, '');
            if (UNIT_SCALERS.has(bare)) continue;
            if (!threeSigDigits(tok)) continue;
            if (!inArithmetic(line, m.index, tok)) continue;
            // Ignore obvious array indices / px in template strings handled by arithmetic test already.
            warnings.push(`${rel}:${i + 1} · ${tok} · ${trimmed.slice(0, 100)}`);
        }
    }
}

console.log(`audit-dcmoc-hardcodes (WARN-only, advisory) — scanned ${files.length} .ts/.tsx files under dcmoc/src`);
console.log(`Heuristic: numeric literal ≥3 sig-digits, in arithmetic, WITHOUT a provenance keyword (${PROV_RE.source}) within ±3 lines.`);
console.log(`Expect false positives (math/unit constants, non-keyword sources like EPA/CBRE/BNEF). Treat each as "look here".`);
console.log(`\n${warnings.length} WARN finding(s):\n`);
for (const w of warnings) console.log(`WARN ${w}`);

// ALWAYS advisory — never blocks a ship.
process.exit(0);
