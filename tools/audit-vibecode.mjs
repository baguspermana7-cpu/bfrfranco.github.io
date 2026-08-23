#!/usr/bin/env node
/**
 * audit-vibecode.mjs — fail the build if the site drifts toward the generic "AI-generated" look.
 * Codified in standarization/ANTI_VIBECODE_STANDARD.md. Detects the hard-banned tells with
 * context-awareness; whitelists the deliberate RZ signature (aurora-mesh hero radial gradients,
 * IBM Plex/Fraunces/JetBrains fonts). Run: node tools/audit-vibecode.mjs --strict
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
// Scope = the PUBLISHED site (root pages, articles, calculators, css). Excludes sub-apps with their
// own design systems (Apps/*, dca-app, finance-terminal), scraped/generated artifacts (Automation/*,
// tools/dc-corpus/raw), and non-shipped dirs.
const SKIP = ["node_modules", ".git", "dcmoc", ".next", "games", "Dunia-Emosi", "obsidian-knowledge-vault",
  ".claude", "review", "Documents", "cf-worker", "result", "Article", "02.02.26",
  "Apps", "Automation", "dc-corpus", "my-video", "TestEA", "worktrees", "backups", ".qa-screens",
  // changelog.html is a GENERATED archive (build-changelog-html.py) that quotes historical site CSS +
  // tokens (`#8b5cf6`, old tier colors) as before/after illustration of the very purges it documents.
  // It is not a live-design surface; its real styling is governed by CHANGELOG.md + the generator, so
  // the ban is enforced there, not on the rendered archive. Excluded to avoid documentary false-positives.
  "changelog.html"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.some((s) => name === s || name.toLowerCase() === s.toLowerCase())) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if ([".html", ".css"].includes(extname(name))) out.push(p);
  }
  return out;
}

// each rule: {id, test(text, file) -> match string | null}
const RULES = [
  { id: "inter-primary-font",
    test: (t) => (/font-family:\s*['"]?(Inter|Geist|Space Grotesk)\b/i.test(t) || /family=(Inter|Geist|Space\+Grotesk)\b/.test(t))
      ? "Inter/Geist/Space-Grotesk as a PRIMARY font (use 'IBM Plex Sans')" : null },
  { id: "anthropic-purple",
    test: (t) => /#8b5cf6/i.test(t) ? "#8B5CF6 (rejected Anthropic-purple) — use a semantic token/mint" : null },
  { id: "emoji-ui-icon",
    // Decorative PICTOGRAPH emoji as UI icons/headings/badges (sign #5). Whitelisted (kept): 🔒/🔓 lock
    // (gated-feature affordance), ⚠ warn, ⚡ energy, ★☆⭐ rating, regional-indicator FLAGS (country data),
    // arrows/checks/math (typographic, handled by their own idioms). Everything else in the pictograph
    // ranges = slop → use a Font Awesome / thin-line icon instead. `u` flag is mandatory (surrogate pairs).
    test: (t) => {
      const WHITELIST = new Set(["🔒","🔓","⚠","⚡","★","☆","⭐","✅","✓","✔","✗","✘","❌","➜","🌐","⚑","☀","☽","☾","☼"]);
      const PICTO = /[\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1FAFF}\u{2600}-\u{26FF}\u{2728}]/gu;
      const FLAG = /[\u{1F1E6}-\u{1F1FF}]/u;   // regional-indicator halves → country flags (data, kept)
      let m;
      while ((m = PICTO.exec(t))) {
        const c = m[0];
        if (WHITELIST.has(c) || FLAG.test(c)) continue;
        return `decorative emoji ${c} as UI (use a Font Awesome / thin-line icon)`;
      }
      return null;
    } },
  { id: "sparkle-emoji",
    // NB: the char-class MUST carry the `u` flag — without it, 🪄 (a surrogate pair) decays to two
    // lone surrogates and the class matches the \uD83E high-surrogate shared by 🧪🧠🧬 etc. (false hits).
    test: (t) => /[✨🪄]/u.test(t) || /fa-(magic|wand-magic|sparkles?)/.test(t) ? "sparkle/wand icon (AI tell)" : null },
  { id: "dot-grid-bg",
    // real dot-grid background: radial-gradient(...) with background-size (tiled dots), not a comment
    test: (t) => {
      const noComments = t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
      return /radial-gradient\([^)]*\)\s*;?\s*background-size:\s*\d/i.test(noComments) &&
             /circle|closest-side/.test(noComments) ? "dot-grid tiled background" : null;
    } },
  { id: "lucide-icons",
    test: (t) => /lucide(-|\.|\/)/i.test(t) ? "Lucide icon library (use the site's Font Awesome idiom)" : null },
  { id: "glass-decoration",
    // Selector-aware: backdrop-blur on nav/modal/overlay/palette/sticky-header is standard FUNCTIONAL UI
    // (not slop). Only DECORATIVE surfaces (card/panel/tile/bento/hero/badge/chip/widget) count as
    // glassmorphism. Flag when ≥3 decorative surfaces carry blur.
    test: (t) => {
      const DECOR = /(card|panel|tile|bento|hero|badge|chip|widget|glass-(?!bg|blur))/i;
      const FUNC = /(nav|navbar|modal|overlay|gate|search|palette|ticker|dropdown|tooltip|sticky|header|drawer|sheet|toast|banner|menu)/i;
      // Resolve `backdrop-filter: var(--glass-blur)` indirection: if --glass-blur is DEFINED as a real
      // blur(...) anywhere in the file, substitute so token-glass can't hide from the blur( scan below.
      const def = t.match(/--glass-blur:\s*(blur\([^;]*\))/i);
      if (def) t = t.replace(/backdrop-filter:\s*var\(--glass-blur\)/gi, "backdrop-filter: " + def[1]);
      let decor = 0;
      const re = /([.#][^{}]{1,120}?)\{[^{}]*backdrop-filter:\s*[^;}]*blur\([^{}]*\}/gi;
      let m;
      while ((m = re.exec(t))) {
        const sel = m[1];
        if (DECOR.test(sel) && !FUNC.test(sel)) decor++;
      }
      return decor >= 3 ? `glassmorphism blur on ${decor} decorative surface(s)` : null;
    } },
];

const files = walk(ROOT);
const findings = [];
// Strip DOCUMENTATION prose before scanning: <code>/<pre> blocks (e.g. the public changelog quotes
// historical CSS like `<code>#8b5cf6</code>` while DESCRIBING the purge — documenting a tell is not
// committing it). Real usage lives in style="" / class="" / CSS rules, which survive this strip.
function stripDocProse(t) {
  return t.replace(/<code[\s\S]*?<\/code>/gi, "").replace(/<pre[\s\S]*?<\/pre>/gi, "");
}
// Decode NUMERIC HTML entities (&#128214; / &#x1F4D6;) so an emoji written as an entity is caught by the
// same char-based rules as a literal one — a book pill authored as `&#128214;` renders 📖 all the same.
function decodeEntities(t) {
  return t.replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return _; } })
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } });
}
for (const f of files) {
  let t; try { t = decodeEntities(stripDocProse(readFileSync(f, "utf8"))); } catch { continue; }
  for (const r of RULES) {
    const m = r.test(t, f);
    if (m) findings.push({ file: f.replace(ROOT + "/", ""), rule: r.id, msg: m });
  }
}

// REQUIRED pages (absence is itself a tell)
for (const req of ["terms.html", "privacy.html"]) {
  if (!existsSync(join(ROOT, req))) findings.push({ file: req, rule: "missing-legal", msg: `${req} missing (required)` });
}

const byRule = {};
for (const f of findings) (byRule[f.rule] ||= []).push(f.file);
console.log("── ANTI-VIBECODE AUDIT ──");
if (!findings.length) { console.log("CLEAN — no vibecode tells."); process.exit(0); }
for (const [rule, fs] of Object.entries(byRule)) {
  console.log(`  ✗ ${rule}: ${fs.length} file(s) — ${byRule[rule].slice(0, 4).join(", ")}${fs.length > 4 ? " …" : ""}`);
}
console.log(`── ${findings.length} finding(s) across ${new Set(findings.map((f) => f.file)).size} file(s). See standarization/ANTI_VIBECODE_STANDARD.md`);
process.exit(STRICT ? 1 : 0);
