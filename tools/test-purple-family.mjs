#!/usr/bin/env node
/**
 * The purple family, and the four places it is allowed to stay.
 *
 * WHY THIS GATE EXISTS
 *
 * standarization/ANTI_VIBECODE_STANDARD.md §A.3 bans the AI-default purple, and CLAUDE.md's
 * rejected-patterns list names `#8B5CF6` specifically. Both were enforced by grepping for that one
 * string, which is why the ban was broken continuously and invisibly:
 *
 *   - the same hue arrived as `#6d28d9`, `#7c3aed`, `#a855f7`, `#9333ea`, `#c084fc`, `#C3B0FA`,
 *     `#c4b5fd`, `#a5b4fc`, `#7B4FE0`, `#5b21b6`, `#4c1d95`, `#581c87`, `#e9d5ff`, `#f5f3ff`…
 *   - and as `rgb()` / `rgba()` triplets of every one of those;
 *   - inside .js files, which the string grep never opened;
 *   - as a var named `--prep-green` holding violet-800, and `--dark-purple` holding it honestly.
 *
 * A colour is not a string. This gate reads the HUE, so a regression cannot rename its way past it.
 *
 * WHAT COUNTS
 *
 * Any hex or rgb()/rgba() literal whose HSL hue lands in [238°, 310°] with enough saturation to be
 * seen as a colour, and enough lightness not to read as near-black. That band is violet through
 * magenta — the AI-default family and its neighbours — and it deliberately includes indigo-600
 * (`#4f46e5`, hue 243°), which is where the family hides when someone "moves away from purple".
 *
 * WHAT IS EXEMPT, AND WHY EACH ONE IS
 *
 * Four exemptions, each a case where the hue carries meaning that a different hue would destroy:
 *
 *   1. ISA-18.2 / EEMUA 191 ALARM STATES. Both standards reserve the magenta-violet band for
 *      shelved / suppressed / out-of-service / trouble, precisely so those states cannot be misread
 *      as an active alarm colour. An operator has seen this convention in every real alarm system;
 *      changing it here would make the cockpits disagree with the field.
 *   2. THE AURORA MESH. CLAUDE.md's canonical-patterns list specifies the hero mesh as
 *      "Mint + gold + violet + blue + pink". It is a named, approved, multi-hue wash.
 *   3. LITERAL SPECTRA. A red→orange→yellow→green→blue→violet ramp is a picture of light. Removing
 *      its violet end leaves a spectrum that is wrong about physics.
 *   4. SCIENTIFIC COLORMAPS. viridis starts at #440154. It is a perceptually-uniform sequence
 *      published as a whole; you may choose not to use it, but you may not edit its first stop.
 *
 * Everything else is a finding. There is no "it's just one chip" exemption, because that is exactly
 * how 681 occurrences accumulated across 127 files.
 *
 * Usage: node tools/test-purple-family.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Directories that are vendored, generated, archived or not part of the site's own surface. */
const SKIP_DIR = /^(Apps\/dca-app\/dist|dcmoc|games|Dunia-Emosi|Article|my-video|TestEA|Documents|cf-worker|obsidian-knowledge-vault|backups|worktrees|node_modules|standarization\/Audit result)\//;
const SKIP_FILE = /(\.min\.(css|js)|^changelog\.html$)/;

/* Each exemption names WHAT it protects, not merely which file to skip. A line matching one of
   these patterns is exempt; a file is never blanket-exempt. */
const EXEMPT = [
  { why: 'ISA-18.2 / EEMUA 191 reserve magenta-violet for shelved / suppressed / OOS / trouble',
    test: (line) => /shelved|suppress|out-of-service|oos|trouble|maint|bypass|--sec\b|\.sec\b/i.test(line) },
  { why: 'the aurora mesh hero, named in CLAUDE.md as mint + gold + violet + blue + pink',
    test: (line) => /aurora|floating-shape|mesh|radial-gradient\(/i.test(line) },
  { why: 'a literal spectrum — the violet end is what makes it a spectrum',
    test: (line, lines, i) => /spectrum|prism/i.test(lines.slice(Math.max(0, i - 8), i + 2).join('\n'))
      || /rgba\(255,\s*0,\s*0/.test(lines.slice(Math.max(0, i - 8), i + 1).join('\n')) },
  { why: 'a published perceptually-uniform colormap (viridis / magma / plasma)',
    test: (line) => /viridis|magma|plasma|inferno|#440154/i.test(line) },
];

function hue(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  const l = (mx + mn) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === R) h = ((G - B) / d) % 6;
  else if (mx === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h, s, l };
}

/* Dark AND muted is navy chrome, not the tell. `#2a2a4e` (s .30, l .24) is a border on a dark app
   shell and reads as slate-navy; `#2d1b69` (s .59, l .26) at the same lightness reads as violet,
   and does get flagged. The tell is SATURATION at depth, so the exclusion needs both terms. */
const isFamily = ({ h, s, l }) =>
  h >= 238 && h <= 310 && s > 0.12 && l > 0.16 && l < 0.97 && !(l < 0.30 && s < 0.45);

const files = execFileSync('git', ['ls-files', '*.html', '*.css', '*.js'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter((f) => !SKIP_DIR.test(f) && !SKIP_FILE.test(f.split('/').pop()) && !SKIP_FILE.test(f));

const LITERAL = /#[0-9a-fA-F]{6}\b|rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
const findings = [];
let exempted = 0;

for (const file of files) {
  let text;
  try { text = readFileSync(resolve(ROOT, file), 'utf8'); } catch { continue; }
  if (!/#[0-9a-fA-F]{6}|rgba?\(/.test(text)) continue;
  /* This gate's own prose names the colours it bans; so does a changelog entry, an HTML comment,
     or a code comment explaining a past fix. A colour inside a comment paints nothing — and block
     comments SPAN LINES, so they have to be blanked across the whole text before it is split, with
     the newlines kept so line numbers still point at the right place. */
  const blanked = text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = text.split('\n');
  blanked.split('\n').forEach((raw, i) => {
    const line = lines[i] || raw;
    const code = raw.replace(/(^|\s)\/\/\s.*$/, ' ');
    LITERAL.lastIndex = 0;
    let m;
    while ((m = LITERAL.exec(code))) {
      let r, g, b;
      if (m[0].startsWith('#')) {
        const h = m[0].slice(1);
        [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
      } else {
        [r, g, b] = [m[1], m[2], m[3]].map(Number);
      }
      if (!isFamily(hue(r, g, b))) continue;
      const excuse = EXEMPT.find((e) => e.test(line, lines, i));
      if (excuse) { exempted += 1; continue; }
      findings.push({ file, line: i + 1, value: m[0], text: line.trim().slice(0, 120) });
    }
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings, exempted, files: files.length }, null, 2));
} else {
  console.log('── PURPLE FAMILY ──');
  console.log(`${files.length} tracked source files; ${exempted} literal(s) exempt under a declared reason.`);
  for (const f of findings.slice(0, 40)) {
    console.log(`  ✗ ${f.file}:${f.line}  ${f.value}   ${f.text}`);
  }
  if (findings.length > 40) console.log(`  … and ${findings.length - 40} more`);
}

if (findings.length) {
  console.error(`\nFAIL — ${findings.length} literal(s) in the banned hue band [238°, 310°].`);
  console.error('A colour is not a string: renaming the hex does not move the hue. Either use a hue');
  console.error('from the site palette, or add an exemption to EXEMPT here that names why THIS hue');
  console.error('carries meaning no other hue can carry.');
  process.exit(1);
}
console.log('PASS — no unexplained purple-family colour in the site source.');
